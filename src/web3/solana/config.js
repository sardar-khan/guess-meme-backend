const { AnchorProvider, Program, Wallet } = require("@coral-xyz/anchor");
const { Keypair, Connection, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");
const IDL1 = require("./solIdl.json");


const programId = new PublicKey(
    "7jFsWYwonXMUWicDFkR7vfCudb8pm8feyzAi535DmsVh"
);

const RPC_URL = "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

const feeRecipient = new PublicKey(
    "GTwY38pfmivyecwZtevaT14N3WDHMQebrrWjt2i48E29"
);

const SELLSLIPPAGE = 50;

const mintaddy = new PublicKey(
    "qVsZ9LG4pp2cKRuCDkXrL3RDZPGFK6vLyZUGSQQJ2Uj"
);

const DEV_KEY = "4Suo836P86rZ1n3ZMdCXn5R7YEerQg5D3s862WsdatJYdccPsPmEr1TYuqfsJqVrqF8HAbBdxbaYVqXfWCcgXeKo";

const wallet = new Wallet(Keypair.fromSecretKey(bs58.default.decode(DEV_KEY)));

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
    program
};
