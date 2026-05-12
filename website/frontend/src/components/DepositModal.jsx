import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";
import { usePool } from "../context/PoolContext";
import { fetchRelayerKeys, executeDeposit } from "../services/deposit";

const MIN_FEE_ETH = "0.1";
const MIN_FEE_WEI = ethers.parseEther(MIN_FEE_ETH);

// ── step indicator ───────────────────────────────────────────────────────────
const STEPS = ["Validate", "Generate Proof", "Send Transaction", "Done"];

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((label, i) => {
        const done    = i < current;
        const active  = i === current;
        const pending = i > current;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-6 h-6 flex items-center justify-center border text-xs font-display transition-all duration-300 ${
                  done    ? "border-prifi-600 bg-prifi-600 text-noir-950" :
                  active  ? "border-prifi-400 text-prifi-400 animate-pulse" :
                            "border-noir-600 text-white/30"
                }`}
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span className={`text-[10px] font-display tracking-wider hidden sm:block transition-colors duration-300 ${
                done || active ? "text-prifi-400" : "text-white/30"
              }`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 mb-3 transition-colors duration-500 ${
                i < current ? "bg-prifi-600" : "bg-noir-700"
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 14 }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-block border border-prifi-400 border-t-transparent rounded-full animate-spin"
    />
  );
}

// ── field ────────────────────────────────────────────────────────────────────
function Field({ label, hint, error, children }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <label className="font-display text-xs tracking-widest uppercase text-white/60">{label}</label>
        {hint && <span className="text-[10px] font-body text-white/40">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-[11px] font-display text-crimson-400 tracking-wide">{error}</p>}
    </div>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────
export default function DepositModal({ onClose }) {
  const { walletKeys } = useWallet();
  const {  forceSync } = usePool();

  const [depositStr, setDepositStr] = useState("");
  const [feeStr, setFeeStr]         = useState(MIN_FEE_ETH);
  const [errors, setErrors]         = useState({});
  const [step, setStep]             = useState(-1); // -1 = idle
  const [statusMsg, setStatusMsg]   = useState("");
  const [txHash, setTxHash]         = useState(null);
  const [fatalError, setFatalError] = useState(null);

  // ── validation ─────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const errs = {};

    let depositWei, feeWei;
    try {
      depositWei = ethers.parseEther(depositStr || "0");
    } catch {
      errs.deposit = "Invalid amount";
    }
    try {
      feeWei = ethers.parseEther(feeStr || "0");
    } catch {
      errs.fee = "Invalid fee";
    }

    if (!errs.deposit && depositWei <= 0n) {
      errs.deposit = "Enter an amount greater than 0";
    }

    if (!errs.fee) {
      if (feeWei < MIN_FEE_WEI) {
        errs.fee = `Minimum fee is ${MIN_FEE_ETH} MON`;
      }
    }

    if (!errs.deposit && !errs.fee && depositWei && feeWei) {
      // check balance — balance is a raw BigInt string (wei)
      if (feeWei >= depositWei) {
        errs.fee = "Fee must be less than deposit amount";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [depositStr, feeStr]);

  // live validate after first submit attempt
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched) validate();
  }, [depositStr, feeStr, touched, validate]);

  // ── submit ──────────────────────────────────────────────────────────────
  const handleDeposit = async () => {
    setTouched(true);
    if (!validate()) return;

    setFatalError(null);
    setStep(0);
    setStatusMsg("Fetching relayer info...");

    try {
      const relayerKeys = await fetchRelayerKeys();

      setStep(1);
      setStatusMsg("Generating zero-knowledge proof — this may take ~20s...");

      const { receipt } = await executeDeposit({
        depositAmountEth: depositStr,
        feeAmountEth: feeStr,
        walletKeys,
        relayerKeys,
        onSendTx: () => {
          setStep(2);
          setStatusMsg("Sending transaction to Monad Testnet...");
        },
      });

      setStep(3);
      setTxHash(receipt.hash);
      setStatusMsg("Deposit confirmed!");

      // trigger pool sync immediately
      setTimeout(() => forceSync?.(), 2000);

    } catch (err) {
      console.error(err);
      setFatalError(err.message || "Deposit failed. Check console for details.");
      setStep(-1);
    }
  };

  const isDone = step === 3;
  const isBusy = step >= 0 && step < 3;
  const userAmount = (() => {
    try {
      const d = ethers.parseEther(depositStr || "0");
      const f = ethers.parseEther(feeStr || "0");
      if (d > f) return ethers.formatEther(d - f);
    } catch {}
    return "—";
  })();

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-noir-950/80 animate-fade-in">
      <div className="relative w-full max-w-md mx-4 bg-noir-900 border border-noir-600 glow-border animate-slide-up">
        {/* corner accents */}
        <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-prifi-600" />
        <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-prifi-600" />
        <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-prifi-600" />
        <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-prifi-600" />

        {/* header */}
        <div className="p-6 border-b border-noir-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-prifi-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2v20M2 12h20" />
              </svg>
            </span>
            <div>
              <p className="font-display text-xs text-prifi-600 tracking-widest uppercase">Action</p>
              <h3 className="font-display text-lg text-white">Deposit Funds</h3>
            </div>
          </div>
          {!isBusy && (
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* step bar — shown while active */}
          {step >= 0 && <StepBar current={step} />}

          {/* ── IDLE / INPUT ── */}
          {step === -1 && (
            <>
              {/* deposit amount */}
              <Field
                label="Deposit Amount"
                hint="MON"
                error={errors.deposit}
              >
                <div className="relative">
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={depositStr}
                        onChange={(e) => setDepositStr(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-noir-800 border border-noir-600 focus:border-prifi-600 outline-none font-display text-sm text-white px-3 py-2.5 transition-colors placeholder:text-white/20"
                    />
                </div>
              </Field>

              {/* fee */}
              <Field
                label="Relayer Fee"
                hint={`min ${MIN_FEE_ETH} MON`}
                error={errors.fee}
              >
                <input
                  type="number"
                  min={MIN_FEE_ETH}
                  step="0.01"
                  value={feeStr}
                  onChange={(e) => setFeeStr(e.target.value)}
                  className="w-full bg-noir-800 border border-noir-600 focus:border-prifi-600 outline-none font-display text-sm text-white px-3 py-2.5 transition-colors"
                />
              </Field>

              {/* breakdown */}
              {depositStr && feeStr && !errors.deposit && !errors.fee && (
                <div className="border border-noir-700 bg-noir-800/30 px-3 py-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="font-display text-xs text-white/50 tracking-widest">You deposit</span>
                    <span className="font-display text-xs text-white">{depositStr} MON</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-display text-xs text-white/50 tracking-widest">Relayer fee</span>
                    <span className="font-display text-xs text-white">− {feeStr} MON</span>
                  </div>
                  <div className="h-px bg-noir-700 my-1" />
                  <div className="flex justify-between">
                    <span className="font-display text-xs text-prifi-600 tracking-widest">You receive</span>
                    <span className="font-display text-xs text-prifi-400">{userAmount} MON</span>
                  </div>
                </div>
              )}

              {fatalError && (
                <div className="flex items-start gap-2 p-3 border border-crimson-400/40 bg-crimson-400/5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-crimson-400 mt-0.5 flex-shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="font-display text-xs text-crimson-400 leading-relaxed">{fatalError}</p>
                </div>
              )}
            </>
          )}

          {/* ── BUSY ── */}
          {isBusy && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Spinner size={28} />
              <p className="font-display text-xs text-prifi-400 tracking-widest text-center leading-relaxed max-w-xs">
                {statusMsg}
              </p>
              {step === 1 && (
                <p className="text-[11px] font-body text-white/40 text-center">
                  ZK proof generation runs locally in your browser and takes ~20–30 seconds.
                </p>
              )}
            </div>
          )}

          {/* ── DONE ── */}
          {isDone && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-12 h-12 border border-prifi-600 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-prifi-400">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="font-display text-sm text-prifi-400 tracking-widest mb-1">Deposit Confirmed</p>
                <p className="font-body text-xs text-white/50">Your funds have been privately deposited.</p>
              </div>
              {txHash && (
                <a
                  href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-display text-[11px] text-prifi-600 hover:text-prifi-400 underline underline-offset-2 tracking-widest transition-colors"
                >
                  View on Explorer →
                </a>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="p-6 pt-0 flex gap-3">
          {step === -1 && (
            <>
              <button
                onClick={onClose}
                className="flex-1 font-display text-xs tracking-widest uppercase py-2.5 border border-noir-600 text-white/60 hover:text-white hover:border-noir-500 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                className="flex-1 font-display text-xs tracking-widest uppercase py-2.5 border border-prifi-600 text-prifi-400 hover:bg-prifi-600/10 transition-all"
              >
                Deposit
              </button>
            </>
          )}
          {isDone && (
            <button
              onClick={onClose}
              className="w-full font-display text-xs tracking-widest uppercase py-2.5 border border-prifi-600 text-prifi-400 hover:bg-prifi-600/10 transition-all"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}