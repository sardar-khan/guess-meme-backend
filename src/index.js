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
const { deployTokenOnBlockchain, buyTokensOnBlockchain, transferTokensBasedOnAmount, transferEthToAdmin, transferMatic, getPrice } = require('./web3/tokens');
const buyers_requests = require('./models/buyers_requests');
const { getLatestTradeAndCoin, getKingOfTheHillPercentage, getBondingCurveProgress, getTrades } = require('./controllers/trades');
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
const { getTokenLargestAccounts, marketCapPolygon } = require('./web3/test');
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
// Main function to check and handle hidden coins
async function checkHiddenCoins() {
    console.log("Checking hidden coins...");
    const now = new Date();

    // Notify users with hidden coins
    const hiddenCoins = await CoinCreated.find({ status: 'created', timer: { $gt: now } });
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
    const expiredCoins = await CoinCreated.find({ status: 'created', timer: { $lte: now } });
    for (const coin of expiredCoins) {
        const creator = await User.findById(coin.creator);
        const type = creator.wallet_address?.[0]?.blockchain;
        console.log("here")
        try {

            console.log("coin deploying ......")
            coin.status = 'deployed';
            await coin.save();


        } catch (error) {
            console.error(`Failed to deploy token for ${coin.name}`, error);
            coin.status = 'failed';  // Set the status to false if deployment fails due to insufficient funds
            await coin.save();  // Save the updated coin status
        }
    }
}
// Schedule the check every 5 minutes
setInterval(checkHiddenCoins, 1 * 60 * 1000);
checkHiddenCoins();
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

//getTokenLargestAccounts("4qk5ovKNmtVUZyfdKfbqcUufzZ6Zcjv3rBdWVSmn8vC2", 1)//
// create('Fresh Token', 'FT', 'http://localhost:5000/user/metadata/67077e41d45a7d48dbd15975', 100);
// transferEthToAdmin(0.01)
// transferMatic();
// transferSol('4sdSJgUYH1tREGZrSy2QFDZWqMUjD32gM9B6EryK4Mau', '3bYzjrW1FXSdT35h2kCeSQbYqJkfi7yDqZDds9G7gd8y', 0.02)
//marketCapPolygon("0x0C8b5e837901688Ae05cEb942474F10B51C93707", 1)