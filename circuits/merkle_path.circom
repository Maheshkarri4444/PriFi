pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template MerklePath(depth){
    // public inputs
    signal input root;
    // private inputs
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];


    signal cur[depth + 1];
    cur[0] <== leaf;

    for (var i = 0; i < depth; i++){
        component hasher = Poseidon(2);

        pathIndices[i] * (1 - pathIndices[i]) === 0; // constarint that checks path indices is either 0 or 1

        signal left;
        signal right;

        // if idx == 0:
        // left = cur
        // right = sibling
        //
        // if idx == 1:
        // left = sibling
        // right = cur
        
        left <== (1 - pathIndices[i]) * cur[i] +  pathIndices[i] * pathElements[i];
        right <== pathIndices[i] * cur[i] + (1 - pathIndices[i]) * pathElements[i];

        hasher.inputs[0] <== left;
        hasher.inputs[1] <== right;

        cur[i + 1] <== hasher.out;
    }
    cur[depth] === root;
}

component main { public [ root ]} = MerlePath(20);