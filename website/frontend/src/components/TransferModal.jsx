import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ethers } from "ethers";
import * as snarkjs from "snarkjs";
import { buildPoseidon } from "circomlibjs";
import { useWallet } from "../context/WalletContext";
import { usePool } from "../context/PoolContext";
import { createCommitment } from "../helpers/commitments";
import { encryptMessage } from "../helpers/crypto";
import { BASE_URL } from "../services/api";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_INPUTS      = 4;
const FEE_PER_CALL    = ethers.parseEther("0.5");
const FEE_RETRY_EXTRA = ethers.parseEther("0.1"); // +0.1/call on retry → 0.4/call
const ZERO_HASH       = ethers.ZeroHash;
const ZERO_BIG        = BigInt(0);

// ─── Poseidon singleton ───────────────────────────────────────────────────────
let _poseidon = null;
async function getPoseidon() {
  if (!_poseidon) _poseidon = await buildPoseidon();
  return _poseidon;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toBytes32(value) {
  return ethers.zeroPadValue(ethers.toBeHex(BigInt(value)), 32);
}

function randomR() {
  return ethers.toBigInt(ethers.randomBytes(31)).toString();
}

function feePerCall(isRetry = false) {
  return isRetry ? FEE_PER_CALL + FEE_RETRY_EXTRA : FEE_PER_CALL;
}

/**
 * Core planner — no errors thrown, pure return null on failure.
 *
 * How it works:
 *   Each TransferCall pays its OWN fee from its OWN inputs.
 *   Invariant per call: inputs = receiverAmt + changeAmt + feeAmt  ✓
 *   This means no call can ever be "under-funded for its fee" because
 *   we only assign UTXOs whose total already exceeds the fee.
 *
 * The chicken-and-egg (fee depends on #calls, #calls depends on #UTXOs)
 * is resolved by iterating N upward until stable.
 */
function planTransfer(unspent, transferAmt, isRetry = false) {
  if (!unspent || !unspent.length || transferAmt <= ZERO_BIG) return null;

  const fee    = feePerCall(isRetry);
  const sorted = [...unspent].sort((a, b) => {
    const diff = BigInt(b.amount) - BigInt(a.amount);
    return diff > 0n ? 1 : diff < 0n ? -1 : 0;
  });

  let N = 1;
  for (let iter = 0; iter < 20; iter++) {
    const totalNeeded = transferAmt + fee * BigInt(N);

    // Greedily pick minimum UTXOs to cover totalNeeded
    const selected = [];
    let acc = ZERO_BIG;
    for (const u of sorted) {
      if (acc >= totalNeeded) break;
      selected.push(u);
      acc += BigInt(u.amount);
    }

    if (acc < totalNeeded) return null; // genuinely insufficient

    const callsNeeded = Math.ceil(selected.length / MAX_INPUTS);

    if (callsNeeded <= N) {
      // Stable — split into per-call plans
      return buildPlans(selected, transferAmt, fee, N);
    }

    N = callsNeeded; // need more calls → more fee → possibly more UTXOs
  }

  return null;
}

/**
 * Split UTXOs into batches and build per-call plans.
 * Each call independently satisfies: batchTotal = receiverAmt + changeAmt + feeAmt
 *
 * Receiver amount is distributed greedily across calls.
 * Change is whatever's left in each call after receiver + fee.
 *
 * Because planTransfer already guarantees total inputs ≥ transferAmt + N×fee,
 * we are mathematically guaranteed that:
 *   - availableForReceiver (= batchTotal − fee) ≥ 0 for every batch
 *   - receiverRemaining reaches 0 by the last batch
 */
function buildPlans(selectedUTXOs, transferAmt, fee, N) {
  const flat    = [...selectedUTXOs];
  const batches = [];
  while (flat.length > 0) batches.push(flat.splice(0, MAX_INPUTS));

  const plans = [];
  let receiverRemaining = transferAmt;

  for (const batch of batches) {
    const batchTotal          = batch.reduce((s, u) => s + BigInt(u.amount), ZERO_BIG);
    const availableForReceiver = batchTotal - fee; // always ≥ 0 (proven above)

    const toReceiver = receiverRemaining <= availableForReceiver
      ? receiverRemaining
      : availableForReceiver;

    const changeAmt = batchTotal - fee - toReceiver; // always ≥ 0

    receiverRemaining -= toReceiver;

    plans.push({
      inputs:      batch,
      receiverAmt: toReceiver,
      changeAmt,
      feeAmt:      fee,
    });
  }

  if (receiverRemaining > ZERO_BIG) return null; // should never happen

  return {
    plans,
    numCalls: batches.length,
    totalFee: fee * BigInt(batches.length),
  };
}

// ─── Build a single TransferCall + ZK proof ───────────────────────────────────
async function buildTransferCall(
  inputs,
  receiverAmt,
  changeAmt,
  feeAmt,
  receiver,
  sender,
  relayer,
  getMerkleProof
) {
  const poseidon = await getPoseidon();

  const padded = [...inputs];
  while (padded.length < MAX_INPUTS) padded.push(null);

  const enabled           = [];
  const c_ins             = [];
  const a_ins             = [];
  const r_ins             = [];
  const roots             = [];
  const pathElements      = [];
  const pathIndices       = [];
  const nullifiers        = [];
  const poolIds           = [];
  const rootsBytes32      = [];
  const nullifiersBytes32 = [];

  for (const utxo of padded) {
    if (!utxo) {
      enabled.push(0);
      c_ins.push("0");
      a_ins.push("0");
      r_ins.push("0");
      roots.push("0");
      pathElements.push(Array(20).fill("0"));
      pathIndices.push(Array(20).fill(0));
      nullifiers.push("0");
      poolIds.push(0);
      rootsBytes32.push(ethers.ZeroHash);
      nullifiersBytes32.push(ethers.ZeroHash);
      continue;
    }

    enabled.push(1);
    const merkleProof = getMerkleProof(utxo.poolId, utxo.leafIndex);
    if (!merkleProof)
      throw new Error(`No Merkle proof for leaf ${utxo.leafIndex} in pool ${utxo.poolId}`);

    const rootBig   = merkleProof.root.toString();
    const nullifier = poseidon.F.toString(
      poseidon([2, BigInt(utxo.commitment), BigInt(utxo.randomness), BigInt(sender.zk.secretKey)])
    );

    c_ins.push(BigInt(utxo.commitment).toString());
    a_ins.push(utxo.amount);
    r_ins.push(utxo.randomness);
    roots.push(rootBig);
    pathElements.push(merkleProof.siblings.map((s) => s[0].toString()));
    pathIndices.push(merkleProof.pathIndices);
    nullifiers.push(nullifier);
    poolIds.push(typeof utxo.poolId === "number" ? utxo.poolId : parseInt(utxo.poolId) || 0);
    rootsBytes32.push(toBytes32(rootBig));
    nullifiersBytes32.push(toBytes32(nullifier));
  }

  const rReceiver = randomR();
  const rChange   = randomR();
  const rRelayer  = randomR();

  const receiverEnabled = receiverAmt > ZERO_BIG ? 1 : 0;
  const changeEnabled   = changeAmt   > ZERO_BIG ? 1 : 0;
  const relayerEnabled  = feeAmt      > ZERO_BIG ? 1 : 0;

  const receiverCommitment = await createCommitment(receiverAmt.toString(), rReceiver, receiver.zkPublicKey);
  const changeCommitment   = await createCommitment(changeAmt.toString(),   rChange,   sender.zk.publicKey);
  const relayerCommitment  = await createCommitment(feeAmt.toString(),      rRelayer,  relayer.zkPublicKey);

  const encryptedNote1 = encryptMessage(
    JSON.stringify({ amount: receiverAmt.toString(), randomness: rReceiver }),
    receiver.privateWalletPublicKey
  );
  const encryptedNote2 = encryptMessage(
    JSON.stringify({ amount: changeAmt.toString(), randomness: rChange }),
    sender.privateWallet.publicKey
  );
  const encryptedNote3 = encryptMessage(
    JSON.stringify({ amount: feeAmt.toString(), randomness: rRelayer }),
    relayer.publicKey
  );

  const circuitInput = {
    sk:      sender.zk.secretKey,
    pk:      sender.zk.publicKey,
    relayer: relayer.zkPublicKey,
    enabled,
    c_ins, a_ins, r_ins, roots, pathElements, pathIndices, nullifiers,
    output_enabled: [receiverEnabled, changeEnabled, relayerEnabled],
    c_outs: [
      receiverEnabled ? receiverCommitment.decimal : "0",
      changeEnabled   ? changeCommitment.decimal   : "0",
      relayerEnabled  ? relayerCommitment.decimal  : "0",
    ],
    a_outs:    [receiverAmt.toString(), changeAmt.toString(), feeAmt.toString()],
    r_outs:    [rReceiver, rChange, rRelayer],
    receivers: [receiver.zkPublicKey, sender.zk.publicKey, relayer.zkPublicKey],
  };

  const { proof: zkProof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInput,
    "/zk/transfer_proof.wasm",
    "/zk/transfer_final.zkey"
  );
  console.log("public signals frontend:", publicSignals);

  const calldata = await snarkjs.groth16.exportSolidityCallData(zkProof, publicSignals);
  const argv     = calldata.replace(/["[\]\s]/g, "").split(",");

  return {
    transferCall: {
      a: [argv[0], argv[1]],
      b: [[argv[2], argv[3]], [argv[4], argv[5]]],
      c: [argv[6], argv[7]],
      enabled,
      roots:      rootsBytes32,
      poolIds,
      nullifiers: nullifiersBytes32,
      C1: receiverEnabled ? receiverCommitment.bytes32 : ZERO_HASH,
      C2: changeEnabled   ? changeCommitment.bytes32   : ZERO_HASH,
      C3: relayerEnabled  ? relayerCommitment.bytes32  : ZERO_HASH,
      encryptedNote1,
      encryptedNote2,
      encryptedNote3,
    },
    zkProof,
  };
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  const steps = ["relayer", "building", "proving", "sending", "done"];
  const idx   = steps.indexOf(current);
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
            i < idx   ? "bg-prifi-600" :
            i === idx ? "bg-prifi-400 animate-pulse" :
                        "bg-noir-600"
          }`} />
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px transition-all duration-500 ${i < idx ? "bg-prifi-600" : "bg-noir-700"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── User selector ────────────────────────────────────────────────────────────
function UserSelector({ allUsers, selected, onSelect, currentAddress }) {
  const [query, setQuery] = useState("");
  const filtered = allUsers.filter(
    (u) =>
      u.realAddress?.toLowerCase() !== currentAddress?.toLowerCase() &&
      (u.name?.toLowerCase().includes(query.toLowerCase()) ||
       u.realAddress?.toLowerCase().includes(query.toLowerCase()))
  );
  return (
    <div className="space-y-2">
      <label className="font-display text-xs text-white/60 uppercase tracking-widest block">Recipient</label>
      <input
        type="text"
        placeholder="Search by name or address…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-noir-800 border border-noir-600 focus:border-prifi-600 outline-none px-3 py-2 font-display text-xs text-white placeholder-white/20 transition-colors"
      />
      <div className="max-h-40 overflow-y-auto space-y-1">
        {filtered.length === 0 && (
          <p className="text-white/40 text-xs font-body px-1 py-2">No users found.</p>
        )}
        {filtered.map((u) => (
          <button
            key={u._id || u.realAddress}
            onClick={() => onSelect(u)}
            className={`w-full flex items-center justify-between px-3 py-2.5 border transition-colors ${
              selected?.realAddress === u.realAddress
                ? "border-prifi-600/60 bg-prifi-600/10 text-prifi-400"
                : "border-noir-700 hover:border-prifi-600/40 bg-noir-800 text-white/60 hover:text-white"
            }`}
          >
            <div className="text-left">
              <p className="font-display text-xs">{u.name}</p>
              <p className="font-display text-xs text-white/40 mt-0.5">
                {u.realAddress?.slice(0, 10)}…{u.realAddress?.slice(-6)}
              </p>
            </div>
            {selected?.realAddress === u.realAddress && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Fee breakdown ────────────────────────────────────────────────────────────
function FeeBreakdown({ parsedAmt, feeResult, totalAvailable, isRetry }) {
  if (!feeResult || parsedAmt <= ZERO_BIG) return null;

  const { numCalls, totalFee } = feeResult;
  const totalNeeded  = parsedAmt + totalFee;
  const insufficient = totalAvailable < totalNeeded;
  const perCallLabel = isRetry ? "0.4" : "0.3";

  return (
    <div className="border border-noir-700 bg-noir-800/40 divide-y divide-noir-700">
      <div className="flex justify-between px-4 py-2.5">
        <span className="font-display text-xs text-white/60">Send</span>
        <span className="font-display text-xs text-white">{ethers.formatEther(parsedAmt)} MON</span>
      </div>

      <div className="flex justify-between items-start px-4 py-2.5">
        <div>
          <span className="font-display text-xs text-white/60 block">Relayer fee</span>
          <span className="font-display text-xs text-white/30 block mt-0.5">
            {numCalls} call{numCalls > 1 ? "s" : ""} × {perCallLabel} MON
            {isRetry && <span className="text-amber-400/70"> (retry)</span>}
          </span>
        </div>
        <span className="font-display text-xs text-white/60">− {ethers.formatEther(totalFee)} MON</span>
      </div>

      <div className="flex justify-between px-4 py-2.5">
        <span className="font-display text-xs text-white/60">Total deducted</span>
        <span className={`font-display text-xs ${insufficient ? "text-crimson-400" : "text-white"}`}>
          {ethers.formatEther(totalNeeded)} MON
        </span>
      </div>

      {!insufficient && (
        <div className="flex justify-between px-4 py-2.5">
          <span className="font-display text-xs text-prifi-400">Receiver gets</span>
          <span className="font-display text-xs text-prifi-400">{ethers.formatEther(parsedAmt)} MON</span>
        </div>
      )}

      {insufficient && (
        <div className="px-4 py-3 bg-crimson-400/5">
          <p className="font-display text-xs text-crimson-400 mb-1">Insufficient balance</p>
          <p className="font-body text-xs text-white/50 leading-relaxed">
            Fee is{" "}
            <span className="text-crimson-400">{ethers.formatEther(totalFee)} MON</span>
            {" "}for {numCalls} transfer call{numCalls > 1 ? "s" : ""}.
            Decrease the amount or deposit more funds.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TransferModal({ onClose }) {
  const { walletKeys, address, allUsers } = useWallet();
  const { allUnspentUTXOs, getMerkleProof, fetchLatest } = usePool();

  const [selectedUser, setSelectedUser]           = useState(null);
  const [amountEth, setAmountEth]                 = useState("");
  const [step, setStep]                           = useState("idle");
  const [stepLabel, setStepLabel]                 = useState("");
  const [txHash, setTxHash]                       = useState(null);
  const [errorMsg, setErrorMsg]                   = useState(null);
  const [isRelayerFeeError, setIsRelayerFeeError] = useState(false);
  const [provenCount, setProvenCount]             = useState(0);
  const [totalProofs, setTotalProofs]             = useState(0);
  const [isRetry, setIsRetry]                     = useState(false);

  const parsedAmt = useMemo(() => {
    try { return ethers.parseEther(amountEth || "0"); } catch { return ZERO_BIG; }
  }, [amountEth]);

  const totalAvailable = useMemo(
    () => allUnspentUTXOs.reduce((s, u) => s + BigInt(u.amount), ZERO_BIG),
    [allUnspentUTXOs]
  );

  // Live fee estimate as the user types
  const feeResult = useMemo(
    () => parsedAmt > ZERO_BIG ? planTransfer(allUnspentUTXOs, parsedAmt, isRetry) : null,
    [parsedAmt, allUnspentUTXOs, isRetry]
  );

  // Retry fee preview (for error screen)
  const retryFeeResult = useMemo(
    () => parsedAmt > ZERO_BIG ? planTransfer(allUnspentUTXOs, parsedAmt, true) : null,
    [parsedAmt, allUnspentUTXOs]
  );

  // True maximum the user can send — binary-search for the largest amount planTransfer accepts
  const maxTransferable = useMemo(() => {
    if (totalAvailable <= ZERO_BIG) return ZERO_BIG;
    // Estimate: start with totalAvailable minus conservative fee, then verify with planner
    const estCalls = Math.max(1, Math.ceil(allUnspentUTXOs.length / MAX_INPUTS));
    const estFee   = feePerCall(isRetry) * BigInt(estCalls);
    let lo = ZERO_BIG;
    let hi = totalAvailable > estFee ? totalAvailable - estFee : ZERO_BIG;
    if (hi <= ZERO_BIG) return ZERO_BIG;
    // Binary search — 50 iterations gives wei-level precision
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi + 1n) / 2n;
      const ok  = planTransfer(allUnspentUTXOs, mid, isRetry) !== null;
      if (ok) lo = mid; else hi = mid - 1n;
    }
    return lo;
  }, [totalAvailable, allUnspentUTXOs, isRetry]);

  const totalNeeded = feeResult ? parsedAmt + feeResult.totalFee : parsedAmt;
  const isValid     = selectedUser && parsedAmt > ZERO_BIG && !!feeResult && totalAvailable >= totalNeeded;
  const isRunning   = !["idle", "done", "error"].includes(step);

  const runTransfer = useCallback(async (retry) => {
    setErrorMsg(null);
    setTxHash(null);
    setProvenCount(0);
    setTotalProofs(0);
    setIsRelayerFeeError(false);

    try {
      // 1. Relayer
      setStep("relayer");
      setStepLabel("Fetching relayer keys…");
      const relRes = await fetch(`${BASE_URL}/relayer/get`);
      if (!relRes.ok) throw new Error("Could not fetch relayer info");
      const relayer = await relRes.json();

      // 2. Plan — same deterministic function used for UI preview
      setStep("building");
      setStepLabel("Selecting inputs…");
      const plan = planTransfer(allUnspentUTXOs, parsedAmt, retry);
      if (!plan) {
        throw new Error(`Insufficient balance. Have ${ethers.formatEther(totalAvailable)} MON.`);
      }

      const { plans } = plan;
      setTotalProofs(plans.length);
      setStepLabel(`Planned ${plans.length} call(s). Building proofs…`);

      // 3. Prove
      setStep("proving");
      const transferCalls = [];
      const zkProofs      = [];

      for (let i = 0; i < plans.length; i++) {
        const p = plans[i];
        setStepLabel(`Generating ZK proof ${i + 1} of ${plans.length}…`);

        const { transferCall, zkProof } = await buildTransferCall(
          p.inputs,
          p.receiverAmt,
          p.changeAmt,
          p.feeAmt,
          {
            zkPublicKey:            selectedUser.zkPublicKey,
            privateWalletPublicKey: selectedUser.privateWalletPublicKey,
          },
          walletKeys,
          relayer,
          getMerkleProof
        );

        transferCalls.push(transferCall);
        zkProofs.push(zkProof);
        setProvenCount(i + 1);
      }

      // 4. Submit
      setStep("sending");
      setStepLabel("Sending to relayer…");
      const res    = await fetch(`${BASE_URL}/transfer/transfer`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ transferCalls, zkProofs }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.message === "Relayer fee insufficient") {
          const err = new Error("Relayer fee insufficient");
          err.isRelayerFeeError = true;
          throw err;
        }
        throw new Error(data.message || "Transfer failed on-chain");
      }

      setTxHash(data.txHash);
      await fetchLatest();
      setStep("done");

    } catch (err) {
      console.error("[TransferModal]", err);
      setStep("error");
      setErrorMsg(err?.reason || err?.message || "Transfer failed");
      if (err.isRelayerFeeError) setIsRelayerFeeError(true);
    }
  }, [parsedAmt, selectedUser, walletKeys, allUnspentUTXOs, getMerkleProof, fetchLatest, totalAvailable]);

  const handleTransfer = useCallback(() => runTransfer(isRetry), [runTransfer, isRetry]);

  const handleRetry = useCallback(() => {
    setIsRetry(true);
    setStep("idle");
    setErrorMsg(null);
    setIsRelayerFeeError(false);

    const r = planTransfer(allUnspentUTXOs, parsedAmt, true);
    if (!r) return; // balance still insufficient — show in idle

    setTimeout(() => runTransfer(true), 50);
  }, [allUnspentUTXOs, parsedAmt, runTransfer]);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape" && !isRunning) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, isRunning]);

  const retryInsufficient = retryFeeResult
    ? totalAvailable < parsedAmt + retryFeeResult.totalFee
    : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-noir-950/80 animate-fade-in">
      <div className="relative w-full max-w-md mx-4 bg-noir-900 border border-noir-600 glow-border animate-slide-up max-h-[90vh] flex flex-col">
        <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-prifi-600 pointer-events-none" />
        <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-prifi-600 pointer-events-none" />
        <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-prifi-600 pointer-events-none" />
        <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-prifi-600 pointer-events-none" />

        {/* Header */}
        <div className="p-6 border-b border-noir-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-prifi-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
            <div>
              <p className="font-display text-xs text-prifi-600 tracking-widest uppercase">Action</p>
              <h3 className="font-display text-lg text-white">Private Transfer</h3>
            </div>
          </div>
          <button onClick={onClose} disabled={isRunning}
            className="text-white/60 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {isRunning && <StepIndicator current={step} />}

          {/* ── Idle ── */}
          {step === "idle" && (
            <>
              <div className="flex justify-between items-center">
                <span className="font-display text-xs text-white/40 uppercase tracking-widest">Available</span>
                <span className="font-display text-xs text-prifi-400">{ethers.formatEther(totalAvailable)} MON</span>
              </div>

              {isRetry && (
                <div className="flex items-start gap-3 p-3 border border-amber-400/30 bg-amber-400/5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" className="mt-0.5 flex-shrink-0">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <p className="font-body text-xs text-amber-400/80 leading-relaxed">
                    Retry mode — fee increased to 0.4 MON per call.
                  </p>
                </div>
              )}

              <UserSelector
                allUsers={allUsers}
                selected={selectedUser}
                onSelect={setSelectedUser}
                currentAddress={address}
              />

              <div>
                <label className="font-display text-xs text-white/60 uppercase tracking-widest block mb-2">
                  Amount (MON)
                </label>
                <div className="relative">
                  <input
                    type="number" min="0" step="0.01"
                    value={amountEth}
                    onChange={(e) => {
                      try {
                        const raw     = e.target.value;
                        const entered = ethers.parseEther(raw || "0");
                        // Clamp to maxTransferable — never let the user exceed it
                        if (entered > maxTransferable) {
                          setAmountEth(ethers.formatEther(maxTransferable));
                        } else {
                          setAmountEth(raw);
                        }
                      } catch {
                        setAmountEth(e.target.value);
                      }
                    }}
                    placeholder="0.00"
                    className="w-full bg-noir-800 border border-noir-600 focus:border-prifi-600 outline-none px-4 py-3 font-display text-white text-lg placeholder-white/20 transition-colors"
                  />
                  <button
                    onClick={() => setAmountEth(ethers.formatEther(maxTransferable))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 font-display text-xs text-prifi-600 hover:text-prifi-400 border border-prifi-600/40 px-2 py-0.5"
                  >
                    MAX
                  </button>
                </div>
                {maxTransferable > ZERO_BIG && (
                  <p className="font-display text-xs text-amber-400/80 mt-1.5">
                    Max transferable: {ethers.formatEther(maxTransferable)} MON
                  </p>
                )}
              </div>

              <FeeBreakdown
                parsedAmt={parsedAmt}
                feeResult={feeResult}
                totalAvailable={totalAvailable}
                isRetry={isRetry}
              />

              <div className="flex items-start gap-3 p-3 border border-prifi-600/20 bg-prifi-600/5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4dffc8" strokeWidth="1.5" className="mt-0.5 flex-shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="font-body text-xs text-white/60 leading-relaxed">
                  Shielded end-to-end. Only the recipient can decrypt their note. Submitted by the relayer — your identity is never linked to this transfer.
                </p>
              </div>
            </>
          )}

          {/* ── Running ── */}
          {isRunning && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-2 border-prifi-600/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-prifi-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="font-display text-sm text-white text-center">{stepLabel}</p>
              {step === "proving" && (
                <>
                  <p className="font-body text-xs text-white/40 text-center">
                    ZK proof generation runs in your browser — please wait.
                  </p>
                  {totalProofs > 1 && (
                    <div className="flex items-center gap-2 border border-noir-700 bg-noir-800 px-4 py-2">
                      <span className="font-display text-xs text-prifi-600">{provenCount}/{totalProofs}</span>
                      <span className="font-display text-xs text-white/40">proofs generated</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Done ── */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-12 h-12 border border-prifi-600/40 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4dffc8" strokeWidth="1.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="font-display text-sm text-prifi-400 tracking-widest uppercase mb-1">Transfer Confirmed</p>
                <p className="font-body text-xs text-white/60">
                  {ethers.formatEther(parsedAmt)} MON sent privately to{" "}
                  <span className="text-prifi-400">{selectedUser?.name}</span>.
                </p>
              </div>
              {txHash && (
                <a
                  href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                  target="_blank" rel="noreferrer"
                  className="font-display text-xs text-prifi-600 hover:text-prifi-400 underline underline-offset-2 transition-colors"
                >
                  View on Explorer ↗
                </a>
              )}
            </div>
          )}

          {/* ── Error ── */}
          {step === "error" && (
            <div className="space-y-4">
              <div className="border border-crimson-400/40 bg-crimson-400/5 p-4">
                <p className="font-display text-xs text-crimson-400 uppercase tracking-widest mb-1">Transfer Failed</p>
                <p className="font-body text-xs text-white/60 break-words">{errorMsg}</p>
              </div>

              {isRelayerFeeError && (
                <div className="border border-amber-400/30 bg-amber-400/5 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" className="mt-0.5 flex-shrink-0">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <div>
                      <p className="font-display text-xs text-amber-400 uppercase tracking-widest mb-1">Relayer Fee Too Low</p>
                      <p className="font-body text-xs text-white/60 leading-relaxed">
                        Gas cost exceeded the collected fee. Retrying with +0.1 MON per call.
                      </p>
                    </div>
                  </div>

                  {retryFeeResult && (
                    <div className="border border-noir-700 bg-noir-800/40 divide-y divide-noir-700">
                      <div className="flex justify-between px-3 py-2">
                        <span className="font-display text-xs text-white/50">Retry fee</span>
                        <span className="font-display text-xs text-amber-400">
                          {retryFeeResult.numCalls} call{retryFeeResult.numCalls > 1 ? "s" : ""} × 0.4 MON
                          {" "}= {ethers.formatEther(retryFeeResult.totalFee)} MON
                        </span>
                      </div>
                      {retryInsufficient && (
                        <div className="px-3 py-2.5 bg-crimson-400/5">
                          <p className="font-display text-xs text-crimson-400 mb-1">Still insufficient</p>
                          <p className="font-body text-xs text-white/50">
                            Retry fee exceeds your balance. Decrease the amount or deposit more funds.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-3 flex-shrink-0">
          {step === "idle" && (
            <button
              onClick={handleTransfer}
              disabled={!isValid}
              className="flex-1 font-display text-xs tracking-widest uppercase py-3 border border-prifi-600/60 text-prifi-400 hover:bg-prifi-600/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Transfer Privately
            </button>
          )}

          {step === "error" && !isRelayerFeeError && (
            <button
              onClick={() => { setStep("idle"); setErrorMsg(null); }}
              className="flex-1 font-display text-xs tracking-widest uppercase py-3 border border-noir-600 text-white/60 hover:text-white hover:border-noir-500 transition-all"
            >
              Try Again
            </button>
          )}

          {step === "error" && isRelayerFeeError && (
            <button
              onClick={handleRetry}
              disabled={retryInsufficient}
              className="flex-1 font-display text-xs tracking-widest uppercase py-3 border border-amber-400/60 text-amber-400 hover:bg-amber-400/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Retry with Higher Fee
            </button>
          )}

          {(step === "idle" || step === "done" || step === "error") && (
            <button
              onClick={onClose}
              className={`font-display text-xs tracking-widest uppercase py-3 border border-noir-600 text-white/60 hover:text-white hover:border-noir-500 transition-all ${
                step === "done" ? "flex-1" : "px-5"
              }`}
            >
              {step === "done" ? "Close" : "Cancel"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}