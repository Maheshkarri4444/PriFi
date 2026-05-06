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
 * A ZK-based UTXO-style private ETH pool.
 *
 * - ETH is locked in the contract
 * - Ownership is represented by commitments (cmx)
 * - Balances, senders, receivers, and amounts are hidden
 * - Merkle trees track note existence
 * - Nullifiers prevent double-spends
 *
 * All sensitive data is handled off-chain by wallets.
 * On-chain logic only verifies cryptographic correctness.
 */
contract PrivatePool {
    // constants
    uint32 public constant TREE_DEPTH = 20;
    uint32 public constant ROOT_HISTORY_SIZE = 10;
    uint32 public constant MAX_LEAF = uint32(1) << TREE_DEPTH; // 2**20 value
    uint32 constant MAX_INPUTS = 4;

    // zero commitment - used in the place of empty commitment (wallet must use same convention)
    bytes32 public constant ZERO_COMMITMENT =
        bytes32(uint256(keccak256("ZERO_COMMITMENT")));

    // verifiers
    IVerifier public immutable depositVerifier;
    IVerifier public immutable transferVerifier;
    IVerifier public immutable withdrawVerifier;

    // posidon
    IPoseidon public immutable posidon;

    // events
    event NewPool(uint256 indexed poolId); //indexed-> searchable/filterable

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
        bytes32[ROOT_HISTORY_SIZE] root_history; // stores the recent history of roots , so the system allows mempool delays to improve UX.
        uint32 rootPtr; // tracks newest position in circular root history
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
        p.root_history[0] = zero;
        p.rootPtr = 0;
        p.nextIdx = 0;
        p.validRoot[zero] = true;

        emit NewPool(pools.length - 1);
    }

    function _currentPool() internal returns (Pool storage) {
        return pools[pools.length - 1];
    }
}
