import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { buildPoseidon } from "circomlibjs";
import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";
import { decryptMessage } from "../helpers/crypto"; // your eciesjs wrapper
import { useWallet } from "./WalletContext";
import { BASE_URL } from "../services/api";
import { ethers } from "ethers";
const PoolContext = createContext(null);

const API_BASE = BASE_URL;
const POLL_INTERVAL_MS = 10_000;

// ─── Poseidon singleton ────────────────────────────────────────────────────────
let _poseidon = null;
async function getPoseidon() {
  if (!_poseidon) _poseidon = await buildPoseidon();
  return _poseidon;
}

function makeHashFn(poseidon) {
  return (inputs) =>
    BigInt(poseidon.F.toString(poseidon(inputs)));
}

function buildFreshTree(poseidon) {
  return new IncrementalMerkleTree(makeHashFn(poseidon), 20, BigInt(0), 2);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Try to decrypt an encrypted note with the given private key.
 * Returns parsed { amount, randomness } or null.
 */
function tryDecryptNote(encryptedHex, privateKey) {
  try {
    const plaintext = decryptMessage(encryptedHex, privateKey);
    return JSON.parse(plaintext); // { amount, randomness }
  } catch {
    return null;
  }
}

export function PoolProvider({ children }) {
  const { walletKeys, address } = useWallet();

  // ── raw state from server ──────────────────────────────────────────────────
  const [spentNullifiers, setSpentNullifiers] = useState([]);
  const [poolStates, setPoolStates] = useState([]); // array of pool objects

  // ── merkle tree per poolId ─────────────────────────────────────────────────
  // treeMap: { [poolId]: IncrementalMerkleTree }
  const treeMapRef = useRef({});

  // ── your decrypted UTXOs ───────────────────────────────────────────────────
  // { [poolId]: [ { commitment, amount, randomness, leafIndex, spent } ] }
  const [myUTXOs, setMyUTXOs] = useState({});

  // ── sync meta ──────────────────────────────────────────────────────────────
  // how many commitments we've already inserted per pool
  const insertedCountRef = useRef({}); // { [poolId]: number }
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [error, setError] = useState(null);
  const poseidonRef = useRef(null);

  // ─── initialise poseidon once ────────────────────────────────────────────
  useEffect(() => {
    getPoseidon().then((p) => { poseidonRef.current = p; });
  }, []);

  // ─── process a fresh server response ─────────────────────────────────────
  const processState = useCallback(
    async (data) => {
      const poseidon = poseidonRef.current;
      if (!poseidon) return;

      setSpentNullifiers(data.spentNullifiers || []);
      const pools = data.poolStates || [];
      setPoolStates(pools);

      const privateKey = walletKeys?.privateWallet?.privateKey ?? null;
      const updatedUTXOs = {};

      for (const pool of pools) {
        const pid = pool.poolId;
        const commitments = pool.commitments || []; // array of hex/decimal strings
        // encryptedNotes is a Map serialised as object: { [commitment]: encryptedHex }
        const encryptedNotes =
          pool.encryptedNotes instanceof Map
            ? Object.fromEntries(pool.encryptedNotes)
            : pool.encryptedNotes || {};

        // ── build or extend tree ─────────────────────────────────────────
        if (!treeMapRef.current[pid]) {
          treeMapRef.current[pid] = buildFreshTree(poseidon);
          insertedCountRef.current[pid] = 0;
        }
        const tree = treeMapRef.current[pid];
        const alreadyInserted = insertedCountRef.current[pid];

        // Only process NEW commitments (delta from last sync)
        const newCommitments = commitments.slice(alreadyInserted);
        for (const cmx of newCommitments) {
          tree.insert(BigInt(cmx));
        }
        insertedCountRef.current[pid] = commitments.length;

        // ── decrypt notes & build UTXOs ──────────────────────────────────
        // Carry forward existing UTXOs so we don't lose already-decrypted ones
        const existingUTXOs = myUTXOs[pid] || [];
        const existingByCommitment = Object.fromEntries(
          existingUTXOs.map((u) => [u.commitment, u])
        );

        const utxosForPool = [];
        for (let i = 0; i < commitments.length; i++) {
          const cmx = commitments[i];

          // If we already processed this commitment, recheck spent status and carry forward
          if (existingByCommitment[cmx]) {
            utxosForPool.push({
              ...existingByCommitment[cmx],
              spent: data.spentNullifiers.includes(
                existingByCommitment[cmx].nullifier
              ),
            });
            continue;
          }

          // Try to decrypt the note for this commitment
          const encryptedHex = encryptedNotes[cmx];
          if (!encryptedHex || !privateKey) continue;

          const decrypted = tryDecryptNote(encryptedHex, privateKey);
          if (!decrypted) continue; // not yours
        //   console.log("try decrypt",decrypted );
          // Compute nullifier: Poseidon(2, secretKey, leafIndex)
          const sk = walletKeys?.zk?.secretKey;
          if (!sk) continue;
          const leafIndex = pool.leafToIndex
            ? typeof pool.leafToIndex.get === "function"
              ? pool.leafToIndex.get(cmx)
              : pool.leafToIndex[cmx]
            : i;
            const nullifier =
                ethers.zeroPadValue(

                    ethers.toBeHex(

                        BigInt(
                            poseidon.F.toString(
                                poseidon([
                                    2,
                                    BigInt(cmx),
                                    BigInt(decrypted.randomness),
                                    BigInt(sk),
                                ])
                            )
                        )
                    ),

                    32
                );
            // console.log("spent nullifier:",data.spentNullifiers);
            // console.log(`nullifier: ${nullifier} spent nullifier: ${data.spentNullifiers.includes(nullifier)}`);
          utxosForPool.push({
            commitment: cmx,
            amount: decrypted.amount,
            randomness: decrypted.randomness,
            leafIndex: leafIndex ?? i,
            nullifier,
            spent: data.spentNullifiers.includes(nullifier),
            poolId: pid,
          });
        }

        updatedUTXOs[pid] = utxosForPool;
      }

      setMyUTXOs(updatedUTXOs);
      setLastSyncedAt(Date.now());
    },
    // walletKeys changes only when user logs in/out
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walletKeys]
  );

  // ─── fetch from server ────────────────────────────────────────────────────
  const fetchLatest = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/state/latest`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      await processState(data);
    } catch (err) {
      setError(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [processState]);

  // ─── initial fetch after login ────────────────────────────────────────────
  useEffect(() => {
    if (!address) return; // not logged in
    // reset tree state on login/logout
    treeMapRef.current = {};
    insertedCountRef.current = {};
    setMyUTXOs({});
    fetchLatest();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // ─── poll every 10 seconds ────────────────────────────────────────────────
  useEffect(() => {
    if (!address) return;
    const id = setInterval(fetchLatest, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [address, fetchLatest]);

  // ─── helpers consumers can use ────────────────────────────────────────────

  /** Get the latest root for a given pool */
  const getRoot = useCallback((poolId) => {
    const tree = treeMapRef.current[poolId];
    return tree ? tree.root.toString() : null;
  }, []);

  /**
   * Get a Merkle proof (siblings + pathIndices) for a commitment in a pool.
   * Used by the withdraw/transfer ZK circuits.
   */
  const getMerkleProof = useCallback((poolId, leafIndex) => {
    const tree = treeMapRef.current[poolId];
    if (!tree) return null;
    try {
      return tree.createProof(leafIndex);
    } catch {
      return null;
    }
  }, []);

  /** All unspent UTXOs across all pools that belong to the current user */
  const allUnspentUTXOs = Object.values(myUTXOs)
    .flat()
    .filter((u) => !u.spent);

  const formattedBalance = parseFloat(
    ethers.formatEther(
        allUnspentUTXOs.reduce((s, u) => s + BigInt(u.amount), BigInt(0))
    )
    ).toFixed(4);

  const value = {
    // raw
    spentNullifiers,
    poolStates,
    // per-pool UTXOs
    myUTXOs,
    allUnspentUTXOs,
    // sync state
    syncing,
    lastSyncedAt,
    error,
    // actions
    fetchLatest,
    getRoot,
    getMerkleProof,
    formattedBalance,
  };

  return <PoolContext.Provider value={value}>{children}</PoolContext.Provider>;
}

export function usePool() {
  const ctx = useContext(PoolContext);
  if (!ctx) throw new Error("usePool must be used within PoolProvider");
  return ctx;
}