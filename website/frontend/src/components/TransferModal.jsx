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
const MAX_INPUTS = 4;
const FEE_PER_CALL = ethers.parseEther("0.2"); // relayer fee per TransferCall
const ZERO_HASH = ethers.ZeroHash;
const ZERO_BIG = BigInt(0);

// ─── Poseidon singleton ───────────────────────────────────────────────────────
let _poseidon = null;
async function getPoseidon() {
  if (!_poseidon) _poseidon = await buildPoseidon();
  return _poseidon;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** bytes32 hex from a BigInt / decimal string */
function toBytes32(value) {
  return ethers.zeroPadValue(ethers.toBeHex(BigInt(value)), 32);
}

/** random 31-byte bigint string */
function randomR() {
  return ethers.toBigInt(ethers.randomBytes(31)).toString();
}

/**
 * Greedily pick UTXOs until their sum >= target.
 * Returns null if impossible.
 */
function selectUTXOs(unspent, targetBigInt) {
  // sort descending by amount so we use fewer notes
  console.log("unspent: ",unspent);
    const sorted = [...unspent].sort((a, b) => {
    const diff = BigInt(b.amount) - BigInt(a.amount);
    return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });
  const selected = [];
  let acc = ZERO_BIG;
  for (const utxo of sorted) {
    if (acc >= targetBigInt) break;
    selected.push(utxo);
    acc += BigInt(utxo.amount);
  }
  return acc >= targetBigInt ? selected : null;
}

/**
 * Build one TransferCall object + its ZK proof.
 *
 * inputs      – array of 1-4 UTXO objects (from PoolContext)
 * receiverAmt – BigInt amount going to receiver (0 if this is a change-only call)
 * changeAmt   – BigInt change back to sender
 * feeAmt      – BigInt relayer fee
 * receiver    – { zkPublicKey, privateWalletPublicKey }
 * sender      – walletKeys object from WalletContext
 * relayer     – { zkPublicKey, publicKey }
 * getMerkleProof – from PoolContext
 */
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

  // pad inputs to MAX_INPUTS with dummy zeroes
  const padded = [...inputs];
  while (padded.length < MAX_INPUTS) {
    padded.push(null); // dummy
  }

  // ── enabled flags ──────────────────────────────────────────────────────────
  const enabled = padded.map((u) => (u ? 1 : 0));

  // ── merkle proofs & nullifiers ────────────────────────────────────────────
  const c_ins        = [];
  const a_ins        = [];
  const r_ins        = [];
  const roots        = [];
  const pathElements = [];
  const pathIndices  = [];
  const nullifiers   = [];
  const poolIds      = [];
  const rootsBytes32 = [];
  const nullifiersBytes32 = [];

  for (const utxo of padded) {
    if (!utxo) {
      // dummy slot
      c_ins.push("0");
      a_ins.push("0");
      r_ins.push("0");
      roots.push("0");
      pathElements.push(Array(20).fill("0"));
      pathIndices.push(Array(20).fill(0));
      nullifiers.push("0");
      poolIds.push(0);
      rootsBytes32.push(ZERO_HASH);
      nullifiersBytes32.push(ZERO_HASH);
      continue;
    }

    // merkle proof
    const merkleProof = getMerkleProof(utxo.poolId, utxo.leafIndex);
    console.log("merkle proof: ",merkleProof);
    if (!merkleProof) throw new Error(`No Merkle proof for leaf ${utxo.leafIndex} in pool ${utxo.poolId}`);

    const rootBig = merkleProof.root.toString();

    // nullifier = poseidon(2, commitment, randomness, sk)
    const nullifier = poseidon.F.toString(
      poseidon([
        2, 
        BigInt(utxo.commitment), 
        BigInt(utxo.randomness), 
        BigInt(sender.zk.secretKey)
    ])
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

  // ── output commitments ────────────────────────────────────────────────────
  const rReceiver = randomR();
  const rChange   = randomR();
  const rRelayer  = randomR();

  const receiverEnabled = receiverAmt > ZERO_BIG ? 1 : 0;
  const changeEnabled   = changeAmt   > ZERO_BIG ? 1 : 0;
  const relayerEnabled  = feeAmt      > ZERO_BIG ? 1 : 0;

  const receiverCommitment = await createCommitment(
    receiverAmt.toString(), rReceiver, receiver.zkPublicKey
  );
  const changeCommitment = await createCommitment(
    changeAmt.toString(), rChange, sender.zk.publicKey
  );
  const relayerCommitment = await createCommitment(
    feeAmt.toString(), rRelayer, relayer.zkPublicKey
  );

  // ── encrypt notes ─────────────────────────────────────────────────────────
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

  // ── circom input ──────────────────────────────────────────────────────────
  const circuitInput = {
    sk:      sender.zk.secretKey,
    pk:      sender.zk.publicKey,
    relayer: relayer.zkPublicKey,

    enabled,
    c_ins,
    a_ins,
    r_ins,
    roots,
    pathElements,
    pathIndices,
    nullifiers,

    output_enabled: [receiverEnabled, changeEnabled, relayerEnabled],

    c_outs: [
      receiverCommitment.decimal,
      changeCommitment.decimal,
      relayerCommitment.decimal,
    ],

    a_outs: [
      receiverAmt.toString(),
      changeAmt.toString(),
      feeAmt.toString(),
    ],

    r_outs: [rReceiver, rChange, rRelayer],

    receivers: [
      receiver.zkPublicKey,
      sender.zk.publicKey,
      relayer.zkPublicKey,
    ],
  };

  // ── ZK proof ──────────────────────────────────────────────────────────────
  const { proof: zkProof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInput,
    "/zk/transfer_proof.wasm",
    "/zk/transfer_final.zkey"
  );
  console.log("publicsignals:  ", publicSignals);
  const calldata = await snarkjs.groth16.exportSolidityCallData(zkProof, publicSignals);
  const argv = calldata.replace(/["[\]\s]/g, "").split(",");

  const a = [argv[0], argv[1]];
  const b = [[argv[2], argv[3]], [argv[4], argv[5]]];
  const c = [argv[6], argv[7]];

  // ── assemble TransferCall ─────────────────────────────────────────────────
  const transferCall = {
    a, b, c,
    enabled,
    roots:     rootsBytes32,
    poolIds,
    nullifiers: nullifiersBytes32,
    C1: receiverEnabled ? receiverCommitment.bytes32 : ZERO_HASH,
    C2: changeEnabled   ? changeCommitment.bytes32   : ZERO_HASH,
    C3: relayerEnabled  ? relayerCommitment.bytes32  : ZERO_HASH,
    encryptedNote1,
    encryptedNote2,
    encryptedNote3,
  };

  return { transferCall, changeAmt, rChange, publicSignals };
}

// ─── Steps ────────────────────────────────────────────────────────────────────
const STEPS = ["idle", "relayer", "building", "proving", "sending", "done", "error"];

function StepIndicator({ current }) {
  const active = ["relayer", "building", "proving", "sending", "done"];
  const idx = active.indexOf(current);
  return (
    <div className="flex items-center gap-1 mb-6">
      {active.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
            i < idx  ? "bg-prifi-600" :
            i === idx ? "bg-prifi-400 animate-pulse" :
            "bg-noir-600"
          }`} />
          {i < active.length - 1 && (
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
  const filtered = allUsers.filter((u) =>
    u.realAddress?.toLowerCase() !== currentAddress?.toLowerCase() &&
    (u.name?.toLowerCase().includes(query.toLowerCase()) ||
     u.realAddress?.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="space-y-2">
      <label className="font-display text-xs text-white/60 uppercase tracking-widest block">
        Recipient
      </label>
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function TransferModal({ onClose }) {
  const { walletKeys, address, allUsers } = useWallet();
  const { allUnspentUTXOs, getMerkleProof, fetchLatest } = usePool();

  const [selectedUser, setSelectedUser] = useState(null);
  const [amountEth, setAmountEth]       = useState("");
  const [step, setStep]                 = useState("idle");
  const [stepLabel, setStepLabel]       = useState("");
  const [txHash, setTxHash]             = useState(null);
  const [errorMsg, setErrorMsg]         = useState(null);
  const [callCount, setCallCount]       = useState(0);

  // ── derived values ─────────────────────────────────────────────────────────
  const parsedAmt = useMemo(() => {
    try { return ethers.parseEther(amountEth || "0"); } catch { return ZERO_BIG; }
  }, [amountEth]);

  // How many TransferCalls will we need? (rough estimate — 1 for most cases)
  const estimatedCalls = useMemo(() => {
    if (parsedAmt === ZERO_BIG || allUnspentUTXOs.length === 0) return 0;
    const totalAvailable = allUnspentUTXOs.reduce((s, u) => s + BigInt(u.amount), ZERO_BIG);
    const needed = parsedAmt + FEE_PER_CALL;
    if (totalAvailable < needed) return 0; // can't afford
    // naive: 1 call covers up to 4 inputs
    return 1;
  }, [parsedAmt, allUnspentUTXOs]);

  const totalFee = FEE_PER_CALL * BigInt(Math.max(estimatedCalls, 1));
  const userReceives = parsedAmt;
  const totalNeeded  = parsedAmt + totalFee;

  const totalAvailable = useMemo(
    () => allUnspentUTXOs.reduce((s, u) => s + BigInt(u.amount), ZERO_BIG),
    [allUnspentUTXOs]
  );

  const isValid =
    selectedUser &&
    parsedAmt > ZERO_BIG &&
    totalAvailable >= totalNeeded;

  const isRunning = !["idle", "done", "error"].includes(step);

  // ── main handler ───────────────────────────────────────────────────────────
  const handleTransfer = useCallback(async () => {
    setErrorMsg(null);
    setTxHash(null);
    setCallCount(0);

    try {
      // 1. Fetch relayer
      setStep("relayer");
      setStepLabel("Fetching relayer keys…");
      const relRes = await fetch(`${BASE_URL}/relayer/get`);
      if (!relRes.ok) throw new Error("Could not fetch relayer info");
      const relayer = await relRes.json();
      // relayer = { publicKey, zkPublicKey }

      // 2. Select UTXOs
      setStep("building");
      setStepLabel("Selecting inputs…");

      const transferAmt = parsedAmt; // BigInt
      const needed      = transferAmt + FEE_PER_CALL;
      const selected    = selectUTXOs(allUnspentUTXOs, needed);

      if (!selected) {
        throw new Error(
          `Insufficient balance. Need ${ethers.formatEther(needed)} MON, ` +
          `have ${ethers.formatEther(totalAvailable)} MON`
        );
      }

      // 3. Split into batches of MAX_INPUTS
      //    In almost all cases this is a single call.
      //    If the user has many tiny notes we may need multiple calls,
      //    chaining the change output of call N as a virtual input to call N+1.
      //    For simplicity we handle the 99% case (1 call) and the rare multi-call.
      const transferCalls = [];
      const publicSignals = [];
      let   remaining     = transferAmt; // how much still needs to reach receiver
      let   inputBatch    = selected;

      setStepLabel("Building transfer call(s)…");

      while (remaining > ZERO_BIG || inputBatch.length > 0) {
        const batchInputs = inputBatch.slice(0, MAX_INPUTS);
        const batchTotal  = batchInputs.reduce((s, u) => s + BigInt(u.amount), ZERO_BIG);

        const fee        = FEE_PER_CALL;
        // How much goes to receiver in THIS call
        const toReceiver = remaining <= batchTotal - fee ? remaining : batchTotal - fee;
        const change     = batchTotal - toReceiver - fee;

        setStep("proving");
        setStepLabel(
          `Generating ZK proof ${transferCalls.length + 1}` +
          (inputBatch.length > MAX_INPUTS ? ` of ~${Math.ceil(inputBatch.length / MAX_INPUTS)}` : "") +
          "…"
        );

        const { transferCall, changeAmt: changeLeft, rChange , publicSignals: ps} = await buildTransferCall(
          batchInputs,
          toReceiver,
          change,
          fee,
          {
            zkPublicKey:            selectedUser.zkPublicKey,
            privateWalletPublicKey: selectedUser.privateWalletPublicKey,
          },
          walletKeys,
          relayer,
          getMerkleProof
        );

        transferCalls.push(transferCall);
        publicSignals.push(ps);
        setCallCount(transferCalls.length);

        remaining     -= toReceiver;
        inputBatch     = inputBatch.slice(MAX_INPUTS);

        // If there's leftover change AND more inputs to spend, carry the change
        // forward as a "virtual" input in the next batch.
        // (In practice this almost never happens for normal use.)
        if (remaining > ZERO_BIG && inputBatch.length > 0 && change > ZERO_BIG) {
          // The change UTXO isn't on-chain yet so we can't use it as a real
          // Merkle input. Abort with a clear message — user should wait for
          // the first tx to land and then transfer the rest.
          throw new Error(
            "Transfer requires more than one on-chain transaction. " +
            "Please send a smaller amount or wait for pending notes to confirm."
          );
        }

        if (inputBatch.length === 0) break;
      }

      // 4. Send to relayer API
      setStep("sending");
      setStepLabel("Sending to relayer…");

      const res = await fetch(`${BASE_URL}/transfer/transfer`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ transferCalls, publicSignals }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Transfer failed on-chain");
      }

      setTxHash(result.txHash);

      // 5. Refresh pool state
      await fetchLatest();

      setStep("done");
      setStepLabel("Transfer confirmed!");

    } catch (err) {
      console.error("[TransferModal]", err);
      setStep("error");
      setErrorMsg(err?.reason || err?.message || "Transfer failed");
    }
  }, [parsedAmt, selectedUser, walletKeys, allUnspentUTXOs, getMerkleProof, fetchLatest, totalAvailable]);

  // close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape" && !isRunning) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, isRunning]);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-noir-950/80 animate-fade-in">
      <div className="relative w-full max-w-md mx-4 bg-noir-900 border border-noir-600 glow-border animate-slide-up max-h-[90vh] flex flex-col">
        {/* corner accents */}
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
          <button
            onClick={onClose}
            disabled={isRunning}
            className="text-white/60 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {step !== "idle" && <StepIndicator current={step} />}

          {/* ── IDLE: form ── */}
          {step === "idle" && (
            <>
              {/* Available balance hint */}
              <div className="flex justify-between items-center">
                <span className="font-display text-xs text-white/40 uppercase tracking-widest">
                  Available
                </span>
                <span className="font-display text-xs text-prifi-400">
                  {ethers.formatEther(totalAvailable)} MON
                </span>
              </div>

              {/* Recipient */}
              <UserSelector
                allUsers={allUsers}
                selected={selectedUser}
                onSelect={setSelectedUser}
                currentAddress={address}
              />

              {/* Amount */}
              <div>
                <label className="font-display text-xs text-white/60 uppercase tracking-widest block mb-2">
                  Amount (MON)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountEth}
                    onChange={(e) => setAmountEth(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-noir-800 border border-noir-600 focus:border-prifi-600 outline-none px-4 py-3 font-display text-white text-lg placeholder-white/20 transition-colors"
                  />
                  <button
                    onClick={() => {
                      // max = available - fee
                      const max = totalAvailable > FEE_PER_CALL
                        ? totalAvailable - FEE_PER_CALL
                        : ZERO_BIG;
                      setAmountEth(ethers.formatEther(max));
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 font-display text-xs text-prifi-600 hover:text-prifi-400 transition-colors border border-prifi-600/40 px-2 py-0.5"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Breakdown */}
              {parsedAmt > ZERO_BIG && (
                <div className="border border-noir-700 bg-noir-800/40 divide-y divide-noir-700">
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="font-display text-xs text-white/60">Send</span>
                    <span className="font-display text-xs text-white">{ethers.formatEther(parsedAmt)} MON</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="font-display text-xs text-white/60">Relayer fee</span>
                    <span className="font-display text-xs text-white/60">− {ethers.formatEther(FEE_PER_CALL)} MON</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="font-display text-xs text-white/60">Total deducted</span>
                    <span className={`font-display text-xs ${totalAvailable >= totalNeeded ? "text-white" : "text-crimson-400"}`}>
                      {ethers.formatEther(totalNeeded)} MON
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="font-display text-xs text-prifi-400">Receiver gets</span>
                    <span className="font-display text-xs text-prifi-400">{ethers.formatEther(userReceives)} MON</span>
                  </div>
                  {totalAvailable < totalNeeded && (
                    <div className="px-4 py-2.5">
                      <span className="font-display text-xs text-crimson-400">
                        Insufficient balance
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Privacy hint */}
              <div className="flex items-start gap-3 p-3 border border-prifi-600/20 bg-prifi-600/5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4dffc8" strokeWidth="1.5" className="mt-0.5 flex-shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="font-body text-xs text-white/60 leading-relaxed">
                  This transfer is shielded end-to-end. Only the recipient can decrypt their note. The transaction is submitted by the relayer so your on-chain identity is never linked to the transfer.
                </p>
              </div>
            </>
          )}

          {/* ── RUNNING ── */}
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
                  {callCount > 0 && (
                    <div className="flex items-center gap-2 border border-noir-700 bg-noir-800 px-4 py-2">
                      <span className="font-display text-xs text-prifi-600">{callCount}</span>
                      <span className="font-display text-xs text-white/40">call(s) proven so far</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── DONE ── */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-12 h-12 border border-prifi-600/40 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4dffc8" strokeWidth="1.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="font-display text-sm text-prifi-400 tracking-widest uppercase mb-1">
                  Transfer Confirmed
                </p>
                <p className="font-body text-xs text-white/60">
                  {ethers.formatEther(parsedAmt)} MON sent privately to{" "}
                  <span className="text-prifi-400">{selectedUser?.name}</span>.
                </p>
              </div>
              {txHash && (
                <a
                  href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-display text-xs text-prifi-600 hover:text-prifi-400 underline underline-offset-2 transition-colors"
                >
                  View on Explorer ↗
                </a>
              )}
            </div>
          )}

          {/* ── ERROR ── */}
          {step === "error" && (
            <div className="border border-crimson-400/40 bg-crimson-400/5 p-4">
              <p className="font-display text-xs text-crimson-400 uppercase tracking-widest mb-1">
                Transfer Failed
              </p>
              <p className="font-body text-xs text-white/60 break-words">{errorMsg}</p>
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

          {step === "error" && (
            <button
              onClick={() => { setStep("idle"); setErrorMsg(null); }}
              className="flex-1 font-display text-xs tracking-widest uppercase py-3 border border-noir-600 text-white/60 hover:text-white hover:border-noir-500 transition-all"
            >
              Try Again
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