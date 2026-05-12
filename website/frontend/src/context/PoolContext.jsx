import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import * as circomlibjs from "circomlibjs";
import { ethers } from "ethers";
import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";
import { decryptMessage } from "../helpers/crypto"; // your existing decrypt helper
import { useWallet } from "./WalletContext";
import { BASE_URL } from "../services/api";
const PoolContext = createContext(null);

const STATE_LATEST_URL = `${BASE_URL}/state/latest`;
const POLL_INTERVAL_MS = 10_000;

// ─── helpers ────────────────────────────────────────────────────────────────

async function buildPoseidonHasher() {
  const poseidon = await circomlibjs.buildPoseidon();
  return {
    poseidon,
    hash: (inputs) =>
      BigInt(poseidon.F.toString(poseidon(inputs))),
  };
}

function makeTree(hash) {
  const ZERO_VALUE = BigInt(0);
  return new IncrementalMerkleTree(hash, 20, ZERO_VALUE, 2);
}

// ─── provider ───────────────────────────────────────────────────────────────

export function PoolProvider({ children }) {
  const { walletKeys, address } = useWallet();

  // per-pool: { [poolId]: { tree, commitments: string[], roots: string[], latestRoot: string|null } }
  const poolStatesRef = useRef({});

  // processed commitment count per pool so we skip already-seen ones
  const processedCountRef = useRef({}); // { [poolId]: number }

  // spent nullifiers set (strings)
  const spentNullifiersRef = useRef(new Set());

  // poseidon instance (built once)
  const poseidonRef = useRef(null);
  const hashRef = useRef(null);

  // exposed state
  const [unspentCommitments, setUnspentCommitments] = useState([]); // cmxRecord[]
  const [spentCommitments, setSpentCommitments] = useState([]);     // cmxRecord[]
  const [balance, setBalance] = useState("0");                      // string (wei / raw amount)
  const [poolStatesSnap, setPoolStatesSnap] = useState({});         // for consumers that want tree info
  const [loading, setLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const walletKeysRef = useRef(walletKeys);
  walletKeysRef.current = walletKeys;

  // ── init poseidon once ──────────────────────────────────────────────────
  useEffect(() => {
    buildPoseidonHasher().then(({ poseidon, hash }) => {
      poseidonRef.current = poseidon;
      hashRef.current = hash;
    });
  }, []);

  // ── reset everything when wallet changes (address changes) ──────────────
  // This covers both disconnect and MetaMask account switch.
  // We do NOT rebuild trees — trees are pool-level and address-independent.
  // We only clear the wallet-level note/balance state.
  const resetWalletState = useCallback(() => {
    setUnspentCommitments([]);
    setSpentCommitments([]);
    setBalance("0");
  }, []);

  useEffect(() => {
    resetWalletState();
    // When address changes we want a fresh scan from existing pool data.
    // We keep trees intact (pool state) but re-derive wallet notes.
    // Force a re-scan by running processAll against current pool states next poll.
    // We mark processedCount as 0 for wallet state only — pool trees are unchanged.
    // Nothing else needed here; the next poll will recompute wallet notes.
  }, [address, resetWalletState]);

  // ── core: ensure pool initialized ──────────────────────────────────────
  function ensurePool(poolId) {
    if (!poolStatesRef.current[poolId]) {
      poolStatesRef.current[poolId] = {
        tree: makeTree(hashRef.current),
        commitments: [],
        encryptedNotes: {},   // commitment (string) -> encryptedNote (string)
        roots: [],
        latestRoot: null,
      };
      processedCountRef.current[poolId] = 0;
    }
  }

  // ── core: sync from server response ────────────────────────────────────
  const syncFromLatest = useCallback(async (serverData) => {
    if (!hashRef.current || !poseidonRef.current) return; // poseidon not ready
    const keys = walletKeysRef.current;
    if (!keys) return; // not logged in

    const { spentNullifiers, poolStates: serverPools } = serverData;

    // 1. Update spent nullifiers
    spentNullifiersRef.current = new Set(spentNullifiers);

    // 2. For each pool — insert only NEW commitments into the tree
    for (const serverPool of serverPools) {
      const poolId = serverPool.poolId;
      ensurePool(poolId);

      const localState = poolStatesRef.current[poolId];
      const serverCommitments = serverPool.commitments || [];
      const serverEncryptedNotes = serverPool.encryptedNotes || {};
      const alreadyProcessed = processedCountRef.current[poolId];
      const newCommitments = serverCommitments.slice(alreadyProcessed);

      for (const cmxStr of newCommitments) {
        const cmxBigInt = BigInt(cmxStr);
        localState.tree.insert(cmxBigInt);
        localState.commitments.push(cmxStr);
        const root = localState.tree.root.toString();
        localState.roots.push(root);
        localState.latestRoot = root;
      }

      // Merge encrypted notes map
      Object.assign(localState.encryptedNotes, serverEncryptedNotes);

      processedCountRef.current[poolId] = serverCommitments.length;
    }

    // 3. Recompute wallet notes across ALL pools
    // (we always recompute from scratch for the wallet — cheap since
    //  the heavy work is tree insertion which we've already skipped for old entries)
    const newUnspent = [];
    const newSpent = [];
    let totalBalance = BigInt(0);

    const poseidon = poseidonRef.current;

    for (const [poolId, localState] of Object.entries(poolStatesRef.current)) {
      const { commitments, encryptedNotes, tree } = localState;

      for (let leafIndex = 0; leafIndex < commitments.length; leafIndex++) {
        const cmxStr = commitments[leafIndex];
        const encryptedNote = encryptedNotes[cmxStr];
        if (!encryptedNote) continue;

        // Try to decrypt
        let parsed;
        try {
          const decrypted = decryptMessage(
            encryptedNote,
            keys.privateWallet.privateKey
          );
          parsed = JSON.parse(decrypted);
        } catch {
          continue; // not mine
        }

        // Compute expected nullifier
        const expectedNullifier = poseidon.F.toString(
          poseidon([
            2,
            cmxStr,
            parsed.randomness,
            keys.zk.secretKey,
          ])
        );

        const root = localState.roots[leafIndex] ?? localState.latestRoot;

        const record = {
          poolId,
          commitment: cmxStr,
          encryptedNote,
          amount: parsed.amount,
          randomness: parsed.randomness,
          leafIndex,
          root,
          nullifier: expectedNullifier,
        };

        if (spentNullifiersRef.current.has(expectedNullifier)) {
          newSpent.push(record);
        } else {
          newUnspent.push(record);
          totalBalance += BigInt(parsed.amount);
        }
      }
    }

    setUnspentCommitments(newUnspent);
    setSpentCommitments(newSpent);
    setBalance(totalBalance.toString());
    setPoolStatesSnap(
      Object.fromEntries(
        Object.entries(poolStatesRef.current).map(([id, s]) => [
          id,
          {
            commitmentCount: s.commitments.length,
            latestRoot: s.latestRoot,
          },
        ])
      )
    );
    setLastSyncedAt(Date.now());
  }, []);

  // ── polling ─────────────────────────────────────────────────────────────
  const fetchAndSync = useCallback(async () => {
    if (!walletKeysRef.current) return; // not logged in — skip
    try {
      setLoading(true);
      const res = await fetch(STATE_LATEST_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      await syncFromLatest(data);
    } catch (err) {
      console.error("[PoolContext] sync error:", err);
    } finally {
      setLoading(false);
    }
  }, [syncFromLatest]);

  useEffect(() => {
    if (!walletKeys) return; // don't poll until logged in

    fetchAndSync(); // immediate first fetch

    const id = setInterval(fetchAndSync, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [walletKeys, fetchAndSync]);

  // ── formatted balance helper ────────────────────────────────────────────
  // If your amounts are in wei, format with ethers; if they're raw integers,
  // just expose the string. Adjust to your denomination.
  const formattedBalance = (() => {
    try {
      // Assuming amounts are in wei (18 decimals) — adjust if different
      return ethers.formatEther(balance === "" ? "0" : balance);
    } catch {
      return "0.0";
    }
  })();

  const value = {
    unspentCommitments,
    spentCommitments,
    balance,           // raw BigInt string
    formattedBalance,  // "0.0" style string for display
    poolStatesSnap,
    loading,
    lastSyncedAt,
    forceSync: fetchAndSync,
  };

  return (
    <PoolContext.Provider value={value}>
      {children}
    </PoolContext.Provider>
  );
}

export function usePool() {
  const ctx = useContext(PoolContext);
  if (!ctx) throw new Error("usePool must be used within PoolProvider");
  return ctx;
}