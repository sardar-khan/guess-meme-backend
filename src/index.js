const dotenv = require('dotenv');
dotenv.config();
const express = require("express");
const app = express();
const bs58 = require("bs58");
const auth = require("./config/auth");
const session = require('express-session');
const passport = require('./services/passport/passport');
const PORT = process.env.PORT
const MONGOURL = process.env.MONGOURL
const fs = require('fs');
console.log(PORT, "port", MONGOURL)
const bodyParser = require('body-parser');
const { upload } = require("../src/middlewares/uploadFiles")
// Use body-parser middleware to parse JSON bodie
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
}; app.use(session({
    secret: process.env.SESSION_SECRET,  // Replace with a strong secret
    resave: false,
    saveUninitialized: true,
}));

// Initialize Passport after session middleware
app.use(passport.initialize());
app.use(passport.session());
const pusher = require('./config/pusher')
const CoinCreated = require('./models/coin_created'); // Adjust the path as needed
const { getBondingCurveStatus } = require('./web3/tokens');
const User = require('./models/users');
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
const { tokenAgainstSol } = require('./web3/test');
const { meta } = require('./web3/solana/meta');
const { updateMetadata } = require('./web3/sepolia/sp_tokens');
const validateImageWithSightEngine = require('./services/imageValidator');

// Use routes

app.use('/notifications', notificationRoutes);

// Updated route with SightEngine validation
app.post("/getimageurl", auth, upload.single('profile_photo'), async (req, res) => {
    try {
        const uploadedImage = req.file;

        if (!uploadedImage) {
            return res.status(400).json({ error: "No image uploaded" });
        }

        // Optional: Check if delete_image_uri is provided, and if not, skip the deletion process
        const { delete_image_uri } = req.body;
        if (delete_image_uri) {
            // Construct the absolute path to the image
            const imagePath = path.join(__dirname, delete_image_uri);

            // Check if the file exists before attempting to delete
            try {
                await fs.promises.access(imagePath);
                // Delete the file asynchronously
                await fs.promises.unlink(imagePath);
                console.log("Previous image deleted successfully");
            } catch (err) {
                console.log("Previous image not found or delete failed");
                // Continue execution, don't return an error
            }
        }

        // Validate the uploaded image with SightEngine
        try {
            // Pass the file object directly to the validation function
            const validationResult = await validateImageWithSightEngine(uploadedImage);

            if (!validationResult.valid) {
                // If image validation fails, delete the uploaded image
                try {
                    await fs.promises.unlink(uploadedImage.path);
                    console.log("Invalid image deleted");
                } catch (err) {
                    console.error("Failed to delete invalid image:", err);
                }

                return res.status(400).json({
                    error: "Image validation failed",
                    reason: validationResult.reason
                });
            }

            // If validation passes, proceed as normal
            const imageUrl = `/uploads/${uploadedImage.filename}`;
            return res.status(201).json({ imageUrl });
        } catch (validationError) {
            // If validation process itself fails, still return the image URL but log the error
            console.error("Image validation error:", validationError);
            const imageUrl = `/uploads/${uploadedImage.filename}`;
            return res.status(201).json({ imageUrl, warning: "Image validation could not be completed" });
        }
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
        const creator = await User.findById(coin.creator);
        const type = creator.wallet_address?.[0]?.blockchain;
        console.log("type", type)
        if (type === 'solana') {
            try {
                const bonding = await tokenAgainstSol(coin.token_address, 1);
                console.log("status", bonding.isComplete)
                if (bonding.isComplete) {
                    console.log("started")
                    let metadata = `/user/metadata/${coin.id}`
                    console.log("coin deploying ...... Call blockchain function")
                    await meta(coin.name, coin.ticker, metadata, coin.token_address)
                    coin.status = 'deployed';
                    await coin.save();
                } else {
                    console.log("bonding curve not complete yet")
                }
            }
            catch (error) {
                console.error(`Failed to get meta of token  ${coin.name}`, error);
            }
        }
        else if (type === 'sepolia') {
            try {
                console.log("sp")
                const bonding = await getBondingCurveStatus(coin.token_address, 1, type)
                if (bonding.bondingCurveStatus === 'true') {
                    console.log("coin deploying ...... Call blockchain sepolia function")
                    const update_metadata = await updateMetadata(coin.name, coin.ticker, coin.token_address);
                    if (update_metadata.success) {
                        coin.status = 'deployed';
                        await coin.save();
                    } else {
                        console.log("Error in updating metadata", update_metadata.error)
                    }
                }
            } catch (error) {
                console.error(`Failed to deploy token ${coin.name}`, error);
            }
        }

        console.log("Bonding curve is not complete")

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
        console.log("type", type)
        if (type === 'solana') {
            try {
                let metadata = `/user/metadata/${coin.id}`
                console.log("coin deploying ...... Call blockchain function")
                await meta(coin.name, coin.ticker, metadata, coin.token_address)
                coin.status = 'deployed';
                await coin.save();
            } catch (error) {
                console.error(`Failed to get meta of token  ${coin.name}`, error);
            }

        }
        if (type === 'sepolia') {
            try {
                console.log("coin deploying ...... Call blockchain sepolia function")
                const update_metadata = await updateMetadata(coin.name, coin.ticker, coin.token_address);
                if (update_metadata.success) {
                    coin.status = 'deployed';
                    await coin.save();
                } else {
                    console.log("Error in updating metadata", update_metadata.error)
                }
            } catch (error) {
                console.error(`Failed to deploy token ${coin.name}`, error);
            }
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
// meta("name","metadata","http://metadata","4qk5ovKNmtVUZyfdKfbqcUufzZ6Zcjv3rBdWVSmn8vC2")
//  withdraw("GHmxFHJGCE3RvCr5xc2UZSRnokMQ3E6AxTv5UKHDFpyC");
//updateMetadata("name", "symbol", "0x0C8b5e837901688Ae05cEb942474F10B51C93707")