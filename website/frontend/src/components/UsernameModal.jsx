import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { createUser } from "../services/api";

export default function UsernameModal() {
  const { pendingAddress, signAuthMessage, finalizeUser, walletKeys } = useWallet();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getFinalUsername = (val) => {
    const trimmed = val.trim();
    return trimmed.endsWith(".PriFi") ? trimmed : `${trimmed}.PriFi`;
  };

  const handleSubmit = async () => {
    setError("");
    const trimmed = username.trim();
    if (!trimmed) return setError("Username is required.");

    const finalUsername = getFinalUsername(trimmed);

    setLoading(true);
    try {
      // signAuthMessage returns cached sig — no second MetaMask popup
      await signAuthMessage(pendingAddress);

      if (!walletKeys) throw new Error("Wallet keys not generated. Please reconnect.");

      const newUser = await createUser({
        name: finalUsername,
        realAddress: pendingAddress,
        privateWalletPublicKey: walletKeys.privateWallet.publicKey,
        zkPublicKey: walletKeys.zk.publicKey,
      });

      await finalizeUser(newUser);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e) => {
    let val = e.target.value;
    if (val.includes(".PriFi")) {
      val = val.replace(".PriFi", "");
    }
    setUsername(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-noir-950/80 animate-fade-in">
      <div className="relative w-full max-w-md mx-4 bg-noir-900 border border-noir-600 glow-border p-8 animate-slide-up">
        <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-prifi-600" />
        <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-prifi-600" />
        <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-prifi-600" />
        <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-prifi-600" />

        <div className="mb-6">
          <p className="font-display text-xs text-prifi-600 tracking-widest uppercase mb-2">New Identity</p>
          <h2 className="font-display text-2xl text-white">Choose your handle</h2>
          <p className="text-noir-600 text-sm mt-2 font-body">
            Address{" "}
            <span className="text-prifi-400 font-display text-xs">
              {pendingAddress?.slice(0, 6)}...{pendingAddress?.slice(-4)}
            </span>{" "}
            is not registered yet.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center bg-noir-800 border border-noir-600 focus-within:border-prifi-600 transition-colors">
            <input
              type="text"
              value={username}
              onChange={handleInput}
              placeholder="yourname"
              className="flex-1 bg-transparent outline-none px-4 py-3 font-display text-sm text-white placeholder-noir-600"
            />
            <span className="pr-4 font-display text-sm text-prifi-600 select-none">.PriFi</span>
          </div>

          {error && (
            <p className="text-crimson-400 text-xs font-display">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !username}
            className="w-full font-display text-sm tracking-widest uppercase py-3 bg-prifi-600/10 border border-prifi-600 text-prifi-400 hover:bg-prifi-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border border-prifi-400 border-t-transparent rounded-full animate-spin" />
                Signing...
              </>
            ) : (
              "Sign & Create Identity"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}