const hre = require("hardhat");

require("dotenv").config();

const {
    generatePrivateWallet
} = require("../helpers/wallets");

async function main() {

    // provider
    const provider =
        new hre.ethers.providers.JsonRpcProvider(
            "https://testnet-rpc.monad.xyz"
        );

    // relayer signer from .env
    const relayerSigner =
        new hre.ethers.Wallet(
            process.env.PRIVATE_KEY,
            provider
        );

    console.log(
        "\nDeploying with:",
        relayerSigner.address
    );

    // balance
    const balance =
        await provider.getBalance(
            relayerSigner.address
        );

    console.log(
        "Balance:",
        hre.ethers.utils.formatEther(balance),
        "MON"
    );

    // derive deterministic relayer wallet
    const relayerSignature =
        await relayerSigner.signMessage(
            "PriFi private financial dapp"
        );

    const relayerWallet =
        await generatePrivateWallet(
            relayerSignature
        );

    console.log("\n========== RELAYER ==========");
    console.log(relayerWallet);




    // ================================
    // PoseidonT3 Library
    // ================================

    const PoseidonT3 =
        await hre.ethers.getContractFactory(
            "PoseidonT3",
            relayerSigner
        );

    const poseidonLib =
        await PoseidonT3.deploy();

    await poseidonLib.deployed();

    console.log(
        "\nPoseidonT3:",
        poseidonLib.address
    );




    // ================================
    // PoseidonHasher
    // ================================

    const PoseidonHasher =
        await hre.ethers.getContractFactory(
            "PoseidonHasher",
            {
                libraries: {
                    PoseidonT3:
                        poseidonLib.address
                },
                signer: relayerSigner
            }
        );

    const poseidon =
        await PoseidonHasher.deploy();

    await poseidon.deployed();

    console.log(
        "PoseidonHasher:",
        poseidon.address
    );




    // ================================
    // DepositVerifier
    // ================================

    const DepositVerifier =
        await hre.ethers.getContractFactory(
            "DepositVerifier",
            relayerSigner
        );

    const depositVerifier =
        await DepositVerifier.deploy();

    await depositVerifier.deployed();

    console.log(
        "DepositVerifier:",
        depositVerifier.address
    );




    // ================================
    // TransferVerifier
    // ================================

    const TransferVerifier =
        await hre.ethers.getContractFactory(
            "TransferVerifier",
            relayerSigner
        );

    const transferVerifier =
        await TransferVerifier.deploy();

    await transferVerifier.deployed();

    console.log(
        "TransferVerifier:",
        transferVerifier.address
    );




    // ================================
    // WithdrawVerifier
    // ================================

    const WithdrawVerifier =
        await hre.ethers.getContractFactory(
            "WithdrawVerifier",
            relayerSigner
        );

    const withdrawVerifier =
        await WithdrawVerifier.deploy();

    await withdrawVerifier.deployed();

    console.log(
        "WithdrawVerifier:",
        withdrawVerifier.address
    );




    // ================================
    // PrivatePool
    // ================================

    const PrivatePool =
        await hre.ethers.getContractFactory(
            "PrivatePool",
            relayerSigner
        );

    const privatePool =
        await PrivatePool.deploy(

            depositVerifier.address,

            transferVerifier.address,

            withdrawVerifier.address,

            poseidon.address,

            // relayer eth address
            relayerSigner.address,

            // relayer zk public key
            relayerWallet.zk.publicKey
        );

    await privatePool.deployed();

    console.log(
        "PrivatePool:",
        privatePool.address
    );




    console.log("\n========== DEPLOYMENT COMPLETE ==========");

    console.log({

        PoseidonT3:
            poseidonLib.address,

        PoseidonHasher:
            poseidon.address,

        DepositVerifier:
            depositVerifier.address,

        TransferVerifier:
            transferVerifier.address,

        WithdrawVerifier:
            withdrawVerifier.address,

        PrivatePool:
            privatePool.address
    });
}


main()
    .then(() => process.exit(0))
    .catch((error) => {

        console.error(error);

        process.exit(1);
    });


/* 
PoseidonT3: 0x6AB8891c8C939f6E5654A6C6b2597f8e37E8789f
PoseidonHasher: 0xb1E39bA4b9A04B3c6f8b8555daf18Ba1C8938Ea2
DepositVerifier: 0x21D6aE367a8F3d2ED61A49E205BF22e34333cFeb
TransferVerifier: 0x6a42B131e28ee3257339FB06dbFa296aF80135f0
WithdrawVerifier: 0xc7b23B23913A08895c234a30BB3E9b790c4F7453
PrivatePool: 0x06E2102A2FA7fECffCD0d24737f38863C80827B8

========== DEPLOYMENT COMPLETE ==========
{
  PoseidonT3: '0x6AB8891c8C939f6E5654A6C6b2597f8e37E8789f',
  PoseidonHasher: '0xb1E39bA4b9A04B3c6f8b8555daf18Ba1C8938Ea2',
  DepositVerifier: '0x21D6aE367a8F3d2ED61A49E205BF22e34333cFeb',
  TransferVerifier: '0x6a42B131e28ee3257339FB06dbFa296aF80135f0',
  WithdrawVerifier: '0xc7b23B23913A08895c234a30BB3E9b790c4F7453',
  PrivatePool: '0x06E2102A2FA7fECffCD0d24737f38863C80827B8'
}
*/