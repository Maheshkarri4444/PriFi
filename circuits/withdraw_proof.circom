pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "./merkle_path.circom";

/**
 * Withdraw
 *
 * Consumes up to MAX_INPUTS private input notes
 * belonging to a single owner and releases ETH to a public
 * address, while optionally creating up to 2 new private
 * output notes (change and relayer).
 *
 * Input notes are masked using an `enabled[]` flag, allowing
 * dummy slots to be ignored while keeping the circuit size fixed.
 *
 * All value conservation, Merkle inclusion, ownership checks,
 * and nullifier correctness are enforced inside the ZK circuit.
 */

template WithdrawProof(max_inputs, depth) {
    // we need to check the ownership 
    // Requires: Pk, Sk
    // we need to check the input commitments validity
    // Requires: enabled[], c_ins[], a_ins[], r_ins[] , pk ,  
    // we need recompute nullifiers
    // Requires: c_ins[],r_ins[],sk
    // we need to check the 2 output commitments validity
    // Requires: out_enabled[] , C_outs[], r_outs[] , a_outs[]
    // we need compute sumInputs = sumOutputs
    // Requires: Sum(a_ins[]) == Sum(withdrawAmount + Sum(a_outs)) 
}
