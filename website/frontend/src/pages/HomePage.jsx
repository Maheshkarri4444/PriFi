import React from "react";
import ConnectButton from "../components/ConnectButton";

const features = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: "Public Deposits",
    desc: "Shield your funds with zero-knowledge cryptography. No one knows what you deposited.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
    title: "Anonymous Transfers",
    desc: "Send assets to any PriFi identity without revealing the sender, receiver, or amount.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    title: "Private Withdrawals",
    desc: "Exit your funds cleanly. Withdraw to any address with full deniability.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    title: "ZK Proofs",
    desc: "Every transaction is backed by a cryptographic proof. Math doesn't lie.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen grid-bg flex flex-col">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-noir-700 bg-noir-950/80 modal-backdrop">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 border border-prifi-600 flex items-center justify-center">
              <div className="w-3 h-3 bg-prifi-600" />
            </div>
            <span className="font-display text-lg tracking-widest text-white">PriFi</span>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 relative overflow-hidden">
        {/* Background glow orb */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full bg-prifi-600/5 blur-[100px]" />
        </div>

        {/* Chain badges */}
        <div className="flex items-center gap-3 mb-8 relative">
          <span className="font-display text-xs tracking-widest text-white/60 uppercase border border-noir-700 px-3 py-1">
            Monad Testnet
          </span>
          <span className="w-1 h-1 bg-prifi-600 rounded-full" />
          <span className="font-display text-xs tracking-widest text-white/60 uppercase border border-noir-700 px-3 py-1">
            Ethereum Testnet
          </span>
        </div>

        <div className="relative max-w-3xl mx-auto">
          <h1 className="font-display text-5xl sm:text-7xl text-white leading-none tracking-tight mb-6">
            Finance in the{" "}
            <span className="text-prifi-400 glow-text">dark</span>
            <span className="text-prifi-600">.</span>
          </h1>
          <p className="font-body text-lg max-w-xl text-white/60 mx-auto mb-12 leading-relaxed">
            PriFi is a private wallet protocol on Monad and Ethereum. Deposit,
            transfer, and withdraw your funds without leaving a trace — backed
            by zero-knowledge proofs.
          </p>
          <ConnectButton />
        </div>

        {/* Stat row */}
        <div className="mt-20 flex flex-wrap justify-center gap-px border border-noir-700 relative">
          {[
            { label: "Transactions", value: "Encrypted" },
            { label: "Network", value: "Monad" },
            { label: "Privacy", value: "ZK-Backed" },
            { label: "Status", value: "Building" },
          ].map((s) => (
            <div
              key={s.label}
              className="px-8 py-4 border border-noir-700 bg-noir-900/50 text-center"
            >
              <p className="font-display text-sm text-white">{s.value}</p>
              <p className="font-body text-xs  text-white/60 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24 w-full">
        <p className="font-display text-xs text-prifi-600 tracking-widest uppercase mb-8">
          Core Protocol
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-noir-700">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-noir-900 p-6 flex flex-col gap-4 hover:bg-noir-800 transition-colors group"
            >
              <span className="text-prifi-600 group-hover:text-prifi-400 transition-colors">{f.icon}</span>
              <div>
                <h3 className="font-display text-sm text-white mb-2">{f.title}</h3>
                <p className="font-body text-xs text-white/60 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-noir-700 py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-display text-xs text-white/60 tracking-wider">PriFi © 2026</span>
          <span className="font-display text-xs text-white/60">
            Private Finance on{" "}
            <span className="text-prifi-600">Monad</span>
          </span>
        </div>
      </footer>
    </div>
  );
}