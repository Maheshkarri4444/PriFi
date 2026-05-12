import React from "react";
import { useWallet } from "../context/WalletContext";
import { useNavigate } from "react-router-dom";
import { usePool } from "../context/PoolContext";

export default function Header() {
  const { address, userData, disconnectWallet } = useWallet();
  const { formattedBalance } = usePool();  
  const navigate = useNavigate();

  const handleDisconnect = () => {
    disconnectWallet();
    navigate("/");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-noir-700 bg-noir-950/80 modal-backdrop">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 border border-prifi-600 flex items-center justify-center">
            <div className="w-3 h-3 bg-prifi-600" />
          </div>
          <span className="font-display text-lg tracking-widest text-white">
            PriFi
          </span>
        </div>

        {/* Right side */}
        {address && (
          <div className="flex items-center gap-4">
            {/* Balance badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 border border-noir-600 bg-noir-800">
              <span className="w-1.5 h-1.5 rounded-full bg-prifi-600 animate-pulse" />
              <span className="font-display text-xs text-prifi-400">
                {formattedBalance} MON          {/* ← live balance */}
              </span>
            </div>


            {/* Username */}
            {userData?.name && (
              <span className="font-display text-xs text-prifi-400 tracking-wide hidden md:block">
                {userData.name}
              </span>
            )}

            {/* Address + disconnect */}
            <div className="flex items-center gap-2">
              <span className="font-display text-xs text-white/60">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <button
                onClick={handleDisconnect}
                className="text-white/60 hover:text-crimson-400 transition-colors"
                title="Disconnect"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}