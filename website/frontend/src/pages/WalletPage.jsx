import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import Header from "../components/Header";
import WalletDetails from "../components/WalletDetails";
import ActionModal from "../components/ActionModal";

const ACTIONS = [
  {
    id: "deposit",
    label: "Deposit",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v20M2 12h20" />
      </svg>
    ),
  },
  {
    id: "transfer",
    label: "Transfer",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
  },
  {
    id: "withdraw",
    label: "Withdraw",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
      </svg>
    ),
  },
];

function CopyIdentityButton({ walletKeys }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const text = `Public Key: ${walletKeys?.privateWallet?.publicKey ?? ""}\nZK Public Key: ${walletKeys?.zk?.publicKey ?? ""}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy keys"
      className="flex items-center gap-1.5 text-xs font-display text-white/60 hover:text-prifi-400 transition-colors"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy Keys
        </>
      )}
    </button>
  );
}

// Fullscreen overlay shown when MetaMask account is switched
function WalletChangedOverlay({ onGoHome }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-noir-950/95 modal-backdrop animate-fade-in">
      <div className="relative w-full max-w-sm mx-4 bg-noir-900 border border-crimson-400/40 p-8 text-center animate-slide-up">
        <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-crimson-400" />
        <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-crimson-400" />
        <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-crimson-400" />
        <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-crimson-400" />

        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-12 h-12 border border-crimson-400/40 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-crimson-400">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        </div>

        <p className="font-display text-xs text-crimson-400 tracking-widest uppercase mb-2">
          Wallet Changed
        </p>
        <h2 className="font-display text-xl text-white mb-3">Account switched</h2>
        <p className="font-body text-sm text-white/60 mb-8 leading-relaxed">
          A different MetaMask account was detected. Your session has been cleared. Go back and reconnect with the correct account.
        </p>

        <button
          onClick={onGoHome}
          className="w-full font-display text-sm tracking-widest uppercase py-3 border border-crimson-400/60 text-crimson-400 hover:bg-crimson-400/10 transition-all"
        >
          Go Back & Reconnect
        </button>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const { userData, address, walletKeys, walletChanged, disconnectWallet } = useWallet();
  const [activeModal, setActiveModal] = useState(null);

  const handleGoHome = () => {
    disconnectWallet();
    window.location.href = "/"; // or use your router: navigate("/")
  };

  return (
    <div className="min-h-screen grid-bg">
      <Header />

      {/* Wallet changed — fullscreen takeover */}
      {walletChanged && <WalletChangedOverlay onGoHome={handleGoHome} />}

      <main className="max-w-2xl mx-auto px-6 pt-28 pb-16">
        {/* Identity block */}
        <div className="border border-noir-700 glow-border bg-noir-900/60 p-6 mb-6 animate-slide-up relative">
          <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-prifi-600" />
          <span className="absolute top-0 right-0 w-3 h-3 border-t border-r border-prifi-600" />
          <span className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-prifi-600" />
          <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-prifi-600" />

          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-display text-xs text-prifi-600 tracking-widest uppercase mb-1">Identity</p>
              <h2 className="font-display text-2xl text-white tracking-wide">
                {userData?.name || "—"}
              </h2>
            </div>
            <CopyIdentityButton walletKeys={walletKeys} />
          </div>

          <div className="flex items-center gap-2 text-xs font-display text-white/60 mb-5">
            <span>{address?.slice(0, 10)}...</span>
            <span>·</span>
            <span>Monad Testnet</span>
          </div>

          <WalletDetails />
        </div>

        {/* Balance card */}
        <div className="border border-noir-700 bg-noir-900/40 p-6 mb-6 animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-xs text-white/60 uppercase tracking-widest mb-1">Balance</p>
              <p className="font-display text-4xl text-white">
                0.0 <span className="text-prifi-600 text-2xl">MON</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="flex items-center gap-1.5 font-display text-xs text-prifi-600">
                <span className="w-1.5 h-1.5 rounded-full bg-prifi-600 animate-pulse" />
                Live
              </span>
              <span className="text-xs font-body text-white/60">Currently building</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-3 animate-slide-up">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => setActiveModal(action.id)}
              className="group flex flex-col items-center gap-3 py-6 border border-noir-700 bg-noir-900/40 hover:border-prifi-600/60 hover:bg-prifi-600/5 transition-all duration-300 relative"
            >
              <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-prifi-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="absolute top-0 right-0 w-2 h-2 border-t border-r border-prifi-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-prifi-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-prifi-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-white/60 group-hover:text-prifi-400 transition-colors">{action.icon}</span>
              <span className="font-display text-xs tracking-widest uppercase text-white/60 group-hover:text-prifi-400 transition-colors">
                {action.label}
              </span>
            </button>
          ))}
        </div>

        {/* Key preview */}
        <div className="mt-6 border border-noir-700 bg-noir-900/20 p-4 animate-slide-up">
          <p className="font-display text-xs text-white/60 uppercase tracking-widest mb-3">Keys Preview</p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-white/60 font-display mb-0.5">Public Key</p>
              <p className="font-display text-xs text-prifi-400/60 break-all">
                {walletKeys?.privateWallet?.publicKey
                  ? walletKeys.privateWallet.publicKey.slice(0, 32) + "..."
                  : "Sign in MetaMask to derive keys"}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60 font-display mb-0.5">ZK Public Key</p>
              <p className="font-display text-xs text-prifi-400/60 break-all">
                {walletKeys?.zk?.publicKey
                  ? walletKeys.zk.publicKey.slice(0, 32) + "..."
                  : "Sign in MetaMask to derive keys"}
              </p>
            </div>
          </div>
        </div>
      </main>

      {activeModal && (
        <ActionModal type={activeModal} onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}