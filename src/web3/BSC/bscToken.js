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
    console.log("token_data", tokenData, WALLET_ADDRESS);
    try {
        let { name, symbol } = tokenData;
        const totalSupply = ethers.parseUnits('1000000000', 18) //total supply
        console.log(`Deploying token: ${name} (${symbol}), Total Supply: ${totalSupply}`);
        name = name.toString();
        symbol = symbol.toString();
        const tx = await factoryContract.createToken(
            WALLET_ADDRESS,
            name,
            symbol,
            totalSupply,
            100
        );
        console.log("tx", tx)
        const newTx = await tx.wait();
        console.log('Transaction hash:', newTx.hash, "token_addresss", newTx.logs[0].address);
        return { hash: tx.hash, token_address: newTx.logs[0].address }; // Return the transaction hash
    } catch (error) {
        console.error('Error deploying token on the blockchain:', error);
        throw new Error('Blockchain deployment failed.');
    }
};
// Function to buy tokens
async function buyTokensOnBsc(tokenAddress, amount) {
    try {
        console.log("call bydv", tokenAddress, amount)
        const payableAmount = await factoryContract.buyQuote(tokenAddress, amount);
        const fee = await factoryContract.calculateBuyFee(tokenAddress, amount);
        const ethToPay = payableAmount + fee;
        console.log("Total ETH to pay:", ethers.formatEther(ethToPay));
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