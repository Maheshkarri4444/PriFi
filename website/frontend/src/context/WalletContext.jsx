import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useMetaMask } from "../hooks/useMetaMask";
import { getAllUsers } from "../services/api";
import { generatePrivateWallet } from "../services/generateWallet";

const WalletContext = createContext(null);
const LS_ADDRESS_KEY = "prifi_address";
const LS_USERDATA_KEY = "prifi_userdata";

// Stable provider getter — same logic as useMetaMask's getMetaMaskProvider
function getMetaMaskProvider() {
  if (typeof window === "undefined") return null;
  const { ethereum } = window;
  if (!ethereum) return null;
  if (ethereum.providers?.length) {
    return ethereum.providers.find(
      (p) => p.isMetaMask && !p.isPhantom && !p.isBraveWallet
    ) ?? null;
  }
  if (ethereum.isMetaMask && !ethereum.isPhantom) return ethereum;
  return null;
}

export function WalletProvider({ children }) {
  const { connect, signMessage, switchToMonad, isMetaMaskAvailable } = useMetaMask();

  const [address, setAddress] = useState(() => localStorage.getItem(LS_ADDRESS_KEY) || null);
  const [userData, setUserData] = useState(() => {
    try {
      const s = localStorage.getItem(LS_USERDATA_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const [signature, setSignature] = useState(null);
  const [walletKeys, setWalletKeys] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [pendingAddress, setPendingAddress] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [walletChanged, setWalletChanged] = useState(false);

  // Guards against double-execution (React 18 strict mode + manual re-renders)
  const mountSignAttempted = useRef(false);

  const persistSession = useCallback((addr, user) => {
    if (addr) localStorage.setItem(LS_ADDRESS_KEY, addr);
    else localStorage.removeItem(LS_ADDRESS_KEY);
    if (user) localStorage.setItem(LS_USERDATA_KEY, JSON.stringify(user));
    else localStorage.removeItem(LS_USERDATA_KEY);
  }, []);

  const fetchAllUsers = useCallback(async () => {
    try {
      const users = await getAllUsers();
      setAllUsers(users);
      return users;
    } catch { return []; }
  }, []);

  const checkUser = useCallback(async (addr) => {
    const users = await fetchAllUsers();
    return users.find((u) => u.realAddress?.toLowerCase() === addr.toLowerCase()) || null;
  }, [fetchAllUsers]);

  // Stable ref so event listeners always call the latest version
  // without needing to be in dependency arrays
  const signAndGenerateKeysRef = useRef(null);
  signAndGenerateKeysRef.current = async (addr) => {
    const sig = await signMessage(addr, "PriFi private financial dapp");
    setSignature(sig);
    const keys = await generatePrivateWallet(sig);
    setWalletKeys(keys);
    return { sig, keys };
  };

  const signAndGenerateKeys = useCallback(
    (addr) => signAndGenerateKeysRef.current(addr),
    [] // stable — delegates to ref
  );

  // ─── Mount effect: re-derive keys for existing session (fires ONCE) ──────────
  useEffect(() => {
    if (mountSignAttempted.current) return; // prevent strict-mode double-fire
    mountSignAttempted.current = true;

    const storedAddr = localStorage.getItem(LS_ADDRESS_KEY);
    if (!storedAddr || !isMetaMaskAvailable()) return;

    const provider = getMetaMaskProvider();
    if (!provider) return;

    provider.request({ method: "eth_accounts" }).then(async (accounts) => {
      if (!accounts.length) {
        persistSession(null, null);
        setAddress(null);
        setUserData(null);
        return;
      }
      const currentAddr = accounts[0].toLowerCase();
      if (currentAddr !== storedAddr.toLowerCase()) {
        persistSession(null, null);
        setAddress(null);
        setUserData(null);
        setWalletChanged(true);
        return;
      }
      try {
        await signAndGenerateKeys(storedAddr);
        await fetchAllUsers();
      } catch {
        // User rejected — stay on page without keys
      }
    }).catch(() => {
      persistSession(null, null);
      setAddress(null);
      setUserData(null);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs once on mount

  // ─── MetaMask event listeners ─────────────────────────────────────────────
  useEffect(() => {
    if (!isMetaMaskAvailable()) return;

    const provider = getMetaMaskProvider();
    if (!provider) return;

    // Refs so handlers always see latest state without causing re-subscription
    const checkUserRef = { current: checkUser };
    checkUserRef.current = checkUser;

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        // MetaMask locked
        persistSession(null, null);
        setAddress(null);
        setUserData(null);
        setSignature(null);
        setWalletKeys(null);
        setNeedsUsername(false);
        setPendingAddress(null);
        setWalletChanged(false);
        return;
      }

      const newAddr = accounts[0];
      const prevAddr = localStorage.getItem(LS_ADDRESS_KEY);

      if (prevAddr && prevAddr.toLowerCase() !== newAddr.toLowerCase()) {
        // Different account — clear session and show overlay
        persistSession(null, null);
        setAddress(null);
        setUserData(null);
        setSignature(null);
        setWalletKeys(null);
        setNeedsUsername(false);
        setPendingAddress(null);
        setWalletChanged(true); // ← this now reliably fires
        return;
      }

      // No prior session — treat as fresh connect
      try {
        const existingUser = await checkUserRef.current(newAddr);
        await signAndGenerateKeysRef.current(newAddr);
        if (existingUser) {
          setAddress(newAddr);
          setUserData(existingUser);
          setNeedsUsername(false);
          persistSession(newAddr, existingUser);
        } else {
          setPendingAddress(newAddr);
          setAddress(null);
          setUserData(null);
          setNeedsUsername(true);
        }
      } catch {
        // sign rejected — do nothing
      }
    };

    const handleChainChanged = async () => {
      try { await switchToMonad(); } catch { /* ignore */ }
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    // Cleanup reliably removes listeners — no ref guard needed
    return () => {
      provider.removeListener("accountsChanged", handleAccountsChanged);
      provider.removeListener("chainChanged", handleChainChanged);
    };
  // Only re-subscribe if these truly stable callbacks change (they won't)
  }, [isMetaMaskAvailable, switchToMonad, persistSession]);

  const connectWallet = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    setWalletChanged(false);
    try {
      const addr = await connect();
      const existingUser = await checkUser(addr);
      await signAndGenerateKeys(addr);

      if (existingUser) {
        setAddress(addr);
        setUserData(existingUser);
        setNeedsUsername(false);
        persistSession(addr, existingUser);
      } else {
        setPendingAddress(addr);
        setNeedsUsername(true);
      }
    } catch (err) {
      setError(err.message || "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  }, [connect, checkUser, signAndGenerateKeys, persistSession]);

  const finalizeUser = useCallback(async (newUserData) => {
    setAddress(pendingAddress);
    setUserData(newUserData);
    setNeedsUsername(false);
    setPendingAddress(null);
    persistSession(pendingAddress, newUserData);
    await fetchAllUsers();
  }, [pendingAddress, fetchAllUsers, persistSession]);

  const signAuthMessage = useCallback(async (addr) => {
    if (signature) return signature;
    const { sig } = await signAndGenerateKeys(addr);
    return sig;
  }, [signature, signAndGenerateKeys]);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setUserData(null);
    setSignature(null);
    setWalletKeys(null);
    setNeedsUsername(false);
    setPendingAddress(null);
    setWalletChanged(false);
    persistSession(null, null);
  }, [persistSession]);

  const value = {
    address, userData, signature, walletKeys,
    isConnecting, error, needsUsername, pendingAddress,
    allUsers, walletChanged,
    connectWallet, finalizeUser, signAuthMessage,
    disconnectWallet, fetchAllUsers,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}