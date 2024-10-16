const BN = require("bn.js");
const { mintaddy, program, programId } = require("./config");
const { PublicKey, SystemProgram, TransactionInstruction } = require("@solana/web3.js");

function b(e, n, t = false, r = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), i = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")) {
    // if (!t && !PublicKey.isOnCurve(n.toBuffer()))
    //     throw new InvalidPublicKeyError;
    let [d] = PublicKey.findProgramAddressSync(
        [n.toBuffer(), r.toBuffer(), e.toBuffer()],
        i
    );
    return d;
}

function Buy_createTransactionInstruction(
    signerPublicKey, // Public key of the signer account
    programPublicKey, // Public key of the program to interact with
    associatedTokenPublicKey, // Public key of the associated token account
    mintPublicKey // Public key of the mint account
) {
    const accounts = [
        {
            pubkey: signerPublicKey,
            isSigner: true,
            isWritable: true,
        },
        {
            pubkey: programPublicKey,
            isSigner: false,
            isWritable: false,
        },
        {
            pubkey: associatedTokenPublicKey,
            isSigner: false,
            isWritable: true,
        },
        {
            pubkey: mintPublicKey,
            isSigner: false,
            isWritable: false,
        },
        {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
        },
        {
            pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
            isSigner: false,
            isWritable: false,
        },
    ];

    const data = Buffer.alloc(0);

    return new TransactionInstruction({
        keys: accounts,
        programId: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
        data,
    });
}

async function lx_global() {
    const [i] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding-curve"), mintaddy.toBuffer()],
        programId
    );
    const r = await program.account.bondingCurve.fetch(i);

    return {
        bonding_curve: r,
    };
}

async function fetchLiquidityPool(_str) {
    return await program.account.bondingCurve.fetch(_str);
}

async function fetchPrice(purchaseAmount, hasLiquidity, bonding_curve) {
    let liquidityPool = await fetchLiquidityPool(bonding_curve);
    console.log(liquidityPool.virtualSolReserves.toString());

    function calculateFee(e) {
        return new BN(0);
    }

    function exchangeRate(purchaseAmount, hasLiquidity) {
        if (purchaseAmount.isZero() || !liquidityPool) {
            return new BN(0);
        }

        let remainingSolAmount, tokensSold, feeAmount;

        if (hasLiquidity) {
            const totalLiquidity = liquidityPool.virtualSolReserves.mul(
                liquidityPool.virtualTokenReserves
            );
            const newSolReserve = liquidityPool.virtualSolReserves.add(purchaseAmount);
            const pricePerToken = totalLiquidity.div(newSolReserve).add(new BN(1)); // +1 for rounding

            tokensSold = liquidityPool.virtualTokenReserves.sub(pricePerToken);
            tokensSold = BN.min(tokensSold, liquidityPool.realTokenReserves);
            remainingSolAmount = purchaseAmount;
        } else {
            remainingSolAmount = BN.min(
                purchaseAmount,
                liquidityPool.realTokenReserves
            );
            const pricePerToken = remainingSolAmount
                .mul(liquidityPool.virtualSolReserves)
                .div(liquidityPool.virtualTokenReserves.sub(remainingSolAmount))
                .add(new BN(1)); // +1 for rounding

            tokensSold = remainingSolAmount;
        }

        // Assuming 'y' calculates a fee based on remainingSolAmount
        feeAmount = calculateFee(remainingSolAmount);

        return hasLiquidity ? tokensSold : remainingSolAmount.add(feeAmount);
    }

    if (hasLiquidity) {
        const tokensReceivedWithLiquidity = exchangeRate(purchaseAmount, true);
        return tokensReceivedWithLiquidity;
    } else {
        const tokensReceivedWithoutLiquidity = exchangeRate(purchaseAmount, false);
        return tokensReceivedWithoutLiquidity;
    }
}

module.exports = {
    b,
    Buy_createTransactionInstruction,
    lx_global,
    fetchLiquidityPool,
    fetchPrice,
};
