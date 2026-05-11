const mongoose =
    require("mongoose");

const userSchema =
    new mongoose.Schema({

        name: {
            type: String,
            required: true
        },

        realAddress: {
            type: String,
            required: true,
            unique: true
        },

        privateWalletPublicKey: {
            type: String,
            required: true
        },

        zkPublicKey: {
            type: String,
            required: true
        }

    }, {
        timestamps: true
    });

module.exports =
    mongoose.model(
        "User",
        userSchema
    );