import React from "react";
import { useWallet } from "../context/WalletContext";

const ICONS = {
  deposit: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2v20M2 12h20" />
    </svg>
  ),
  transfer: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  withdraw: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22V2M2 12h20" transform="rotate(45 12 12)" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
};

export default function ActionModal({ type, onClose }) {
  const { allUsers } = useWallet();
  const isTransfer = type === "transfer";

  const titles = {
    deposit: "Deposit Funds",
    transfer: "Private Transfer",
    withdraw: "Withdraw Funds",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-noir-950/80 animate-fade-in">
      <div className="relative w-full max-w-md mx-4 bg-noir-900 border border-noir-600 glow-border animate-slide-up">
        <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-prifi-600" />
        <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-prifi-600" />
        <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-prifi-600" />
        <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-prifi-600" />

        <div className="p-6 border-b border-noir-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-prifi-600">{ICONS[type]}</span>
            <div>
              <p className="font-display text-xs text-prifi-600 tracking-widest uppercase">Action</p>
              <h3 className="font-display text-lg text-white">{titles[type]}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Building notice */}
          <div className="flex items-start gap-3 p-4 border border-prifi-600/20 bg-prifi-600/5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4dffc8" strokeWidth="1.5" className="mt-0.5 flex-shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="font-display text-xs text-prifi-400 tracking-wider">Currently in building stage</p>
              <p className="text-white/60 text-xs font-body mt-1">
                {isTransfer
                  ? "Private transfers are being finalized. You can preview available recipients below."
                  : "This feature will be live soon on Monad Testnet."}
              </p>
            </div>
          </div>

          {/* Transfer: show all users */}
          {isTransfer && (
            <div>
              <p className="font-display text-xs text-white/60 uppercase tracking-widest mb-2">
                Registered Users
              </p>
              {allUsers.length === 0 ? (
                <p className="text-white/60 text-xs font-body">No users found.</p>
              ) : (
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {allUsers.map((u) => (
                    <div
                      key={u._id || u.realAddress}
                      className="flex items-center justify-between px-3 py-2.5 border border-noir-700 hover:border-prifi-600/40 bg-noir-800 transition-colors cursor-not-allowed opacity-70"
                    >
                      <div>
                        <p className="font-display text-xs text-prifi-400">{u.name}</p>
                        <p className="font-display text-xs text-white/60 mt-0.5">
                          {u.realAddress?.slice(0, 10)}...{u.realAddress?.slice(-6)}
                        </p>
                      </div>
                      <span className="text-xs font-display text-white/60 border border-noir-700 px-2 py-0.5">
                        Select
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 pt-0">
          <button
            onClick={onClose}
            className="w-full font-display text-xs tracking-widest uppercase py-2.5 border border-noir-600 text-white/60 hover:text-white hover:border-noir-500 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}