const dotenv = require('dotenv');
dotenv.config();
const express = require("express");
const app = express();
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
    origin: "*",
    credentials: true, //access-control-allow-credentials:true
    optionSuccessStatus: 200,
};


require('./config/database')
app.use(cors(corsOptions));
app.use('/user', user_routes)
app.use('/admin', admin_routes)
app.use('/thread', thread_routes)
app.use('/trade', trade_routes)

app.get("/", (req, res) => {
    res.send("Hello, Welcome to guess meme!");
});
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
const notificationRoutes = require('./routes/notification');

// Use routes
app.use('/notifications', notificationRoutes);

app.post("/getimageurl", auth, upload.single('profile_photo'), async (req, res) => {
    try {
        const uploadedImage = req.file;
        const wallet_address = req.user.wallet_address;

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


const pusher = require('./config/pusher')
const CoinCreated = require('./models/coin_created'); // Adjust the path as needed
const CoinDeploymentRequest = require('./models/coins_deploy_request');
const { deployTokenOnBlockchain, buyTokensOnBlockchain } = require('./web3/tokens');
const buyers_requests = require('./models/buyers_requests');
const { getLatestTradeAndCoin } = require('./controllers/trades');

// Initialize Pusher

// Function to check and notify hidden coins
async function checkHiddenCoins() {
    console.log("Checking hidden coins...");
    const now = new Date();

    // Find coins that are hidden and where the hidden period hasn't expired
    const hiddenCoins = await CoinCreated.find({
        coin_status: false,
        timer: { $gt: now },
    });

    hiddenCoins.forEach(coin => {
        const timeLeft = Math.max(0, Math.floor((coin.timer - now) / 1000 / 60)); // time left in minutes
        // Log notification to the console
        console.log(`Notification: Your coin "${coin.name}" is still hidden. Time left: ${timeLeft} minutes.`);

        // Send notification using Pusher
        pusher.trigger(`user-${coin.creator}`, 'coin-hidden-status', {
            message: `Your coin "${coin.name}" is still hidden. Time left: ${timeLeft} minutes.`,
            timeLeft: timeLeft,
            coinId: coin._id,
        });
    });

    // Update coins whose hidden period has expired and deploy them
    const expiredCoins = await CoinCreated.find({
        coin_status: false,
        timer: { $lte: now },
    });

    for (const coin of expiredCoins) {
        console.log(`Deploying token for expired coin: ${coin.name}`);

        // Update the coin status to deployed
        const deploymentRequest = await CoinDeploymentRequest.findOne({ coin_id: coin._id });
        if (!deploymentRequest) {
            console.log('Deployment request not found for coin:', coin.name);
            continue;
        }

        if (deploymentRequest.status === 'approved') {
            console.log('Token already deployed for:', coin.name);
            continue;
        }

        // Call the smart contract function to deploy the token
        const tokenData = {
            name: coin.name,
            symbol: 'ST',
            totalSupply: coin.max_supply,
        };

        try {
            const txHash = await deployTokenOnBlockchain(tokenData); // Deploy token via smart contract
            console.log('Token deployed, transaction hash:', txHash);

            // Update coin status and deployment request
            coin.status = 'deployed';
            coin.transaction_hash = txHash.hash;
            coin.token_address = "0x76148Cd0a2e51C54B2950a23Dd18aFDF98239e4F"
            await coin.save();

            deploymentRequest.status = 'approved';
            await deploymentRequest.save();

            // Process pending buyer requests
            const buyerRequests = await buyers_requests.find({ token_id: coin._id, status: 'pending' });
            if (buyerRequests.length > 0) {
                console.log(`Processing ${buyerRequests.length} buyer requests for ${coin.name} in sequence...`);

                // Process each buyer request in sequence
                for (const buyerRequest of buyerRequests) {
                    try {
                        console.log(`Processing buyer request for user: ${buyerRequest.user_id}`);

                        // Call the buy function for each buyer
                        const buyTxHash = await buyTokensOnBlockchain(coin.token_address, buyerRequest.amount);
                        console.log(`Tokens bought successfully for buyer: ${buyerRequest.user_id}, transaction hash: ${buyTxHash}`);

                        // Update the buyer request status
                        buyerRequest.status = 'approved';
                        buyerRequest.transaction_hash = buyTxHash.transactionHash;
                        await buyerRequest.save();
                    } catch (buyError) {
                        console.error(`Error processing buy request for user: ${buyerRequest.user_id}`, buyError);
                        // Optionally handle failed buy request
                    }
                }
            } else {
                console.log(`No pending buyer requests for ${coin.name}.`);
            }
        } catch (deploymentError) {
            console.error(`Error deploying token for ${coin.name}`, deploymentError);
        }
    }

    // Update the hidden coins status to true as they are now deployed
    await CoinCreated.updateMany(
        { coin_status: false, timer: { $lte: now } },
        { $set: { coin_status: true } }
    );
}
// Run the check every 5 minutes
setInterval(checkHiddenCoins, 1 * 60 * 1000);
// Start initial check
checkHiddenCoins();


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

