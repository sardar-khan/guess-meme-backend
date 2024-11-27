const { ethers } = require('ethers');
const abi = require('./abi.json');
const tokenAbi = require('./tokenAbi.json')
require('dotenv').config();

const INFURA_URL_TESTNET = process.env.INFURA_URL_TESTNET;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const WALLET_SECRET = process.env.WALLET_SECRET.toString();
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(INFURA_URL_TESTNET); // Amoy testnet
const signer = new ethers.Wallet(WALLET_SECRET, provider);
const factoryContract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
async function getBondingCurve(address) {
    console.log("call")
    try {
        const result = await factoryContract.bondingCurve(address);
        console.log('Bonding Curve:', result[2]);
        return result;
    } catch (error) {
        console.error('Error fetching bonding curve:', error);
    }
}
async function virtualTokenAmount() {
    try {
        const amount = await factoryContract.virtualTokenAmount();
        console.log("amount", amount);
        return {
            virtualTokenAmount: amount
        }
    } catch (error) {
        console.error('Error fetching bonding curve:', error);
    }
}


// const name = "SecondToken"; //name 
// const symbol = "ST"; //symbol
// const totalSupply = ethers.parseUnits('1000000000', 18) //total supply
const deployTokenOnBlockchain = async (tokenData) => {
    console.log("token_data", tokenData);
    let { name, symbol } = tokenData;

    try {
        const totalSupply = ethers.parseUnits('1000000000', 18) //total supply
        console.log(`Deploying token: ${name} (${symbol}), Total Supply: ${totalSupply}`);
        name = name.toString();
        symbol = symbol.toString();
        const tx = await factoryContract.createToken(WALLET_ADDRESS, name, symbol, totalSupply, 100);
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
//sell tokens 
async function sellTokensOnBlockchain(tokenAddress, amount) {
    try {
        console.log("Approving tokens for sale", tokenAddress, amount);
        const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, signer);

        console.log("Approving tokens for sale");
        const tokensToSell = ethers.parseUnits(amount.toString(), 18); // Tokens to sell
        console.log("Approving tokens for afetr sale", tokenAddress, amount);
        const approvalTx = await tokenContract.approve(CONTRACT_ADDRESS, tokensToSell);
        await approvalTx.wait();
        console.log("Approval transaction hash:", approvalTx.hash);

        const tx = await factoryContract.sellTokens(tokenAddress, tokensToSell);
        await tx.wait();
        console.log('Sell transaction hash:', tx.hash);

        return { success: true, transactionHash: tx.hash };
    } catch (error) {
        console.error('Error selling tokens on blockchain:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { deployTokenOnBlockchain, virtualTokenAmount, buyTokensOnBlockchain, sellTokensOnBlockchain, getBondingCurve };
