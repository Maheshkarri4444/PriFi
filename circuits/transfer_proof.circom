pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "./merkle_path.circom";

/**
 * Transfer
 *
 * Consumes up to MAX_INPUTS (e.g. 4) private input notes
 * belonging to a single owner and creates up to 3 new
 * private output notes in one proof.
 *
 * Input notes are masked using an `enabled[]` flag, allowing
 * dummy slots to be ignored while keeping the circuit size fixed.
 *
 * All value conservation, ownership checks, Merkle inclusion,
 * and nullifier correctness are enforced inside the ZK circuit.
 */


template TransferProof(max_inputs,  depth) {
    // ownership
    // private inputs
    signal input sk;    // PrivateKey of the wallet
    signal input pk;    // zkPublicKey of the wallet

    // pk = poseidon(sk)
    component ownershipHasher = Poseidon(1);
    ownershipHasher.inputs[0] = sk;
    pk === ownershipHasher.out; // zk publickey ownership constraint

    // we need max_inpts of enalbled flags ✅
    // we need max_inputs of c_in for commitments ✅
    // we need a_in, r_in for every c_in ✅
    // max_inputs of roots , path_indices , path_elements ✅
    // we have max_inputs of nullifiers -> poseidon(c_in,r_in,sk) ✅

    // enabled flag
    signal input enabled[max_inpts]; //public (0 or 1)

    // input commitments validity check
    signal input c_ins[max_inputs]; // private
    signal input a_ins[max_inputs]; // private
    signal input r_ins[max_inputs]; // private 

    // roots validity check
    signal input roots[max_inputs];
    signal input pathElements[max_inputs][depth];
    signal input pathIndices[max_inputs][depth];

    // nullifier validity check
    signal input nullifiers[max_inputs];

    for (var i = 0; i < max_inputs; i++) {
        // enable flag constraint
        enabled[i] * (1 - enabled[i]) === 0;

        // input commitment computation checkup
        component hasher = Poseidon(3);

        hasher.inputs[0] = a_ins[i];
        hasher.inputs[1] = r_ins[i];
        hasher.inputs[2] = pk;

        enabled[i] * (c_ins[i] - hasher.out) === 0; //commitment checkup

        // root validity check for that commitment
        component merklePath = MerklePath(depth);
        merklePath.leaf = c_ins[i];
        for (var j = 0; j < depth ; j++ ){
            merklePath.pathIndices[j] <== pathIndices[i][j];
            merklePath.pathElements[j] <== pathElements[i][j];
        }

        enabled[i] * (merklePath.computedRoot - roots[i]) === 0; 

        // nullifier computation checkup for that commitment
        // nullifier -> poseidon(c_in,r_in,sk) 
        component nullHasher = Poseidon(3);
        nullHasher.inputs[0] = c_in[i]; 
        nullHasher.inputs[1] = r_in[i]; // "r" used to create that commitment
        nullHasher.inputs[2] = sk;  // why not pk? because the sender can compute the nullifier.

        enabled[i] * (nullHasher.out - nullifiers[i]) === 0;

    }
    




} 