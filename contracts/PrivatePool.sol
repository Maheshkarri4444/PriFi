// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicSignals
    ) external view returns (bool);
}

interface IPoseidon {
    function hash(bytes32 left, bytes32 right) external pure returns (bytes32);
}

/**
 * ShieldedPool
 *
 * A ZK-based UTXO-style private ETH/EVM-based-coins pool.
 *
 * - ETH or Evm-based-coins (like monad) is locked in the contract
 * - Ownership is represented by commitments (cmx)
 * - Balances, senders, receivers, and amounts are hidden
 * - Merkle trees track note existence
 * - Nullifiers prevent double-spends
 *
 * All sensitive data is handled off-chain by wallets.
 * On-chain logic only verifies cryptographic correctness.
 */
contract PrivatePool {
    /**
     * Wallet:
     *      Get signature from real wallet
     *      PrivateKey = H(signature("prifiwallet"))
     *      Derive:
     *          zkPublicKey = Poseidon(PrivateKey) // used for transfer
     *          encPublicKey = EC_Derive(PrivateKey) // used for encrypting notes
     */

    // constants
    uint32 public constant TREE_DEPTH = 20;
    uint32 public constant ROOT_HISTORY_SIZE = 10;
    uint32 public constant MAX_LEAF = uint32(1) << TREE_DEPTH; // 2**20 value
    uint32 constant MAX_INPUTS = 4;

    // zero commitment - used in the place of empty commitment (wallet must use same convention)
    bytes32 public constant ZERO_COMMITMENT =
        bytes32(uint256(keccak256("ZERO_COMMITMENT")));

    //global state
    mapping(bytes32 => bool) nullifierSpent;
    mapping(bytes32 => bool) commitmentExists;

    // verifiers
    IVerifier public immutable depositVerifier;
    IVerifier public immutable transferVerifier;
    IVerifier public immutable withdrawVerifier;

    // posidon
    IPoseidon public immutable posidon;

    // events
    event NewPool(uint256 indexed poolId); //indexed-> searchable/filterable
    // we dont store the encryptedNotes on chain ( storage gas ) instead we emit them as events
    event NoteCreated(uint256 poolId, bytes32 commitment, bytes encryptedNote);

    constructor(
        address _depositVerifier,
        address _transferVerifier,
        address _withdrawVerifier,
        address _posidon
    ) {
        depositVerifier = IVerifier(_depositVerifier);
        transferVerifier = IVerifier(_transferVerifier);
        withdrawVerifier = IVerifier(_withdrawVerifier);
        posidon = IPoseidon(_posidon);
        _createPool();
    }

    struct Pool {
        bytes32[TREE_DEPTH] zeros; // the zeros are used to know the value of Z0, Z1, Z2 (i.e the zero hash value of each level)
        bytes32[TREE_DEPTH] filledSubtrees; // Stores the latest filled LEFT subtree hash at each tree level
        // its an optimistic approach to compute the root
        // explanantion of filled subtrees is provided at notes/filled_subtress.txt
        bytes32 root; //the current root
        bytes32[ROOT_HISTORY_SIZE] rootHistory; // stores the recent history of roots , so the system allows mempool delays to improve UX.
        uint32 rootPtr; // where next root is to be inserted in the circular root history
        uint32 nextIdx; // where next leaf insertion should happen
        mapping(bytes32 => bool) validRoot; //fast membership check for acceptable roots
        // O(1) lookup wether the root is still valid (i.e still in root history) or not
    }

    Pool[] public pools;

    function _createPool() internal {
        Pool storage p = pools.push();
        bytes32 zero = bytes32(0);

        for (uint8 i = 0; i < TREE_DEPTH; i++) {
            p.zeros[i] = zero; // the Z0,Z1,Z2 ...
            p.filledSubtrees[i] = zero; // inital zero tree
            zero = posidon.hash(zero, zero); // Z1 = hash(Z0,Z0) ... Z20 = hash(Z19,Z19)
        }

        p.root = zero; // Z20
        p.rootHistory[0] = zero;
        p.rootPtr = 0;
        p.nextIdx = 0;

        emit NewPool(pools.length - 1);
    }

    // returns current pool
    function _currentPool() internal view returns (Pool storage) {
        return pools[pools.length - 1];
    }

    // Depsoit
    //  * Public entry into the shielded pool.
    //  *
    //  * - ETH is sent with the transaction
    //  * - One or two commitments are created
    //  * - Commitments are inserted into the current pool(s)
    //  * - Each commitment is logged with NoteCreated
    //  *
    //  * Wallet responsibilities (off-chain):
    //  * - Choose amount + randomness
    //  * - Compute commitment(s)
    //  * - Encrypt note(s)
    //  * - Track emitted poolId + leaf index
    function deposit(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        bytes32 C1, // First commitment (required)
        bytes32 C2, // 2nd commitment   relayer fee
        bytes calldata encryptedNote1, // encrypted (amount, randomness) for C1
        bytes calldata encryptedNote2 // Encrypted (amount, randomness) for C2
    ) external payable {
        require(msg.value != 0, "No ethereum");

        // zero commitments are only for transfer call
        require(C1 != ZERO_COMMITMENT, "Invalid commitment 1");
        require(C2 != ZERO_COMMITMENT, "Invalid commitment 2");

        // commitments already exists?
        require(
            commitmentExists[C1],
            "Commitment 1 already existing, change r value"
        );
        require(
            commitmentExists[C2],
            "Commitment 2 already existing, change r value"
        );
        // public signals
        // deposit amount
        // c1
        // c2
        uint256[] memory publicSignals = new uint256[](3);
        publicSignals[0] = msg.value;
        publicSignals[1] = uint256(C1);
        publicSignals[2] = uint256(C2);

        // in deposit we dont need to check merkle path
        // deposit zk , proves that the amounts that are in the commitments equals deposited amount
        require(
            depositVerifier.verifyProof(a, b, c, publicSignals),
            "Deposit proof verification failed"
        );

        bytes32[] memory commitments = new bytes32[](2);
        commitments[0] = C1;
        commitments[1] = C2;

        // addition of group of commitments to be added here
        InsertedNote[] memory notesInserted = _insertBatch(commitments);
        for (uint8 i = 0; i < 2; i++) {
            InsertedNote memory note = notesInserted[i];
            if (i == 0) {
                // emit the note created event
                emit NoteCreated(note.poolId, note.commitment, encryptedNote1);
            } else {
                emit NoteCreated(note.poolId, note.commitment, encryptedNote2);
            }
        }
    }

    // transfer call
    struct TransferCall {
        // zk proof
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        //public inputs of zkproof
        uint8[MAX_INPUTS] enabled; // decides wether input at index is present or not
        bytes32[MAX_INPUTS] roots; // tree roots which the respective commiment belongs to.
        uint256[MAX_INPUTS] poolIds; // poolid of that root
        bytes32[MAX_INPUTS] nullifiers; // nullifier for each commitment
        // outputs (maximum of 3)
        bytes32 C1; // receiver commitment (Required)
        bytes32 C2; // change commitment
        bytes32 C3; // relayer commitment
        bytes encryptedNote1; // receiver encrypted note
        bytes encryptedNote2; // change encrypted note
        bytes encryptedNote3; // relayer encrypted note
    }
    /*
     * - Each TransferCall consumes between 1 and MAX_INPUTS private input notes
     * - Multiple TransferCalls can be executed atomically in a single transaction
     * - Later TransferCalls may spend commitments created by earlier TransferCalls
     *   within the same transaction
     * - This enables note aggregation and large fan-in transfers
     *   while remaining atomic and private
     */

    // helper functions
    struct InsertedNote {
        uint256 poolId;
        bytes32 commitment;
    }

    //update pool for commitment
    function _updatePool(Pool storage p, bytes32 commitment) internal {
        bytes32 current = commitment;
        uint256 idx = p.nextIdx;
        p.nextIdx++; // update the next index
        // compute the root
        for (uint16 i = 0; i < TREE_DEPTH; i++) {
            // idx & 1 -> extracts lsb and & 1 decides odd or even
            if ((idx & 1) == 0) {
                // even -> the current one is left
                // so add it to the subtree, compute hash with zero[i](i.e Zi -> refere notes/filled_subtrees.txt)
                p.filledSubtrees[i] = current;
                current = posidon.hash(current, p.zeros[i]);
            } else {
                // odd -> the current one is right
                // so hash it with present value of the subtree
                current = posidon.hash(p.filledSubtrees[i], current);
            }
            idx >>= 1; // shifts 1 bit
        }
        p.root = current; //update root
    }

    // it inserts the group of commitments all at once.
    function _insertBatch(
        bytes32[] memory commitments
    ) internal returns (InsertedNote[] memory inserted) {
        inserted = new InsertedNote[](commitments.length); // inserted notes
        uint32 idx = 0; // how many currently inserted into pool
        uint32 outIdx = 0; // how many inserted currently inserted into the array
        uint256 total = commitments.length; // num of commitments

        while (idx < total) {
            Pool storage pool = _currentPool();
            uint256 poolId = pools.length - 1;
            uint32 remaining = MAX_LEAF - pool.nextIdx; // how many can be inserted in this pool

            // if there is no space in pool -> create pool
            if (remaining == 0) {
                _createPool();
                continue;
            }

            uint32 left = uint32(remaining - idx); //
            uint32 toInsert = remaining < left ? remaining : left;

            // insert leafs without pushing the root here
            for (uint8 i = 0; i < toInsert; i++) {
                bytes32 C = commitments[idx++]; // commitment
                commitmentExists[C] = true; //add commitment to commitment pool
                // update pool for the commitment
                _updatePool(pool, C);
                inserted[outIdx++] = InsertedNote({
                    poolId: poolId,
                    commitment: C
                });
            }

            // push root only once for group of commitments
            _pushRoot(pool, pool.root);
        }
    }

    function _pushRoot(Pool storage p, bytes32 newRoot) internal {
        // current root
        bytes32 oldRoot = p.rootHistory[p.rootPtr]; // old root at that position
        if (oldRoot != bytes32(0)) {
            p.validRoot[oldRoot] = false; // old root no more a valid root
        }

        p.rootHistory[p.rootPtr] = newRoot; // store new root in the history
        p.validRoot[newRoot] = true; // new root in valid roots
        p.rootPtr = (p.rootPtr + 1) % ROOT_HISTORY_SIZE; // increament root ptr (i.e where next root will be inserted)
    }
}
