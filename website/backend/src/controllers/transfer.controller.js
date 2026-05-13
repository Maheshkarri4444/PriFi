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
    wallet
} = require("../config/provider");
const provider = require("../config/provider");

const {
    spentNullifiers
} = require("../indexer/poolIndexer");

const transferVKey =
    require("../zk/transfer_verification_key.json");


const ZERO_COMMITMENT = ethers.ZeroHash;

// =====================================
// BUILD PUBLIC SIGNALS
// =====================================
function buildPublicSignals(call) {

    const publicSignals = [];

    // relayer zk pubkey
    publicSignals.push(
        provider.relayerWallet.zk.publicKey.toString()
    );

    // enabled
    for (const e of call.enabled) {
        publicSignals.push(
            e.toString()
        );
    }

    // roots
    for (const root of call.roots) {
        publicSignals.push(
            BigInt(root).toString()
        );
    }

    // nullifiers
    for (const n of call.nullifiers) {
        publicSignals.push(
            BigInt(n).toString()
        );
    }

    // output enabled
    publicSignals.push(
        call.C1 !== ZERO_COMMITMENT
            ? "1"
            : "0"
    );

    publicSignals.push(
        call.C2 !== ZERO_COMMITMENT
            ? "1"
            : "0"
    );

    publicSignals.push(
        call.C3 !== ZERO_COMMITMENT
            ? "1"
            : "0"
    );

    // commitments
    publicSignals.push(
        BigInt(call.C1).toString()
    );

    publicSignals.push(
        BigInt(call.C2).toString()
    );

    publicSignals.push(
        BigInt(call.C3).toString()
    );

    return publicSignals;
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

        const {
            zkProofs
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
            let i = 0;
            i < transferCalls.length;
            i++
        ) {

            const call =
                transferCalls[i];

            const proof = zkProofs[i];

            const signals =
                buildPublicSignals(call);

            console.log(
                "built public singals:",
                signals
            );

            const verified =
                await snarkjs.groth16
                    .verify(

                        transferVKey,

                        signals,

                        proof
                    );
            console.log(
                "call", i,
                "verified", verified
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
                    ZERO_COMMITMENT
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
            // console.log("relayer wallet:",provider.relayerWallet);

            try {
                // console.log("encrypted note of relayer: ",call.encryptedNote3);

                const decrypted =
                    decryptMessage(

                        call.encryptedNote3,

                        provider.relayerWallet.privateWallet.privateKey,
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


        // const zeroCommitment = await privatePool.ZERO_COMMITMENT();
        // console.log("zero commitment: ",zeroCommitment);

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
            await provider.provider
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

        console.log("estimated cost",estimatedCost);

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