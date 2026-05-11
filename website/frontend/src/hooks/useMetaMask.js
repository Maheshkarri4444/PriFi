import { useCallback } from "react";

const MONAD_TESTNET = {
  chainId: "0x279f",
  chainName: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: ["https://testnet.monadexplorer.com"],
};

// Finds the real MetaMask provider even when Phantom is also installed
function getMetaMaskProvider() {
  if (typeof window === "undefined") return null;

  const { ethereum } = window;
  if (!ethereum) return null;

  // Multiple wallets injected — find MetaMask specifically
  if (ethereum.providers?.length) {
    return ethereum.providers.find(
      (p) => p.isMetaMask && !p.isPhantom && !p.isBraveWallet
    ) ?? null;
  }

  // Only one wallet — make sure it's MetaMask and not Phantom masquerading
  if (ethereum.isMetaMask && !ethereum.isPhantom) return ethereum;

  return null;
}

export function useMetaMask() {
  const isMetaMaskAvailable = () => !!getMetaMaskProvider();

  const switchToMonad = useCallback(async () => {
    const provider = getMetaMaskProvider();
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MONAD_TESTNET.chainId }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [MONAD_TESTNET],
        });
      } else {
        throw err;
      }
    }
  }, []);

  const connect = useCallback(async () => {
    const provider = getMetaMaskProvider();
    if (!provider) {
      throw new Error(
        "MetaMask not found. Please install MetaMask and disable Phantom for this site, or set MetaMask as your default wallet."
      );
    }
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    await switchToMonad();
    return accounts[0];
  }, [switchToMonad]);

  const signMessage = useCallback(async (address, message) => {
    const provider = getMetaMaskProvider();
    const signature = await provider.request({
      method: "personal_sign",
      params: [message, address],
    });
    return signature;
  }, []);

  const getChainId = useCallback(async () => {
    const provider = getMetaMaskProvider();
    return provider.request({ method: "eth_chainId" });
  }, []);

  return { connect, signMessage, switchToMonad, isMetaMaskAvailable, getChainId };
}