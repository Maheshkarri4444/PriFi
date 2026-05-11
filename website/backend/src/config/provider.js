const { ethers } =
    require("ethers");

require("dotenv").config();

const provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL
    );

const wallet =
    new ethers.Wallet(
        process.env.PRIVATE_KEY,
        provider
    );

const {
    generatePrivateWallet
} = require("../helpers/privateWallet");


let relayerWallet;

async function initializeRelayer() {

    const relayerSignature =
        await wallet.signMessage(
            "PriFi private financial dapp"
        );

    relayerWallet =
        await generatePrivateWallet(
            relayerSignature
        );
}

module.exports = {
    provider,
    wallet,

    initializeRelayer,

    get relayerWallet() {
        return relayerWallet;
    }
};