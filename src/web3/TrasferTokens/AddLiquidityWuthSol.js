const {
    CREATE_CPMM_POOL_PROGRAM,
    CREATE_CPMM_POOL_FEE_ACC,
    DEVNET_PROGRAM_ID,
    getCpmmPdaAmmConfigId,
} = require('@raydium-io/raydium-sdk-v2');

const BN = require('bn.js');
const { initSdk, txVersion } = require('./solLiquidityConfig');



exports.createPool = async (token_address) => {
    console.log("token-address", token_address)
    try {
        const raydium = await initSdk({ loadToken: true })
        console.log("raydium", true)
        // check token list here: https://api-v3.raydium.io/mint/list
        // RAY
        const mintA = await raydium.token.getTokenInfo(token_address)
        console.log("raydium 2", true)
        // USDC
        const mintB = await raydium.token.getTokenInfo('So11111111111111111111111111111111111111112')
        console.log("raydium 3", true)
        /**
         * you also can provide mint info directly like below, then don't have to call token info api
         *  {
            address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            decimals: 6,
          } 
         */

        const feeConfigs = await raydium.api.getCpmmConfigs()
        if (raydium.cluster === 'devnet') {
            feeConfigs.forEach((config) => {
                config.id = getCpmmPdaAmmConfigId(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, config.index).publicKey.toBase58()
            })
        }
        console.log("raydium 4", true, feeConfigs)
        const { execute, extInfo } = await raydium.cpmm.createPool({
            // poolId: // your custom publicKey, default sdk will automatically calculate pda pool id
            programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, // devnet: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM
            poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC, // devnet:  DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC
            mintA,
            mintB,
            mintAAmount: new BN(204831000000000), // token in decimal 6
            mintBAmount: new BN(79885290000),
            startTime: new BN(0),
            feeConfig: feeConfigs[0],
            associatedOnly: false,
            ownerInfo: {
                useSOLBalance: true,
            },
            txVersion,
            // optional: set up priority fee here
            // computeBudgetConfig: {
            //   units: 600000,
            //   microLamports: 46591500,
            // },
        })
        // don't want to wait confirm, set sendAndConfirm to false or don't pass any params to execute
        console.log("raydium 5", true, extInfo)
        const { txId } = await execute({ sendAndConfirm: true })
        console.log('pool created', {
            txId,
            poolId: extInfo.address.poolId.toString(),
            poolKeys: Object.keys(extInfo.address).reduce(
                (acc, cur) => ({
                    ...acc,
                    [cur]: extInfo.address[cur].toString(),
                }),
                {}
            ),
        })

        return {
            poolId: extInfo.address.poolId.toString(),
            success: true,
        }
    } catch (error) {
        console.log("error in pool", error)
        return {
            poolId: extInfo.address.poolId.toString(),
            success: false,
        }

    }


}

exports.checkthisshit = async () => {
    try {
        const mintA = await raydium.token.getTokenInfo(token_address)
        console.log("mint-a", mintA)

    } catch (error) {
        console.log("error", error);
    }

}


