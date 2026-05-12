import * as snarkjs from "snarkjs";
import { ethers } from "ethers";
import * as circomlibjs from "circomlibjs";
import { createCommitment } from "../helpers/commitments"; 
import { encryptMessage } from "../helpers/crypto";        
import PrivatePoolABI from "../abis/PrivatePool.json";
import { BASE_URL } from "./api";
const POOL_ADDRESS = import.meta.env.VITE_PRIVATE_POOL_ADDRESS;
const WASM_PATH    = "/zk/deposit_proof.wasm";
const ZKEY_PATH    = "/zk/deposit_final.zkey";
const MIN_FEE      = ethers.parseEther("0.1");

// ── fetch relayer keys ───────────────────────────────────────────────────────
export async function fetchRelayerKeys() {
  const res = await fetch(`${BASE_URL}/relayer/get`);
  if (!res.ok) throw new Error("Failed to fetch relayer wallet");
  return res.json(); // { publicKey, zkPublicKey }
}

// ── random 31-byte field element (as decimal string) ────────────────────────
function randomFieldElement() {
  const bytes = crypto.getRandomValues(new Uint8Array(31));
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return BigInt(hex).toString();
}

// ── main deposit function ────────────────────────────────────────────────────
export async function executeDeposit({
  depositAmountEth,   // string, e.g. "1.5"
  feeAmountEth,       // string, e.g. "0.1"
  walletKeys,         // from WalletContext
  relayerKeys,        // { publicKey, zkPublicKey }
  onSendTx,
}) {
  const depositAmount = ethers.parseEther(depositAmountEth);
  const feeAmount     = ethers.parseEther(feeAmountEth);
  const userAmount    = depositAmount - feeAmount;

  if (userAmount <= 0n) throw new Error("Fee must be less than deposit amount");

  // randomness
  const r1 = randomFieldElement();
  const r2 = randomFieldElement();

  // commitments
  const commitment1 = await createCommitment(
    userAmount.toString(),
    r1,
    walletKeys.zk.publicKey
  );
  const commitment2 = await createCommitment(
    feeAmount.toString(),
    r2,
    relayerKeys.zkPublicKey
  );

  // encrypted notes
  const encryptedNote1 = encryptMessage(
    JSON.stringify({ amount: userAmount.toString(), randomness: r1 }),
    walletKeys.privateWallet.publicKey
  );
  const encryptedNote2 = encryptMessage(
    JSON.stringify({ amount: feeAmount.toString(), randomness: r2 }),
    relayerKeys.publicKey
  );

  // circom input
  const input = {
    depositAmount: depositAmount.toString(),
    c1: commitment1.decimal,
    c2: commitment2.decimal,
    a1: userAmount.toString(),
    r1,
    pk1: walletKeys.zk.publicKey,
    a2: feeAmount.toString(),
    r2,
    pk2: relayerKeys.zkPublicKey,
  };

  // generate proof
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    WASM_PATH,
    ZKEY_PATH
  );

  // format calldata
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const argv = calldata.replace(/["[\]\s]/g, "").split(",");
  const a = [argv[0], argv[1]];
  const b = [[argv[2], argv[3]], [argv[4], argv[5]]];
  const c = [argv[6], argv[7]];

  // get signer from MetaMask real wallet
  function getMetaMaskProvider() {
    const { ethereum } = window;
    if (!ethereum) throw new Error("MetaMask not found");
    if (ethereum.providers?.length) {
      return ethereum.providers.find(
        (p) => p.isMetaMask && !p.isPhantom && !p.isBraveWallet
      );
    }
    if (ethereum.isMetaMask && !ethereum.isPhantom) return ethereum;
    throw new Error("MetaMask not found");
  }

  const mmProvider = getMetaMaskProvider();
  const provider   = new ethers.BrowserProvider(mmProvider);
  const signer     = await provider.getSigner();
  const contract   = new ethers.Contract(POOL_ADDRESS, PrivatePoolABI, signer);

  if (onSendTx) onSendTx();

  const tx = await contract.deposit(
    a, b, c,
    commitment1.bytes32,
    commitment2.bytes32,
    encryptedNote1,
    encryptedNote2,
    { value: depositAmount }
  );

  const receipt = await tx.wait();
  return { receipt, commitment1, commitment2 };
}