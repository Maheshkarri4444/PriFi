const { ethers } =
    require("ethers");

require("dotenv").config();

const provider =
    new ethers.providers.JsonRpcProvider(
        process.env.RPC_URL
    );

const wallet =
    new ethers.Wallet(
        process.env.PRIVATE_KEY,
        provider
    );

module.exports = {
    provider,
    wallet
};