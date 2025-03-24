const CoinCreated = require("../models/coin_created");
const Trade = require("../models/trades");
const User = require("../models/users");
const pusher = require('../../src/config/pusher');
const { getTokenLargestAccounts, marketCapPolygon, tokenAgainstSol, fetchEthPriceInUsd, fetchSolPriceInUsd } = require("../web3/test");
const buyers_requests = require("../models/buyers_requests");
const { buyTokensOnBlockchain, getPrice, withdrawEvmFunds } = require("../web3/tokens");
const { buyWithAddress, initializeUserATA } = require("../web3/solana/buyTokens");
const { buyOnTron } = require("../web3/tron/tronTrades");
const { mintaddy, wallet, getPrivateKey, connection } = require('../web3/solana/config');
const { topHolders } = require("./users/users");
const mongoose = require('mongoose');
const { withdraw } = require("../web3/solana/withdraw");
const { createPool } = require("../web3/TrasferTokens/AddLiquidityWuthSol");
const { addLiquidityWithETH } = require("../web3/TrasferTokens/addLiquidityWithETH");

exports.createTrade = async (req, res) => {
    const { token_id, type, amount, account_type, token_amount, transaction_hash, endpoint = true } = req.body;
    const account = req.user.address;

    try {
        // Fetch user and token concurrently for better performance
        const [user, token] = await Promise.all([
            User.findOne({ 'wallet_address.address': account }),
            CoinCreated.findById(token_id)
        ]);
        if (!user || !token) {
            return res.status(404).json({ message: 'User or Token not found.' });
        }

        return this.postLaunchTrade(req, res, user, token, type, account_type, amount, token_amount, transaction_hash, endpoint);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
};


exports.getUserTradeSummary = async (req, res) => {
    const { token_id, creator_id } = req.params;
    const userId = creator_id; // Extracted from authentication middleware


    try {
        // Fetch all trades of this user for the given token
        const userTrades = await Trade.find({ token_id, account: new mongoose.Types.ObjectId(userId) });

        // Calculate total buy and sell amounts
        let totalBuyAmount = 0;
        let totalSellAmount = 0;

        userTrades.forEach(trade => {
            if (trade.type === 'buy') {
                totalBuyAmount += trade.amount;
            } else if (trade.type === 'sell') {
                totalSellAmount += trade.amount;
            }
        });

        // Net tokens bought (buys - sells)
        const netTokenAmount = totalBuyAmount - totalSellAmount;

        return res.status(200).json({
            status: 200,
            message: 'User trade summary fetched successfully.',
            userTradeSummary: {
                totalBuyAmount,
                totalSellAmount,
                netTokenAmount, // Final amount user actually holds
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
};

//get the all trades aginst the token
exports.getTrades = async (token_id, page, limit) => {


    try {
        const trades = await Trade.find({ token_id })
            .populate('account', 'user_name profile_photo')
            .populate('token_id', 'name ticker description image')
            .sort({ created_at: -1 })
            .skip((page - 1) * limit) // Skip the trades of previous pages
            .limit(parseInt(limit)) // Limit the number of trades to fetch


        const totalTrades = await Trade.countDocuments({ token_id }); // Total number of trades for the token

        if (!trades.length) {
            throw ({ message: 'No trades found for this token.' });
        }

        return {
            data: trades,
            currentPage: page,
            totalPages: Math.ceil(totalTrades / limit),
            totalTrades: totalTrades
        };
    } catch (error) {
        console.error(error);
        throw error
    }
};

//fgwfggfe
exports.getBondingCurveProgress = async (token_address) => {
    try {
        const token = await CoinCreated.findOne({ token_address: token_address });

        if (!token) {
            throw ({ message: 'Token not found.' });
        }

        let progress = (token.max_supply / 629000000000000) * 100;  // Bonding curve progress in percentage
        if (progress > 100) {
            progress = 100;
        }
        if (progress < 0) {
            progress = 0;
        }
        return progress.toFixed(18);

    } catch (error) {
        console.error(error);
        throw error;
    }
};

//get the coin of hill
exports.getKingOfTheHill = async (req, res) => {
    try {
        const { type } = req.params; // Extract the type (solana or ethereum) from the route parameter
        console.log("type", type)
        // Validate type
        if (!type || !['solana', 'ethereum', 'polygon', 'bsc', 'sepolia'].includes(type)) {
            return res.status(400).json({
                status: 400,
                message: "Invalid type. Please use 'solana' or 'ethereum'."
            });
        }

        // Aggregate query to join CoinCreated with User and filter by blockchain type
        const kingOfTheHill = await CoinCreated.aggregate([
            {
                $lookup: {
                    from: "users", // Name of the User collection
                    localField: "creator", // Field in CoinCreated that references User
                    foreignField: "_id", // Field in User that matches
                    as: "creatorDetails"
                }
            },
            {
                $unwind: "$creatorDetails" // Unwind the array of matched User documents
            },
            {
                $match: {
                    "is_king_of_the_hill.value": true,
                    "creatorDetails.wallet_address.0.blockchain": type // Match blockchain type
                }
            },

            {
                $sort: { "is_king_of_the_hill.time": -1 } // Sort by time descending
            },
            {
                $limit: 1 // Get the latest King of the Hill
            }

        ]);
        if (!kingOfTheHill || kingOfTheHill.length === 0) {
            return res.status(404).json({
                status: 404,
                message: `No King of the Hill found for ${type}.`
            });
        }

        // Extract the first King of the Hill document
        const king = kingOfTheHill[0];
        const user = king.creatorDetails;

        return res.status(200).json({
            status: 200,
            message: `King of the Hill for ${type} fetched successfully.`,
            data: {
                kingOfTheHill: king,
                user_profile: user.profile_photo,
                user_name: user.user_name,
                user_id: user._id
            }
        });
    } catch (error) {
        console.error("Error fetching King of the Hill:", error);
        return res.status(500).json({
            status: 500,
            message: "Error fetching King of the Hill.",
            error: error.message
        });
    }
};

//graph data
exports.getGraphData = async (req, res) => {
    try {
        const { token_id } = req.query;

        if (!token_id) {
            return res.status(400).json({ error: 'token_id is required' });
        }

        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        // Query trades within the specified date range
        const trades = await Trade.find({
            token_id: token_id,
            created_at: { $gte: startOfYear, $lte: now }
        }).sort({ created_at: 1 });

        if (trades.length === 0) {
            return res.status(404).json({ status: 404, error: 'No trades found for the specified token and date range' });
        }

        const dailyData = {};

        trades.forEach(trade => {
            const date = trade.created_at.toISOString().split('T')[0];
            const x = trade.amount; // Amount of SOL purchased
            const tokensObtained = 1073000191 - (32190005730 / (30 + x)); // Bonding curve formula
            const pricePerToken = x / tokensObtained; // Calculate token price

            if (!dailyData[date]) {
                dailyData[date] = {
                    open: pricePerToken,
                    high: pricePerToken,
                    low: pricePerToken,
                    close: pricePerToken
                };
            } else {
                dailyData[date].high = Math.max(dailyData[date].high, pricePerToken);
                dailyData[date].low = Math.min(dailyData[date].low, pricePerToken);
                dailyData[date].close = pricePerToken;
            }
        });

        const result = Object.keys(dailyData).map(date => ({
            time: date,
            open: dailyData[date].open,
            high: dailyData[date].high,
            low: dailyData[date].low,
            close: dailyData[date].close
        }));

        return res.status(200).json({
            status: 200,
            data: result
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
};


async function waitForTransactionFinalization(transactionHash, maxRetries = 10, delay = 4000) {
    try {
        for (let i = 0; i < maxRetries; i++) {
            const transactionDetails = await connection.getTransaction(transactionHash, {
                commitment: "confirmed", // Ensures confirmation but not finalit
                maxSupportedTransactionVersion: 0
            });

            if (transactionDetails) {
                const confirmedStatus = await connection.getSignatureStatus(transactionHash, { searchTransactionHistory: true });

                if (confirmedStatus?.value?.confirmationStatus === "finalized") {
                    console.log("Transaction finalized:", transactionHash);
                    return true; // Now safe to call the backend
                }
            }

            console.log(`Waiting for finalization... Attempt ${i + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
        }

        console.log("Transaction not finalized within the given retries.");
        return false; // Return false if transaction is not finalized
    } catch (error) {
        console.error("Error checking transaction status:", error.message);
        return false;
    }
}
//i want that user can search graph on the basis of time lie 5minutes,30 minutes ,hour, 1 day, 5days, 1 month, 3 months, 6 months, 1 year
//carrys data
exports.getGraphDataa = async (req, res) => {
    try {
        const { type, token_id, time, bucketSize: userBucketSize, bucketUnit } = req.query;
        let DEFAULT_PRICE = 0.000000027; // Set default price
        if (type === 'solana') {
            DEFAULT_PRICE = 0.000000027;
        } else {
            DEFAULT_PRICE = 0.000000001770735939;
        }

        // Set default price

        if (!token_id) {
            return res.status(400).json({ error: 'token_id is required' });
        }
        const token = await CoinCreated.findById(token_id);
        const token_address = token?.token_address;
        // Validate bucket unit if provided
        const validBucketUnits = ['minute', 'hour', 'day', 'week', 'month', 'year'];
        if (userBucketSize && !bucketUnit) {
            return res.status(400).json({ error: 'bucketUnit is required when bucketSize is provided' });
        }
        if (bucketUnit && !validBucketUnits.includes(bucketUnit)) {
            return res.status(400).json({
                error: `Invalid bucket unit. Must be one of: ${validBucketUnits.join(', ')}`
            });
        }

        const now = new Date();
        let startTime;

        // Time range calculation
        const timeRanges = {
            '5minutes': 5 * 60000,
            '30minutes': 30 * 60000,
            'hour': 60 * 60000,
            '1day': 24 * 60 * 60000,
            '5days': 5 * 24 * 60 * 60000,
            '1month': 30 * 24 * 60 * 60000,
            '3months': 90 * 24 * 60 * 60000,
            '6months': 180 * 24 * 60 * 60000,
            '1year': 365 * 24 * 60 * 60000
        };

        startTime = new Date(now.getTime() - (timeRanges[time] || 0));
        if (!timeRanges[time]) {
            return res.status(400).json({ error: 'Invalid time parameter' });
        }

        // Convert bucket size to milliseconds based on unit
        let bucketSize;
        if (userBucketSize) {
            const size = parseInt(userBucketSize);
            if (isNaN(size) || size <= 0) {
                return res.status(400).json({ error: 'Invalid bucket size. Must be a positive number.' });
            }

            switch (bucketUnit) {
                case 'minute':
                    bucketSize = size * 60 * 1000;
                    break;
                case 'hour':
                    bucketSize = size * 60 * 60 * 1000;
                    break;
                case 'day':
                    bucketSize = size * 24 * 60 * 60 * 1000;
                    break;
                case 'week':
                    bucketSize = size * 7 * 24 * 60 * 60 * 1000;
                    break;
                case 'month':
                    bucketSize = size * 30 * 24 * 60 * 60 * 1000;
                    break;
                case 'year':
                    bucketSize = size * 365 * 24 * 60 * 60 * 1000;
                    break;
                default:
                    bucketSize = size * 60 * 1000;
            }

            const timeRange = timeRanges[time];
            const maxBuckets = 1000;
            const minBucketSize = timeRange / maxBuckets;

            if (bucketSize < minBucketSize) {
                const suggestedSize = Math.ceil(minBucketSize / (60 * 1000));
                return res.status(400).json({
                    error: `Bucket size too small for selected time range. Minimum bucket size for ${time} is ${suggestedSize} minutes.`
                });
            }
        } else {
            if (time === '5minutes') {
                bucketSize = 60 * 1000;
            } else if (time === '30minutes') {
                bucketSize = 2 * 60 * 1000;
            } else if (time === 'hour') {
                bucketSize = 5 * 60 * 1000;
            } else if (time === '1day') {
                bucketSize = 15 * 60 * 1000;
            } else {
                bucketSize = 60 * 60 * 1000;
            }
        }

        const calculatePrice = async () => {
            //const tokensObtained = 1073000191 - (32190005730 / (30 + amount));
            let tokensObtained = await tokenAgainstSol(token_address, 1)
            tokensObtained = tokensObtained?.tokenPriceInSol;
            return tokensObtained;
        };

        const trades = await Trade.find({
            token_id: token_id,
            created_at: { $gte: startTime, $lte: now }
        }).sort({ created_at: 1 });

        const graphData = [];
        let currentBucketTime = new Date(startTime);
        let lastKnownPrice = DEFAULT_PRICE; // Initialize with default price instead of null

        while (currentBucketTime <= now) {
            const bucketEnd = new Date(currentBucketTime.getTime() + bucketSize);

            const bucketTrades = trades.filter(trade =>
                trade.created_at >= currentBucketTime &&
                trade.created_at < bucketEnd
            );

            let bucketData;

            if (bucketTrades.length > 0) {
                const bucketPrices = bucketTrades.map(trade => trade.coin_price);
                bucketData = {
                    time: currentBucketTime.toISOString(),//234324
                    open: lastKnownPrice || DEFAULT_PRICE, //0.000000028 //0.0000000311
                    high: Math.max(lastKnownPrice || DEFAULT_PRICE, ...bucketPrices),//
                    low: Math.min(...bucketPrices),// trade.coinPrice 0.000000000041
                    close: bucketPrices[bucketPrices.length - 1]
                };
                lastKnownPrice = bucketData.close; //
            } else {
                bucketData = {
                    time: currentBucketTime.toISOString(),
                    open: lastKnownPrice || DEFAULT_PRICE,
                    high: lastKnownPrice || DEFAULT_PRICE,
                    low: lastKnownPrice || DEFAULT_PRICE,
                    close: lastKnownPrice || DEFAULT_PRICE
                };
            }

            graphData.push(bucketData);
            currentBucketTime = bucketEnd;
        }

        return res.status(200).json({
            status: 200,
            data: graphData
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
};

// exports.getGraphDataa = async (req, res) => {
//     try {
//         const { token_id, time, bucketSize: userBucketSize, bucketUnit } = req.query;
//         const DEFAULT_PRICE = 0.000000028;

//         if (!token_id) {
//             return res.status(400).json({ error: 'token_id is required' });
//         }

//         const token = await CoinCreated.findById(token_id);
//         const token_address = token?.token_address;

//         const validBucketUnits = ['minute', 'hour', 'day', 'week', 'month', 'year'];
//         if (userBucketSize && !bucketUnit) {
//             return res.status(400).json({ error: 'bucketUnit is required when bucketSize is provided' });
//         }
//         if (bucketUnit && !validBucketUnits.includes(bucketUnit)) {
//             return res.status(400).json({
//                 error: `Invalid bucket unit. Must be one of: ${validBucketUnits.join(', ')}`,
//             });
//         }

//         const now = new Date();
//         const timeRanges = {
//             '5minutes': 5 * 60000,
//             '30minutes': 30 * 60000,
//             'hour': 60 * 60000,
//             '1day': 24 * 60 * 60000,
//             '5days': 5 * 24 * 60 * 60000,
//             '1month': 30 * 24 * 60 * 60000,
//             '3months': 90 * 24 * 60 * 60000,
//             '6months': 180 * 24 * 60 * 60000,
//             '1year': 365 * 24 * 60 * 60000
//         };

//         let startTime = new Date(now.getTime() - (timeRanges[time] || 0));
//         if (!timeRanges[time]) {
//             return res.status(400).json({ error: 'Invalid time parameter' });
//         }

//         let bucketSize;
//         if (userBucketSize) {
//             const size = parseInt(userBucketSize);
//             if (isNaN(size) || size <= 0) {
//                 return res.status(400).json({ error: 'Invalid bucket size. Must be a positive number.' });
//             }

//             const unitMultipliers = {
//                 minute: 60 * 1000,
//                 hour: 60 * 60 * 1000,
//                 day: 24 * 60 * 60 * 1000,
//                 week: 7 * 24 * 60 * 60 * 1000,
//                 month: 30 * 24 * 60 * 60 * 1000,
//                 year: 365 * 24 * 60 * 60 * 1000
//             };

//             bucketSize = size * unitMultipliers[bucketUnit] || size * 60 * 1000;

//             const minBucketSize = timeRanges[time] / 1000;
//             if (bucketSize < minBucketSize) {
//                 const suggestedSize = Math.ceil(minBucketSize / (60 * 1000));
//                 return res.status(400).json({
//                     error: `Bucket size too small for selected time range. Minimum bucket size for ${time} is ${suggestedSize} minutes.`
//                 });
//             }
//         } else {
//             bucketSize = {
//                 '5minutes': 60 * 1000,
//                 '30minutes': 2 * 60 * 1000,
//                 'hour': 5 * 60 * 1000,
//                 '1day': 15 * 60 * 1000
//             }[time] || 60 * 60 * 1000;
//         }

//         const calculatePrice = async () => {
//             let tokensObtained = await tokenAgainstSol(token_address, 1);
//             return tokensObtained?.tokenPriceInSol || DEFAULT_PRICE;
//         };

//         const trades = await Trade.find({
//             token_id: token_id,
//             created_at: { $gte: startTime, $lte: now }
//         }).sort({ created_at: 1 });

//         const graphData = [];
//         let lastKnownPrice = DEFAULT_PRICE;

//         for (const trade of trades) {
//             console.log('Fetched Trades:', trades.map(t => ({ time: t.created_at, price: t.price })));

//             const tradeTime = new Date(trade.created_at);
//             const tradePrice = await calculatePrice();

//             // Ensure a new candle is created for every trade
//             graphData.push({
//                 time: tradeTime.toISOString(),
//                 open: lastKnownPrice,
//                 high: Math.max(lastKnownPrice, tradePrice),
//                 low: Math.min(lastKnownPrice, tradePrice),
//                 close: tradePrice
//             });

//             lastKnownPrice = tradePrice;
//         }

//         return res.status(200).json({
//             status: 200,
//             data: graphData
//         });

//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ status: 500, error: error.message });
//     }
// };

// exports.getGraphDataa = async (req, res) => {
//     try {
//         const { token_id, time, bucketSize: userBucketSize, bucketUnit } = req.query;
//         const DEFAULT_PRICE = 0.000000028; // Set default price

//         if (!token_id) {
//             return res.status(400).json({ error: 'token_id is required' });
//         }
//         const token = await CoinCreated.findById(token_id);
//         const token_address = token?.token_address;
//         // Validate bucket unit if provided
//         const validBucketUnits = ['minute', 'hour', 'day', 'week', 'month', 'year'];
//         if (userBucketSize && !bucketUnit) {
//             return res.status(400).json({ error: 'bucketUnit is required when bucketSize is provided' });
//         }
//         if (bucketUnit && !validBucketUnits.includes(bucketUnit)) {
//             return res.status(400).json({
//                 error: `Invalid bucket unit. Must be one of: ${validBucketUnits.join(', ')}`
//             });
//         }

//         const now = new Date();
//         let startTime;

//         // Time range calculation
//         const timeRanges = {
//             '5minutes': 5 * 60000,
//             '30minutes': 30 * 60000,
//             'hour': 60 * 60000,
//             '1day': 24 * 60 * 60000,
//             '5days': 5 * 24 * 60 * 60000,
//             '1month': 30 * 24 * 60 * 60000,
//             '3months': 90 * 24 * 60 * 60000,
//             '6months': 180 * 24 * 60 * 60000,
//             '1year': 365 * 24 * 60 * 60000
//         };

//         startTime = new Date(now.getTime() - (timeRanges[time] || 0));
//         if (!timeRanges[time]) {
//             return res.status(400).json({ error: 'Invalid time parameter' });
//         }

//         // Convert bucket size to milliseconds based on unit
//         let bucketSize;
//         if (userBucketSize) {
//             const size = parseInt(userBucketSize);
//             if (isNaN(size) || size <= 0) {
//                 return res.status(400).json({ error: 'Invalid bucket size. Must be a positive number.' });
//             }

//             switch (bucketUnit) {
//                 case 'minute':
//                     bucketSize = size * 60 * 1000;
//                     break;
//                 case 'hour':
//                     bucketSize = size * 60 * 60 * 1000;
//                     break;
//                 case 'day':
//                     bucketSize = size * 24 * 60 * 60 * 1000;
//                     break;
//                 case 'week':
//                     bucketSize = size * 7 * 24 * 60 * 60 * 1000;
//                     break;
//                 case 'month':
//                     bucketSize = size * 30 * 24 * 60 * 60 * 1000;
//                     break;
//                 case 'year':
//                     bucketSize = size * 365 * 24 * 60 * 60 * 1000;
//                     break;
//                 default:
//                     bucketSize = size * 60 * 1000;
//             }

//             const timeRange = timeRanges[time];
//             const maxBuckets = 1000;
//             const minBucketSize = timeRange / maxBuckets;

//             if (bucketSize < minBucketSize) {
//                 const suggestedSize = Math.ceil(minBucketSize / (60 * 1000));
//                 return res.status(400).json({
//                     error: `Bucket size too small for selected time range. Minimum bucket size for ${time} is ${suggestedSize} minutes.`
//                 });
//             }
//         } else {
//             if (time === '5minutes') {
//                 bucketSize = 60 * 1000;
//             } else if (time === '30minutes') {
//                 bucketSize = 2 * 60 * 1000;
//             } else if (time === 'hour') {
//                 bucketSize = 5 * 60 * 1000;
//             } else if (time === '1day') {
//                 bucketSize = 15 * 60 * 1000;
//             } else {
//                 bucketSize = 60 * 60 * 1000;
//             }
//         }

//         const calculatePrice = async (trade) => {
//             let tokensObtained = await tokenAgainstSol(token_address, 1);
//             tokensObtained = tokensObtained?.tokenPriceInSol;
//             return tokensObtained;
//         };

//         // Fetch all trades (both buy and sell) within the time range
//         const allTrades = await Trade.find({
//             token_id: token_id,
//             created_at: { $gte: startTime, $lte: now }
//         }).sort({ created_at: 1 });

//         // Process trades and group by bucket
//         const tradeBuckets = new Map();
//         let lastKnownPrice = DEFAULT_PRICE;

//         // First get price for each trade and organize them into buckets
//         for (const trade of allTrades) {
//             const tradePrice = await calculatePrice(trade);
//             const bucketTime = new Date(
//                 Math.floor(trade.created_at.getTime() / bucketSize) * bucketSize
//             );
//             const bucketKey = bucketTime.getTime();

//             if (!tradeBuckets.has(bucketKey)) {
//                 tradeBuckets.set(bucketKey, {
//                     time: bucketTime.toISOString(),
//                     prices: [tradePrice],
//                     trades: [trade],
//                     volume: trade.amount || 0,
//                     buyCount: trade.type === 'buy' ? 1 : 0,
//                     sellCount: trade.type === 'sell' ? 1 : 0
//                 });
//             } else {
//                 const bucket = tradeBuckets.get(bucketKey);
//                 bucket.prices.push(tradePrice);
//                 bucket.trades.push(trade);
//                 bucket.volume += (trade.amount || 0);
//                 if (trade.type === 'buy') bucket.buyCount++;
//                 if (trade.type === 'sell') bucket.sellCount++;
//             }
//         }

//         // Create all time buckets from start to end
//         const graphData = [];
//         let currentBucketTime = new Date(startTime);

//         while (currentBucketTime <= now) {
//             const bucketKey = currentBucketTime.getTime();
//             const bucket = tradeBuckets.get(bucketKey);

//             if (bucket) {
//                 // We have trades in this bucket
//                 const prices = bucket.prices;
//                 const bucketData = {
//                     time: currentBucketTime.toISOString(),
//                     open: prices.length > 0 ? prices[0] : lastKnownPrice,
//                     high: prices.length > 0 ? Math.max(...prices) : lastKnownPrice,
//                     low: prices.length > 0 ? Math.min(...prices) : lastKnownPrice,
//                     close: prices.length > 0 ? prices[prices.length - 1] : lastKnownPrice,
//                     volume: bucket.volume,
//                     buyCount: bucket.buyCount,
//                     sellCount: bucket.sellCount,
//                     tradeCount: bucket.trades.length
//                 };

//                 lastKnownPrice = bucketData.close;
//                 graphData.push(bucketData);
//             } else {
//                 // No trades in this bucket, use last known price
//                 const bucketData = {
//                     time: currentBucketTime.toISOString(),
//                     open: lastKnownPrice,
//                     high: lastKnownPrice,
//                     low: lastKnownPrice,
//                     close: lastKnownPrice,
//                     volume: 0,
//                     buyCount: 0,
//                     sellCount: 0,
//                     tradeCount: 0
//                 };

//                 graphData.push(bucketData);
//             }

//             // Move to next bucket
//             currentBucketTime = new Date(currentBucketTime.getTime() + bucketSize);
//         }

//         return res.status(200).json({
//             status: 200,
//             data: graphData
//         });

//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ status: 500, error: error.message });
//     }
// };




//get the  king of hill progress
exports.getKingOfTheHillPercentage = async (token_address) => {

    try {

        const kingOfTheHill = await CoinCreated.findOne({ token_address: token_address })
        if (!kingOfTheHill) {
            throw ({ message: 'No King of the Hill found.' });
        }
        return kingOfTheHill.king_of_hill_percenatge;

    } catch (error) {
        console.error(error);
        throw error;
    }
};

function calculateProgress(currentTokenValue, minValue, maxValue) {

    const progress = ((currentTokenValue - minValue) / (maxValue - minValue)) * 100;
    return progress.toFixed(2); // Return the progress percentage as a string with 2 decimal places
}

//get data of coin and trade latest one
exports.getLatestTradeAndCoin = async (req, res) => {
    try {
        const { type } = req.params; // Extract the type (solana or ethereum) from the route parameter
        console.log("type", type)
        // Validate type
        if (!type || !['solana', 'ethereum', 'polygon', 'bsc', 'sepolia'].includes(type)) {
            return res.status(400).json({
                status: 400,
                message: "Invalid type. Please use 'solana' or 'ethereum'."
            });
        } let tradeNotification;

        const latestTrade = await Trade.findOne({ account_type: type })
            .sort({ created_at: -1 })
            .populate('token_id', 'image name ticker token_address')
            .populate({
                path: 'account',
                select: 'user_name profile_photo wallet_address',
                match: { wallet_address: { $elemMatch: { blockchain: type } } }
            })
            .exec();




        // Fetch the latest coin with populated user details
        const latestCoin = await CoinCreated.findOne({ coin_type: type })
            .sort({ time: -1 }) // Get the latest coin
            .populate({
                path: 'creator',
                select: 'user_name profile_photo wallet_address',
            })
            .exec();

        if (!latestTrade || !latestTrade.account) {
            tradeNotification = null;
        }
        // Prepare the trade notification format
        else {
            tradeNotification = {
                user_name: latestTrade.account?.user_name,
                action: `${latestTrade.type === "buy" ? "bought" : "sold"} ${latestTrade.amount} of ${latestTrade.token_id.name}`,
                coin_photo: latestTrade.token_id.image,
                user_image: latestTrade.account?.profile_photo,
                user_id: latestTrade.account?._id,
                token_address: latestCoin?.token_address,
                token_id: latestCoin?._id
            };
        }

        // Prepare the coin notification format
        const coinNotification = {
            user_name: latestCoin.creator.user_name,
            user_profile: latestCoin.creator?.profile_photo,
            user_id: latestCoin.creator?._id,
            action: `created ${latestCoin?.name}`,
            coin_photo: latestCoin?.image,
            date: latestCoin?.time,
            token_id: latestCoin?._id,
            ticker: latestCoin?.ticker,
            replies: 0, // Set to 0 or fetch actual replies count if needed
            token_address: latestCoin?.token_address
        };

        // Prepare the response data
        const response = {
            latestTrade: tradeNotification,
            latestCoin: coinNotification
        };

        return res.status(200).json({
            status: 200,
            message: `Latest trade and coin for type ${type} fetched successfully.`,
            data: response
        });
    } catch (error) {
        console.error(error);
        return res.status(200).json({ status: 500, error: error.message });
    }
};

//buy trade
exports.createBuyTrade = async (res, token_id, type, amount, account_type, token_amount, transaction_hash, account) => {
    try {

        const user = await User.findOne({ wallet_address: account });
        const token = await CoinCreated.findById(token_id);

        if (!user || !token) {
            return res.status(404).json({ message: 'User or Token not found.' });
        }

        const newTrade = new Trade({
            account: user._id,
            token_id: token_id,
            type: type,
            amount: amount,
            token_amount: token_amount,
            account_type: account_type,
            transaction_hash: transaction_hash
        });

        // Ensure max_supply is a valid number
        let supply = parseFloat(token.max_supply);
        if (isNaN(supply)) {
            return res.status(400).json({ message: 'Invalid token max_supply value.' });
        }
        const token_cap = await getTokenLargestAccounts(token.token_address);
        const marketCap = token_cap.market_cap;
        // Update total token supply
        if (type === 'buy') {
            supply += parseFloat(amount);
            if (marketCap == null) {
                marketCap = 0
                token.market_cap = marketCap;
            }
        }

        // Ensure the updated supply is a valid number
        if (isNaN(supply)) {
            return res.status(400).json({ message: 'Invalid updated token supply value.' });
        }

        token.max_supply = supply;  // Update the token's max_supply with the new supply value

        // Check if token reaches 50% threshold for King of the Hill
        const halfway_mark = 314.5e6; // 314.5 million tokens
        if (supply >= halfway_mark) {

            // Update King of the Hill
            token.is_king_of_the_hill.value = true;
            token.is_king_of_the_hill.time = Date.now();
            token.badge = true;
        } else {
            token.is_king_of_the_hill.value = false;
        }

        await newTrade.save();
        await token.save();  // Save the updated token with new supply

        user.trades.push(newTrade._id);
        // Check if coin is already held by user
        const coinIndex = user.coins_held.findIndex(coin => coin.coinId.toString() === token_id);
        if (coinIndex > -1) {
            // Coin already held, update the amount
            if (type === 'buy') {
                user.coins_held[coinIndex].amount += parseFloat(amount);
            }
        } else {
            // Coin not held, add new entry
            user.coins_held.push({ coinId: token_id, amount: type === 'buy' ? parseFloat(amount) : 0 });
        }

        await user.save();

        // Notify via Pusher
        const tradeNotification = {
            user_name: user.user_name,
            action: `${type} ${amount} Sol of ${token.name}`,
            coin_photo: token.image,
            token_address: token.token_address,
            user_image: user.profile_photo
        };
        pusher.trigger('trades-channel', 'trade-initiated', tradeNotification);

        return { error: false, message: 'Trade created successfully.' };
    } catch (error) {
        console.error(error);
        return { error: true, message: error.message };
    }
};
//pre launch trdae
exports.preLaunchTrade = async (req, res, user, token, type, amount, token_amount) => {
    if (type === 'buy' && token.timer > Date.now()) {
        const newBuyRequest = new buyers_requests({
            user_id: user._id,
            token_id: token._id,
            amount,
            token_amount,
            request_date: new Date(),
            status: 'pending'
        });

        await newBuyRequest.save();
        return res.status(200).json({ status: 200, message: 'Buy request submitted successfully.' });
    } else if (type === 'sell') {
        return res.status(200).json({ status: 401, message: 'You cannot sell this token during the pre-launch phase.' });
    }
};
//popst launch trade
exports.postLaunchTrade = async (req, res, user, token, type, account_type, amount, token_amount, transaction_hash, endpoint) => {
    let supply = token.max_supply;
    let token_address = token?.token_address;
    let bondingResult;
    //console.log("supply", supply, token?.token_address, account_type, token_amount)
    if (isNaN(supply)) {
        return res.status(400).json({ message: 'Invalid token max supply.' });
    }

    let token_cap;
    if (account_type === 'solana') {
        token_cap = await getTokenLargestAccounts(token_address, token_amount);
        const calculatePrice = async () => {
            const tokensObtained = await tokenAgainstSol(token_address, 1)
            return {
                tokenPrice: tokensObtained?.tokenPriceInSol,
                bondingCurveStatus: tokensObtained?.isComplete
            }
        };
        if (token_cap?.isComplete) {
            bondingResult = {
                bondingCurveStatus: token_cap?.isComplete,
                tokenPrice: 0.0000004109
            }
        } else {
            bondingResult = await calculatePrice();
        }



    }

    if (account_type === 'ethereum' || account_type === 'bsc' || account_type === 'polygon' || account_type === 'sepolia') {

        // console.log("papi", token_address, amount, account_type);
        token_cap = await marketCapPolygon(token_address, amount, account_type);


        bondingResult = await getPrice(token_address, 1, account_type);


    }

    // const marketCap = token_cap.market_cap;
    if (type === 'buy') {
        supply += parseFloat(amount);
        if (token_cap?.remaining_tokens <= 396550000) {
            token.is_king_of_the_hill.value = true;
            token.is_king_of_the_hill.time = Date.now();
            token.badge = true;
        } else {
            const minValue = 793100000; // 0% progress
            const maxValue = 396550000; // 100% progress
            const progress = calculateProgress(token_cap?.remaining_tokens, minValue, maxValue);
            console.log(`Progress: ${progress}%`);
            token.kingOfTheHill = progress;

        }
        // token.market_cap = marketCap;
    } else if (type === 'sell') {
        //console.log("type", type, token.max_supply, supply, amount, marketCap);
        token.max_supply = supply - parseFloat(amount);
        if (token.max_supply <= 0) {
            token.max_supply = 0;
        }
        // token.market_cap = marketCap;
        //console.log("marketCap", marketCap);
    }


    const newTrade = new Trade({
        account: user._id,
        token_id: token._id,
        type,
        amount,
        coin_price: bondingResult?.tokenPrice,
        token_amount: req.body.amount,
        account_type,
        transaction_hash: transaction_hash
    });

    if (account_type === 'solana') {
        //console.log("solana", bondingResult)
        if (bondingResult?.bondingCurveStatus) {
            token.is_shifted = "in-process";
            await token.save();
            //withdraw
            const withdraw_token = await withdraw(token_address);
            if (withdraw_token?.success) {
                const confirmation = await waitForTransactionFinalization(withdraw_token?.hash);
                if (confirmation) {
                    const response = await createPool(token_address);
                    if (response?.success) {
                        token.is_shifted = "shifted"
                        token.pool_id = response.poolId;
                    } else {
                        token.is_shifted = "failed"
                    }
                }


            }
            else {
                token.is_shifted = "failed"
            }

        }
    } else {
        if (bondingResult?.bondingCurveStatus !== 'false') {

            //do ethereum withdraw call here

            token.is_shifted = "in-process";
            await token.save();
            // get the token address
            //withdraw
            const withdraw_token = await withdrawEvmFunds(token_address);
            if (withdraw_token?.success) {
                const response = await addLiquidityWithETH(token_address)
                if (response?.success) {
                    token.is_shifted = "shifted"
                    token.pool_id = response.address;
                } else {
                    token.is_shifted = "failed"
                }

            }
            else {
                token.is_shifted = "failed"
            }

        }
    }


    await newTrade.save();
    await token.save();


    await updateUserHoldings(user, token, type, amount);

    triggerTradeNotification(user, token, type, amount, account_type);
    tradeNotificationPusher(user, token, type, amount);
    if (endpoint) {
        res.status(201).json({
            status: 201,
            message: 'Trade created successfully.',
            data: newTrade,
            token
        });
    } else {
        return { status: 201, message: 'Trade created successfully.', data: newTrade, token };
    }
};


// Update user's coin holdings
const updateUserHoldings = async (user, token, type, amount) => {
    const coinIndex = user.coins_held.findIndex(coin => coin.coinId.toString() === token._id.toString());
    if (coinIndex > -1) {
        // Update amount for existing holding
        if (type === 'buy') {
            user.coins_held[coinIndex].amount += parseFloat(amount);
        } else if (type === 'sell') {
            user.coins_held[coinIndex].amount = Math.max(0, user.coins_held[coinIndex].amount - parseFloat(amount));
        }
    } else {
        // Add new coin holding
        user.coins_held.push({ coinId: token._id, amount: type === 'buy' ? parseFloat(amount) : 0 });
    }
    await user.save();
};
// Trigger trade notifications
const triggerTradeNotification = (user, token, type, amount, account_type) => {
    const tradeNotification = {
        user_name: user.user_name,
        action: `${type === "buy" ? "bought" : "sold"} ${amount} Sol of ${token.name}`,
        coin_photo: token.image,
        token_address: token.token_address,
        token_id: token._id,
        user_image: user.profile_photo,
    };
    if (account_type === 'solana') {
        pusher.trigger('solana-trades-channel', 'solana-trade-initiated', tradeNotification);
    }
    else if (account_type === 'ethereum') {
        pusher.trigger('eth-trades-channel', 'eth-trade-initiated', tradeNotification);
    }
    else if (account_type === 'bsc') {
        pusher.trigger('bsc-trades-channel', 'bsc-trade-initiated', tradeNotification);
    }
    else if (account_type === 'polygon') {
        pusher.trigger('polygon-trades-channel', 'polygon-trade-initiated', tradeNotification);
    }
};
const tradeNotificationPusher = (user, token, type, amount) => {
    // 1. Retrieve Data Asynchronously (Assuming Async Operations)
    const promises = [
        this.getKingOfTheHillPercentage(token.token_address),
        this.getBondingCurveProgress(token.token_address),
        this.getTrades(token.id, 1, 3),
        topHolders(token.token_address)
    ];

    Promise.all(promises)
        .then(results => {
            const [koh_percentage, bonding_curve_percentage, latestTrades, topHolder] = results;

            // 2. Construct Notification Data
            const percentageData = {
                user_name: user.user_name,
                coin_photo: token.image,
                token_address: token.token_address,
                user_image: user.profile_photo,
                king_of_the_hill_per: koh_percentage,
                bonding_curve_percentage: bonding_curve_percentage,
                latestTrades: latestTrades,
                topHolders: topHolder
            };
            console.log("percentageData", percentageData)
            // 3. Trigger Pusher Notification
            pusher.trigger('percentage-chanel', 'new-percentage', percentageData);
        })
        .catch(error => {
            console.error('Error fetching data for notification:', error);
            // Implement error handling (e.g., fallback values, retry logic)
        });
};

exports.fetchLastestSolPriceInUsd = async (req, res) => {
    try {

        const price = await fetchSolPriceInUsd()
        return res.status(200).json({ status: 200, message: "price fetched successfully", data: price })


    } catch (error) {
        console.error(error);
        return res.status(200).json({ status: 500, error: error.message });
    }
};

exports.fetchLastestEthPriceInUsd = async (req, res) => {
    try {

        const price = await fetchEthPriceInUsd()
        return res.status(200).json({ status: 200, message: "price fetched successfully", data: price })


    } catch (error) {
        console.error(error);
        return res.status(200).json({ status: 500, error: error.message });
    }
};
const graphData = [];
const MIN_VALUE = 2.8e-8;
const MAX_VALUE = 4.1e-7;

function getRandomPrice(min, max) {
    return Math.random() * (max - min) + min;
}

function formatPrice(value) {
    return parseFloat(value.toFixed(9)); // Ensure only 2 to 3 decimal places
}

function generateNewData() {
    let lastClose = graphData.length > 0 ? graphData[graphData.length - 1].close : getRandomPrice(MIN_VALUE, MAX_VALUE);

    const open = formatPrice(lastClose);
    const high = formatPrice(Math.max(open, getRandomPrice(open, MAX_VALUE)));
    const low = formatPrice(Math.min(open, getRandomPrice(MIN_VALUE, open)));
    const close = formatPrice(getRandomPrice(low, high));

    const newData = {
        time: new Date().toISOString(),
        open,
        high,
        low,
        close
    };

    graphData.push(newData);
}

exports.getRandomGraphData = async (req, res) => {
    try {
        // console.log("hitting data")
        // const token_address = "0x3d40afa78da8acb77b5cee43dc622dccc724757b"
        // const withdraw_token = await withdrawEvmFunds(token_address);
        // console.log("withdraw_token", withdraw_token)
        // if (withdraw_token?.success) {
        //     const response = await addLiquidityWithETH(token_address)
        //     console.log("response", response)
        //     if (response?.success) {
        //         console.log("response", response)
        //     } else {

        //     }
        // }

        // const response = await addLiquidityWithETH("0x3d40afa78da8acb77b5cee43dc622dccc724757b")
        // console.log("response", response);
        // setTimeout(() => {
        //     generateNewData(); // Generate new data with a 1-second delay
        //     return res.status(200).json({
        //         status: 200,
        //         data: graphData
        //     });
        // }, 1000);
        // const yahoo = await getPrivateKey()
        // console.log("yahoo", yahoo)
        // const withdraw_token = await withdraw("9bQDrE7YLhsdYsuDuXVrsb1Z7ihsdS6B92D1Gztd1xzp");
        // console.log("with-draw-token", withdraw_token);
        // const withdraw_token = await withdraw("2T5X28K17D8pvHs4iPCWYuEArbjCzG3azaDCycfonU3F");
        // console.log("with-draw-token", withdraw_token);
    } catch (error) {
        console.error("errir in ciii", error);
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
};
