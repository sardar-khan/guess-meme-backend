// import { Raydium, TxVersion, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2'
// import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js'
// import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
// import bs58 from 'bs58'
const { Raydium, TxVersion, parseTokenAccountResp } = require('@raydium-io/raydium-sdk-v2');
const { Connection, Keypair, clusterApiUrl } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');
const { signer } = require('../solana/config');
const bs58 = require('bs58');



const owner = Keypair.fromSecretKey(
  bs58.decode("5Y3hoJE2HRUgDC5nKzhWVSaKGk7VkAJLiedyNP8gKzvLjKKYM6JkBe52pwJxL7eTNV5aGYMXEhYrAj83mQbBzY5y")
);

//const owner = signer;

//  const owner: Keypair =  Keypair.fromSecretKey(new Uint8Array(
//   [226,215,102,199,238,120,45,220,34,208,69,232,141,191,76,36,72,85,70,212,169,75,70,99,155,248,253,203,205,85,1,187,95,33,104,174,228,100,75,92,240,40,177,237,165,36,60,225,50,111,3,224,100,99,206,14,18,241,68,174,231,52,195,4]

//   ));
const connection = new Connection('https://api.devnet.solana.com') //<YOUR_RPC_URL>
//  const connection = new Connection(clusterApiUrl('devnet')) //<YOUR_RPC_URL>
const txVersion = TxVersion.V0 // or TxVersion.LEGACY
const cluster = 'devnet' // 'mainnet' | 'devnet'

let raydium;
const initSdk = async (params) => {
  if (raydium) return raydium
  if (connection.rpcEndpoint === clusterApiUrl('devnet'))
    console.warn('using free rpc node might cause unexpected error, strongly suggest uses paid rpc node')
  console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`)
  raydium = await Raydium.load({
    owner,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: 'finalized',
    // urlConfigs: {
    //   BASE_HOST: '<API_HOST>', // api url configs, currently api doesn't support devnet
    // },
  })

  /**
   * By default: sdk will automatically fetch token account data when need it or any sol balace changed.
   * if you want to handle token account by yourself, set token account data after init sdk
   * code below shows how to do it.
   * note: after call raydium.account.updateTokenAccount, raydium will not automatically fetch token account
   */

  /*
  raydium.account.updateTokenAccount(await fetchTokenAccountData())
  connection.onAccountChange(owner.publicKey, async () => {
    raydium!.account.updateTokenAccount(await fetchTokenAccountData())
  })
  */

  return raydium
}

const fetchTokenAccountData = async () => {
  const solAccountResp = await connection.getAccountInfo(owner.publicKey)
  const tokenAccountResp = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_PROGRAM_ID })
  const token2022Req = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_2022_PROGRAM_ID })
  const tokenAccountData = parseTokenAccountResp({
    owner: owner.publicKey,
    solAccountResp,
    tokenAccountResp: {
      context: tokenAccountResp.context,
      value: [...tokenAccountResp.value, ...token2022Req.value],
    },
  })
  return tokenAccountData
}

const grpcUrl = '<YOUR_GRPC_URL>'
const grpcToken = '<YOUR_GRPC_TOKEN>'
module.exports = { owner, connection, txVersion, initSdk, fetchTokenAccountData, grpcUrl, grpcToken }