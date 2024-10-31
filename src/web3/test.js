const axios = require('axios')
const CoinCreated = require("../models/coin_created");
const web3 = require('@solana/web3.js');
const anchor = require('@project-serum/anchor');
const { AnchorProvider, Program } = require('@coral-xyz/anchor');
const idl = require('../web3/idl.json')
const abi = require('../web3/abi.json');
const { getBondingCurve, virtualTokenAmount } = require('./tokens');
exports.getTokenLargestAccounts = async (req, res, token_address) => {
    console.log(":token address", token_address)
    const url = process.env.REACT_APP_HELEIUS
    const headers = {
        'Content-Type': 'application/json',
    }
    const data = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenLargestAccounts',
        params: [token_address],
    }

    try {

        //console.log('tokenAta', tokenAta)
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data),
        })

        if (response.ok) {

            const result = await response.json()
            console.log("result", result, parseFloat(result?.result?.value[0]?.uiAmount))
            const total_tokens = 1000000000;

            const soldTokens = total_tokens - parseFloat(result?.result?.value[0]?.uiAmount);
            console.log("tokens from bc", soldTokens)
            // setBondingTokens(result?.result?.value[0]?.uiAmount);
            const res = await tokenAgainstSol(
                token_address, //token_address
                soldTokens
            )
            console.log("tokenprice in sol", res)
            const tokensInSol = parseFloat(res?.tokenPriceInSol)?.toFixed(2);
            const priceInUsd = await fetchPrice();
            console.log('gg', priceInUsd)
            const marketCap = tokensInSol * priceInUsd.solPrice;
            console.log("market_cap", marketCap)
            return { market_cap: marketCap }
        }
    } catch (error) {
        console.error(error);
        return ({ status: 500, error: error.message });
    }
}


const reteriveTokenInfo = async (taddress) => {
    // window.Buffer = buffer.Buffer
    const programId = new web3.PublicKey(
        'hp3TJUpe3y1KX9h3UYEpE4NgccMTt58fEN1VgxYDMNX',
    )
    const anchor = require('@project-serum/anchor');
    const { Connection, clusterApiUrl } = require('@solana/web3.js');

    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const provider = new AnchorProvider(connection, '4Suo836P86rZ1n3ZMdCXn5R7YEerQg5D3s862WsdatJYdccPsPmEr1TYuqfsJqVrqF8HAbBdxbaYVqXfWCcgXeKo', 'confirmed');

    //make public provider
    const program = new Program(idl, programId, provider)
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

const tokenAgainstSol = async (taddress, amount) => {
    try {
        console.log("params", taddress, amount)

        const tokenamt = tokenToSmallestUnit(parseInt(amount), 6)

        // window.Buffer = buffer.Buffer


        const data = await reteriveTokenInfo(taddress)
        console.log("datra", data)
        //token price buy
        const tokenPriceInLamport = parseFloat(tokenamt * parseFloat(data?.virtualSolReserves)) /
            parseFloat(parseFloat(data?.virtualTokenReserves) - tokenamt)
        const tokenPriceInSol = convertScientificToDecimal(
            parseFloat(tokenPriceInLamport / 1000000000),
        )

        console.log("tokenPriceInSol", tokenPriceInSol, tokenPriceInLamport)

        return {
            //tokenInfo: data,
            tokenPriceInSol: tokenPriceInSol,


            //solPer1Token:parseFloat(1/tokenAgainstSol)
        }
    } catch (error) {
        console.log('error while fetching sell token price', error)
    }
}


//get sol price in dollars
const fetchPrice = async () => {
    try {

        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');

        const solPrice = response.data.solana.usd;

        console.log("hfds", solPrice)
        return { solPrice: solPrice };
    } catch (error) {
        // setError('Error fetching price data');
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
        console.log("coiun", coins.token_address, coins.bonding_curve);
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
        console.log(`The current price of 1 MATIC in USD is: $${price}`);
        return { priceInUsd: price }
    } catch (error) {
        console.error('Error fetching MATIC price:', error);
    }


}
//get market cap of the polygon
exports.marketCapPolygon = async (req, res) => {
    try {
        const { token_address } = req.body;

        const result = await getBondingCurve(token_address)

        console.log("result", result[2])
        const total_tokens = 1000000000;

        const soldTokens = total_tokens - parseFloat(result[2]);
        console.log("tokens from bc", soldTokens)
        // setBondingTokens(result?.result?.value[0]?.uiAmount);
        const res = await virtualTokenAmount()
        console.log("virtual", res)
        const tokensInSol = parseFloat(res.virtualTokenAmount)?.toFixed(2);
        const priceInUsd = await polygonToUsd();
        console.log('gg', priceInUsd)
        const marketCap = tokensInSol * priceInUsd.priceInUsd;
        console.log("market_cap", marketCap)
        return { market_cap: marketCap }
    } catch (error) {

    }
}
//

