const axios = require('axios')
const CoinCreated = require("../models/coin_created");
const web3 = require('@solana/web3.js');
const anchor = require('@project-serum/anchor');
const { AnchorProvider, Program, Wallet } = require('@coral-xyz/anchor');
const idl = require('../web3/idl.json')
const bs58 = require("bs58");
const abi = require('../web3/abi.json');
const { getBondingCurve, virtualTokenAmount, getPrice, evmTokenInfo, getTokenBondingCurveInfo } = require('./tokens');

const { Keypair, Connection, PublicKey } = require("@solana/web3.js");
const { programId, connection, wallet } = require('./solana/config');
const { IDL } = require('@coral-xyz/anchor/dist/cjs/native/system');


//carys-function
exports.getTokenLargestAccounts = async (token_address) => {
    const amount = 1;
    try {
        const res = await this.tokenAgainstSol(
            token_address, //token_address
            amount
        )
        const tokensInSol = (res?.tokenPriceInSol)?.toFixed(10);
        const priceInUsd = await fetchPrice();
        const tokenPriceInUsdt = tokensInSol * priceInUsd.solPrice;
        const marketCap = tokenPriceInUsdt * 1000000000;
        return {
            market_cap: marketCap,
            remaining_tokens: res?.remianing_tokens,
            isComplete: res?.isComplete
        }

    } catch (error) {
        console.error(error);
        return ({ status: 500, error: error.message });
    }
}



const reteriveTokenInfo = async (taddress, amount) => {
    // window.Buffer = buffer.Buffer

    const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    const IDL1 = require("./solana/solIdl.json");

    //make public provider
    const program = new Program(IDL1, programId, provider);
    const tokenAddress = new web3.PublicKey(taddress)
    const [C] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from('bonding-curve'), tokenAddress.toBuffer()],
        programId,
    )

    const r = await program.account.bondingCurve.fetch(C)

    const {
        virtualTokenReserves,
        virtualSolReserves,
        realTokenReserves,
        tokenTotalSupply,
        complete = false, // Default value if not present
    } = r

    // Convert BN objects to strings
    const virtualTokenReservesStr = virtualTokenReserves.toString()
    const virtualSolReservesStr = virtualSolReserves.toString()
    const realTokenReservesStr = realTokenReserves.toString()
    const tokenTotalSupplyStr = tokenTotalSupply.toString()
    // Logging the specific properties in a formatted string
    const formattedOutput = {
        virtualTokenReserves: virtualTokenReservesStr,
        virtualSolReserves: virtualSolReservesStr,
        realTokenReserves: realTokenReservesStr,
        tokenTotalSupply: tokenTotalSupplyStr,
        remainingTokens: parseFloat(realTokenReservesStr / 1000000),
        totalTokens: parseFloat(tokenTotalSupplyStr / 1000000),
        complete: complete,
    }



    //console.log('virtual rese', formattedOutput)
    return formattedOutput
}



//token price in sol

exports.tokenAgainstSol = async (taddress, amount) => {
    try {

        const data = await reteriveTokenInfo(taddress, amount);
        const virtualSolReserves = BigInt(data?.virtualSolReserves);
        const virtualTokenReserves = BigInt(data?.virtualTokenReserves);
        const oneSOLInLamports = BigInt(Math.floor(amount * web3.LAMPORTS_PER_SOL));
        const k = virtualSolReserves * virtualTokenReserves;
        const tokenAmountBN = BigInt(Math.floor(amount * 1_000_000)); // Assuming 6 decimal tokens

        // const tokenPriceInLamport = (oneSOLInLamports * virtualSolReserves) / virtualTokenReserves;

        // SOL price for given tokens
        const buySolAgainstTokens = Math.abs(Number(
            virtualSolReserves - (k / (virtualTokenReserves - tokenAmountBN))
        ));
        const sellSolAgainstTokens = Math.abs(Number(
            (k / (virtualTokenReserves + tokenAmountBN)) - virtualSolReserves
        ));

        // const tokenPriceInSol = Number(tokenPriceInLamport) / 1_000_000_000;






        const tokenPriceInSol = buySolAgainstTokens / 1_000_000_000;

        return {
            tokensbuy: buySolAgainstTokens / 1_000_000_000, // Convert lamports to SOL
            tokensell: sellSolAgainstTokens / 1_000_000_000, // Convert lamports to SOL
            tokenPriceInSol: tokenPriceInSol,
            remianing_tokens: data?.remainingTokens,
            isComplete: data?.complete,
        };

    } catch (error) {
        console.log('error while fetching sell token price', error)
    }
}
exports.fetchSolPriceInUsd = async () => {
    try {

        const response = await axios.get('https://frontend-api-v3.pump.fun/sol-price');
        const solPrice = response?.data?.solPrice;

        return { solPrice: solPrice };
    } catch (error) {
        // setError('Error fetching price data');
        console.error('Error fetching price:', error);
    }
};
exports.fetchEthPriceInUsd = async () => {
    try {

        const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
            params: {
                symbol: 'ETH',
                convert: 'USD'
            },
            headers: {
                'X-CMC_PRO_API_KEY': 'fd603c3c-6199-4739-b977-451a94658308'
            }
        });

        const ethPrice = response.data.data.ETH.quote.USD.price;
        console.log(`The current price of 1 MATIC in USD is: $${ethPrice}`);
        return { ethPrice: ethPrice }

        // const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        // console.log("response",response)
        // const ethPrice = response?.data?.ethereum?.usd;
    } catch (error) {
        // setError('Error fetching price data');
        console.error('Error fetching price:', error);
    }
};


//get sol price in dollars
const fetchPrice = async () => {
    try {

        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');

        const solPrice = response.data.solana.usd;
        return { solPrice: solPrice };
    } catch (error) {
        console.error('Error fetching price:', error);
    }
};

fetchPrice();
//function to getv the token address and the bonding curve address
exports.getTokenAddressAndCurveAddress = async (req, res) => {
    try {
        let id = req.query.id;

        // Convert the id to a string
        id = id.toString();
        const coins = await CoinCreated.findById(id);
        return res.status(200).json({ status: 200, token_address: coins.token_address, bonding_curve_address: coins.bonding_curve })
    } catch (error) {
        console.error(error);
        return res.status(200).json({ status: 500, error: error.message });
    }
}
function tokenToSmallestUnit(tokenAmount, decimals) {
    return tokenAmount * Math.pow(10, decimals)
}
function convertScientificToDecimal(scientificNotation) {
    // Convert scientific notation to string
    let scientificString = scientificNotation.toString()

    // Split the string into coefficient and exponent parts
    let parts = scientificString.toLowerCase().split('e')
    let coefficient = parts[0]
    let exponent = parseInt(parts[1], 10)

    // If there's no exponent, return the original scientific notation string
    if (!exponent) return scientificString

    // Adjust coefficient length to match the required precision
    let precision = Math.max(0, -exponent - coefficient.length + 2)
    let adjustedCoefficient = (
        exponent < 0
            ? '0.' + '0'.repeat(-exponent - 1) + coefficient.replace('.', '')
            : coefficient.slice(0, exponent + 1) +
            '.' +
            coefficient.slice(exponent + 1)
    ).replace(/\.?0+$/, '')

    // Return the adjusted coefficient with sign
    return (scientificNotation < 0 ? '-' : '') + adjustedCoefficient
}
//polygon to usd
const polygonToUsd = async (req, res) => {
    try {
        const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
            params: {
                symbol: 'MATIC',
                convert: 'USD'
            },
            headers: {
                'X-CMC_PRO_API_KEY': 'fd603c3c-6199-4739-b977-451a94658308'
            }
        });

        const price = response.data.data.MATIC.quote.USD.price;
        return { priceInUsd: price }
    } catch (error) {
        console.error('Error fetching MATIC price:', error);
    }


}
//get market cap of the polygon
exports.marketCapPolygon = async (token_address, amount, account_type) => {
    try {

        //let tokensInSol = await getPrice(token_address, amount, account_type);
        let res = await getTokenBondingCurveInfo(token_address, amount, account_type);

        //  console.log("tokens in sol", tokensInSol.tokenPrice)
        return {
            remaining_tokens: res?.realTokenReserves
        }
    } catch (error) {

    }
}
//
