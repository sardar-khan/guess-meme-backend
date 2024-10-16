const { Keypair, PublicKey } = require("@solana/web3.js");
const { program, programId } = require("../solana/config");
const BN = require("bn.js");
const { b } = require("./utils");

async function create(t_name, t_symbol, t_uri, max_supply) {

    const tokenTotalSupply = new BN(250000000000000);
    const tokenMargin = new BN(73000000000000);
    const initialVirtualTokenReserves = tokenTotalSupply.add(tokenMargin);
    const initialRealTokenReserves = tokenTotalSupply.mul(new BN(80)).div(new BN(100));
    const token_key = Keypair.generate();
    console.log("Token address (public key):", token_key.publicKey.toBase58());
    const [S] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint-authority")],
        programId
    );

    console.log("mint auth:", S);
    const [C] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding-curve"), token_key.publicKey.toBuffer()],
        programId
    );

    console.log("Mint authority: " + S.toBase58());
    console.log("Bonding curve: " + C.toBase58());

    const B = b(token_key.publicKey, C, true);
    console.log("token pubkey b:", B.toBase58());

    const MPL_TOKEN_METADATA_PROGRAM_ID =
        "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

    const E = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);
    const [O] = PublicKey.findProgramAddressSync(
        [Buffer.from("global")],
        programId
    );
    const [D] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), E.toBuffer(), token_key.publicKey.toBuffer()],
        E
    );

    console.log("Token Supply:", tokenTotalSupply);

    const tx = await program.methods
        .create(t_name, t_symbol, t_uri, max_supply, initialRealTokenReserves, initialVirtualTokenReserves, tokenTotalSupply)
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

    console.log("Your transaction signature", tx);
    return { hash: tx.hash, token_address: token_key.publicKey.toBase58() }
}


module.exports = { create }
