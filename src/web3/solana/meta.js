const { Keypair, PublicKey } = require("@solana/web3.js");
const { program, programId, wallet } = require("../solana/config2");
const BN = require("bn.js");
const { b } = require("./utils");

async function meta(name, symbol, uri, token_address) {
    // Constants for SOL and Token decimals
    const SOL_DECIMALS = 9;
    const TOKEN_DECIMALS = 6;

    // Compute scaling factors
    const solFactor = new BN(10).pow(new BN(SOL_DECIMALS)); // 10^9 for SOL
    const tokenFactor = new BN(10).pow(new BN(TOKEN_DECIMALS)); // 10^6 for Token

    // Adjusted token parameters
    const tokenTotalSupply = new BN(1000000000).mul(tokenFactor); // 1 billion tokens, adjusted for 6 decimals
    const tokenMargin = new BN(200000000).mul(tokenFactor); // Margin adjusted for token decimals
    const initialVirtualTokenReserves = tokenTotalSupply.add(tokenMargin);
    const initialRealTokenReserves = tokenTotalSupply.mul(new BN(80)).div(new BN(100)); // 80% of total supply

    const token_key = new PublicKey(token_address);
    console.log("Token address (public key):", token_key.toString());
    console.log("SOL Decimals:", SOL_DECIMALS);
    console.log("Token Decimals:", TOKEN_DECIMALS);
    console.log("Initial Real Token Reserves:", initialRealTokenReserves.toString());
    console.log("Initial Virtual Token Reserves:", initialVirtualTokenReserves.toString());

    // Derive addresses
    const [S] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint-authority")],
        programId
    );
    console.log("Mint authority:", S.toBase58());

    const [C] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding-curve"), token_key.toBuffer()],
        programId
    );

    const B = b(token_key, C, true);

    const MPL_TOKEN_METADATA_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
    const E = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);

    const [O] = PublicKey.findProgramAddressSync(
        [Buffer.from("global")],
        programId
    );

    const [D] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), E.toBuffer(), token_key.toBuffer()],
        E
    );
    // console.log("Token Supply (adjusted for decimals):", tokenTotalSupply.toString(), max_supply * tokenFactor);
    // Create transaction
    const tx = await program.methods
        .meta(
            name,
            symbol,
            uri,
        )
        .accounts({
            mint: token_key,
            mintAuthority: S,
            bondingCurve: C,
            associatedBondingCurve: B,
            global: O,
            mplTokenMetadata: E,
            metadata: D,
        })
        .signers([wallet.payer])
        .rpc();

    console.log("Transaction Signature:", tx);

    // Placeholder for future liquidity injection logic
    if (false) {
        console.log("Liquidity injection logic goes here. Inject $12,000 into Raydium.");
    }

    return {
        hash: tx,
        token_address: token_key.toBase58(),
    };
}


module.exports = { meta }
