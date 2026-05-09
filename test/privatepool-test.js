const { ethers } = require("hardhat");

const {
    generatePrivateWallet
} = require("../helpers/wallets");

const {
    encryptMessage,
    decryptMessage
} = require("../helpers/encryption");


// global relayer wallet
let relayerWallet;

// global users wallets
const userWallets = [];


describe("PriFi Wallet Architecture", function () {

    it("Should generate deterministic private wallets and zk keys", async function () {

        const signers = await ethers.getSigners();

        // relayer
        const relayerSigner = signers[0];

        const relayerSignature =
            await relayerSigner.signMessage(
                "PriFi private financial dapp"
            );

        relayerWallet =
            await generatePrivateWallet(
                relayerSignature
            );

        console.log("\n========== RELAYER ==========");
        console.log(relayerWallet);

        // users
        const users = signers.slice(1, 6);

        for (let i = 0; i < users.length; i++) {

            const signer = users[i];

            const signature =
                await signer.signMessage(
                    "PriFi private financial dapp"
                );

            const wallet =
                await generatePrivateWallet(
                    signature
                );

            userWallets.push(wallet);

            console.log(`\n========== USER ${i + 1} ==========`);

            console.log(wallet);
        }

        console.log("\n========== ALL USERS ==========");
        console.log(userWallets);
    });



    it("Should encrypt and decrypt notes between users and relayer", async function () {

        // random user
        const user = userWallets[2];

        // sample note
        const note = {

            amount: "100",

            randomness:
                ethers.BigNumber.from(
                    ethers.utils.randomBytes(31)
                ).toString(),

            zkPublicKey:
                user.zk.publicKey
        };

        // serialize note
        const plaintext =
            JSON.stringify(note);

        console.log("\n========== ORIGINAL NOTE ==========");
        console.log(plaintext);




        // USER -> RELAYER

        const encryptedToRelayer =
            encryptMessage(
                plaintext,
                relayerWallet.privateWallet.publicKey
            );

        console.log("\n========== ENCRYPTED TO RELAYER ==========");
        console.log(encryptedToRelayer);

        const decryptedByRelayer =
            decryptMessage(
                encryptedToRelayer,
                relayerWallet.privateWallet.privateKey
            );

        console.log("\n========== RELAYER DECRYPTED ==========");
        console.log(decryptedByRelayer);





        // RELAYER -> USER

        const encryptedToUser =
            encryptMessage(
                plaintext,
                user.privateWallet.publicKey
            );

        console.log("\n========== ENCRYPTED TO USER ==========");
        console.log(encryptedToUser);

        const decryptedByUser =
            decryptMessage(
                encryptedToUser,
                user.privateWallet.privateKey
            );

        console.log("\n========== USER DECRYPTED ==========");
        console.log(decryptedByUser);
    });
});