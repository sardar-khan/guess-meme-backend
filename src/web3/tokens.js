const { ethers } = require('ethers');
const abi = require('./abi.json');
require('dotenv').config();

const INFURA_URL_TESTNET = process.env.INFURA_URL_TESTNET;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const WALLET_SECRET = process.env.WALLET_SECRET;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(INFURA_URL_TESTNET); // Amoy testnet
const signer = new ethers.Wallet(WALLET_SECRET, provider);
const factoryContract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

const name = "SecondToken"; //name 
const symbol = "ST"; //symbol
// const totalSupply = ethers.parseUnits('1000000000', 18) //total supply
const deployTokenOnBlockchain = async (tokenData) => {
    console.log("token_data", tokenData);
    let { name, symbol, totalSupply } = tokenData;

    try {
        console.log(`Deploying token: ${name} (${symbol}), Total Supply: ${totalSupply}`);
        name = name.toString();
        symbol = symbol.toString();
        totalSupply = totalSupply.toString();
        console.log("totalSupply", totalSupply, "symbol", symbol, "name", name);
        const totalSupplyInWei = ethers.parseUnits(totalSupply.toString(), 18); // Ensure correct unit
        const tx = await factoryContract.createToken(WALLET_ADDRESS, name, symbol, totalSupplyInWei, 100);
        await tx.wait();
        console.log("tx", tx)

        console.log('Transaction hash:', tx.hash, "token_addresss", tx.to);
        return { hash: tx.hash, token_address: tx.to }; // Return the transaction hash
    } catch (error) {
        console.error('Error deploying token on the blockchain:', error);
        throw new Error('Blockchain deployment failed.');
    }
};
// Function to buy tokens
async function buyTokensOnBlockchain(tokenAddress, amount) {
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

module.exports = { deployTokenOnBlockchain, buyTokensOnBlockchain };
