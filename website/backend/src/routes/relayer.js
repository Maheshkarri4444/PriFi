const express =
    require("express");

const router =
    express.Router();

const provider =
    require("../config/provider");

router.get(
    "/get",
    async (req, res) => {


        try {

            return res.json({

                publicKey: provider.relayerWallet.privateWallet.publicKey,

                zkPublicKey:
                    provider.relayerWallet
                        .zk
                        .publicKey
            });

        } catch (error) {

            console.error(error);

            return res.status(500).json({

                error:
                    "Failed to fetch relayer wallet"
            });
        }
    }
);

module.exports = router;