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

const v2Features = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 1l4 4-4 4" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <path d="M7 23l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    ),
    title: "Private Swaps",
    desc: "Exchange any asset without exposing your position, size, or strategy to MEV bots or observers.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Private Holdings",
    desc: "Keep your portfolio invisible. Holdings, allocations, and PnL stay yours alone.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
        <path d="M7 8h.01M12 8h5" />
        <path d="M7 12h.01M12 12h5" />
      </svg>
    ),
    title: "Private Function Calls",
    desc: "Interact with any on-chain contract — DeFi, governance, NFTs — without your address being linked.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
    title: "Stealth Yield",
    desc: "Earn from lending, staking, and liquidity provision with no public trace of participation.",
  },
];

// ─── Social icons ──────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

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
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full bg-prifi-600/5 blur-[100px]" />
        </div>

        <div className="flex items-center gap-3 mb-8 relative">
          <span className="font-display text-xs tracking-widest text-white/60 uppercase border border-noir-700 px-3 py-1">
            Monad Testnet
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

        <div className="mt-20 flex flex-wrap justify-center gap-px border border-noir-700 relative">
          {[
            { label: "Transactions", value: "Encrypted" },
            { label: "Network", value: "Monad" },
            { label: "Privacy", value: "ZK-Backed" },
            { label: "Status", value: "V1 live" },
          ].map((s) => (
            <div
              key={s.label}
              className="px-8 py-4 border border-noir-700 bg-noir-900/50 text-center"
            >
              <p className="font-display text-sm text-white">{s.value}</p>
              <p className="font-body text-xs text-white/60 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* V1 — Core Protocol */}
      <section className="max-w-6xl mx-auto px-6 pb-16 w-full">
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

      {/* V2 — Coming Soon */}
      <section className="max-w-6xl mx-auto px-6 pb-24 w-full">
        {/* Header row */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <p className="font-display text-xs text-white/30 tracking-widest uppercase mb-1">
              On the horizon
            </p>
            <div className="flex items-center gap-3">
              <p className="font-display text-xs text-prifi-600 tracking-widest uppercase">
                V2 — Private Wallet
              </p>
              <span className="font-display text-xs text-white/40 border border-white/10 bg-white/5 px-2 py-0.5 tracking-widest uppercase">
                Coming Soon
              </span>
            </div>
          </div>
          <p className="font-body text-xs text-white/40 max-w-sm leading-relaxed text-right">
            A complete private wallet layer — not just balances, but every
            on-chain action becomes unobservable.
          </p>
        </div>

        {/* Subtle separator line */}
        <div className="w-full h-px bg-gradient-to-r from-prifi-600/30 via-prifi-600/10 to-transparent mb-8" />

        {/* V2 feature cards — slightly muted to signal "not yet" */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-noir-800">
          {v2Features.map((f) => (
            <div
              key={f.title}
              className="bg-noir-950 p-6 flex flex-col gap-4 relative overflow-hidden group border border-noir-800 hover:border-prifi-600/20 transition-colors"
            >
              {/* Dim overlay — lifts on hover */}
              <div className="absolute inset-0 bg-noir-950/60 group-hover:bg-noir-950/20 transition-all duration-300 pointer-events-none" />

              <span className="text-prifi-600/50 group-hover:text-prifi-600/80 transition-colors relative z-10">
                {f.icon}
              </span>
              <div className="relative z-10">
                <h3 className="font-display text-sm text-white/50 group-hover:text-white/80 mb-2 transition-colors">
                  {f.title}
                </h3>
                <p className="font-body text-xs text-white/30 group-hover:text-white/50 leading-relaxed transition-colors">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom callout */}
        <div className="mt-6 border border-prifi-600/15 bg-prifi-600/[0.03] px-6 py-4 flex items-center gap-4">
          <div className="w-1.5 h-1.5 rounded-full bg-prifi-600/60 animate-pulse flex-shrink-0" />
          <p className="font-body text-xs text-white/40 leading-relaxed">
            V2 extends the ZK core with private contract interactions — enabling
            private swaps, stealth yield, and invisible on-chain positions. Same
            math. Broader surface.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-noir-700 py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-display text-xs text-white/60 tracking-wider">PriFi © 2026</span>

          {/* Built by */}
          <div className="flex items-center gap-3">
            <span className="font-display text-xs text-white/30 tracking-wider">Built by</span>
            <span className="font-display text-xs text-white/60 tracking-wider">Mahesh</span>
            <div className="flex items-center gap-2 ml-1">
              <a
                href="https://x.com/0xM4he5h"
                target="_blank"
                rel="noreferrer"
                className="text-white/30 hover:text-prifi-400 transition-colors"
                aria-label="X / Twitter"
              >
                <XIcon />
              </a>
              <a
                href="https://github.com/Maheshkarri4444"
                target="_blank"
                rel="noreferrer"
                className="text-white/30 hover:text-prifi-400 transition-colors"
                aria-label="GitHub"
              >
                <GithubIcon />
              </a>
              <a
                href="https://www.linkedin.com/"
                target="_blank"
                rel="noreferrer"
                className="text-white/30 hover:text-prifi-400 transition-colors"
                aria-label="LinkedIn"
              >
                <LinkedInIcon />
              </a>
            </div>
          </div>

          <span className="font-display text-xs text-white/60">
            Private Finance on{" "}
            <span className="text-prifi-600">Monad</span>
          </span>
        </div>
      </footer>
    </div>
  );
}