const circomlibjs =
    require("circomlibjs");

const {
    IncrementalMerkleTree
} = require(
    "@zk-kit/incremental-merkle-tree"
);

const privatePool =
    require("../contracts/privatePool");

const PoolState =
    require("../models/PoolState");

const NoteState =
    require("../models/NoteState");

const NullifierState =
    require("../models/NullifierState");


// in-memory states
const poolStates = {};

const spentNullifiers =
    new Set();

let isSyncing = false;


// =====================================
// INITIALIZE POOL
// =====================================

async function initializePool(
    poolId
) {

    if (poolStates[poolId]) {
        return;
    }

    const poseidon =
        await circomlibjs.buildPoseidon();

    const hash =
        (inputs) => {

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

    poolStates[poolId] = {

        tree,

        roots: [],

        latestRoot: null,

        leafToIndex: {},

        encryptedNotes: {}
    };

    console.log(
        `Pool ${poolId} initialized`
    );
}

async function startSyncLoop() {

    while (true) {

        try {

            await syncPools();

        } catch (err) {

            console.error(
                "Sync failed:",
                err
            );
        }

        await new Promise(resolve =>
            setTimeout(resolve, 10000)
        );
    }
}


// =====================================
// MAIN SYNC
// =====================================

async function syncPools() {

    if (isSyncing) {

        console.log(
            "Sync already running"
        );

        return;
    }

    isSyncing = true;

    console.log(
        "\n========== SYNCING POOLS =========="
    );

    const latestBlock =
        await privatePool.runner.provider
            .getBlockNumber();

    console.log(
        "Latest block:",
        latestBlock
    );



    // =================================
    // NULLIFIER STATE
    // =================================

    let nullifierState =
        await NullifierState.findOne({
            key: "global"
        });

    if (!nullifierState) {

        nullifierState =
            await NullifierState.create({

                key: "global",

                nullifiers: [],

                lastProcessedBlock:
                    Number(
                        process.env
                            .PRIVATE_POOL_DEPLOY_BLOCK
                    )
            });
    }



    // =================================
    // NOTE STATE
    // =================================

    let noteState =
        await NoteState.findOne({
            key: "global"
        });

    if (!noteState) {

        noteState =
            await NoteState.create({

                key: "global",

                lastProcessedBlock:
                    Number(
                        process.env
                            .PRIVATE_POOL_DEPLOY_BLOCK
                    )
            });
    }



    // =================================
    // NULLIFIER EVENTS
    // =================================

    const nullifierFrom =
        Number(
            nullifierState
                .lastProcessedBlock
        ) + 1;

    const nullifierTo =
        Math.min(
            nullifierFrom + 89,
            latestBlock
        );

    console.log(
        `Nullifiers blocks: ${nullifierFrom} -> ${nullifierTo}`
    );

    const nullifierEvents =
        await privatePool.queryFilter(

            privatePool.filters.NullifierSpent(),

            nullifierFrom,

            nullifierTo
        );



    for (const event of nullifierEvents) {

        const nullifier =
            event.args
                .nullifier
                .toString();

        if (
            !spentNullifiers.has(
                nullifier
            )
        ) {

            spentNullifiers.add(
                nullifier
            );

            nullifierState
                .nullifiers
                .push(nullifier);
        }
    }

    nullifierState.lastProcessedBlock =
        nullifierTo;

    await nullifierState.save();



    // =================================
    // NOTE EVENTS
    // =================================

    const noteFrom =
        Number(
            noteState
                .lastProcessedBlock
        ) + 1;

    const noteTo =
        Math.min(
            noteFrom + 89,
            latestBlock
        );

    console.log(
        `Notes blocks: ${noteFrom} -> ${noteTo}`
    );

    const noteEvents =
        await privatePool.queryFilter(

            privatePool.filters.NoteCreated(),

            noteFrom,

            noteTo
        );



    for (const event of noteEvents) {

        const poolId =
            event.args.poolId
                .toString();

        const commitment =
            event.args.commitment
                .toString();

        const encryptedNote =
            event.args.encryptedNote;


        // =================================
        // DB POOL
        // =================================

        let dbPool =
            await PoolState.findOne({
                poolId
            });

        if (!dbPool) {

            dbPool =
                await PoolState.create({

                    poolId,

                    commitments: [],

                    roots: [],

                    latestRoot: null,

                    leafToIndex: {},

                    lastProcessedBlock:
                        noteFrom
                });
        }



        // =================================
        // MEMORY TREE
        // =================================

        await initializePool(
            poolId
        );

        const state =
            poolStates[poolId];

        state.tree.insert(
            BigInt(commitment)
        );

        const leafIndex =
            state.tree.leaves.length - 1;

        const root =
            state.tree.root
                .toString();



        // =================================
        // MEMORY UPDATE
        // =================================

        state.roots.push(root);

        state.latestRoot =
            root;

        state.leafToIndex[
            commitment
        ] = leafIndex;

        state.encryptedNotes[
            commitment
        ] = encryptedNote;


        // =================================
        // DATABASE UPDATE
        // =================================

        dbPool.commitments.push(
            commitment
        );

        dbPool.roots.push(
            root
        );

        dbPool.latestRoot =
            root;

        dbPool.leafToIndex.set(
            commitment,
            leafIndex
        );

        dbPool.encryptedNotes.set(
            commitment,
            encryptedNote
        );
        dbPool.lastProcessedBlock =
            event.blockNumber;

        await dbPool.save();



        console.log(
            `Pool ${poolId} updated`
        );
    }



    // =================================
    // UPDATE NOTE STATE
    // =================================

    noteState.lastProcessedBlock =
        noteTo;

    await noteState.save();


    isSyncing = false;
    console.log(
        "\n========== POOL SYNC COMPLETE =========="
    );

}



// =====================================
// CATCHUP
// =====================================

async function catchUpPools() {

    console.log(
        "\n========== CATCHUP STARTED =========="
    );

    while (true) {

        let noteState =
            await NoteState.findOne({
                key: "global"
            });

        if (!noteState) {

            noteState =
                await NoteState.create({

                    key: "global",

                    lastProcessedBlock:
                        Number(
                            process.env
                                .PRIVATE_POOL_DEPLOY_BLOCK
                        )
                });
        }

        const latestBlock =
            await privatePool.runner.provider
                .getBlockNumber();

        const currentBlock =
            Number(
                noteState
                    .lastProcessedBlock
            );

        console.log(
            `Current: ${currentBlock}`
        );

        console.log(
            `Latest: ${latestBlock}`
        );

        // fully synced
        if (
            latestBlock - currentBlock < 50
        ) {

            console.log(
                "\n========== FULLY SYNCED =========="
            );

            break;
        }

        await syncPools();
    }
}


module.exports = {

    syncPools,

    isSyncing,

    startSyncLoop,
    catchUpPools,

    poolStates,

    spentNullifiers
};