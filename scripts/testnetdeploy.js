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

PoseidonT3: 0x543e455C08c399a46228923CD1CC88241505B0a2
PoseidonHasher: 0x929Cb58a2739DC7F0a864Da92c742A9E190937b4
DepositVerifier: 0x034202222a529209439B11dA98aa19C6083b1dA3
TransferVerifier: 0x2e1a8D27829cD7b18C6838CD10e37267da4d65B1
WithdrawVerifier: 0x31c2A4DCe7563E007f5F81Bd212bbDceE5964752
PrivatePool: 0xCa9D63A1c7b102E46771640D28FA032BAA3dd3b5

========== DEPLOYMENT COMPLETE ==========
{
  PoseidonT3: '0x543e455C08c399a46228923CD1CC88241505B0a2',
  PoseidonHasher: '0x929Cb58a2739DC7F0a864Da92c742A9E190937b4',
  DepositVerifier: '0x034202222a529209439B11dA98aa19C6083b1dA3',
  TransferVerifier: '0x2e1a8D27829cD7b18C6838CD10e37267da4d65B1',
  WithdrawVerifier: '0x31c2A4DCe7563E007f5F81Bd212bbDceE5964752',
  PrivatePool: '0xCa9D63A1c7b102E46771640D28FA032BAA3dd3b5'
}
*/