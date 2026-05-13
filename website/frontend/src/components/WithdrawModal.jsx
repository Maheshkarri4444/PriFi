import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ethers } from "ethers";
import * as snarkjs from "snarkjs";
import { buildPoseidon } from "circomlibjs";
import { useWallet } from "../context/WalletContext";
import { usePool } from "../context/PoolContext";
import { createCommitment } from "../helpers/commitments";
import { encryptMessage } from "../helpers/crypto";
import { BASE_URL } from "../services/api";
import POOL_ABI from "../abis/PrivatePool.json";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_INPUTS = 4;
const RELAYER_FEE = ethers.parseEther("0.5"); // flat fee to relayer (once per withdraw, not per batch)
const ZERO_HASH  = ethers.ZeroHash;
const ZERO_BIG   = BigInt(0);

const POOL_ADDRESS = import.meta.env.VITE_PRIVATE_POOL_ADDRESS;

// ─── MetaMask-specific provider (mirrors WalletContext logic) ─────────────────
function getMetaMaskProvider() {
  if (typeof window === "undefined") return null;
  const { ethereum } = window;
  if (!ethereum) return null;
  if (ethereum.providers?.length) {
    return (
      ethereum.providers.find(
        (p) => p.isMetaMask && !p.isPhantom && !p.isBraveWallet
      ) ?? null
    );
  }
  if (ethereum.isMetaMask && !ethereum.isPhantom) return ethereum;
  return null;
}

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

function selectUTXOs(unspent, targetBigInt) {
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
 * Plan withdraw calls.
 *
 * Each WithdrawCall:
 *   inputs (up to 4 UTXOs) → withdrawAmount (to ETH address) + change (back to ZK) + fee (to relayer)
 *   Circuit: sum(inputs) === withdrawAmount + changeAmt + feeAmt
 *
 * Fee strategy: ONE flat RELAYER_FEE total across ALL calls.
 *   - The fee is paid entirely in the LAST batch.
 *   - All earlier batches: feeAmt = 0, surplus goes as change.
 *   - Total UTXOs needed = withdrawAmt + RELAYER_FEE.
 *   - maxWithdrawable = totalAvailable (the full balance); fee is taken from
 *     the same pool of UTXOs, reducing change — not the destination amount.
 */
function planWithdraw(unspent, withdrawAmt) {
  if (!unspent?.length || withdrawAmt <= ZERO_BIG) return null;

  // We need UTXOs that cover withdrawAmt + RELAYER_FEE (fee comes from balance)
  const totalNeeded = withdrawAmt + RELAYER_FEE;
  const selected    = selectUTXOs(unspent, totalNeeded);
  if (!selected) return null;

  const batches = [];
  const flat = [...selected];
  while (flat.length > 0) batches.push(flat.splice(0, MAX_INPUTS));

  const plans = [];
  let withdrawRemaining = withdrawAmt;
  let feeRemaining      = RELAYER_FEE; // paid once, in the last batch

  for (let i = 0; i < batches.length; i++) {
    const batch      = batches[i];
    const isLast     = i === batches.length - 1;
    const batchTotal = batch.reduce((s, u) => s + BigInt(u.amount), ZERO_BIG);

    // Fee only comes out of the last batch
    const feeAmt = isLast ? feeRemaining : ZERO_BIG;

    const available = batchTotal - feeAmt; // what's left after fee for withdraw + change
    if (available < ZERO_BIG) return null; // last batch too small to cover fee

    const toWithdraw = withdrawRemaining <= available ? withdrawRemaining : available;
    const changeAmt  = available - toWithdraw;

    withdrawRemaining -= toWithdraw;
    if (isLast) feeRemaining = ZERO_BIG;

    plans.push({ inputs: batch, withdrawAmt: toWithdraw, changeAmt, feeAmt });
  }

  if (withdrawRemaining > ZERO_BIG) return null;
  return { plans, totalFee: RELAYER_FEE };
}

// ─── Build a single WithdrawCall + ZK proof ───────────────────────────────────
async function buildWithdrawCall(
  inputs,
  withdrawAmt,
  changeAmt,
  feeAmt,
  senderAddress,
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
      rootsBytes32.push(ZERO_HASH);
      nullifiersBytes32.push(ZERO_HASH);
      continue;
    }

    enabled.push(1);
    const merkleProof = getMerkleProof(utxo.poolId, utxo.leafIndex);
    if (!merkleProof)
      throw new Error(`No Merkle proof for leaf ${utxo.leafIndex} in pool ${utxo.poolId}`);

    const rootBig   = merkleProof.root.toString();
    const nullifier = poseidon.F.toString(
      poseidon([
        2,
        BigInt(utxo.commitment),
        BigInt(utxo.randomness),
        BigInt(sender.zk.secretKey),
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

  const rChange  = randomR();
  const rRelayer = randomR();

  const changeEnabled  = changeAmt > ZERO_BIG ? 1 : 0;
  const relayerEnabled = feeAmt    > ZERO_BIG ? 1 : 0;

  const changeCommitment  = await createCommitment(changeAmt.toString(), rChange,  sender.zk.publicKey);
  const relayerCommitment = await createCommitment(feeAmt.toString(),    rRelayer, relayer.zkPublicKey);

  const encryptedNote1 = encryptMessage(
    JSON.stringify({ amount: changeAmt.toString(), randomness: rChange }),
    sender.privateWallet.publicKey
  );
  const encryptedNote2 = encryptMessage(
    JSON.stringify({ amount: feeAmt.toString(), randomness: rRelayer }),
    relayer.publicKey
  );

  const receiverUint = BigInt(senderAddress).toString();

  const circuitInput = {
    pk:             sender.zk.publicKey,
    sk:             sender.zk.secretKey,
    receiver:       receiverUint,
    changeReceiver: sender.zk.publicKey,
    relayer:        relayer.zkPublicKey,

    enabled,
    c_ins,
    a_ins,
    r_ins,
    roots,
    pathElements,
    pathIndices,
    nullifiers,

    withdrawAmount: withdrawAmt.toString(),

    out_enabled: [changeEnabled, relayerEnabled],

    a_outs: [changeAmt.toString(), feeAmt.toString()],
    r_outs: [rChange, rRelayer],

    c_outs: [
      changeEnabled  ? changeCommitment.decimal  : "0",
      relayerEnabled ? relayerCommitment.decimal : "0",
    ],

    receivers: [sender.zk.publicKey, relayer.zkPublicKey],
  };

  const { proof: zkProof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInput,
    "/zk/withdraw_proof.wasm",
    "/zk/withdraw_final.zkey"
  );

  console.log("withdraw public signals:", publicSignals);

  const calldata = await snarkjs.groth16.exportSolidityCallData(zkProof, publicSignals);
  const argv     = calldata.replace(/["[\]\s]/g, "").split(",");
  const a = [argv[0], argv[1]];
  const b = [[argv[2], argv[3]], [argv[4], argv[5]]];
  const c = [argv[6], argv[7]];

  const withdrawCall = {
    a, b, c,
    enabled,
    roots:      rootsBytes32,
    poolIds,
    nullifiers: nullifiersBytes32,
    C1: changeEnabled  ? changeCommitment.bytes32  : ZERO_HASH,
    C2: relayerEnabled ? relayerCommitment.bytes32 : ZERO_HASH,
    encryptedNote1,
    encryptedNote2,
    withdrawAmount: withdrawAmt,
  };

  return { withdrawCall, zkProof };
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WithdrawModal({ onClose }) {
  const { walletKeys, address } = useWallet();
  const { allUnspentUTXOs, getMerkleProof, fetchLatest } = usePool();

  const [amountEth, setAmountEth] = useState("");
  const [step, setStep]           = useState("idle");
  const [stepLabel, setStepLabel] = useState("");
  const [txHash, setTxHash]       = useState(null);
  const [errorMsg, setErrorMsg]   = useState(null);
  const [provenCount, setProvenCount] = useState(0);
  const [totalProofs, setTotalProofs] = useState(0);

  const parsedAmt = useMemo(() => {
    try { return ethers.parseEther(amountEth || "0"); } catch { return ZERO_BIG; }
  }, [amountEth]);

  const totalAvailable = useMemo(
    () => allUnspentUTXOs.reduce((s, u) => s + BigInt(u.amount), ZERO_BIG),
    [allUnspentUTXOs]
  );

  const plan = useMemo(
    () => parsedAmt > ZERO_BIG ? planWithdraw(allUnspentUTXOs, parsedAmt) : null,
    [parsedAmt, allUnspentUTXOs]
  );

  // ── Key fix: maxWithdrawable is the FULL balance.
  // planWithdraw will internally need balance >= withdrawAmt + RELAYER_FEE,
  // so when the user tries to withdraw their full balance (e.g. 4.3),
  // it works only if totalAvailable >= 4.3 + 0.5 = 4.8.
  // If the balance is exactly 4.3 and fee is 0.5, the true max the user can
  // send to their wallet is 4.3 - 0.5 = 3.8 (fee is deducted from UTXOs).
  // We binary-search for the highest withdrawAmt that planWithdraw accepts,
  // which naturally accounts for UTXO fragmentation — but we no longer
  // pre-subtract RELAYER_FEE before the search, so the result is the true
  // maximum destination amount (not artificially lowered by a double-subtract).
  const maxWithdrawable = useMemo(() => {
    if (totalAvailable === ZERO_BIG) return ZERO_BIG;
    // The absolute ceiling: we can never send more to the wallet than what's
    // in the pool minus the flat fee (fee always comes from the same UTXOs).
    const ceiling = totalAvailable > RELAYER_FEE
      ? totalAvailable - RELAYER_FEE
      : ZERO_BIG;
    if (ceiling === ZERO_BIG) return ZERO_BIG;

    // Binary-search within [0, ceiling] for the largest amount planWithdraw accepts.
    // This handles UTXO fragmentation (e.g. can't always reach the ceiling exactly).
    let lo = ZERO_BIG;
    let hi = ceiling;
    for (let i = 0; i < 64; i++) {
      const mid = (lo + hi + 1n) / 2n;
      if (planWithdraw(allUnspentUTXOs, mid) !== null) lo = mid;
      else hi = mid - 1n;
    }
    return lo;
  }, [totalAvailable, allUnspentUTXOs]);

  // Insufficient when the plan couldn't be built (planWithdraw returned null)
  const insufficient = parsedAmt > ZERO_BIG && plan === null;
  // Also flag if the entered amount exceeds balance entirely
  const overBalance  = parsedAmt > totalAvailable;

  const isValid   = parsedAmt > ZERO_BIG && !!plan;
  const isRunning = !["idle", "done", "error"].includes(step);

  // What will actually be deducted from the pool (withdraw + fee, sourced from UTXOs)
  const totalDeducted = parsedAmt > ZERO_BIG ? parsedAmt + RELAYER_FEE : ZERO_BIG;

  const handleWithdraw = useCallback(async () => {
    setErrorMsg(null);
    setTxHash(null);
    setProvenCount(0);
    setTotalProofs(0);

    try {
      // 1. Fetch relayer info
      setStep("relayer");
      setStepLabel("Fetching relayer keys…");
      const relRes = await fetch(`${BASE_URL}/relayer/get`);
      if (!relRes.ok) throw new Error("Could not fetch relayer info");
      const relayer = await relRes.json();

      // 2. Plan
      setStep("building");
      setStepLabel("Selecting inputs…");
      const withdrawPlan = planWithdraw(allUnspentUTXOs, parsedAmt);
      if (!withdrawPlan) {
        throw new Error(
          `Insufficient balance. Need ${ethers.formatEther(parsedAmt + RELAYER_FEE)} MON ` +
          `(${ethers.formatEther(parsedAmt)} + ${ethers.formatEther(RELAYER_FEE)} fee), ` +
          `but only have ${ethers.formatEther(totalAvailable)} MON.`
        );
      }

      const { plans } = withdrawPlan;
      setTotalProofs(plans.length);
      setStepLabel(`Building ${plans.length} withdraw call(s)…`);

      // 3. Generate proofs
      setStep("proving");
      const withdrawCalls = [];

      for (let i = 0; i < plans.length; i++) {
        const p = plans[i];
        setStepLabel(`Generating ZK proof ${i + 1} of ${plans.length}…`);

        const { withdrawCall } = await buildWithdrawCall(
          p.inputs,
          p.withdrawAmt,
          p.changeAmt,
          p.feeAmt,
          address,
          walletKeys,
          relayer,
          getMerkleProof
        );

        withdrawCalls.push(withdrawCall);
        setProvenCount(i + 1);
      }

      // 4. Send tx — use MetaMask-specific provider, never window.ethereum directly
      setStep("sending");
      setStepLabel("Awaiting MetaMask signature…");

      const mmProvider = getMetaMaskProvider();
      if (!mmProvider) throw new Error("MetaMask not found. Please make sure MetaMask is installed and active.");

      const provider = new ethers.BrowserProvider(mmProvider);
      const signer   = await provider.getSigner();
      const pool     = new ethers.Contract(POOL_ADDRESS, POOL_ABI, signer);

      const tx = await pool.withdraw(withdrawCalls, address);

      setStepLabel("Waiting for confirmation…");
      const receipt = await tx.wait();
      setTxHash(receipt.hash);

      // 5. Refresh pool state
      await fetchLatest();
      setStep("done");

    } catch (err) {
      console.error("[WithdrawModal]", err);
      setStep("error");
      setErrorMsg(err?.reason || err?.message || "Withdraw failed");
    }
  }, [parsedAmt, address, walletKeys, allUnspentUTXOs, getMerkleProof, fetchLatest, totalAvailable]);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape" && !isRunning) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, isRunning]);

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
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </span>
            <div>
              <p className="font-display text-xs text-prifi-600 tracking-widest uppercase">Action</p>
              <h3 className="font-display text-lg text-white">Withdraw Funds</h3>
            </div>
          </div>
          <button onClick={onClose} disabled={isRunning}
            className="text-white/60 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
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

              <div className="border border-noir-700 bg-noir-800/40 p-3 flex items-center gap-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4dffc8" strokeWidth="1.5" className="flex-shrink-0">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <div className="min-w-0">
                  <p className="font-display text-xs text-white/40 uppercase tracking-widest mb-0.5">Destination</p>
                  <p className="font-display text-xs text-prifi-400 truncate">{address}</p>
                </div>
              </div>

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
                        const entered = ethers.parseEther(e.target.value || "0");
                        // Cap at maxWithdrawable so the user can't type more than is plannable
                        if (entered > maxWithdrawable) {
                          setAmountEth(ethers.formatEther(maxWithdrawable));
                        } else {
                          setAmountEth(e.target.value);
                        }
                      } catch {
                        setAmountEth(e.target.value);
                      }
                    }}
                    placeholder="0.00"
                    className="w-full bg-noir-800 border border-noir-600 focus:border-prifi-600 outline-none px-4 py-3 font-display text-white text-lg placeholder-white/20 transition-colors"
                  />
                  {/* MAX sets to the full maxWithdrawable (balance minus fee) */}
                  <button
                    onClick={() => setAmountEth(ethers.formatEther(maxWithdrawable))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 font-display text-xs text-prifi-600 hover:text-prifi-400 border border-prifi-600/40 px-2 py-0.5"
                  >
                    MAX
                  </button>
                </div>
                {maxWithdrawable > ZERO_BIG && (
                  <p className="font-display text-xs text-white/30 mt-1.5">
                    Max: {ethers.formatEther(maxWithdrawable)} MON
                    <span className="text-white/20 ml-1">(after {ethers.formatEther(RELAYER_FEE)} MON fee)</span>
                  </p>
                )}
              </div>

              {parsedAmt > ZERO_BIG && (
                <div className="border border-noir-700 bg-noir-800/40 divide-y divide-noir-700">
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="font-display text-xs text-white/60">Withdraw</span>
                    <span className="font-display text-xs text-white">{ethers.formatEther(parsedAmt)} MON</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="font-display text-xs text-white/60">Relayer fee (once)</span>
                    <span className="font-display text-xs text-white/60">− {ethers.formatEther(RELAYER_FEE)} MON</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="font-display text-xs text-white/60">Total deducted from pool</span>
                    <span className={`font-display text-xs ${overBalance ? "text-crimson-400" : "text-white"}`}>
                      {ethers.formatEther(totalDeducted)} MON
                    </span>
                  </div>
                  {!insufficient && !overBalance && (
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="font-display text-xs text-prifi-400">You receive</span>
                      <span className="font-display text-xs text-prifi-400">{ethers.formatEther(parsedAmt)} MON</span>
                    </div>
                  )}
                  {(insufficient || overBalance) && (
                    <div className="px-4 py-3 bg-crimson-400/5">
                      <p className="font-display text-xs text-crimson-400 mb-1">Insufficient balance</p>
                      <p className="font-body text-xs text-white/50 leading-relaxed">
                        You need {ethers.formatEther(parsedAmt + RELAYER_FEE)} MON (withdraw + fee) but only have{" "}
                        {ethers.formatEther(totalAvailable)} MON.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-start gap-3 p-3 border border-prifi-600/20 bg-prifi-600/5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4dffc8" strokeWidth="1.5" className="mt-0.5 flex-shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="font-body text-xs text-white/60 leading-relaxed">
                  Funds are sent directly to your MetaMask address. A flat {ethers.formatEther(RELAYER_FEE)} MON relayer fee is charged once per withdrawal. A ZK proof verifies your ownership without revealing which notes you're spending.
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
              {step === "sending" && (
                <p className="font-body text-xs text-white/40 text-center">
                  Check MetaMask to confirm the transaction.
                </p>
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
                <p className="font-display text-sm text-prifi-400 tracking-widest uppercase mb-1">Withdrawal Confirmed</p>
                <p className="font-body text-xs text-white/60">
                  {ethers.formatEther(parsedAmt)} MON sent to your wallet.
                </p>
                <p className="font-display text-xs text-white/30 mt-1 break-all">
                  {address?.slice(0, 16)}…
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
            <div className="border border-crimson-400/40 bg-crimson-400/5 p-4">
              <p className="font-display text-xs text-crimson-400 uppercase tracking-widest mb-1">Withdrawal Failed</p>
              <p className="font-body text-xs text-white/60 break-words">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-3 flex-shrink-0">
          {step === "idle" && (
            <button
              onClick={handleWithdraw}
              disabled={!isValid}
              className="flex-1 font-display text-xs tracking-widest uppercase py-3 border border-prifi-600/60 text-prifi-400 hover:bg-prifi-600/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Withdraw
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