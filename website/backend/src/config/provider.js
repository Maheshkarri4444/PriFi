const { ethers } =
    require("ethers");

const circomlibjs =
    require("circomlibjs");


const PoolState =
    require("../models/PoolState");

const NullifierState =
    require("../models/NullifierState");

const {
    IncrementalMerkleTree
} = require("@zk-kit/incremental-merkle-tree");

const {
    decryptMessage
} = require("../helpers/crypto");

require("dotenv").config();

const provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL
    );

const wallet =
    new ethers.Wallet(
        process.env.PRIVATE_KEY,
        provider
    );

const {
    generatePrivateWallet
} = require("../helpers/privateWallet");


let relayerWallet;

async function initializeRelayer() {

    const relayerSignature =
        await wallet.signMessage(
            "PriFi private financial dapp"
        );

    relayerWallet =
        await generatePrivateWallet(
            relayerSignature
        );
}


async function buildWallet() {

    console.log(
        "\n========== BUILDING RELAYER WALLET =========="
    );

    const poseidon =
        await circomlibjs.buildPoseidon();

    const pools =
        await PoolState.find();

    const nullifierState =
        await NullifierState.findOne({
            key: "global"
        });

    const spentNullifiers =
        new Set(
            nullifierState?.nullifiers || []
        );

    const walletState = {

        notes: [],

        balance:
            ethers.parseEther("0"),

        pools: {}
    };



    for (const pool of pools) {

        const poolId =
            pool.poolId;

        const latestRoot =
            pool.latestRoot;

        const hash = (inputs) => {
            return BigInt(
                poseidon.F.toString(
                    poseidon(inputs)
                )
            );
        };

        const tree =
            new IncrementalMerkleTree(
                hash,
                20,
                BigInt(0),
                2
            );

        for (
            const commitment
            of pool.commitments
        ) {

            tree.insert(
                BigInt(cmx)
            );

            try {

                const encryptedNote =
                    pool.encryptedNotes.get(
                        commitment
                    );

                const decrypted =
                    decryptMessage(

                        encryptedNote,

                        relayerWallet
                            .privateWallet
                            .privateKey
                    );

                const parsed =
                    JSON.parse(decrypted);

                const expectedNullifier =
                    poseidon.F.toString(

                        poseidon([

                            2,

                            commitment.toString(),

                            parsed.randomness,

                            relayerWallet
                                .zk
                                .secretKey
                        ])
                    );

                if (

                    spentNullifiers.has(
                        expectedNullifier
                    )
                ) {

                    continue;
                }

                const leafIndex =
                    pool.leafToIndex.get(
                        commitment
                    );

                walletState.notes.push({

                    poolId,

                    commitment,

                    amount:
                        parsed.amount,

                    randomness:
                        parsed.randomness,

                    leafIndex,

                    root:
                        latestRoot
                });

                walletState.balance +=
                    BigInt(parsed.amount);

            } catch (_) {

            }
        }

        walletState.pools[poolId] = {

            tree,

            latestRoot
        };
    }

    console.log(
        "\n========== RELAYER WALLET =========="
    );

    console.log(
        "Balance:",
        walletState.balance.toString()
    );

    console.log(
        "Unspent notes:",
        walletState.notes
    );

    return walletState;
}

module.exports = {
    provider,
    wallet,

    buildWallet,

    initializeRelayer,

    get relayerWallet() {
        return relayerWallet;
    }
};