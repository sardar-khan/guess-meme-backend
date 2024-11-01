require('dotenv').config();
const TronWeb = require('tronweb');
const abi = require('./tronAbi.json');
const HttpProvider = TronWeb.providers.HttpProvider;

const INFURA_URL_TESTNET = process.env.TRON_RPC;
const WALLET_ADDRESS = process.env.TRON_USER_WALLET;
const WALLET_SECRET = process.env.TRON_SECRET;
const CONTRACT_ADDRESS = process.env.TRON_CONTRACT_ADDRESS;

const tronWeb = new TronWeb({
    fullNode: 'https://nile.trongrid.io/',
    solidityNode: 'https://nile.trongrid.io/',
    eventServer: 'https://nile.trongrid.io/',
    privateKey: WALLET_SECRET
});

const factoryContract = tronWeb.contract(abi, CONTRACT_ADDRESS);

// Deploy on Tron
const deployOnTron = async (tokenData) => {
    console.log("token_data", tokenData);
    let { name, symbol, totalSupply } = tokenData;

    try {
        console.log(`Deploying token: ${name} (${symbol}), Total Supply: ${totalSupply}`);
        name = name.toString();
        symbol = symbol.toString();
        totalSupply = totalSupply.toString();
        // const totalSupplyInWei = tronWeb.toSun(totalSupply); // Convert to SUN (Tron's smallest unit)
        // console.log("totalSupplyInWei", totalSupplyInWei)
        const tx = await factoryContract.createToken(WALLET_ADDRESS, name, symbol, 1, 100)
            .send();
        console.log("Transaction hash:", tx);

        return { hash: tx, token_address: CONTRACT_ADDRESS }; // Tron does not return a `to` field for token address here
    } catch (error) {
        console.error('Error deploying token on the blockchain:', error.message);
        throw new Error('Blockchain deployment failed.');
    }
};

// Buy on Tron
async function buyOnTron(tokenAddress, amount) {
    try {
        console.log("call bydv", tokenAddress, amount);

        const payableAmount = await factoryContract.buyQuote(tokenAddress, amount).call();
        const fee = await factoryContract.calculateBuyFee(tokenAddress, amount).call();

        const totalAmount = tronWeb.toBigNumber(payableAmount).plus(fee);
        console.log("Total amount to pay in SUN:", totalAmount.toString());

        const tx = await factoryContract.buyTokens(tokenAddress, amount).send({
            callValue: totalAmount.toNumber(), // Call value in SUN
        });

        console.log('Transaction hash:', tx);
        return {
            success: true,
            transactionHash: tx
        };
    } catch (error) {
        console.error('Error buying tokens on blockchain:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = { buyOnTron, deployOnTron };
