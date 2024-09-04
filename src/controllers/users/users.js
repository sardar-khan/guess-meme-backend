const jwt = require("jsonwebtoken");
const User = require("../../models/users");
const mongoose = require('mongoose');
const coins_created = require("../../models/coin_created")
const { generateUsername } = require("../../services/users/userServices");
const Trade = require("../../models/trades");
const Thread = require("../../models/threads");
const pusher = require('../../config/pusher');
const axios = require('axios');
exports.createUser = async (req, res) => {
    const { wallet_address } = req.body;
    try {
        // Check if walletAddress is already registered
        const existingUser = await User.findOne({ wallet_address });
        if (existingUser) {
            console.log(existingUser.token)
            if (existingUser.token || existingUser.token == null) {
                try {
                    jwt.verify(existingUser.token, process.env.TOKEN_KEY);
                    // If token is still valid, return the existing token
                    return res.status(200).json({ status: 200, message: "User already logged in.", data: existingUser });
                } catch (error) {
                    // Generate a new token for the user
                    const token = jwt.sign(
                        { wallet_address },
                        process.env.TOKEN_KEY,
                        {
                            expiresIn: "1d",
                        }
                    );
                    existingUser.token = token;
                    await existingUser.save();
                    return res.status(200).json({ status: 201, message: "User Log In Successfully!", data: existingUser });
                }
            }
        }
        else {
            // Create new user
            const generate_username = generateUsername(wallet_address);
            const newUser = new User({ wallet_address, user_name: generate_username, profile_photo: defaultImage });
            await newUser.save();
            const token = jwt.sign(
                { wallet_address },
                process.env.TOKEN_KEY,
                {
                    expiresIn: "1d",
                }
            );
            // Save the user's token
            newUser.token = token;
            await newUser.save();
            return res.status(200).json({ status: 201, message: "User Sign Up Successfully!", data: newUser });
        }
    } catch (error) {
        return res.status(200).json({ status: 500, error: error.message });
    }
};

const sharp = require('sharp');

exports.updateUserProfile = async (req, res) => {
    const wallet_address = req.user.wallet_address;
    const { user_name, bio } = req.body;

    try {
        // Check if the username is being updated and if it's already taken by another user
        if (user_name) {
            const existingUser = await User.findOne({ user_name });
            if (existingUser && existingUser.wallet_address !== wallet_address) {
                return res.status(400).json({ message: 'Username is already taken' });
            }
        }

        // Find the user by wallet address
        const user = await User.findOne({ wallet_address });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update the allowed fields if they are provided
        if (user_name) user.user_name = user_name;
        if (req.file) {
            const imageBuffer = await sharp(req.file.buffer)
                .resize(100, 100) // Resize the image to a maximum of 500x500 pixels
                .jpeg({ quality: 50 }) // Compress the image to JPEG with a quality of 70
                .toBuffer();
            user.profile_photo = { data: imageBuffer, contentType: 'image/jpeg' };
        }
        if (bio) user.bio = bio;

        // Save the updated user
        const updatedUser = await user.save();
        return res.status(200).json({ status: 200, message: "Updated Successfully", updatedUser });
    } catch (error) {
        return res.status(500).json({ status: 500, error: error.message });
    }
};


exports.logout = async (req, res) => {
    try {
        const wallet_address = req.user.wallet_address;

        if (wallet_address) {
            // Update user's token to null in the database
            const user = await User.findOne({ wallet_address })
            if (user) {
                user.token = null;
                await user.save();
                return res.status(200).json({ status: 200, message: "User Logged Out Successfully" })
            } else {
                return res.status(200).json({ status: 404, message: "User not found during logout" });
            }
        } else {
            return res.status(200).json({ status: 401, message: "Unauthorized user" });
        }
    } catch (error) {
        console.error(error);
        return res.status(200).json({ status: 500, error: error.message });
    }
};

exports.viewProfile = async (req, res) => {
    const wallet_address = req.user.wallet_address;
    try {
        const user = await User.findOne({ wallet_address });
        user.coins_created = undefined;
        user.coins_held = undefined;
        return res.status(200).json({ status: 200, message: "User Profile!", data: user });
    } catch (error) {
        return res.status(200).json({ status: 500, error: error.message });
    }
}

exports.coinsHoldingByUser = async (req, res) => {
    const wallet_address = req.user.wallet_address;
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
    const limit = parseInt(req.query.limit) || 10; // Default to 10 results per page if not specified
    const skip = (page - 1) * limit;

    try {
        const user = await User.findOne({ wallet_address });
        const coinsHeld = await Promise.all(user.coins_held.slice(skip, skip + limit).map(async (coin) => {
            const coinDetails = await coins_created.findById(coin.coinId);
            return {
                coinId: coin.coinId,
                coinName: coinDetails.name,
                coinImage: coinDetails.image,
                token_address: coinDetails.token_address,
                amount: coin.amount
            };
        }));

        return res.status(200).json({
            status: 200,
            message: "User Holding coins!",
            data: coinsHeld,
            currentPage: page,
            totalPages: Math.ceil(user.coins_held.length / limit)
        });
    } catch (error) {
        return res.status(200).json({ status: 500, error: error.message });
    }
}

exports.coinsCreatedByUser = async (req, res) => {
    const wallet_address = req.user.wallet_address;
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
    const limit = parseInt(req.query.limit) || 10; // Default to 10 results per page if not specified
    const skip = (page - 1) * limit;

    try {
        const user = await User.findOne({ wallet_address: wallet_address })
            .populate({
                path: 'coins_created',
                options: {
                    limit: limit,
                    skip: (page - 1) * limit
                }
            });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const coins_created = user.coins_created;
        return res.status(200).json({
            status: 200,
            message: "User Created coins!",
            data: coins_created,
            currentPage: page,
            totalPages: Math.ceil(user.coins_created.length / limit)
        });
    } catch (error) {
        return res.status(200).json({ status: 500, error: error.message });
    }
}

exports.heldCoin = async (req, res) => {
    const wallet_address = req.user.wallet_address;
    const { coin_id, amount } = req.body; // Assuming you're receiving coinId and amount

    try {
        const user = await User.findOne({ wallet_address });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Add the new coin to the coins_held array
        user.coins_held.push({ coinId: coin_id, amount });
        await user.save();
        console.log("user", user)
        return res.status(200).json({ message: "Coin added to user's holdings successfully.", data: user });
    } catch (error) {
        console.error(error);
        return res.status(200).json({ status: 500, error: error.message });
    }
};

//create coin
exports.createCoin = async (req, res) => {
    const { name, ticker, description, image, twitter_link, telegram_link, website, token_address, bonding_curve, metadata, max_buy_percentage, amount, token_amount, transaction_hash, timer } = req.body;
    const wallet_address = req.user.wallet_address;
    try {
        // Find the user
        const user = await User.findOne({ wallet_address });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Check if coin with same token_address already exists
        const existingCoin = await coins_created.findOne({ token_address });

        if (existingCoin) {
            return res.status(400).json({ message: "This token address is already used." });
        }
        else {
            // Create a new coin instance
            const newCoin = new coins_created({
                creator: user._id,
                name,
                ticker,
                description,
                image,
                twitter_link,
                telegram_link,
                website,
                token_address,
                max_supply: 0,
                max_buy_percentage,
                bonding_curve,
                metadata,
                timer
            });

            // Save the new coin to the database
            await newCoin.save();

            // Add the new coin to the user's coins_created array
            user.coins_created.push(newCoin);
            // Create initial trade for the new coin via HTTP request
            let pass_id = newCoin._id;
            pass_id = pass_id.toString()
            try {
                const response = await createBuyTrade(res, pass_id, 'buy', amount, 'sol', token_amount, transaction_hash, user.wallet_address)

                if (response.error === false) {
                    console.log("Trade completed successfully")
                }
                else {
                    console.log("Trade not completed ")
                }
            } catch (tradeError) {
                console.error(tradeError);
                return res.status(500).json({ error: 'Error creating initial trade.' });
            }
            await user.save();
            const tradeNotification = {
                user_name: user.user_name,
                action: `created ${name}`,
                coin_photo: image,
                date: newCoin.time,
                token_id: newCoin._id,
                ticker: ticker,
                replies: 0,
                token_address: token_address,
                user_image: user.profile_photo
            };
            console.log("initated-noti", tradeNotification)

            pusher.trigger('coin-created-channel', 'coin-created', tradeNotification);
            return res.status(200).json({ message: "Coin created successfully.", data: newCoin });
        }
    } catch (error) {
        console.error(error);
        return res.status(200).json({ status: 500, error: error.message });
    }
};

exports.viewCoin = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const order = req.query.order === 'asc' ? 1 : -1; // Default order is descending

    // Define sorting options
    const sortOptions = {
        market_cap: { market_cap: order },
        reply_count: { threadsCount: order },
        last_reply: { 'latestThread.createdAt': order },
        creation_time: { createdAt: order },
        default: { createdAt: order } // Default sort
    };

    // Determine sort field
    const sortField = sortOptions[sortBy] || sortOptions.default;

    try {
        // Build the filter object based on query parameters
        const filter = {};
        if (req.query.creator) {
            filter.creator = req.query.creator;
        }

        // Fetch filtered coin data
        const filteredCoins = await coins_created.find(filter)
            .populate('creator', 'user_name profile_photo trust_score');

        // Fetch additional details (market cap, thread count, and latest thread)
        const coinsWithDetails = await Promise.all(filteredCoins.map(async (coin) => {
            console.log("coin status", coin.coin_status)
            const soldAmount = await Trade.aggregate([
                { $match: { token_id: coin._id, type: 'sell' } },
                { $group: { _id: null, totalSold: { $sum: "$amount" } } }
            ]);

            const threadsCount = await Thread.countDocuments({ token_id: coin._id });

            const latestThread = await Thread.findOne({ token_id: coin._id })
                .sort({ createdAt: -1 });
            if (coin.coin_status == true) {
                console.log("showw all")

                return {
                    coin,
                    market_cap: soldAmount.length ? soldAmount[0].totalSold : 0,
                    threadsCount: threadsCount,
                    latestThread: latestThread || null
                };
            } else {
                return {
                    coin: {
                        _id: coin._id,
                        name: coin.name,
                        market_cap: soldAmount.length ? soldAmount[0].totalSold : 0,
                        creator: coin.creator
                    },
                    threadsCount: threadsCount,
                    latestThread: latestThread || null
                };
            }
        }));

        // Apply sorting
        coinsWithDetails.sort((a, b) => {
            if (sortBy === 'market_cap') {
                return sortField.market_cap ? (order === 1 ? a.market_cap - b.market_cap : b.market_cap - a.market_cap) : 0;
            } else if (sortBy === 'reply_count') {
                return sortField.threadsCount ? (order === 1 ? a.threadsCount - b.threadsCount : b.threadsCount - a.threadsCount) : 0;
            } else if (sortBy === 'last_reply') {
                const dateA = a.latestThread ? new Date(a.latestThread.createdAt) : new Date(0);
                const dateB = b.latestThread ? new Date(b.latestThread.createdAt) : new Date(0);
                return order === 1 ? dateA - dateB : dateB - dateA;
            } else {
                const dateA = new Date(a.coin.time);
                const dateB = new Date(b.coin.time);
                return order === 1 ? dateA - dateB : dateB - dateA;
            }
        });

        // Pagination
        const totalCoins = coinsWithDetails.length;
        const totalPages = Math.ceil(totalCoins / limit);

        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedCoins = coinsWithDetails.slice(startIndex, endIndex);

        // Handle case where no coins are found
        if (!paginatedCoins.length) {
            return res.status(404).json({ message: 'No coins found.' });
        }

        // Respond with paginated and sorted coin data
        return res.status(200).json({
            status: 200,
            message: 'Coins fetched successfully.',
            data: paginatedCoins,
            totalPages: totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
};


//view the token against the token _address
exports.viewCoinAginstToken = async (req, res) => {
    try {
        const { token_address } = req.body;
        const token = await coins_created.findOne({ token_address }).populate('creator', 'user_name profile_photo')
        return res.status(200).json({
            status: 200,
            message: 'Token fetched successfully.',
            data: token
        });
    } catch (error) {
        console.error(error);
        return res.status(200).json({ status: 500, error: error.message });
    }
}
//top 20 holders 
exports.topHolders = async (req, res) => {
    const { token_address } = req.body;

    try {
        // Find the coin by token address
        const coin = await coins_created.findOne({ token_address });
        if (!coin) {
            return res.status(404).json({ status: 404, message: 'Coin not found.' });
        }

        // Aggregate the top 20 holders
        const topHolders = await Trade.aggregate([
            { $match: { token_id: coin._id, type: 'buy' } }, // Filter by token ID and 'buy' type trades
            { $group: { _id: "$account", totalAmount: { $sum: "$amount" } } }, // Group by account and sum amounts
            { $sort: { totalAmount: -1 } }, // Sort by total amount in descending order
            { $limit: 20 } // Limit to top 20 holders
        ]);

        // Populate user details for the top holders
        const holdersWithDetails = await Promise.all(topHolders.map(async (holder) => {
            const user = await User.findById(holder._id, 'user_name profile_photo');
            return {
                user_name: user ? user.user_name : 'Unknown',
                profile_photo: user ? user.profile_photo : '',
                amount: holder.totalAmount
            };
        }));

        return res.status(200).json({
            status: 200,
            message: 'Top holders fetched successfully.',
            data: holdersWithDetails
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }

}
//view the profile of a user
exports.viewUser = async (req, res) => {
    try {
        const { user_id } = req.query;
        const user = await User.findById(user_id)
            .populate({
                path: 'coins_created',
                select: 'name image token_address'
            });
        if (!user) {
            return res.status(404).json({ status: 404, message: 'User not found.' });
        }

        const coinsHeldDetails = await Promise.all(user.coins_held.map(async (coin) => {
            const coinDetails = await coins_created.findById(coin.coinId);
            if (coinDetails) {
                return {
                    coinId: coin.coinId,
                    name: coinDetails.name,
                    image: coinDetails.image,
                    token_address: coinDetails.token_address
                };
            } else {
                console.error(`Coin with ID ${coin.coinId} not found.`);
                return null;
            }
        }));

        // Filter out any null entries resulting from missing coin details
        const filteredCoinsHeldDetails = coinsHeldDetails.filter(coin => coin !== null);

        user.token = undefined;
        user.trades = undefined;
        user.coins_held = undefined;
        return res.status(200).json({
            status: 200,
            message: 'User profile.',
            data: {
                user,

                coins_held: filteredCoinsHeldDetails
            }
        });

    } catch (error) {
        console.error(`Error viewing user: ${error.message}`);
        return res.status(200).json({ status: 500, error: error.message });
    }
};



const fs = require('fs');
const path = require('path');
const { createTrade, createBuyTrade } = require("../trades");

// Read the default image file

const defaultImagePath = path.join(__dirname, '../../../uploads/default.jpg');
const defaultImage = {
    data: fs.readFileSync(defaultImagePath),
    contentType: 'image/jpeg'
};
