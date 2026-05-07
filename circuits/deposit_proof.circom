pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Deposit
 *
 * Proves that deposited amount equals
 * the sum of committed note values.
 *
 * Supports up to 2 commitments.
 */


template DepositProof() {
    //public signals
    signal input depositAmount;
    signal input c1;
    signal input c2;

    //private inputs
    //for 1st commitment
    signal input a1;    // amount of 1st commitment
    signal input r1;    // randomness of 1st commitment
    signal input pk1;   // receiver pubkey of 1st commitment

    // for 2nd commitment
    signal input a2;     
    signal input r2;
    signal input pk2;

    component hasher1 = Poseidon(3);
    hasher1.inputs[0] = a1;
    hasher1.inputs[1] = r1;
    hasher1.inputs[2] = pk1;

    c1 === hasher1.out;

    component hasher2 = Poseidon(3);
    hasher2.inputs[0] = a2;
    hasher2.inputs[1] = r2;
    hasher2.inputs[2] = pk2;

    c1 === hasher2.out;

    depositAmount === a1 + a2; // sum of amounts must be equal to deposit
}