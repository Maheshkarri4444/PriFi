import {
    encrypt,
    decrypt
} from "eciesjs";

import {

    getBytes,

    hexlify,

    toUtf8Bytes,

    toUtf8String

} from "ethers";



// encrypt plaintext using public key
export function encryptMessage(

    message,

    publicKey
) {

    const messageBytes =
        toUtf8Bytes(message);

    const publicKeyBytes =
        getBytes(publicKey);

    const encrypted =
        encrypt(
            publicKeyBytes,
            messageBytes
        );

    return hexlify(encrypted);
}



// decrypt ciphertext using private key
export function decryptMessage(

    ciphertextHex,

    privateKey
) {

    const ciphertextBytes =
        getBytes(ciphertextHex);

    const privateKeyBytes =
        getBytes(privateKey);

    const decrypted =
        decrypt(
            privateKeyBytes,
            ciphertextBytes
        );

    return toUtf8String(decrypted);
}