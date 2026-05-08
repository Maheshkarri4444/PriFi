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


    /// INPUTS SECTION

    // we need max_inpts of enalbled flags to check existence ✅
    // we need max_inputs of c_in i.e commitments ✅
    // we need a_in, r_in for every c_in for computation checkup ✅ 
    // max_inputs of roots , path_indices , path_elements i.e for every commitment to check leaf validity in the tree ✅ 
    // we need max_inputs of nullifiers to check nullifier == poseidon(c_in,r_in,sk) ✅
    // we need sum of inputs to check sumInputs == sumOutputs✅

    // enabled flag
    signal input enabled[max_inputs]; //public (0 or 1)

    // input commitments validity check
    signal input c_ins[max_inputs]; // private
    signal input a_ins[max_inputs]; // private
    signal input r_ins[max_inputs]; // private 

    // cmx validity check in merkle tree
    signal input roots[max_inputs]; // public
    signal input pathElements[max_inputs][depth]; // private
    signal input pathIndices[max_inputs][depth];  // private

    // nullifier validity check
    signal input nullifiers[max_inputs]; // public

    // compute sum of inputs
    signal sum[max_inputs + 1]; 
    sum[0] <== 0;  
    signal x[max_inputs];

    // note: in circom we cannot to circular addition like sum <== sum + amount;
    //       thats why we are using sum array.

    for (var i = 0; i < max_inputs; i++) {
        // enable flag constraint
        enabled[i] * (1 - enabled[i]) === 0;

        // amount summation
        x[i] <== enabled[i] * a_ins[i];
        sum[i + 1] <== sum[i] + x[i];

        // input commitment computation checkup
        component hasher = Poseidon(3);

        hasher.inputs[0] <== a_ins[i];
        hasher.inputs[1] <== r_ins[i];
        hasher.inputs[2] <== pk;

        enabled[i] * (c_ins[i] - hasher.out) === 0; //commitment checkup

        // root validity check for that commitment
        component merklePath = MerklePath(depth);
        merklePath.leaf <== c_ins[i];
        for (var j = 0; j < depth ; j++ ){
            merklePath.pathIndices[j] <== pathIndices[i][j];
            merklePath.pathElements[j] <== pathElements[i][j];
        }

        enabled[i] * (merklePath.computedRoot - roots[i]) === 0; 

        // nullifier computation checkup for that commitment
        // nullifier -> poseidon(c_in,r_in,sk) 
        component nullHasher = Poseidon(3);
        nullHasher.inputs[0] = c_ins[i]; 
        nullHasher.inputs[1] = r_ins[i]; // "r" used to create that commitment
        nullHasher.inputs[2] = sk;  // why not pk? because the sender can compute the nullifier.

        enabled[i] * (nullHasher.out - nullifiers[i]) === 0;

    }

    // OUTPUTS SECTION
    // we need enabled flags (i.e only 3) 1.receiver 2.change 3.relayer ✅
    // we need output commitments ✅
    // we need a_out , r_out , receiver to check commitment validity ✅
    // sum of outputs ✅

    signal input output_enabled[3]; // public
    signal input c_outs[3]; // public
    signal input a_outs[3]; // private
    signal input r_outs[3]; //private
    signal input receivers[3]; //private

    signal out_sum[4];
    out_sum[0] <== 0;
    signal y[3];
    for (var i = 0 ; i < 3 ; i++){
        // output enabled flag constraint
        output_enabled[i] * (1 - output_enabled[i]) === 0;

        //output commitment checkup
        component outHasher = Poseidon(3);
        outHasher.inputs[0] = a_outs[i];
        outHasher.inputs[1] = r_outs[i];
        outHasher.inputs[2] = receivers[i];

        y[i] <== output_enabled[i] * a_outs[i];
        out_sum[i + 1] <== out_sum[i] + y[i];

        output_enabled[i] * (c_out[i] - outHasher.out) === 0;        
    }

    // sum of inputs === sum of outputs
    sum[max_inputs] === out_sum[3];

} 

component main {public [ 
    enabled,
    roots,
    nullifiers,
    output_enabled,
    c_outs,
]} = TransferProof(4,20);