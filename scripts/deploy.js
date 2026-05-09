const hre = require("hardhat");

async function main() {

    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying with:", deployer.address);

    // Poseidon
    // Deploy PoseidonT3 library
    const PoseidonT3 = await hre.ethers.getContractFactory("PoseidonT3");

    const poseidonLib = await PoseidonT3.deploy();

    await poseidonLib.deployed();

    console.log("PoseidonT3 Library:", poseidonLib.address);

    // Link library into PoseidonHasher
    const PoseidonHasher = await hre.ethers.getContractFactory(
        "PoseidonHasher",
        {
            libraries: {
                PoseidonT3: poseidonLib.address
            }
        }
    );

    const poseidon = await PoseidonHasher.deploy();

    await poseidon.deployed();

    console.log("PoseidonHasher:", poseidon.address);

    // Deposit Verifier
    const DepositVerifier = await hre.ethers.getContractFactory("DepositVerifier");
    const depositVerifier = await DepositVerifier.deploy();

    await depositVerifier.deployed();

    console.log("DepositVerifier:", depositVerifier.address);

    // Transfer Verifier
    const TransferVerifier = await hre.ethers.getContractFactory("TransferVerifier");
    const transferVerifier = await TransferVerifier.deploy();

    await transferVerifier.deployed();

    console.log("TransferVerifier:", transferVerifier.address);

    // Withdraw Verifier
    const WithdrawVerifier = await hre.ethers.getContractFactory("WithdrawVerifier");
    const withdrawVerifier = await WithdrawVerifier.deploy();

    await withdrawVerifier.deployed();

    console.log("WithdrawVerifier:", withdrawVerifier.address);

    // relayer address
    const relayer = deployer.address;

    // PrivatePool
    const PrivatePool = await hre.ethers.getContractFactory("PrivatePool");

    const privatePool = await PrivatePool.deploy(
        depositVerifier.address,
        transferVerifier.address,
        withdrawVerifier.address,
        poseidon.address,
        relayer
    );

    await privatePool.deployed();

    console.log("PrivatePool:", privatePool.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });



//deployed addresses
// Deploying with: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
// PoseidonT3 Library: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
// PoseidonHasher: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
// DepositVerifier: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
// TransferVerifier: 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
// WithdrawVerifier: 0x0165878A594ca255338adfa4d48449f69242Eb8F
// PrivatePool: 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853