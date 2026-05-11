import { ethers } from "ethers";

import * as circomlibjs
    from "circomlibjs";



export async function generatePrivateWallet(
    signature
) {

    const poseidon =
        await circomlibjs.buildPoseidon();

    // deterministic seed
    const seed =
        ethers.keccak256(signature);

    // derived private wallet
    const privateWallet =
        new ethers.Wallet(seed);

    // zk secret key
    const sk =
        BigInt(
            privateWallet.privateKey
        ).toString();

    // zk public key
    const pk =
        poseidon.F.toString(
            poseidon([3, sk])
        );

    return {

        privateWallet: {

            address:
                privateWallet.address,

            privateKey:
                privateWallet.privateKey,

            publicKey:
                ethers.SigningKey.computePublicKey(
                    privateWallet.privateKey,
                    false
                )
        },

        zk: {

            secretKey: sk,

            publicKey: pk
        }
    };
}