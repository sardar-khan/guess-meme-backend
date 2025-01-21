const jwt = require("jsonwebtoken");
const User = require("../../models/users");
const mongoose = require('mongoose');
const coins_created = require("../../models/coin_created")
const { generateUsername } = require("../../services/users/userServices");
const Trade = require("../../models/trades");
const Thread = require("../../models/threads");
const pusher = require('../../config/pusher');
const axios = require('axios');
// const sharp = require('sharp');
exports.addWallets = async (req, res) => {
    const { address, blockchain } = req.body;

    try {
        const existingUser = await User.findOne({ 'wallet_address.address': address, 'wallet_address.blockchain': blockchain });
        if (existingUser) {
            console.log("existingUser", existingUser)
            if (existingUser.token) {
                try {
                    // Verify the token
                    jwt.verify(existingUser.token, process.env.TOKEN_KEY);
                    // If token is still valid, return the existing user data
                    return res.status(200).json({ status: 200, message: "User already logged in.", data: existingUser });
                } catch (err) {
                    if (err.name === 'TokenExpiredError') {
                        console.log("Token expired, generating a new token");
                        // Token is expired; generate a new one
                        const newToken = jwt.sign({ address, blockchain }, process.env.TOKEN_KEY, { expiresIn: "1d" });
                        existingUser.token = newToken;
                        await existingUser.save();
                        return res.status(200).json({ status: 200, message: "Token expired, new token issued.", data: existingUser });
                    }
                    // Handle other errors
                    return res.status(500).json({ status: 500, error: err.message });
                }
            }
        }
        else {
            // Create new user
            const generate_username = generateUsername(address, blockchain);
            console.log("gen", generate_username)
            const newUser = new User({ wallet_address: [{ address, blockchain }], user_name: generate_username });
            await newUser.save();
            const token = jwt.sign(
                { address, blockchain },
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
exports.updateUserProfile = async (req, res) => {
    const wallet_address = req.user.address;
    const { user_name, bio, profile_photo } = req.body;

    try {
        // Check if the username is being updated and if it's already taken by another user
        if (user_name) {
            const existingUser = await User.findOne({ user_name });
            if (existingUser && existingUser.wallet_address !== wallet_address) {
                return res.status(400).json({ message: 'Username is already taken' });
            }
        }
        console.log("wallet_address", wallet_address)
        // Find the user by wallet address
        const user = await User.findOne({ 'wallet_address.address': wallet_address });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update the allowed fields if they are provided
        if (user_name) user.user_name = user_name;
        if (profile_photo) user.profile_photo = profile_photo;
        // if (req.file) {
        //     const imageBuffer = await sharp(req.file.buffer)
        //         .resize(100, 100) // Resize the image to a maximum of 500x500 pixels
        //         .jpeg({ quality: 50 }) // Compress the image to JPEG with a quality of 70
        //         .toBuffer();
        //     user.profile_photo = { data: imageBuffer, contentType: 'image/jpeg' };
        // }
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
        const wallet_address = req.user.address;

        if (wallet_address) {
            // Update user's token to null in the database
            const user = await User.findOne({ 'wallet_address.address': wallet_address })
            if (user) {
                const decodedToken = jwt.decode(user.token);

                // Set the expiration time to a past date
                decodedToken.exp = Math.floor(Date.now() / 1000) + (2 * 24 * 60 * 60); // 2 days in seconds
                // Re-sign the token with the new expiration time
                const expiredToken = jwt.sign(decodedToken, process.env.TOKEN_KEY);

                user.token = expiredToken;;
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
    const wallet_address = req.user.address;
    try {
        const user = await User.findOne({ 'wallet_address.address': wallet_address });
        user.coins_created = undefined;
        user.coins_held = undefined;
        return res.status(200).json({ status: 200, message: "User Profile!", data: user });
    } catch (error) {
        return res.status(200).json({ status: 500, error: error.message });
    }
}
exports.coinsHoldingByUser = async (req, res) => {
    const wallet_address = req.user.address;
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
    const limit = parseInt(req.query.limit) || 10; // Default to 10 results per page if not specified
    const skip = (page - 1) * limit;

    try {
        const user = await User.findOne({ 'wallet_address.address': wallet_address });
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
    const wallet_address = req.user.address;
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
    const limit = parseInt(req.query.limit) || 10; // Default to 10 results per page if not specified
    const skip = (page - 1) * limit;

    try {
        const user = await User.findOne({ 'wallet_address.address': wallet_address })
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
    const wallet_address = req.user.address;
    const { coin_id, amount } = req.body; // Assuming you're receiving coinId and amount

    try {
        const user = await User.findOne({ 'wallet_address.address': wallet_address })

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
    const { name, ticker, description, image, twitter_link, telegram_link, website, bonding_curve, max_buy_percentage, amount, token_address, timer, hash } = req.body;
    const wallet_address = req.user.address;
    try {
        // Find the user
        const user = await User.findOne({ 'wallet_address.address': wallet_address })
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        // Check if coin with same token_address already exists
        const existingCoin = await coins_created.findOne({
            $or: [
                { token_address: token_address }
            ]
        });
        if (existingCoin) {
            return res.status(400).json({ message: "This coin address is already exists." });
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
                metadata: {
                    name: name,
                    image: image,
                    twitter_link: twitter_link,
                    description: description,
                    telegram_link: telegram_link,
                    website: website
                },
                timer,
                status: 'created',
                is_created: true,
            });
            if (hash !== null && amount !== null && amount !== "" && amount !== 0) {
                console.log("here", req, res, user, newCoin, 'buy', user.wallet_address[0].blockchain, amount, amount, hash);
                await postLaunchTrade(req, res, user, newCoin, 'buy', user.wallet_address[0].blockchain, amount, amount, hash, endpoint = false)
            }
            // Save the new coin to the database
            await newCoin.save();
            // Add the new coin to the user's coins_created array
            user.coins_created.push(newCoin);
            await user.save();

            const tradeNotification = {
                user_name: user.user_name,
                user_id: user.id,
                action: `created ${name}`,
                coin_photo: image,
                date: newCoin.time,
                token_id: newCoin._id,
                ticker: ticker,
                replies: 0,
                status: newCoin.status,
                market_cap: newCoin.market_cap,
                bonding_curve: newCoin.bonding_curve,
                ticker: newCoin.ticker,
                description: newCoin.description,
                name: newCoin.name,
                token_address: newCoin.token_address


                // user_image: user.profile_photo
            };
            console.log("initated-noti", tradeNotification)

            pusher.trigger('coin-created-channel', 'coin-created', tradeNotification);
            return res.status(200).json({ status: 200, message: "Coin created successfully.", data: newCoin, metadata_link: `/user/metadata/${newCoin._id}` });
        }
    } catch (error) {
        console.error(error);
        return res.status(200).json({ status: 500, error: error.message });
    }
};
exports.viewCoin = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const sortBy = req.query.sortBy || 'time';
    const order = req.query.order === 'asc' ? 1 : -1;
    const type = req.query.type;
    const status = req.query.status;
    console.log("status", status)
    const sortOptions = {
        market_cap: { market_cap: order },
        reply_count: { threadsCount: order },
        last_reply: { 'latestThread.createdAt': order },
        creation_time: { time: order },
        default: { time: -1 }
    };

    const sortField = sortOptions[sortBy] || sortOptions.default;

    try {
        const filter = { status };
        if (req.query.creator) {
            filter.creator = req.query.creator;
        }
        const filteredCoins = await coins_created.find(filter).populate({
            path: 'creator',
            select: 'user_name profile_photo wallet_address',
            match: type ? { 'wallet_address.blockchain': type } : {},
        });

        const coins = filteredCoins.filter((coin) => coin.creator);

        if (type && coins.length === 0) {
            return res.status(200).json({
                status: 200,
                message: 'No coins found according to filters.',
                data: coins,
            });
        }

        const coinsWithDetails = await Promise.all(
            coins.map(async (coin) => {
                if (!coin.creator) {
                    return null;
                }

                let trust_score = await calculateTrustScore(coin.creator.id);
                const soldAmount = await Trade.aggregate([
                    { $match: { token_id: coin._id, type: 'sell' } },
                    { $group: { _id: null, totalSold: { $sum: "$amount" } } }
                ]);

                const threadsCount = await Thread.countDocuments({ token_id: coin._id });
                const latestThread = await Thread.findOne({ token_id: coin._id }).sort({ createdAt: -1 });
                const now = new Date();
                console.log("statusxxxx", coin.status == 'created', coin.status)
                if (status === 'deployed') {
                    console.log("one", coin)
                    return {
                        coin: coin,
                        market_cap: soldAmount.length ? soldAmount[0].totalSold : 0,
                        trust_score,
                        status: coin?.status,
                        threadsCount,
                        latestThread: latestThread || null
                    };
                } else if (status == 'created') {
                    console.log("created")
                    return {
                        coin: {
                            _id: coin._id,
                            name: coin.metadata?.name,
                            market_cap: soldAmount.length ? soldAmount[0].totalSold : 0,
                            trust_score,
                            status: coin?.status,
                            creator: coin.creator,
                            time: coin.time,
                            token_address: coin.token_address
                        },
                        status: coin.status,
                        threadsCount,
                        latestThread: latestThread || null
                    };
                }
            })
        );

        // Shuffle coins
        const shuffleArray = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        };

        shuffleArray(coinsWithDetails);

        const totalCoins = coinsWithDetails.length;
        const totalPages = Math.ceil(totalCoins / limit);

        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedCoins = coinsWithDetails.slice(startIndex, endIndex);

        if (!paginatedCoins.length) {
            return res.status(404).json({ message: 'No coins found.' });
        }

        return res.status(200).json({
            status: 200,
            message: 'Coins fetched successfully.',
            data: paginatedCoins,
            totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
};

//view the token against the token _address
exports.viewCoinAginstId = async (req, res) => {
    try {
        const { token_id } = req.params;
        console.log("token_id", token_id)
        const token = await coins_created.findById(token_id).populate('creator', 'user_name profile_photo');
        const soldAmount = await Trade.aggregate([
            { $match: { token_id: token._id, type: 'sell' } },
            { $group: { _id: null, totalSold: { $sum: "$amount" } } }
        ]);
        const now = new Date();
        let trust_score = await calculateTrustScore(token.creator.id);
        if (token.timer < now) {
            return res.status(200).json({
                status: 200,
                message: 'Token fetched successfully.',
                data: token
            });
        } else {
            return res.status(200).json({
                status: 200,
                message: 'Token fetched successfully.',
                data: {
                    _id: token._id,
                    name: token.metadata?.name,
                    market_cap: soldAmount.length ? soldAmount[0].totalSold : 0,
                    trust_score: trust_score,
                    status: token?.status,
                    creator: token.creator,
                    time: token.time
                },
                // status: token.status,
                // threadsCount: threadsCount,
                // latestThread: latestThread || null
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(200).json({ status: 500, error: error.message });
    }
}
//top 20 holders
exports.topHolders = async (token_address) => {
    try {
        // Find the coin by token address
        const coin = await coins_created.findOne({ token_address });
        if (!coin) {
            throw ({ status: 404, message: 'Coin not found.' });
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
            const user = await User.findById(holder._id, 'user_name profile_photo wallet_address.address');
            const walletAddress = user?.wallet_address?.at(0)?.address;
            return {
                user_name: user ? user.user_name : 'Unknown',
                profile_photo: user ? user.profile_photo : '',
                amount: holder.totalAmount,
                address: coin.token_address,
                wallet_address: walletAddress
            };
        }));

        return {
            data: holdersWithDetails
        };
    } catch (error) {
        console.error(error);
        throw error;
    }

}
//view the profile of a user
exports.viewUser = async (req, res) => {
    try {
        const { user_id } = req.query;
        const user = await User.findById(user_id)
            .populate({
                path: 'coins_created',
                select: 'name image token_address description market_cap ticker time',
                options: { sort: { time: -1 } }
            }).populate({
                path: 'following', // Populate following users
                select: 'user_name profile_photo wallet_address address' // Customize the fields you want for followers
            })
            .populate({
                path: 'followers', // Populate followers users
                select: 'user_name profile_photo wallet_address address' // Customize the fields you want for followers
            });
        ;
        if (!user) {
            return res.status(404).json({ status: 404, message: 'User not found.' });
        }
        const score = await calculateTrustScore(user_id);
        console.log("trust score", score)

        const coinsHeldDetails = await Promise.all(user.coins_held.map(async (coin) => {
            const coinDetails = await coins_created.findById(coin.coinId);
            if (coinDetails) {
                console.log(coinDetails.time, 'time')
                return {
                    coinId: coin.coinId,
                    name: coinDetails.name,
                    image: coinDetails.image,
                    token_address: coinDetails.token_address,
                    description: coinDetails.description,
                    market_cap: coinDetails.market_cap,
                    ticker: coinDetails.ticker,
                    time: coinDetails.time
                };
            } else {
                console.error(`Coin with ID ${coin.coinId} not found.`);
                return null;
            }
        }));

        // Filter out any null entries resulting from missing coin details
        const filteredCoinsHeldDetails = coinsHeldDetails.filter(coin => coin !== null).sort((a, b) => new Date(b.time) - new Date(a.time));;
        // Format followers and following details with count and image
        const followingDetails = user.following.map(following => ({
            username: following.username,
            image: following.image,
            wallet_address: following.wallet_address,
            address: following.address
        }));

        const followersDetails = user.followers.map(follower => ({
            username: follower.user_name,
            image: follower.profile_photo,
            wallet_address: follower.wallet_address[0].address,
            address: follower.address
        }));
        const likedThreads = await Thread.find({ user_id: user.id })
            .select('likes');
        const totalLikes = likedThreads.reduce((sum, thread) => sum + thread.likes.length, 0);

        // Calculate total mentions (mentions of the user's wallet address in threads/replies)
        const mentionedThreads = await Thread.find({ user_id: user.id })
            .select('replies');

        // Calculate the total number of likes
        const count = mentionedThreads.reduce((sum, thread) => sum + thread.replies.length, 0);

        user.token = undefined;
        user.trades = undefined;
        user.coins_held = undefined;
        user.trust_score = score;
        return res.status(200).json({
            status: 200,
            message: 'User profile.',
            data: {
                user: {
                    ...user.toObject(),
                    following_count: followingDetails.length, // Add following count
                    followers_count: followersDetails.length, // Add followers count
                    total_likes: totalLikes, // Add total likes
                    total_mentions: count // Add total mentions
                },
                following: followingDetails, // List of following users
                followers: followersDetails, // List of followers users

                coins_held: filteredCoinsHeldDetails
            }
        });

    } catch (error) {
        console.error(`Error viewing user: ${error.message}`);
        return res.status(200).json({ status: 500, error: error.message });
    }
};
//rate coins
exports.addReview = async (req, res) => {
    const wallet_address = req.user.address;
    try {
        // Find the user
        const user = await User.findOne({ 'wallet_address.address': wallet_address })
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const { rating, comment, coinId } = req.body;

        // Find the coin
        const coin = await coins_created.findById(coinId);
        if (!coin) {
            return res.status(404).json({ message: "Coin not found, please recheck the ID." });
        }

        // Check if the user has already reviewed the coin
        const existingReview = coin.reviews.find(review => review.user === wallet_address);

        if (existingReview) {
            // Update the existing review
            existingReview.rating = rating;
            existingReview.comment = comment;
            message = 'Your review has been updated successfully.';
        } else {
            // Add a new review
            coin.reviews.push({
                user: wallet_address,
                rating: rating,
                comment: comment
            });
            message = 'Thanks for your feedback! Your review has been added successfully.';
        }

        await coin.save();
        return res.status(200).json({ status: 200, message });

    } catch (error) {
        return res.status(200).json({ status: 500, error: error.message });
    }
};
const coin_deployment_request = require("../../models/coins_deploy_request");
const { getTokenLargestAccounts } = require("../../web3/test");
const { postLaunchTrade } = require("../trades");
// Read the default image file
// const defaultImagePath = path.join(__dirname, '../../../uploads/default.jpg');
// const defaultImage = {
//     data: fs.readFileSync(defaultImagePath),
//     contentType: 'image/jpeg'
// };
//get user trust score
async function calculateTrustScore(creatorId) {
    try {
        // Fetch creator's coins and reviews
        const coins = await coins_created.find({ creator: creatorId });

        let totalPerformanceScore = 0;
        let totalReviewScore = 0;
        let totalReviews = 0;

        coins.forEach(coin => {
            // Calculate performance score (e.g., based on price growth or stability)

            // Aggregate review scores
            coin.reviews.forEach(review => {
                totalReviewScore += review.rating;
                totalReviews += 1;
            });
        });

        // Average out the review score
        const averageReviewScore = totalReviews > 0 ? totalReviewScore / totalReviews : 0;

        // Platform-specific metrics (this is a placeholder, you can define your own)
        // const platformMetricsScore = calculatePlatformMetrics(creatorId);

        // Calculate final trust score (weights can be adjusted)
        // const trustScore = (0.5 * (totalPerformanceScore / coins.length)) +
        //     (0.3 * averageReviewScore) +
        //     (0.2 * platformMetricsScore);

        // // Normalize trust score to a range of 0-100
        // const normalizedTrustScore = Math.min(Math.max(trustScore, 0), 100);

        return averageReviewScore;

    } catch (error) {
        console.error("Error calculating trust score:", error);
        throw error;
    }
}
//metradat link
exports.metadata = async (req, res) => {
    try {
        const { coin_id } = req.params; // Use req.params to access parameters in the URL
        console.log(req.params);
        // Use object shorthand property names for better readability
        const coin = await coins_created.findOne({
            coinId: coin_id
        });

        if (!coin) {
            return res.status(404).json({ message: "coin not found" });
        }

        res.json(coin.metadata);
    } catch (error) {
        // Return a 500 status code for internal server errors
        return res.status(500).json({ message: error.message });
    }
};
//top 3 coins
exports.topThreeCoins = async (req, res) => {
    try {
        const { type } = req.params; // Get the account type (solana or ethereum) from the route parameter
        if (!type || !['solana', 'ethereum', 'polygon', 'bsc'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid account type. Please use 'solana' or 'ethereum'."
            });
        }
        const topCoins = await Trade.aggregate([
            // Match transactions based on the account type from the parameter
            {
                $match: {
                    account_type: type
                }
            },
            // Group by token_id and sum up the amount for buy and sell transactions
            {
                $group: {
                    _id: "$token_id", // Group by token_id (each coin)
                    totalVolume: { $sum: "$amount" } // Sum the amount (transaction volume)
                }
            },
            // Sort the results by totalVolume in descending order
            {
                $sort: { totalVolume: -1 }
            },
            // Limit the result to top 3 coins
            { $limit: 3 }
        ]);
        // Fetch additional details for each token
        const enrichedTopCoins = await Promise.all(
            topCoins.map(async (coin) => {
                const tokenDetails = await coins_created
                    .findById(coin._id)
                    .populate('creator', 'user_name profile_photo'); // Populate creator details
                return {
                    token_id: coin._id,
                    totalVolume: coin.totalVolume,
                    tokenDetails: tokenDetails || null // Add token details (or null if not found)
                };
            })
        );

        // Send the response with enriched token details
        res.status(200).json({
            success: true,
            accountType: type,
            topCoins: enrichedTopCoins
        });
    } catch (err) {
        console.error("Error fetching top 3 coins:", err);
        res.status(500).json({
            success: false,
            message: 'Error fetching top coins',
            error: err.message
        });
    }
};
//add followers
exports.toggleFollow = async (req, res) => {
    const wallet_address = req.user.address;
    const { user_id } = req.body;

    try {
        const currentUser = await User.findOne({ 'wallet_address.address': wallet_address });
        if (!currentUser) {
            return res.status(404).json({ status: 404, message: "Logged-in user not found." });
        }

        const targetUser = await User.findById(user_id);
        if (!targetUser) {
            return res.status(404).json({ status: 404, message: "Target user not found." });
        }

        if (currentUser._id.equals(user_id)) {
            return res.status(400).json({ status: 400, message: "You cannot follow or unfollow yourself." });
        }

        // Check if the logged-in user is already following the target user
        const isFollowing = targetUser.followers.includes(currentUser._id);

        if (isFollowing) {
            // Unfollow logic
            targetUser.followers = targetUser.followers.filter(
                (id) => !id.equals(currentUser._id)
            );
            currentUser.following = currentUser.following.filter(
                (id) => !id.equals(targetUser._id)
            );

            targetUser.followers_count -= 1;

            await targetUser.save();

            return res.status(200).json({
                status: 200,
                message: "Successfully unfollowed the user.",
                following: false,
            });
        } else {
            // Follow logic
            targetUser.followers.push(currentUser._id);
            currentUser.following.push(targetUser._id);

            targetUser.followers_count += 1;

            await targetUser.save();
            const pusher_data = {
                message: `${currentUser.user_name} started following you.`,
                userId: currentUser._id,
                user_photo: currentUser.profile_photo
            }
            // Trigger Pusher event for follow
            pusher.trigger('follow-user', 'follow', pusher_data);
            currentUser.unread_notifications += 1;
            await currentUser.save();
            console.log("count", currentUser.unread_notifications)
            return res.status(200).json({
                message: "Successfully followed the user.",
                following: true,
            });
        }
    } catch (error) {
        console.error(`Error in toggleFollow: ${error.message}`);
        return res.status(500).json({ status: 500, error: error.message });
    }
};

//check user follow yet or not
exports.canFollow = async (req, res) => {
    const wallet_address = req.user.address; // Assuming the user's wallet address is in req.user
    const { user_id } = req.body; // ID of the user to check

    try {
        const currentUser = await User.findOne({ 'wallet_address.address': wallet_address });
        if (!currentUser) {
            return res.status(404).json({ status: 404, message: "Logged-in user not found." });
        }

        const targetUser = await User.findById(user_id);
        if (!targetUser) {
            return res.status(404).json({ status: 404, message: "Target user not found." });
        }

        if (currentUser._id.equals(user_id)) {
            return res.status(400).json({ status: 400, message: "You cannot follow yourself.", canFollow: false });
        }

        // // Check if the logged-in user is already following the target user
        const isFollowing = targetUser.followers.includes(currentUser._id);

        return res.status(200).json({
            status: 200,
            follow_status: isFollowing,
            message: isFollowing
                ? "You are already following this user."
                : "You can follow this user.",
        });
    } catch (error) {
        console.error(`Error in canFollow: ${error.message}`);
        return res.status(500).json({ message: "Something went wrong.", error: error.message });
    }
};
//get notifications
exports.getNotifications = async (req, res) => {
    const wallet_address = req.user.address;

    try {
        // Fetch the logged-in user
        const user = await User.findOne({ 'wallet_address.address': wallet_address });
        if (!user) {
            return res.status(404).json({ status: 404, message: "Logged-in user not found." });
        }

        // Fetch all threads created by the user
        const threads = await Thread.find({ user_id: user._id })
            .populate('likes.user_id', 'user_name profile_photo');

        console.log('Threads by user:', threads);

        // Extract and map likes into notifications
        const likeNotifications = threads.flatMap(thread =>
            thread.likes
                .filter(like => String(like.user_id?._id) !== String(user._id)) // Exclude own likes
                .map(like => ({
                    type: 'like',
                    message: `${like.user_id?.user_name || 'Unknown User'} liked your thread.`,
                    created_at: like.likedAt,
                    thread_id: thread._id,
                    token_id: thread.token_id,
                    user_profile: like.user_id?.profile_photo,
                }))
        );

        console.log('Like notifications:', likeNotifications);

        // Fetch the latest followers
        const followers = await User.find({ _id: { $in: user.followers } })
            .select('user_name profile_photo createdAt')
            .limit(10)
            .sort({ createdAt: -1 });

        console.log('Followers:', followers);

        // Map followers into notifications
        const followNotifications = followers.map(follower => ({
            type: 'follow',
            message: `${follower.user_name} started following you.`,
            user_profile: follower.profile_photo,
            created_at: follower.createdAt,
        }));

        console.log('Follow notifications:', followNotifications);

        // Extract mentions from replies
        const repliesIds = threads.flatMap(thread => thread.replies);
        const replies = await Thread.find({ _id: { $in: repliesIds } })
            .populate('user_id', 'user_name profile_photo');
        const mentionNotifications = replies
            .map(reply => ({
                type: 'mention',
                message: `${reply.user_id?.user_name || 'Unknown User'} mentioned you.`,
                created_at: reply.createdAt,
                thread_id: reply.thread_id,
                token_id: reply.token_id,
                user_profile: reply.user_id?.profile_photo,
            }));

        console.log('Mention notifications:', mentionNotifications);

        // Combine all notifications
        const notifications = [...likeNotifications, ...followNotifications, ...mentionNotifications]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.status(200).json({
            status: 200,
            message: 'Notifications fetched successfully.',
            data: notifications,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            status: 500,
            message: 'An error occurred while fetching notifications.',
            error: error.message,
        });
    }
};



//make allnotfications to 0
// Mark notifications as read (when the user views them)
exports.markNotificationsAsRead = async (req, res) => {
    const wallet_address = req.user.address;

    try {
        const user = await User.findOne({ 'wallet_address.address': wallet_address });
        if (!user) {
            return res.status(401).json({ status: 401, message: "User not found." });
        }

        // Reset unread notification count to 0
        user.unread_notifications = 0;
        await user.save();

        return res.status(200).json({
            status: 200,
            message: 'Notifications marked as read.',
        });
    } catch (error) {
        console.error('Error marking notifications as read:', error.message);
        return res.status(500).json({ status: 500, error: error.message });
    }
};