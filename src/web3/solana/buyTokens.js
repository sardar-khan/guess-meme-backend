const {
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
    connection,
    feeRecipient,
    mintaddy,
    program,
    programId,
    wallet,
} = require("./config");
const {
    getAccount,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
} = require("@solana/spl-token");
const { Buy_createTransactionInstruction, b, lx_global } = require("./utils");
const BN = require("bn.js");
const bs58 = require("bs58");
// const userPublickey = new PublicKey("GMjT1392P2XMgMwQJEvQFsjJrrFW6symXjerkUvzinLV");

async function initializeUserATA(payer, user, mint) {
    console.log("minter", user, mint, "associated", TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID)
    user = new PublicKey(user);
    console.log("my user", user)
    const userATA = await getAssociatedTokenAddress(
        mint,
        user,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    console.log("User ATA:", userATA.toBase58());

    const accountInfo = await connection.getAccountInfo(userATA);
    if (accountInfo !== null) {
        console.log("ATA already exists.");
        return userATA;
    }

    const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
            payer.publicKey,
            userATA,
            user,
            mint
        )
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);

    console.log("Transaction signature", signature);

    return userATA;
}

async function buyWithAddress(address) {
    try {
        console.log("mintaddy", mintaddy);
        const buy_value = "0.1";
        const tokenamt = 210000000000;

        const [S] = PublicKey.findProgramAddressSync(
            [Buffer.from("mint-authority")],
            programId
        );
        const [C] = PublicKey.findProgramAddressSync(
            [Buffer.from("bonding-curve"), mintaddy.toBuffer()],
            programId
        );

        console.log("Mint authority: " + S.toBase58());
        console.log("Bonding curve: " + C.toBase58());

        const B = b(mintaddy, C, true);

        const MPL_TOKEN_METADATA_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
        const E = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);
        const [O] = PublicKey.findProgramAddressSync(
            [Buffer.from("global")],
            programId
        );
        const [D] = PublicKey.findProgramAddressSync(
            [Buffer.from("metadata"), E.toBuffer(), mintaddy.toBuffer()],
            E
        );

        let atains;

        const r = b(mintaddy, wallet.publicKey, false);
        try {
            const res = await getAccount(connection, r);
        } catch (error) {
            atains = Buy_createTransactionInstruction(
                wallet.publicKey,
                r,
                wallet.publicKey,
                mintaddy
            );
        }

        const { bonding_curve: k } = await lx_global();
        const {
            virtual_token_reserves,
            virtual_sol_reserves,
            real_token_reserves,
            token_total_supply,
            complete,
        } = k;

        console.log("initialVirtualTokenReserves:", virtual_token_reserves);
        console.log("initialVirtualSolReserves:", virtual_sol_reserves);
        console.log("initialRealTokenReserves:", real_token_reserves);
        console.log("tokenTotalSupply:", token_total_supply);
        console.log("complete:", complete);

        const EX = (e) => (k ? e.mul(new BN(0)).div(new BN(1e4)) : new BN(0));

        const K = (e, t) => {
            let a, r;

            if (e.eq(new BN(0)) || !k) {
                return new BN(0);
            }

            let { initialVirtualSolReserves: l, initialVirtualTokenReserves: s, initialRealTokenReserves: o } = k;

            if (t) {
                let t = l.mul(s);
                let i = l.add(e);
                let n = t.div(i).add(new BN(1));
                r = s.sub(n);
                r = BN.min(r, o);
                a = e;
            } else {
                a = (e = BN.min(e, o)).mul(l).div(s.sub(e)).add(new BN(1));
                r = e;
            }
            console.log(a.toNumber());
            let i = EX(a);
            return t ? r : a.add(i);
        };

        let a = new BN(Math.floor(1e9 * parseFloat(buy_value)));

        let o = {
            solAmount: a,
        };

        let buyTx = await program.methods
            .buy(
                new BN(tokenamt),
                o.solAmount.add(a.mul(new BN(Math.floor(10 * 999))).div(new BN(1e3)))
            )
            .accounts({
                global: O,
                feeRecipient: feeRecipient,
                mint: mintaddy,
                bondingCurve: C,
                associatedBondingCurve: B,
                associatedUser: address,
                user: wallet.publicKey,
                systemProgram: new PublicKey("11111111111111111111111111111111"),
                tokenProgram: new PublicKey(
                    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
                ),
                rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
            })
            .rpc();

        console.log("Buy transaction signature: ", buyTx);
        return {
            success: true,
            transactionHash: buyTx
        };

    } catch (error) {
        console.error("Error in buyWithAddress:", error.message);
        return {
            success: false,
            message: "An error occurred during the buy transaction. Please try again later.",
            error: error.message
        };
    }
}


module.exports = { buyWithAddress, initializeUserATA }