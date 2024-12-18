const dotenv = require('dotenv');
dotenv.config();
const express = require("express");
const app = express();
const bs58 = require("bs58");
const auth = require("./config/auth");
const PORT = process.env.PORT
const MONGOURL = process.env.MONGOURL
console.log(PORT, "port", MONGOURL)
const bodyParser = require('body-parser');
const { upload } = require("../src/middlewares/uploadFiles")
// Use body-parser middleware to parse JSON bodies
const user_routes = require('../src/routes/users/users');
const admin_routes = require('../src/routes/admin')
const thread_routes = require('../src/routes/threads/threads');
const trade_routes = require('./routes/trade/trade')
app.use(bodyParser.json());
app.use(express.json());
const path = require('path');
const cors = require('cors');
app.use(cors());
const corsOptions = {
    origin: "*"
};
const pusher = require('./config/pusher')
const CoinCreated = require('./models/coin_created'); // Adjust the path as needed
const CoinDeploymentRequest = require('./models/coins_deploy_request');
const { deployTokenOnBlockchain, buyTokensOnBlockchain, transferTokensBasedOnAmount, transferEthToAdmin, transferMatic } = require('./web3/tokens');
const buyers_requests = require('./models/buyers_requests');
const { getLatestTradeAndCoin } = require('./controllers/trades');
const User = require('./models/users');
const { create } = require('./web3/solana/create');
const { buyWithAddress, initializeUserATA, transferSol } = require('./web3/solana/buyTokens');
const { mintaddy, wallet } = require('./web3/solana/config');
require('./config/database')
app.use(cors(corsOptions));
app.use('/user', user_routes)
app.use('/admin', admin_routes)
app.use('/thread', thread_routes)
app.use('/trade', trade_routes)

app.get("/", (req, res) => {
    res.send("Hello, Welcome to guess meme !");
});
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
const notificationRoutes = require('./routes/notification');
const { deployOnTron, buyOnTron } = require('./web3/tron/tronTrades');
const { getTokenLargestAccounts, marketCapPolygon } = require('./web3/test');
const Trade = require('./models/trades');
const { createReadStream } = require('fs');

// Use routes
app.use('/notifications', notificationRoutes);

app.post("/getimageurl", auth, upload.single('profile_photo'), async (req, res) => {
    try {
        const uploadedImage = req.file;
        // Optional: Check if delete_image_uri is provided, and if not, skip the deletion process
        const { delete_image_uri } = req.body;
        if (delete_image_uri) {
            // Construct the absolute path to the image
            const imagePath = path.join(__dirname, delete_image_uri);

            // Check if the file exists before attempting to delete
            try {
                await fs.access(imagePath);
                // Delete the file asynchronously
                await fs.unlink(imagePath);
                console.log("Image deleted successfully");
            } catch (err) {
                return res.status(404).json({ error: "File not found or delete failed" });
            }
        }

        // Generate the image URL
        const imageUrl = `/uploads/${uploadedImage.filename}`;
        return res.status(201).json({ imageUrl });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "The Image URL is not created" });
    }
});

// Helper function to deploy tokens based on blockchain type
async function deployToken(coin, type) {
    console.log("type", type)
    if (type === 'ethereum' || type === 'polygon') {
        console.log("ethereum")
        return await deployTokenOnBlockchain({
            name: coin.name,
            symbol: 'ST',
            totalSupply: coin.max_supply
        });
    }
    else if (type === 'solana') {
        console.log("my so", coin.name)
        return await create(coin.name, 'FT', `/user/metadata/${coin.id}`, 100);
    }
    else if (type === 'tron') {
        return await deployOnTron({
            name: coin.name,
            symbol: 'TRX',
            totalSupply: coin.max_supply
        })
    }
    throw new Error(`Unsupported blockchain type: ${type}`);
}

// Helper function to handle buyer requests
async function processBuyRequests(coin, type, creator) {
    console.log("Here2")
    const requests = await buyers_requests.find({ token_id: coin._id, status: 'pending' });
    if (!requests.length) return;
    let supply = coin.max_supply;
    console.log("type", requests, type, "supply", supply)
    for (const req of requests) {
        try {
            let buyTxHash;
            if (type === 'ethereum' || type === 'polygon') {

                buyTxHash = await buyTokensOnBlockchain(coin.token_address, req.amount);
            } else if (type === 'solana') {
                const userAta = await initializeUserATA(wallet.payer, coin.token_address, mintaddy);
                buyTxHash = await buyWithAddress(userAta);
            } else if (type === 'tron') {
                buyTxHash = await buyOnTron(coin.token_address, req.amount)
            }
            req.status = 'approved';
            req.transaction_hash = buyTxHash.transactionHash;
            await req.save();
            // Update the supply based on the amount bought
            coin.max_supply = supply + parseFloat(req.amount);
            await coin.save();
            // Check if the token supply crossed the threshold for "King of the Hill"
            if (coin.max_supply >= process.env.HALF_MARK) {
                console.log("After threshold, King of the Hill:", coin.max_supply);

                // Set the King of the Hill status
                coin.is_king_of_the_hill = {
                    value: true,
                    time: Date.now()  // Record the time when the coin becomes King of the Hill
                };
                coin.badge = true;  // Assign the badge
            } else {
                coin.is_king_of_the_hill.value = false;  // Set to false if below threshold
            }

            // Save the updated coin information
            await coin.save();
            const newTrade = new Trade({
                account: creator.id,
                token_id: coin._id,
                type: 'buy',
                amount: req.amount,
                token_amount: req.amount,
                account_type: type,
                transaction_hash: req.transaction_hash
            });
            await newTrade.save();
            const coinIndex = creator?.coins_held.findIndex(coin => coin.coinId.toString() === coin._id.toString());
            if (coinIndex > -1) {
                // Update amount for existing holding
                if (type === 'buy') {
                    creator.coins_held[coinIndex].amount += parseFloat(amount);
                } else if (type === 'sell') {
                    creator.coins_held[coinIndex].amount = Math.max(0, creator.coins_held[coinIndex].amount - parseFloat(amount));
                }
            } else {
                // Add new coin holding
                creator.coins_held.push({ coinId: coin._id, amount: type === 'buy' ? parseFloat(amount) : 0 });
            }
            console.log("userr", req, creator);
            await req.save();

        } catch (error) {
            console.error(`Failed to process buy request for user ${req.user_id}`, error);
        }
    }
}

// Main function to check and handle hidden coins
async function checkHiddenCoins() {
    console.log("Checking hidden coins...");
    const now = new Date();

    // Notify users with hidden coins
    const hiddenCoins = await CoinCreated.find({ coin_status: false, timer: { $gt: now } });
    for (const coin of hiddenCoins) {
        const timeLeft = Math.max(0, Math.floor((coin.timer - now) / 1000 / 60));
        console.log(`Notification: Your coin "${coin.name}" is still hidden. Time left: ${timeLeft} minutes.`);
        await pusher.trigger(`user-${coin.creator}`, 'coin-hidden-status', {
            message: `Your coin "${coin.name}" is still hidden. Time left: ${timeLeft} minutes.`,
            timeLeft,
            coinId: coin._id,
        });
    }

    // Deploy expired hidden coins
    const expiredCoins = await CoinCreated.find({ coin_status: false, timer: { $lte: now } });
    for (const coin of expiredCoins) {
        console.log("iam het me")
        const creator = await User.findById(coin.creator);
        const type = creator.wallet_address?.[0]?.blockchain;
        const deploymentRequest = await CoinDeploymentRequest.findOne({ coin_id: coin._id });
        console.log("start ", type)
        if (!deploymentRequest || deploymentRequest.status === 'approved') continue;

        try {
            console.log("start deploying", type)
            const txHash = await deployToken(coin, type);
            coin.status = 'deployed';
            coin.transaction_hash = txHash.hash;
            // type === 'ethereum' ? "0x76148Cd0a2e51C54B2950a23Dd18aFDF98239e4F" :
            // type === 'polygon' ? "0x76148Cd0a2e51C54B2950a23Dd18aFDF98239e4F" :
            coin.token_address = txHash.token_address;
            await coin.save();

            deploymentRequest.status = 'approved';
            await deploymentRequest.save();
            // console.log("here", creator)
            await processBuyRequests(coin, type, creator)
        } catch (error) {
            console.error(`Failed to deploy token for ${coin.name}`, error);
            coin.status = 'failed';  // Set the status to false if deployment fails due to insufficient funds
            await coin.save();  // Save the updated coin status
        }
    }

    // Update the status of deployed coins
    await CoinCreated.updateMany({ coin_status: false, timer: { $lte: now } }, { $set: { coin_status: true } });
}
// Schedule the check every 5 minutes
setInterval(checkHiddenCoins, 1 * 60 * 1000);
checkHiddenCoins();
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

//getTokenLargestAccounts("5GLQbrPr7G8HnXPY4dXESRSB8SMiLa6pbCnYKT8YnaRJ")//
// create('Fresh Token', 'FT', 'http://localhost:5000/user/metadata/67077e41d45a7d48dbd15975', 100);
// transferEthToAdmin(0.01)
// transferMatic();
// transferSol('4sdSJgUYH1tREGZrSy2QFDZWqMUjD32gM9B6EryK4Mau', '3bYzjrW1FXSdT35h2kCeSQbYqJkfi7yDqZDds9G7gd8y', 0.02)