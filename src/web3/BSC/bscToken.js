const { ethers } = require('ethers');
const abi = require('../abi.json');
const tokenAbi = require('../tokenAbi.json')
require('dotenv').config();

const INFURA_URL_TESTNET = process.env.INFURA_URL_BSC;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const WALLET_SECRET = process.env.WALLET_SECRET.toString();
const CONTRACT_ADDRESS = process.env.BSC_CA;

const provider = new ethers.JsonRpcProvider(INFURA_URL_TESTNET); // Amoy testnet
const signer = new ethers.Wallet(WALLET_SECRET, provider);
const factoryContract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
const deployTokenOnBsc = async (tokenData) => {
    try {
        let { name, symbol } = tokenData;
        const totalSupply = ethers.parseUnits('1000000000', 18) //total supply
        name = name.toString();
        symbol = symbol.toString();
        const tx = await factoryContract.createToken(
            WALLET_ADDRESS,
            name,
            symbol,
            totalSupply,
            100
        );
        const newTx = await tx.wait();
        return { hash: tx.hash, token_address: newTx.logs[0].address }; // Return the transaction hash
    } catch (error) {
        console.error('Error deploying token on the blockchain:', error);
        throw new Error('Blockchain deployment failed.');
    }
};
// Function to buy tokens
async function buyTokensOnBsc(tokenAddress, amount) {
    try {
        const payableAmount = await factoryContract.buyQuote(tokenAddress, amount);
        const fee = await factoryContract.calculateBuyFee(tokenAddress, amount);
        const ethToPay = payableAmount + fee;
        const tx = await factoryContract.buyTokens(tokenAddress, amount, {
            value: ethToPay,
        });
        await tx.wait();
        console.log('Transaction hash:', tx, tx.hash);
        return {
            success: true,
            transactionHash: tx.hash
        };
    } catch (error) {
        console.error('Error buying tokens on blockchain:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
module.exports = { deployTokenOnBsc, buyTokensOnBsc }