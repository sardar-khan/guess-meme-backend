const { BN } = require('bn.js')
const { connection, feeRecipient, program, programId, provider, signer, tokenFeeRecipient, wallet } = require("../solana/config");
const { b } = require("./utils");
const { getOrCreateAssociatedTokenAccount } = require("@solana/spl-token");
const { PublicKey } = require("@solana/web3.js");

async function withdraw(mintaddy) {
  try {
    const token_address = new PublicKey(mintaddy);

    const [g] = PublicKey.findProgramAddressSync(
      [Buffer.from("global")],
      programId
    );

    const [S] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint-authority")],
      programId
    );
    const [C] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding-curve"), token_address.toBuffer()],
      programId
    );

    const B = b(token_address, C, !0);
    const y = b(token_address, feeRecipient, !0);
    const associateTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      signer,
      token_address,
      feeRecipient,
    );
    const associateUser = await getOrCreateAssociatedTokenAccount(
      connection,
      signer,
      token_address,
      wallet.publicKey
    );
    //const r = b(mintaddy, wallet.publicKey, !1);

    // const initialVirtualTokenReserves = new BN(1073000000000000);
    // const initialVirtualSolReserves = new BN(30000000000); // 30000000000 pumpfun default
    // const initialRealTokenReserves = new BN(629000000000000); // 793100000000000 pumpfun default  //mine 42.5 sol
    // const tokenTotalSupply = new BN(1000000000000000);
    // const feeBasisPoints = new BN(100);
    console.log("global", g.toString(), "mint", token_address.toString(), "bondingCurve", C.toString(), "associated bonding curve", B.toString(), "associateduser", associateUser.address.toString(),
      "user", wallet.publicKey.toString(), "tokenFeeRecipient", feeRecipient.toString(), "associatedTokenFeeRecipient", associateTokenAccount.address.toString()
    )
    // Add your test here.
    const tx = await program.methods
      .withdraw()
      .accounts({
        global: g,
        mint: token_address,
        bondingCurve: C,
        associatedBondingCurve: B,
        associatedUser: associateUser.address,
        user: wallet.publicKey,
        tokenFeeRecipient: feeRecipient,
        associatedTokenFeeRecipient: associateTokenAccount.address

      })
      .rpc();
    console.log("Your transaction signature", tx);
    const tx_status = await getTransactionDetails(tx);
    let success = tx_status?.transaction_status;
    if (success == true) {
      return { hash: tx, success: true };
    } else if (success == false) {
      return { hash: tx, success: false };
    }
  } catch (error) {
    console.log("error", error)
    return { error: error.message, success: false }
  }
}

async function getTransactionDetails(transactionHash) {

  try {
    const transactionDetails = await connection.getTransaction(transactionHash, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0
    });

    if (!transactionDetails) {
      console.log("Transaction not found or still processing.");
      return;
    }

    if (transactionDetails.meta.err === null) {
      return { transaction_status: true }
    }
    else if (transactionDetails.meta.err !== null) {
      return { transaction_status: false }
    }
  } catch (error) {
    console.error("Error fetching transaction details:", error.message);
  }
}


module.exports = { withdraw, getTransactionDetails }
