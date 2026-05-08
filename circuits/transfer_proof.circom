pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";


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

    // we need max_inpts of enalbled flags
    // we need max_inputs of c_in for commitments
    // we need a_in, r_in for every c_in
    // max_inputs of roots , path_indices , path_elements 
    // we have max_inputs of nullifiers -> poseidon(c_in,r_in,sk)

    // enabled flag
    signal input enabled[max_inpts]; //public (0 or 1)

    // commitments validity check
    signal input c_ins[max_inputs]; // private
    signal input a_ins[max_inputs]; // private
    signal input r_ins[max_inputs]; // private 
    
    




} 