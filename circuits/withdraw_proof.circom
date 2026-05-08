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
    // we need to check the ownership ✅
    // Requires: Pk, Sk 
    // we need to check the input commitments validity ✅
    // Requires: enabled[], c_ins[], a_ins[], r_ins[] , pk; roots, pathElements[], pathIndices[] 
    // we need recompute nullifiers ✅
    // Requires: c_ins[],r_ins[],sk
    // we need to check the 2 output commitments validity
    // Requires: out_enabled[] , C_outs[], r_outs[] , a_outs[]
    // we need compute sumInputs = sumOutputs
    // Requires: Sum(a_ins[]) == Sum(withdrawAmount + Sum(a_outs)) 

    // ownership
    signal input pk; // private
    signal input sk; // private

    // owndership check
    component ownHasher = Poseidon(1);
    ownHasher.inputs[1] <== sk;
    pk === ownHasher.out;

    //INPUTS VALIDATION

    // commitments validity required feilds
    signal input enabled[max_inputs];  // 0 or 1                                       //public
    signal input c_ins[max_inputs]; // cmx                                             //private
    signal input a_ins[max_inputs]; // amount in for that cmx                          //private
    signal input r_ins[max_inputs]; // "r" used to create that cmx                     //private
    signal input roots[max_inputs]; // root for the merkle tree that cmx present in    //public
    signal input pathElements[max_inputs][depth]; // path elements to the root         //private 
    signal input pathIndices[max_inputs][depth]; // path indices to the root           //private

    // nullifiers 
    signal input nullifiers[max_inputs];//public

    for(var i = 0; i < max_inputs ; i++){
        // enable constraint
        enabled[i] * (1 - enabled[i]) === 0;

        //input commitment computation checkup
        component comHasher = Poseidon(3);
        comHasher.inputs[0] = a_ins[i];
        comHasher.inputs[1] = r_ins[i];
        comHasher.inputs[2] = pk;

        // constraint 
        enabled[i] * (comHasher.out - c_ins[i]) === 0;

        // merkle root validity check
        component merklePath = MerklePath(depth);
        merklePath.leaf = c_ins[i];
        for (var j = 0; j < depth; j++){
            merklePath.pathElements[j] <== pathElements[i][j];
            merklePath.pathIndices[j] <== pathIndices[i][j];
        }

        // computed root , root equalent constraint
        enabled[i] * (roots[i] - merklePath.computedRoot) === 0;

        // nullifiers checkup
        component nullHasher = Poseidon(3);
        nullHasher.inputs[0] = c_ins[i];
        nullHasher.inputs[1] = r_ins[i];
        nullHasher.inputs[2] = sk;

        enabled[i] * (nullHasher.out - nullifiers[i]) === 0;
    }

    // OUTPUTS VALIDATION
    
}
