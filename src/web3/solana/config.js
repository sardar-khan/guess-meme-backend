const { AnchorProvider, Program, Wallet } = require("@coral-xyz/anchor");
const { Keypair, Connection, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");
const IDL1 = require("./solIdl.json");
const adminKeyPair = require("./adminKeypair.json")

const programId = new PublicKey(
    "9HtryVvUYVdJpuX9GA6rD11m4RbrThdZQp2CSfjCLTV6"
);

const RPC_URL = "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

const feeRecipient = new PublicKey(
    "7QMH9DWpavmAP4q3D4maqHwVGh6NA4dZ3kstmVBwmjCX"
);

const SELLSLIPPAGE = 50;

const mintaddy = new PublicKey(
    "qVsZ9LG4pp2cKRuCDkXrL3RDZPGFK6vLyZUGSQQJ2Uj"
);

// const DEV_KEY = "4Suo836P86rZ1n3ZMdCXn5R7YEerQg5D3s862WsdatJYdccPsPmEr1TYuqfsJqVrqF8HAbBdxbaYVqXfWCcgXeKo";
const signer = Keypair.fromSecretKey(new Uint8Array(adminKeyPair))
//3ENYq2phUNhQivzYMU5UboTB2HnkXmhQKsK1pNxH84oRp3gU5JKTKNA18UPGi9wLgC1n6Q8B3t9aGgY4s9yousEW
// export const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(DEV_KEY)));
const wallet = new Wallet(signer);

const getPrivateKey = async () => {
    const signer = Keypair.fromSecretKey(new Uint8Array(adminKeyPair));
    return Buffer.from(signer.secretKey).toString("hex")
}
// const wallet = new Wallet(Keypair.fromSecretKey(bs58.default.decode(DEV_KEY)));

const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
});

const program = new Program(IDL1, programId, provider);

module.exports = {
    programId,
    connection,
    feeRecipient,
    SELLSLIPPAGE,
    mintaddy,
    wallet,
    provider,
    signer,
    program,
    getPrivateKey
};
