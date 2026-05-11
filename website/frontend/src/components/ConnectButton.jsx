import React from "react";
import { useWallet } from "../context/WalletContext";

export default function ConnectButton({ className = "" }) {
  const { connectWallet, isConnecting, error } = useWallet();

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className={`relative group font-display text-sm tracking-widest uppercase px-8 py-3 rounded-none border border-prifi-600 text-prifi-400 bg-transparent transition-all duration-300 hover:bg-prifi-600/10 hover:border-prifi-400 hover:glow-text disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <span className="relative z-10 flex items-center gap-3">
          {isConnecting ? (
            <>
              <span className="w-3 h-3 border border-prifi-400 border-t-transparent rounded-full animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Connect Wallet
            </>
          )}
        </span>
        {/* corner accents */}
        <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-prifi-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="absolute top-0 right-0 w-2 h-2 border-t border-r border-prifi-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-prifi-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-prifi-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      {error && (
        <p className="text-crimson-400 text-xs font-display max-w-xs text-center">{error}</p>
      )}
    </div>
  );
}