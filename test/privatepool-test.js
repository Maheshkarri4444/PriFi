const { ethers } = require("hardhat");
const { expect } = require("chai");
const snarkjs = require("snarkjs");

const {
    generatePrivateWallet
} = require("../helpers/wallets");

const {
    encryptMessage,
    decryptMessage
} = require("../helpers/encryption");

const {
    createCommitment
} = require("../helpers/commitments");

const circomlibjs = require("circomlibjs");

const {
    IncrementalMerkleTree
} = require("@zk-kit/incremental-merkle-tree");



// global relayer wallet
let relayerWallet;

// global users wallets
const userWallets = [];

// poolId => merkle tree state
const poolStates = {};


// contract + signers
let privatePool;

let relayerSigner;

let userSigner;

// tree helper function
async function initializePool(poolId) {

    // already initialized
    if (poolStates[poolId]) {
        return;
    }

    const poseidon =
        await circomlibjs.buildPoseidon();

    const hash = (inputs) => {

        return BigInt(
            poseidon.F.toString(
                poseidon(inputs)
            )
        );
    };

    const ZERO_VALUE = BigInt(0);

    const tree =
        new IncrementalMerkleTree(
            hash,
            20,
            ZERO_VALUE,
            2
        );

    poolStates[poolId] = {

        tree,

        roots: [],

        latestRoot: null,

        leafToIndex: {}
    };

    console.log(`\nPool ${poolId} initialized`);
}



describe("PriFi Wallet Architecture", function () {
    

    it("Should generate deterministic private wallets and zk keys", async function () {

        const signers = await ethers.getSigners();

        // relayer
        relayerSigner = signers[0];

        // user
        userSigner = signers[1];



        const relayerSignature =
            await relayerSigner.signMessage(
                "PriFi private financial dapp"
            );

        relayerWallet =
            await generatePrivateWallet(
                relayerSignature
            );

        console.log("\n========== RELAYER ==========");
        console.log(relayerWallet);



        // users
        const users = signers.slice(1, 6);

        for (let i = 0; i < users.length; i++) {

            const signer = users[i];

            const signature =
                await signer.signMessage(
                    "PriFi private financial dapp"
                );

            const wallet =
                await generatePrivateWallet(
                    signature
                );

            userWallets.push(wallet);

            console.log(`\n========== USER ${i + 1} ==========`);

            console.log(wallet);
        }

        console.log("\n========== ALL USERS ==========");
        console.log(userWallets);



        // attach deployed contract
        privatePool =
            await ethers.getContractAt(
                "PrivatePool",
                "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"
            );
        console.log(
            "Pool Address:",
            privatePool.address
        );

        const code =
            await ethers.provider.getCode(
                privatePool.address
            );

        console.log(
            "Code Length:",
            code.length
        );

        console.log(code);
    });





    it("Should encrypt and decrypt notes between users and relayer", async function () {

        // random user
        const user = userWallets[2];

        // sample note
        const note = {

            amount: "100",

            randomness:
                ethers.BigNumber.from(
                    ethers.utils.randomBytes(31)
                ).toString(),

            zkPublicKey:
                user.zk.publicKey
        };

        // serialize note
        const plaintext =
            JSON.stringify(note);

        console.log("\n========== ORIGINAL NOTE ==========");
        console.log(plaintext);




        // USER -> RELAYER

        const encryptedToRelayer =
            encryptMessage(
                plaintext,
                relayerWallet.privateWallet.publicKey
            );

        console.log("\n========== ENCRYPTED TO RELAYER ==========");
        console.log(encryptedToRelayer);

        const decryptedByRelayer =
            decryptMessage(
                encryptedToRelayer,
                relayerWallet.privateWallet.privateKey
            );

        console.log("\n========== RELAYER DECRYPTED ==========");
        console.log(decryptedByRelayer);





        // RELAYER -> USER

        const encryptedToUser =
            encryptMessage(
                plaintext,
                user.privateWallet.publicKey
            );

        console.log("\n========== ENCRYPTED TO USER ==========");
        console.log(encryptedToUser);

        const decryptedByUser =
            decryptMessage(
                encryptedToUser,
                user.privateWallet.privateKey
            );

        console.log("\n========== USER DECRYPTED ==========");
        console.log(decryptedByUser);
    });


it("Should verify deposit proof directly", async function () {

    const depositVerifier =
    await ethers.getContractAt(
        "DepositVerifier",
        "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
    );
        const code =
            await ethers.provider.getCode(
                depositVerifier.address
            );
    console.log("deposit verifier length:",code.length);
    // -------------------------
    // VALUES
    // -------------------------

    const depositAmount =
        ethers.utils.parseEther("1");

    const fee =
        ethers.utils.parseEther("0.01");

    const userAmount =
        depositAmount.sub(fee);



    // -------------------------
    // RANDOMNESS
    // -------------------------

    const r1 =
        ethers.BigNumber.from(
            ethers.utils.randomBytes(31)
        ).toString();

    const r2 =
        ethers.BigNumber.from(
            ethers.utils.randomBytes(31)
        ).toString();





    // -------------------------
    // USER + RELAYER
    // -------------------------

    const user =
        userWallets[0];



    // -------------------------
    // COMMITMENTS
    // -------------------------

    const commitment1 =
        await createCommitment(
            userAmount.toString(),
            r1,
            user.zk.publicKey
        );



    const commitment2 =
        await createCommitment(
            fee.toString(),
            r2,
            relayerWallet.zk.publicKey
        );



    console.log("\n========== COMMITMENTS ==========");

    console.log(commitment1);

    console.log(commitment2);



    // -------------------------
    // CIRCOM INPUT
    // -------------------------

    const input = {

        depositAmount:
            depositAmount.toString(),

        pk2:
            relayerWallet.zk.publicKey,

        c1:
            commitment1.decimal,

        c2:
            commitment2.decimal,

        a1:
            userAmount.toString(),

        r1:
            r1,

        pk1:
            user.zk.publicKey,

        a2:
            fee.toString(),

        r2:
            r2
    };



    console.log("\n========== CIRCOM INPUT ==========");

    console.log(input);



    // -------------------------
    // GENERATE PROOF
    // -------------------------

    const { proof, publicSignals } =
        await snarkjs.groth16.fullProve(

            input,

            "build/deposit_proof_js/deposit_proof.wasm",

            "build/deposit_final.zkey"
        );



    console.log("\n========== PUBLIC SIGNALS ==========");

    console.log(publicSignals);



    // -------------------------
    // FORMAT PROOF
    // -------------------------

    const calldata =
        await snarkjs.groth16.exportSolidityCallData(
            proof,
            publicSignals
        );



    const argv =
        calldata
            .replace(/["[\]\s]/g, "")
            .split(",");



    const a = [
        argv[0],
        argv[1]
    ];



    const b = [
        [argv[2], argv[3]],
        [argv[4], argv[5]]
    ];



    const c = [
        argv[6],
        argv[7]
    ];



    console.log("\n========== PROOF ==========");

    console.log("a:", a);

    console.log("b:", b);

    console.log("c:", c);


    const vKey = require("../build/deposit_verification_key.json");

    const offchainVerified =
        await snarkjs.groth16.verify(
            vKey,
            publicSignals,
            proof
        );

    console.log(
        "\n========== OFFCHAIN VERIFIED =========="
    );

    console.log(offchainVerified);
    

    // -------------------------
    // VERIFY DIRECTLY
    // -------------------------

    const verified =
        await depositVerifier.verifyProof(
            a,
            b,
            c,
            publicSignals
        );



    console.log("\n========== VERIFIED ==========");

    console.log(verified);



    expect(verified).to.equal(true);
});


    it("Should deposit privately", async function () {

        const user =
            userWallets[0];



        // -------------------------
        // VALUES
        // -------------------------

        const depositAmount =
            ethers.utils.parseEther("1");

        const fee =
            ethers.utils.parseEther("0.01");

        const userAmount =
            depositAmount.sub(fee);



        // -------------------------
        // RANDOMNESS
        // -------------------------

        const r1 =
            ethers.BigNumber.from(
                ethers.utils.randomBytes(31)
            ).toString();

        const r2 =
            ethers.BigNumber.from(
                ethers.utils.randomBytes(31)
            ).toString();



        // -------------------------
        // COMMITMENTS
        // -------------------------

        const commitment1 =
            await createCommitment(
                userAmount.toString(),
                r1,
                user.zk.publicKey
            );

        const commitment2 =
            await createCommitment(
                fee.toString(),
                r2,
                relayerWallet.zk.publicKey
            );



        console.log("\n========== COMMITMENTS ==========");

        console.log(commitment1);

        console.log(commitment2);




        // -------------------------
        // ENCRYPTED NOTES
        // -------------------------

        const note1 =
            JSON.stringify({

                amount:
                    userAmount.toString(),

                randomness:
                    r1
            });

        const note2 =
            JSON.stringify({

                amount:
                    fee.toString(),

                randomness:
                    r2
            });



        const encryptedNote1 =
            encryptMessage(
                note1,
                user.privateWallet.publicKey
            );

        const encryptedNote2 =
            encryptMessage(
                note2,
                relayerWallet.privateWallet.publicKey
            );



        console.log("\n========== ENCRYPTED NOTES ==========");

        console.log(encryptedNote1);

        console.log(encryptedNote2);




        // -------------------------
        // CIRCOM INPUT
        // -------------------------

        const input = {

            depositAmount:
                depositAmount.toString(),

            c1:
                commitment1.decimal,

            c2:
                commitment2.decimal,

            a1:
                userAmount.toString(),

            r1:
                r1,

            pk1:
                user.zk.publicKey,

            a2:
                fee.toString(),

            r2:
                r2,

            pk2:
                relayerWallet.zk.publicKey
        };



        console.log("\n========== CIRCOM INPUT ==========");

        console.log(input);




        // -------------------------
        // GENERATE PROOF
        // -------------------------

        const { proof, publicSignals } =
            await snarkjs.groth16.fullProve(

                input,

                "build/deposit_proof_js/deposit_proof.wasm",

                "build/deposit_final.zkey"
            );



        console.log("\n========== PUBLIC SIGNALS ==========");

        console.log(publicSignals);




        // -------------------------
        // FORMAT CALLDATA
        // -------------------------

        const calldata =
            await snarkjs.groth16.exportSolidityCallData(
                proof,
                publicSignals
            );



        const argv =
            calldata
                .replace(/["[\]\s]/g, "")
                .split(",");



        const a = [
            argv[0],
            argv[1]
        ];



        const b = [
            [argv[2], argv[3]],
            [argv[4], argv[5]]
        ]



        const c = [
            argv[6],
            argv[7]
        ];



        console.log("\n========== PROOF ==========");

        console.log("a:", a);

        console.log("b:", b);

        console.log("c:", c);




        // -------------------------
        // BALANCES BEFORE
        // -------------------------

        const userBalanceBefore =
            await ethers.provider.getBalance(
                userSigner.address
            );



        const relayerBalanceBefore =
            await ethers.provider.getBalance(
                relayerSigner.address
            );



        console.log("\n========== BALANCES BEFORE ==========");

        console.log(
            "User:",
            ethers.utils.formatEther(
                userBalanceBefore
            )
        );

        console.log(
            "Relayer:",
            ethers.utils.formatEther(
                relayerBalanceBefore
            )
        );




        // -------------------------
        // DEPOSIT
        // -------------------------

        const tx =
            await privatePool
                .connect(userSigner)
                .deposit(

                    a,
                    b,
                    c,

                    commitment1.bytes32,

                    commitment2.bytes32,

                    encryptedNote1,

                    encryptedNote2,

                    {
                        value:
                            depositAmount
                    }
                );



        const receipt =
            await tx.wait();




        // -------------------------
        // EVENTS
        // -------------------------

        console.log("\n========== EVENTS ==========");
        console.log("type of",
                typeof privatePool.deposit
            );


        console.log( "receipt: " , receipt);
        console.log("recipt logs: ",receipt.logs);
        for (const event of receipt.events) {

            console.log("\nEVENT:");

            console.log(event.event);

            console.log(event.args);
        }




        // -------------------------
        // BALANCES AFTER
        // -------------------------

        const userBalanceAfter =
            await ethers.provider.getBalance(
                userSigner.address
            );



        const relayerBalanceAfter =
            await ethers.provider.getBalance(
                relayerSigner.address
            );



        console.log("\n========== BALANCES AFTER ==========");

        console.log(
            "User:",
            ethers.utils.formatEther(
                userBalanceAfter
            )
        );

        console.log(
            "Relayer:",
            ethers.utils.formatEther(
                relayerBalanceAfter
            )
        );




        // -------------------------
        // USER DECRYPTION
        // -------------------------

        const userDecrypted =
            decryptMessage(
                encryptedNote1,
                user.privateWallet.privateKey
            );



        console.log("\n========== USER DECRYPTED ==========");

        console.log(userDecrypted);




        // -------------------------
        // RELAYER DECRYPTION
        // -------------------------

        const relayerDecrypted =
            decryptMessage(
                encryptedNote2,
                relayerWallet.privateWallet.privateKey
            );



        console.log("\n========== RELAYER DECRYPTED ==========");

        console.log(relayerDecrypted);
    });

    it("Should rebuild merkle trees from emitted events", async function () {

        console.log("\n========== FETCHING EVENTS ==========");



        // fetch all NoteCreated events
        const events =
            await privatePool.queryFilter(
                privatePool.filters.NoteCreated()
            );



        console.log(
            "Total NoteCreated Events:",
            events.length
        );



        // rebuild trees from history
        for (const event of events) {

            const poolId =
                event.args.poolId.toString();

            const commitment =
                BigInt(
                    event.args.commitment.toString()
                );



            console.log("\n========== NOTE ==========");

            console.log(
                "PoolId:",
                poolId
            );

            console.log(
                "Commitment:",
                commitment.toString()
            );



            // initialize tree
            await initializePool(poolId);



            const state =
                poolStates[poolId];



            // insert commitment
            state.tree.insert(commitment);



            // latest root
            const root =
                state.tree.root.toString();

            state.latestRoot =
                root;

            state.roots.push(root);



            // leaf index
            const leafIndex =
                state.tree.leaves.length - 1;

            state.leafToIndex[
                commitment.toString()
            ] = leafIndex;



            console.log(
                "Leaf Index:",
                leafIndex
            );

            console.log(
                "Latest Root:",
                root
            );
        }



        console.log("\n========== FINAL POOL STATES ==========");

        console.log(poolStates);
    });
});