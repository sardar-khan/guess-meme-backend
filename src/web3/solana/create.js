const { Keypair, PublicKey } = require("@solana/web3.js");
const { program, programId } = require("../solana/config");
const BN = require("bn.js");
const { b } = require("./utils");

async function create(t_name, t_symbol, t_uri, max_supply) {
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

    const token_key = Keypair.generate();
    console.log("Token address (public key):", token_key.publicKey.toBase58());
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
        [Buffer.from("bonding-curve"), token_key.publicKey.toBuffer()],
        programId
    );
    console.log("Bonding curve:", C.toBase58());

    const B = b(token_key.publicKey, C, true);
    console.log("Associated Bonding Curve Address:", B.toBase58());

    const MPL_TOKEN_METADATA_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
    const E = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);

    const [O] = PublicKey.findProgramAddressSync(
        [Buffer.from("global")],
        programId
    );

    const [D] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), E.toBuffer(), token_key.publicKey.toBuffer()],
        E
    );

    console.log("Token Supply (adjusted for decimals):", tokenTotalSupply.toString(), max_supply * tokenFactor);
    // Create transaction
    const tx = await program.methods
        .create(
            t_name,
            t_symbol,
            t_uri,
            100, // Adjust max_supply for token decimals
            initialRealTokenReserves,
            initialVirtualTokenReserves,
            tokenTotalSupply
        )
        .accounts({
            mint: token_key.publicKey,
            mintAuthority: S,
            bondingCurve: C,
            associatedBondingCurve: B,
            global: O,
            mplTokenMetadata: E,
            metadata: D,
        })
        .signers([token_key])
        .rpc();

    console.log("Transaction Signature:", tx);

    // Placeholder for future liquidity injection logic
    if (false) {
        console.log("Liquidity injection logic goes here. Inject $12,000 into Raydium.");
    }

    return {
        hash: tx,
        token_address: token_key.publicKey.toBase58(),
    };
}
module.exports = { create }
