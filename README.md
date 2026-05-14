# 🔐 PriFi Wallet

### 🌑 Privacy-Preserving Wallet built on Monad using Zero-Knowledge Proofs

![Monad](https://img.shields.io/badge/Monad-Blockchain-black?style=for-the-badge)
![Solidity](https://img.shields.io/badge/Solidity-Smart%20Contracts-363636?style=for-the-badge&logo=solidity)
![Circom](https://img.shields.io/badge/Circom-ZK%20Circuits-blue?style=for-the-badge)
![snarkjs](https://img.shields.io/badge/snarkjs-ZK%20Proofs-orange?style=for-the-badge)
![Poseidon](https://img.shields.io/badge/Poseidon-Hash%20Function-purple?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js)
![Express](https://img.shields.io/badge/Express.js-API-black?style=for-the-badge&logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb)
![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge&logo=react)
![ethers.js](https://img.shields.io/badge/ethers.js-Web3-2535A0?style=for-the-badge)
![MetaMask](https://img.shields.io/badge/MetaMask-Wallet-F6851B?style=for-the-badge&logo=metamask)
![Zero Knowledge](https://img.shields.io/badge/Zero--Knowledge-Privacy-darkred?style=for-the-badge)

PriFi Wallet is a zk-powered private wallet system built on Monad that enables 🔒 private peer-to-peer transfers through Zero-Knowledge Proofs.

The project combines:
- 🔒 zk-SNARK proof systems
- 🧮 Poseidon hash cryptography
- 🌳 Merkle Tree based commitments
- 🔐 Encrypted on-chain note transfers
- 📡 Relayer-based transaction broadcasting

to provide scalable and user-friendly on-chain privacy.

Unlike traditional blockchain transfers where:
- 👤 Sender addresses
- 👤 Receiver addresses
- 💰 Wallet balances
- 🔗 Transaction relationships

are publicly traceable, PriFi preserves privacy by breaking the connection between identities and transfers using Zero-Knowledge proof verification and encrypted note-based transactions.

---

# 🌌 Overview

PriFi Wallet uses a commitment-based privacy model where user funds are represented as cryptographic notes stored inside a Merkle Tree.

Users generate Zero-Knowledge proofs to demonstrate:
- 👤 Ownership
- 🌳 Commitment validity
- ⚖️ Balance conservation

without revealing sensitive information publicly.

---

## ✨ Core Features

The system supports:
- 💰 Deposits into the privacy pool
- 🔒 Anonymous transfers between PriFi users
- 💸 Shielded withdrawals to external wallets
- ⛽ Gas abstraction through relayers
- 🔐 On-chain encrypted note commitments
- 🚫 Nullifier-based double spend prevention

---

## 🏗️ Architecture Components

The architecture consists of:
- 📜 Solidity smart contracts for state management and verification
- ⚡ Circom circuits for zk proof generation
- 📡 A relayer backend for proof submission
- 🖥️ A frontend wallet interface for user interaction
- 🌳 Incremental Merkle Tree based state storage
- 🔐 On-chain encrypted note ownership transfers

## ✨ Features

- 🔒 Private peer-to-peer transfers using zk-SNARKs
- 💰 Public deposits into the privacy pool
- 🕶️ Public withdrawals with anonymous ownership proofs
- 🌳 Merkle Tree based note management
- 🧮 Poseidon hash based commitment generation
- 🚫 Nullifier-based double spend prevention
- 📡 Relayer-based transaction broadcasting
- 🔐 Encrypted on-chain note transfers
- ⛽ Gas abstraction through relayer.
- ⚡ Circom-based Zero-Knowledge circuits

---

# 🏗️ System Workflow

## 🌑 Introduction
This section Introduces the system workflow. 


## 👛 PriFi Wallet Generation

Each user generates a deterministic PriFi wallet from their existing wallet signature.

### 🔑 Wallet Derivation

```text
PrivateKey   = H(signature("prifiwallet - message "))
zkPublicKey  = Poseidon(3, PrivateKey)
encPublicKey/publicKey = EC_Derive(PrivateKey)
```

Where:
- 🔑 `PrivateKey` → Secret ownership key
- 🕶️ `zkPublicKey` → Public ownership key used in commitments
- 🔐 `encPublicKey/publicKey` → Encryption public key for private transfers
- 🧮 `3` → Domain separator

### 📷 Wallet Generation Flow

<img width="1320" height="788" alt="image" src="https://github.com/user-attachments/assets/e12ba114-8dd4-4ee9-b332-e2af5d1274b2" />


The wallet can always be deterministically regenerated from the signed message without requiring additional seed storage.

---

## 🌳 Commitments & Nullifiers

PriFi represents funds using cryptographic commitments.

### 🧮 Commitment Formula

```text
C = Poseidon(1, amount, randomness, zkPublicKey)
```

Where:
- 💰 `amount` → Private balance amount
- 🎲 `randomness` → Random secret value
- 🕶️ `zkPublicKey` → Receiver ownership key
- 🧮 `1` → Commitment domain separator

### 🚫 Nullifier Formula

```text
nullifier = Poseidon(2, c_in, r_in, sk)
```

Where:
- 🌳 `c_in` → Input commitment
- 🎲 `r_in` → Commitment randomness
- 🔑 `sk` → Private ownership key
- 🧮 `2` → Nullifier domain separator

The nullifier prevents double-spending by ensuring a commitment can only be spent once without revealing the actual commitment owner.

### 📷 Commitment & Nullifier Structure

<img width="1794" height="364" alt="image" src="https://github.com/user-attachments/assets/e019820a-1752-4d46-b162-f05a727314f3" />


---

## 🏛️ PriFi Architecture Overview

The PriFi system consists of:
- 👤 User wallets
- 📜 Private Pool smart contract
- 📡 Relayer infrastructure
- 🌳 Merkle Tree commitment storage
- 🔒 zk proof generation and verification

### 📷 System Architecture

<img width="2140" height="1336" alt="image" src="https://github.com/user-attachments/assets/6ae008b6-c53a-45c2-b5f1-a236bb9c85ba" />

---

# 💰 Deposit Flow

The deposit process converts publicly deposited funds into private commitments inside the PriFi pool.

Instead of directly storing balances publicly, the deposited amount is transformed into encrypted private notes represented by cryptographic commitments.

---

## 🏗️ Deposit Architecture

<img width="2456" height="988" alt="image" src="https://github.com/user-attachments/assets/fdf1518f-60fd-4304-bd2d-029f4e7b1efb" />


---

# ⚙️ Off-Chain Process

## 👤 User Inputs

The user selects:
- 💰 Deposit amount `a`
- 📡 Relayer / protocol fee `fee`

---

## 🌳 Private Note Creation

The wallet creates two private notes.

### 👤 User Private Note

```text
(a - fee, r1, zkPublicKey)
```

Where:
- 💰 `a - fee` → User's remaining private balance
- 🎲 `r1` → Fresh randomness
- 🕶️ `zkPublicKey` → User ownership key

---

### 📡 Relayer Fee Note

```text
(fee, r2, relayerZkPubKey)
```

Where:
- 💰 `fee` → Relayer reward amount
- 🎲 `r2` → Fresh randomness
- 🕶️ `relayerZkPubKey` → Relayer ownership key

---

## 🧮 Commitment Generation

The wallet computes two commitments:

### 👤 User Commitment

```text
C1 = Poseidon(1, a - fee, r1, zkPublicKey)
```

### 📡 Relayer Commitment

```text
C2 = Poseidon(1, fee, r2, relayerZkPubKey)
```

These commitments represent private ownership of funds inside the PriFi pool.

---

## 🔐 Encrypted Note Generation

The wallet encrypts note data before sending it on-chain.

### 👤 User Encrypted Note

```text
ciphertext1 = Encrypt(publicKey, (a - fee, r1))
```

### 📡 Relayer Encrypted Note

```text
ciphertext2 = Encrypt(relayerPublicKey, (fee, r2))
```

Only the corresponding private key owner can decrypt and recover the private note data.

---

## 🔒 zk Proof Generation

The wallet generates a zk-SNARK proof proving:

```text
(a - fee) + fee = deposited amount
```

Without revealing:
- 🕶️ Private balances
- 🎲 Randomness values
- 🔑 Ownership information

---

# ⛓️ On-Chain Process

The transaction is submitted to the Private Pool contract along with:
- 📜 zk proof
- 🌳 Commitments
- 🔐 Encrypted notes

The deposited ETH amount `a` is transferred into the pool contract.

---

## ✅ Smart Contract Verification

The contract verifies:
- 🔒 zk proof validity
- 🌳 Commitment correctness
- 💰 Deposit amount consistency

---

## 🌳 Merkle Tree Insertion

After successful verification, the contract inserts:
- `C1`
- `C2`

into the incremental on-chain Merkle Tree.

---

## 📡 Encrypted Note Events

The contract emits:
- 🔐 `encryptedNote1`
- 🔐 `encryptedNote2`

User wallets and relayers continuously scan emitted events to recover and decrypt their corresponding private notes.

---

# 🔒 Transfer Flow

The transfer process enables private peer-to-peer ownership transfer of commitments inside the PriFi pool without revealing sender identities, receiver identities, or transferred balances publicly.

Instead of transferring assets directly on-chain, PriFi privately consumes existing commitments and creates new output commitments for receivers.

---

## 🏗️ Transfer Architecture

<img width="2554" height="1230" alt="image" src="https://github.com/user-attachments/assets/ee60363b-e011-47fe-abd4-5ff08407d37a" />


---

## ⚙️ Off-Chain Process

### 🌳 Input Note Gathering

The sender wallet gathers enough private input notes to satisfy:

```text
transferAmount + relayerFee
```

The wallet selects multiple input commitments if required.

---

### 📦 Batched Transfer Construction

PriFi uses fixed-size batched transfer calls.
> 4 - Inputs , 3 - Outputs

Each batch may contain:
- 👤 Receiver output note
- 🔄 Change output note
- 📡 Relayer fee output note

This fixed-size structure improves privacy by making transfers appear structurally identical on-chain.

---

## 👤 Ownership Verification

The circuit verifies note ownership using:

```text
pk = Poseidon(3, sk)
```

Where:
- 🔑 `sk` → Secret spending key
- 🕶️ `pk` → zk public ownership key
- 🧮 `3` → Domain separator

Only the owner possessing the correct secret key can spend private notes.

---

## 🌳 Input Commitment Reconstruction

Each input commitment is reconstructed inside the circuit:

```text
c_in = Poseidon(1, amount, randomness, owner_pk)
```

Where:
- 💰 `amount` → Input note balance
- 🎲 `randomness` → Commitment randomness
- 🕶️ `owner_pk` → Owner zk public key
- 🧮 `1` → Commitment domain separator

The circuit verifies that the provided private note data correctly matches the consumed commitment.

---

## 🌳 Merkle Inclusion Verification

Each input note is verified against the on-chain Merkle Tree root using Merkle proofs.

The circuit verifies:
- 🌳 Merkle path correctness
- 📜 Commitment existence
- ✅ Valid tree inclusion

This proves that every spent note actually exists inside the PriFi pool state.

---

## 🚫 Nullifier Generation

For every consumed input commitment, the circuit generates a unique nullifier:

```text
nullifier = Poseidon(2, c_in, r_in, sk)
```

Where:
- 🌳 `c_in` → Input commitment
- 🎲 `r_in` → Input randomness
- 🔑 `sk` → Secret ownership key
- 🧮 `2` → Nullifier domain separator

The nullifier prevents double-spending while preserving anonymity.

The contract rejects already-used nullifiers.

---

## 🌳 Output Commitment Construction

The circuit creates new private output notes:

```text
c_out = Poseidon(1, amount, randomness, receiver_pk)
```

Where:
- 💰 `amount` → Output balance
- 🎲 `randomness` → Fresh randomness
- 🕶️ `receiver_pk` → Receiver zk public key
- 🧮 `1` → Commitment domain separator

The generated output commitments represent newly owned private balances.

---

## 🔐 Encrypted Note Generation

For every output note, the wallet generates encrypted note data.

The encrypted notes are emitted on-chain so only the corresponding receiver can decrypt and recover:
- 💰 Note amount
- 🎲 Randomness
- 🌳 Commitment ownership

---

## ⚖️ Balance Conservation

The circuit enforces:

```text
totalInputs = totalOutputs
```

Meaning:
- 🚫 No value can be created
- 🚫 No value can be destroyed
- ✅ All balances remain conserved privately

---

## 🧩 Enabled Flag Logic

PriFi supports fixed-size circuits using enabled flags.

Each flag satisfies:

```text
enabled * (1 - enabled) = 0
```

Meaning:
- ✅ `0` → Dummy input
- ✅ `1` → Real input

Disabled inputs are ignored inside the circuit while maintaining a constant circuit size for privacy.

---

## 🔒 zk Proof Generation

The zk circuit proves that:
- 👤 The sender owns all consumed notes
- 🌳 Input notes exist in the Merkle Tree
- 🚫 Nullifiers are correctly generated
- 🌳 Output commitments are valid
- ⚖️ Total input value equals total output value

Without revealing:
- 🕶️ Sender identity
- 🕶️ Receiver identity
- 💰 Private balances
- 🎲 Randomness values

---

## 📡 Relayer Validation

The sender submits transfer calls to the relayer.

The relayer locally verifies:
- 🔒 zk proof validity
- 🌳 Transfer structure correctness
- 💰 Relayer fee profitability

Invalid transfer calls are rejected before reaching the smart contract.

---

## ⛓️ On-Chain Verification

The relayer submits the transfer batch to the Private Pool contract.

The contract verifies:
- 🚫 Nullifier uniqueness
- 🔒 zk proof validity
- 🌳 Commitment correctness
- 📜 Merkle root validity

After successful verification:
- 🌳 New commitments are inserted into the Merkle Tree
- 🚫 Nullifiers are permanently marked as spent
- 🔐 Encrypted note events are emitted on-chain

---
# 💸 Withdraw Flow

The withdraw process allows users to privately spend commitments from the PriFi pool and withdraw funds back to a public wallet address.

During withdrawal, the relationship between deposited commitments and the final withdrawal address remains hidden through Zero-Knowledge proof verification.

The system also supports:
- 🔄 Private change note generation
- 📡 Relayer fee distribution
- 🚫 Double-spend prevention using nullifiers

---

## 🏗️ Withdraw Architecture

<img width="2560" height="1204" alt="image" src="https://github.com/user-attachments/assets/96f998c8-536e-40af-98c0-204427450575" />


---

## ⚙️ Off-Chain Process

### 🌳 Input Note Gathering

The user wallet gathers enough private input commitments to satisfy:

```text
withdrawAmount + relayerFee
```

Multiple private notes may be consumed together during a withdrawal.

---

### 📦 Batched Withdraw Construction

Each withdraw batch may contain:
- 💸 Public withdrawal amount
- 🔄 Change output note
- 📡 Relayer fee output note

This structure preserves privacy while supporting efficient batching.

---

## 👤 Ownership Verification

The circuit verifies ownership using:

```text
pk = Poseidon(3, sk)
```

Where:
- 🔑 `sk` → Secret ownership key
- 🕶️ `pk` → zk public ownership key
- 🧮 `3` → Ownership domain separator

This ensures only the rightful owner can spend private commitments.

---

## 🌳 Input Commitment Verification

For every consumed input note, the circuit reconstructs:

```text
c_in = Poseidon(1, amount, randomness, pk)
```

Where:
- 💰 `amount` → Input note value
- 🎲 `randomness` → Commitment randomness
- 🕶️ `pk` → Owner zk public key
- 🧮 `1` → Commitment domain separator

The circuit verifies that the reconstructed commitment matches the provided input commitment.

---

## 🌳 Merkle Inclusion Verification

Each input commitment must exist inside the PriFi Merkle Tree.

The circuit verifies:
- 🌳 Merkle path correctness
- 📜 Commitment inclusion
- ✅ Valid Merkle root reconstruction

This proves that the withdrawn commitments are part of the current shielded pool state.

---

## 🚫 Nullifier Verification

For every consumed input note, the circuit generates:

```text
nullifier = Poseidon(2, commitment, randomness, sk)
```

Where:
- 🌳 `commitment` → Input commitment
- 🎲 `randomness` → Input randomness
- 🔑 `sk` → Secret ownership key
- 🧮 `2` → Nullifier domain separator

The generated nullifier uniquely identifies the spend operation without revealing the actual commitment owner.

The smart contract permanently stores used nullifiers to prevent double-spending.

---

## 🔄 Output Note Construction

Withdrawals support creation of up to:
- 🔄 Change note
- 📡 Relayer fee note

Each output commitment is constructed as:

```text
c_out = Poseidon(1, amount, randomness, receiver)
```

Where:
- 💰 `amount` → Output note amount
- 🎲 `randomness` → Fresh randomness
- 🕶️ `receiver` → Receiver zk public key
- 🧮 `1` → Commitment domain separator

---

## 🔐 Receiver Binding

The circuit enforces:
- 👤 `receivers[0] == receiver`
- 📡 `receivers[1] == relayer`

This guarantees:
- 💸 Withdrawn ETH reaches the correct public wallet
- 📡 Relayer fee note belongs to the correct relayer

---

## 🔐 Encrypted Note Generation

For newly created private notes:
- 🔄 Change note
- 📡 Relayer fee note

the wallet generates encrypted note data which is emitted on-chain.

Only the intended receiver can decrypt and recover the note contents.

---

## ⚖️ Conservation Constraint

The circuit enforces:

```text
sum(inputs) = withdrawAmount + sum(outputs)
```

Meaning:
- 🚫 No value can be created
- 🚫 No value can be destroyed
- ✅ Private balances remain conserved

---

## 🧩 Enabled Flag Constraints

PriFi supports fixed-size circuits using enabled flags.

Each enabled flag satisfies:

```text
enabled * (1 - enabled) = 0
```

Meaning:
- ✅ `1` → Real input/output
- ✅ `0` → Dummy slot

Disabled slots are ignored during proof generation while preserving constant circuit size.

---

## 🔒 zk Proof Generation

The withdrawal circuit proves:
- 👤 The sender owns all consumed notes
- 🌳 Input notes exist in the Merkle Tree
- 🚫 Nullifiers are correctly generated
- 🔄 Output commitments are valid
- ⚖️ Total value is conserved
- 💸 Withdraw amount is valid

Without revealing:
- 🕶️ Sender identity
- 💰 Private balances
- 🎲 Randomness values
- 🌳 Actual spent commitments

---

## 📡 Relayer Submission

The wallet submits the withdrawal call containing:
- 📜 zk proof
- 🚫 Nullifiers
- 🌳 Output commitments
- 🔐 Encrypted output notes

to the Private Pool contract directly (it doesn't send it to the relayer).

---

## ⛓️ On-Chain Verification

The smart contract verifies:
- 🔒 zk proof validity
- 🚫 Nullifier uniqueness
- 🌳 Merkle root validity
- 🌳 Output commitment correctness

After successful verification:
- 💸 ETH is transferred to the public receiver wallet
- 🌳 New commitments are inserted into the Merkle Tree
- 🚫 Nullifiers are marked as spent
- 🔐 Encrypted note events are emitted on-chain


# 📸 Screenshots

---

## 🌑 Introduction

| Landing Page | Wallet Creation | Wallet Dashboard |
|---|---|---|
| <img width="2560" height="1428" alt="image" src="https://github.com/user-attachments/assets/862680d8-7e79-46e2-90df-8d94b0e97e5d" /> | <img width="2560" height="1430" alt="image" src="https://github.com/user-attachments/assets/e376c4ff-18e9-4c50-aff7-c396c87d6543" /> | <img width="2560" height="1428" alt="image" src="https://github.com/user-attachments/assets/70f9e8c5-21ca-49dd-8a43-e4031bfe3598" /> |

---

## 💰 Deposit Functionality

| Deposit Window | Deposit Confirmation | Deposit Success |
|---|---|---|
| <img width="2558" height="1428" alt="image" src="https://github.com/user-attachments/assets/b2dbed6d-7223-439c-b6d2-671fb088b2f1" /> | <img width="2560" height="1430" alt="image" src="https://github.com/user-attachments/assets/f8c58721-3766-4726-a9f9-052c9e7273b9" /> | <img width="2560" height="1428" alt="image" src="https://github.com/user-attachments/assets/f1dd9d6d-9069-4d75-a391-110cf42636ef" /> |

---
## 🔒 Transfer Functionality

| Transfer Window | Transfer Success |
|---|---|
| <img width="2560" height="1428" alt="image" src="https://github.com/user-attachments/assets/9a5e8ff5-64fe-435f-8fca-5054eb044314" /> | <img width="2560" height="1430" alt="image" src="https://github.com/user-attachments/assets/16cb6781-cf67-42f2-97a2-b82bfcf3e8cb" /> |

---
## 💸 Withdraw Functionality

| Withdraw Window | Withdraw Confirmation | Withdraw Success |
|---|---|---|
|<img width="2560" height="1426" alt="image" src="https://github.com/user-attachments/assets/e6441f1c-af06-4e8f-bb59-c12f46380686" /> | <img width="2560" height="1428" alt="image" src="https://github.com/user-attachments/assets/c810e76b-eb44-47da-a6f2-b884c64114de" /> | <img width="2560" height="1428" alt="image" src="https://github.com/user-attachments/assets/acf9ffad-8698-4caf-9e8f-793e977608bb" /> |

---

# 🚀 Conclusion

PriFi Wallet V1 demonstrates how Zero-Knowledge cryptography can be used to build a practical privacy layer for on-chain value transfers on Monad.

The current version focuses on:
- 🔒 Private peer-to-peer transfers
- 🌳 Commitment based ownership
- 🚫 Nullifier based double-spend prevention
- 📡 Relayer assisted private transactions
- ⚡ zk-SNARK based proof verification

PriFi V1 is currently deployed on:
- 🧪 Monad Testnet

Future deployments are planned for:
- ⛓️ Ethereum Testnet
- 🌐 Additional EVM compatible ecosystems

---

# 🌑 PriFi V2 — Coming Soon

PriFi V2 expands beyond private balances into a complete private wallet infrastructure for smart contract interactions.

The goal of V2 is to make on-chain activity itself private — not just transfers.

V2 focuses on:
- 🕶️ Private smart contract interactions
- 🔄 Private swaps and DeFi actions
- 🌊 Stealth liquidity positions
- 🏦 Invisible lending and yield strategies
- 📜 Private contract function calls
- 👤 Hidden wallet activity and balances

PriFi V2 extends the same Zero-Knowledge foundation used in V1 while significantly expanding the privacy surface of on-chain applications.

---

# 🤝 Connect With Me

Built by **Mahesh Karri**

- 🐦 X / Twitter: [@0xM4he5h](https://x.com/0xM4he5h)
- 🔗 LinkedIn: [LinkedIn](https://www.linkedin.com/)

---

# 🌌 PriFi

### Private Finance on Monad
