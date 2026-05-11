import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";

function KeyRow({ label, value }) {
  return (
    <div className="py-3 border-b border-noir-700 last:border-0">
      <p className="text-xs text-white/60 font-display uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xs text-prifi-400 break-all font-display">{value || "—"}</p>
    </div>
  );
}

export default function WalletDetails() {
  const { userData, address, walletKeys } = useWallet();
  const [open, setOpen] = useState(false);
  const [showPrivKey, setShowPrivKey] = useState(false);

  const copyAll = () => {
    const text = [
      `Public Key: ${walletKeys?.privateWallet?.publicKey ?? ""}`,
      `ZK Public Key: ${walletKeys?.zk?.publicKey ?? ""}`,
      `Private Wallet Address: ${walletKeys?.privateWallet?.address ?? ""}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-display tracking-widest text-white/60 uppercase hover:text-prifi-400 transition-colors flex items-center gap-2 border-b border-dashed border-noir-700 pb-0.5"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Wallet Details
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-noir-950/80 animate-fade-in">
          <div className="relative w-full max-w-lg mx-4 bg-noir-900 border border-noir-600 glow-border animate-slide-up">
            <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-prifi-600" />
            <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-prifi-600" />
            <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-prifi-600" />
            <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-prifi-600" />

            <div className="p-6 border-b border-noir-700 flex items-center justify-between">
              <div>
                <p className="font-display text-xs text-prifi-600 tracking-widest uppercase">Identity</p>
                <h3 className="font-display text-lg text-white mt-0.5">{userData?.name}</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-0">
              <KeyRow label="Ethereum Address" value={address} />
              <KeyRow label="Private Wallet Address" value={walletKeys?.privateWallet?.address} />
              <KeyRow label="Private Wallet Public Key" value={walletKeys?.privateWallet?.publicKey} />
              <KeyRow label="ZK Public Key" value={walletKeys?.zk?.publicKey} />

              {/* Private key — reveal on demand */}
              <div className="py-3 border-b border-noir-700">
                <p className="text-xs text-white/60 font-display uppercase tracking-wider mb-1">Private Key</p>
                {showPrivKey ? (
                  <p className="text-xs text-crimson-400 break-all font-display">
                    {walletKeys?.privateWallet?.privateKey || "Not available"}
                  </p>
                ) : (
                  <button
                    onClick={() => setShowPrivKey(true)}
                    className="flex items-center gap-2 text-xs font-display text-crimson-400 hover:text-crimson-400/80 transition-colors border border-crimson-400/30 px-3 py-1.5 hover:bg-crimson-400/5"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Reveal Private Key
                  </button>
                )}
              </div>

              {/* ZK Secret Key — also sensitive */}
              <div className="py-3">
                <p className="text-xs text-white/60 font-display uppercase tracking-wider mb-1">ZK Secret Key</p>
                {showPrivKey ? (
                  <p className="text-xs text-crimson-400 break-all font-display">
                    {walletKeys?.zk?.secretKey || "Not available"}
                  </p>
                ) : (
                  <p className="text-xs text-white/20 font-display">Hidden — reveal private key to show</p>
                )}
              </div>
            </div>

            <div className="p-6 pt-0">
              <button
                onClick={copyAll}
                className="flex items-center gap-2 text-xs font-display tracking-wider text-prifi-400 border border-prifi-600/40 px-4 py-2 hover:bg-prifi-600/10 transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy All Keys
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}