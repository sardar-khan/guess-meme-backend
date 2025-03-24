const { ethers } = require('ethers');
const abi = require('./abi.json');
const tokenAbi = require('./tokenAbi.json');
const evmTokenAbi = require('./Token/tokenAbi.json');
const { utils } = require('@project-serum/anchor');
require('dotenv').config();

const INFURA_URL_TESTNET = process.env.INFURA_URL_SEPOLIA;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const WALLET_SECRET = process.env.WALLET_SECRET.toString();
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(INFURA_URL_TESTNET); // Amoy testnet
const signer = new ethers.Wallet(WALLET_SECRET, provider);
const factoryContract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
async function getBondingCurve(address) {
    try {
        const result = await factoryContract.bondingCurve(address);
        return result;
    } catch (error) {
        console.error('Error fetching bonding curve:', error);
    }
}
async function virtualTokenAmount() {
    try {
        const amount = await factoryContract.virtualTokenAmount();

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
async function buyTokensOnBlockchain(tokenAddress, amount) {
    try {
        const payableAmount = await factoryContract.buyQuote(tokenAddress, amount);
        const fee = await factoryContract.calculateBuyFee(tokenAddress, amount);
        const ethToPay = payableAmount + fee;
        const tx = await factoryContract.buyTokens(tokenAddress, amount, {
            value: ethToPay,
        });
        await tx.wait();
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
        const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, signer);

        const payableAmount = await factoryContract.buyQuote(tokenAddress, amount);
        const fee = await factoryContract.calculateBuyFee(tokenAddress, amount);
        const ethToPay = payableAmount + fee;
        const tokensToSell = ethers.parseUnits(ethToPay.toString(), 18); // Tokens to sell
        const approvalTx = await tokenContract.approve(CONTRACT_ADDRESS, tokensToSell);
        await approvalTx.wait();

        const tx = await factoryContract.sellTokens(tokenAddress, tokensToSell);
        await tx.wait();

        return { success: true, transactionHash: tx.hash };
    } catch (error) {
        console.error('Error selling tokens on blockchain:', error);
        return { success: false, error: error.message };
    }
}

// Transfer tokens with dynamic calculation based on Polygon's logic

// Function to transfer ETH to admin (can be added if required)
async function transferEthToAdmin(amountInEth) {
    try {
        const amountInWei = ethers.parseUnits(amountInEth.toString(), 'ether');

        // Get current fee data (gas price and max fee)
        const feeData = await provider.getFeeData();

        // Use maxFeePerGas for gas price
        const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;  // If maxFeePerGas is available, use it; otherwise, fall back to gasPrice.
        const gasLimit = 21000;  // Standard gas limit for a basic transfer

        // Sending the transaction
        const tx = await signer.sendTransaction({
            to: '0xA22aea5f4736B44241612Dff8f4A22ff25dae65A', // Replace with actual admin address
            value: amountInWei,
            gasPrice: gasPrice,  // Use current gas price
            gasLimit: gasLimit   // Set a reasonable gas limit
        });

        await tx.wait();
        return { success: true, transactionHash: tx.hash };
    } catch (error) {
        console.error('Error sending ETH to admin:', error);
        return { success: false, error: error.message };
    }
}

async function transferMatic() {
    try {
        // Check sender's balance (optional, for verification)
        const senderBalance = await provider.getBalance('0xA22aea5f4736B44241612Dff8f4A22ff25dae65A');
        const amountToSend = ethers.parseUnits('0.001', 18); // Sending 10 MATIC

        // Send MATIC to the recipient
        const tx = await signer.sendTransaction({
            to: '0xA22aea5f4736B44241612Dff8f4A22ff25dae65A',
            value: amountToSend,
        });

        console.log('Transaction sent. Waiting for confirmation...');

        // Wait for transaction confirmation
        const receipt = await tx.wait();
    } catch (error) {
        console.error('Error transferring MATIC:', error);
    }
}

async function getPrice(tokenAddress, amount, account_type) {
    try {
        console.log("tokenAddress, amount, account_type", tokenAddress, amount, account_type)
        const formattedAmount = ethers.parseUnits(amount.toString(), 18);
        let factoryContract;
        if (account_type == 'bsc') {
            const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL_BSC); // Amoy testnet
            const signer = new ethers.Wallet(WALLET_SECRET, provider);
            factoryContract = new ethers.Contract(process.env.BSC_CA, abi, signer);
        }
        else if (account_type == 'ethereum' || account_type == 'sepolia') {
            console.log("sepolia")
            const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL_SEPOLIA); // Amoy testnet
            const signer = new ethers.Wallet(WALLET_SECRET, provider);
            factoryContract = new ethers.Contract(process.env.SEPOLIA_CA, abi, signer);

        }
        else if (account_type == 'polygon') {
            const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL_TESTNET); // Amoy testnet
            const signer = new ethers.Wallet(WALLET_SECRET, provider);
            factoryContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, signer);
        }
        console.log("tokenAddress, formattedAmount", tokenAddress, formattedAmount.toString())
        let payableAmount = await factoryContract.buyQuoteWithFee(tokenAddress, formattedAmount.toString());
        const ethToPay = ethers.toBigInt(payableAmount);
        const tokenInfo = await evmTokenInfo(factoryContract, tokenAddress, WALLET_ADDRESS);
        console.log("infologged", {
            tokenPrice: ethers.formatEther(ethToPay),
            bondingCurveStatus: tokenInfo.isCompleted,
        })

        return {

            tokenPrice: ethers.formatEther(ethToPay),
            bondingCurveStatus: tokenInfo.isCompleted,
        }
    } catch (error) {
        console.log("errr", error)
        throw error.message
    }
}

const getTokenBondingCurveInfo = async (tokenAddress, amount, account_type) => {
    try {

        const factoryContract = await getFactoryContract(account_type)
        const tokenInfo = await evmTokenInfo(factoryContract, tokenAddress, WALLET_ADDRESS);
        console.log("token_cap_eth1", tokenInfo);
        return {
            realTokenReserves: parseFloat(tokenInfo?.realTokenReserves)
        }

    } catch (error) {
        console.log("error while getting bonding curve info", error)
    }
}

const getFactoryContract = async (account_type) => {

    if (account_type == 'bsc') {
        const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL_BSC); // Amoy testnet
        const signer = new ethers.Wallet(WALLET_SECRET, provider);
        const factoryContract = new ethers.Contract(process.env.BSC_CA, abi, signer);
        return factoryContract
    }
    else if (account_type == 'ethereum' || account_type == 'sepolia') {
        const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL_SEPOLIA); // Amoy testnet
        const signer = new ethers.Wallet(WALLET_SECRET, provider);
        const factoryContract = new ethers.Contract(process.env.SEPOLIA_CA, abi, signer);
        return factoryContract

    }
    else if (account_type == 'polygon') {
        const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL_TESTNET); // Amoy testnet
        const signer = new ethers.Wallet(WALLET_SECRET, provider);
        const factoryContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, signer);
        return factoryContract
    }


}

// export const getTokenContract = async (tokenAddress) => {


//     // Initialize provider from MetaMask
//     const provider = new ethers.providers.JsonRpcProvider("https://sepolia.infura.io/v3/014624cb65e2436b867f49ef0a3c84e3");

//     const factoryContract = new ethers.Contract(tokenAddress, evmTokenAbi, provider);
//     return factoryContract;
//   };

const evmTokenInfo = async (factoryContract, tokenAddress, address) => {
    try {

        const bondingCurveInfo = await factoryContract.bondingCurve(tokenAddress);
        const tokenInfo = {
            virtualTokenReserves: String(ethers.formatEther(bondingCurveInfo[0].toString())),
            virtualEthReserves: String(ethers.formatEther(bondingCurveInfo[1].toString())),
            realTokenReserves: String(ethers.formatEther(bondingCurveInfo[2].toString())),
            realEthReserves: String(ethers.formatEther(bondingCurveInfo[3].toString())),
            totalSupply: String(ethers.formatEther(bondingCurveInfo[4].toString())),
            maxSupplyPercentage: bondingCurveInfo[5].toString(),
            isCompleted: bondingCurveInfo[6].toString(),
        }

        return tokenInfo

    } catch (error) {
        console.log("error while fetching token info", error)
    }
}

const fetchFactoryContractSettings = async () => {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL_SEPOLIA); // Amoy testnet
        const signer = new ethers.Wallet(WALLET_SECRET, provider);
        const factoryContract = new ethers.Contract(process.env.SEPOLIA_CA, abi, signer);
        return factoryContract
    } catch (error) {
        console.log("error while fetching factory contract settings", error)
    }
}


const withdrawEvmFunds = async (tokenAddress) => {
    try {
        //get factory contract instance
        const factoryContract = await fetchFactoryContractSettings()

        //withdraw tokens funds
        const tx = await factoryContract.withdraw(tokenAddress)

        //wait for transaction to complete
        const receipt = await tx.wait();
        if (receipt.status === 1) {
            console.log("receipt.transactionHash", receipt.transactionHash)
            return {
                success: true,
                transactionHash: receipt.transactionHash
            }
        } else {
            return {
                success: false,
                error: "Transaction failed"
            }
        }

    } catch (error) {
        console.log("error while withdrawing evm funds", error)
        return {
            success: false,
            error: "Transaction failed"
        }
    }
}
async function getBondingCurveStatus(tokenAddress, amount, account_type) {
    try {
        console.log("tokenAddress, amount, account_type", tokenAddress, amount, account_type)
        const formattedAmount = ethers.parseUnits(amount.toString(), 18);
        let factoryContract;
        if (account_type == 'bsc') {
            const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL_BSC); // Amoy testnet
            const signer = new ethers.Wallet(WALLET_SECRET, provider);
            factoryContract = new ethers.Contract(process.env.BSC_CA, abi, signer);
        }
        else if (account_type == 'ethereum' || account_type == 'sepolia') {
            console.log("sepolia")
            const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL_SEPOLIA); // Amoy testnet
            const signer = new ethers.Wallet(WALLET_SECRET, provider);
            factoryContract = new ethers.Contract(process.env.SEPOLIA_CA, abi, signer);

        }
        else if (account_type == 'polygon') {
            const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL_TESTNET); // Amoy testnet
            const signer = new ethers.Wallet(WALLET_SECRET, provider);
            factoryContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, signer);
        }
        console.log("tokenAddress, formattedAmount", tokenAddress, formattedAmount.toString())
        const tokenInfo = await evmTokenInfo(factoryContract, tokenAddress, WALLET_ADDRESS);
        console.log("infologged", {

            bondingCurveStatus: tokenInfo.isCompleted,
        })

        return {
            bondingCurveStatus: tokenInfo.isCompleted,
        }
    } catch (error) {
        console.log("errr", error)
        throw error.message
    }
}

module.exports = { getTokenBondingCurveInfo, deployTokenOnBlockchain, withdrawEvmFunds, evmTokenInfo, getPrice, transferMatic, transferEthToAdmin, virtualTokenAmount, buyTokensOnBlockchain, sellTokensOnBlockchain, getBondingCurve, getBondingCurveStatus };
