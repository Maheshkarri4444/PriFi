const snarkjs =
    require("snarkjs");

const { ethers } =
    require("ethers");

const privatePool =
    require("../contracts/privatePool");

const {
    decryptMessage
} = require("../helpers/crypto");

const {
    relayerWallet,
    provider,
    wallet
} = require("../config/provider");

const {
    spentNullifiers
} = require("../indexer/poolIndexer");

const transferVKey =
    require("../zk/transfer_verification_key.json");



// =====================================
// BUILD PUBLIC SIGNALS
// =====================================

function buildPublicSignals(
    call
) {

    return [

        ...call.enabled,

        ...call.roots,

        ...call.poolIds,

        ...call.nullifiers,

        call.C1,
        call.C2,
        call.C3
    ];
}



// =====================================
// BUILD PROOF OBJECT
// =====================================

function buildProof(
    call
) {

    return {

        pi_a:
            call.a,

        pi_b:
            call.b,

        pi_c:
            call.c,

        protocol:
            "groth16",

        curve:
            "bn128"
    };
}



// =====================================
// TRANSFER CONTROLLER
// =====================================

async function transferController(
    req,
    res
) {

    try {

        const {
            transferCalls
        } = req.body;



        // =====================================
        // VALIDATION
        // =====================================

        if (
            !Array.isArray(
                transferCalls
            )
        ) {

            return res.status(400)
                .json({

                    success: false,

                    message:
                        "transferCalls must be array"
                });
        }



        if (
            transferCalls.length === 0
        ) {

            return res.status(400)
                .json({

                    success: false,

                    message:
                        "No transfer calls"
                });
        }



        // =====================================
        // VERIFY PROOFS
        // =====================================

        for (
            const call
            of transferCalls
        ) {

            const proof =
                buildProof(call);

            const publicSignals =
                buildPublicSignals(
                    call
                );

            const verified =
                await snarkjs.groth16
                    .verify(

                        transferVKey,

                        publicSignals,

                        proof
                    );

            if (!verified) {

                return res.status(400)
                    .json({

                        success: false,

                        message:
                            "Invalid proof"
                    });
            }
        }



        // =====================================
        // NULLIFIER CHECK
        // =====================================

        for (
            const call
            of transferCalls
        ) {

            for (
                const nullifier
                of call.nullifiers
            ) {

                if (
                    nullifier ===
                    ethers.ZeroHash
                ) {

                    continue;
                }

                const parsed =
                    BigInt(
                        nullifier
                    ).toString();

                if (
                    spentNullifiers.has(
                        parsed
                    )
                ) {

                    return res.status(400)
                        .json({

                            success: false,

                            message:
                                "Nullifier already spent"
                        });
                }
            }
        }



        // =====================================
        // DECRYPT RELAYER NOTES
        // =====================================

        let totalRelayerFee =
            0n;

        for (
            const call
            of transferCalls
        ) {

            try {

                const decrypted =
                    decryptMessage(

                        call.encryptedNote3,

                        relayerWallet
                            .privateWallet
                            .privateKey
                    );

                const parsed =
                    JSON.parse(
                        decrypted
                    );

                totalRelayerFee +=
                    BigInt(
                        parsed.amount
                    );

            } catch (_) {

                return res.status(400)
                    .json({

                        success: false,

                        message:
                            "Invalid relayer encrypted note"
                    });
            }
        }



        // =====================================
        // ESTIMATE GAS
        // =====================================

        const gasEstimate =
            await privatePool
                .connect(wallet)
                .transfer
                .estimateGas(

                    transferCalls
                );



        const feeData =
            await provider
                .getFeeData();

        const gasPrice =
            feeData.gasPrice;

        if (!gasPrice) {

            return res.status(500)
                .json({

                    success: false,

                    message:
                        "Unable to fetch gas price"
                });
        }



        const estimatedCost =
            gasEstimate *
            gasPrice;



        // =====================================
        // PROFITABILITY CHECK
        // =====================================

        if (
            totalRelayerFee <
            estimatedCost
        ) {

            return res.status(400)
                .json({

                    success: false,

                    message:
                        "Relayer fee insufficient",

                    estimatedCost:
                        estimatedCost
                            .toString(),

                    totalRelayerFee:
                        totalRelayerFee
                            .toString()
                });
        }



        // =====================================
        // SEND TX
        // =====================================

        const tx =
            await privatePool
                .connect(wallet)
                .transfer(

                    transferCalls
                );



        const receipt =
            await tx.wait();



        // =====================================
        // SUCCESS
        // =====================================

        return res.json({

            success: true,

            txHash:
                receipt.hash,

            gasUsed:
                receipt.gasUsed
                    .toString(),

            totalRelayerFee:
                totalRelayerFee
                    .toString(),

            estimatedCost:
                estimatedCost
                    .toString()
        });

    } catch (err) {

        console.error(err);

        return res.status(500)
            .json({

                success: false,

                message:
                    err.message
            });
    }
}



module.exports = {
    transferController
};