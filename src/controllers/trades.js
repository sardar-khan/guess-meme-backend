const CoinCreated = require("../models/coin_created");
const Trade = require("../models/trades");
const User = require("../models/users");
const pusher = require('../../src/config/pusher');
const { getTokenLargestAccounts, marketCapPolygon } = require("../web3/test");
const buyers_requests = require("../models/buyers_requests");
const { buyTokensOnBlockchain, getPrice } = require("../web3/tokens");
const { buyWithAddress, initializeUserATA } = require("../web3/solana/buyTokens");
const { buyOnTron } = require("../web3/tron/tronTrades");
const { mintaddy, wallet } = require('../web3/solana/config');
const { topHolders } = require("./users/users");
exports.createTrade = async (req, res) => {
    const { token_id, type, amount, account_type, token_amount, transaction_hash } = req.body;
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
        if (token.coin_status === false) {
            return this.preLaunchTrade(req, res, user, token, type, amount, token_amount);
        } else {
            console.log("here", token, type);

            return this.postLaunchTrade(req, res, user, token, type, amount, token_amount, account_type, transaction_hash);
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
};


//get the all trades aginst the token
exports.getTrades = async (token_id, page, limit) => {
    console.log("token_id", token_id)

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
        console.log("Hey token", token.max_supply)

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
        if (!type || !['solana', 'ethereum'].includes(type)) {
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

        console.log('kingOfTheHill', kingOfTheHill)
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


//get the  king of hill progress
exports.getKingOfTheHillPercentage = async (token_address) => {

    try {

        const kingOfTheHill = await CoinCreated.findOne({ token_address: token_address })
        if (!kingOfTheHill) {
            throw ({ message: 'No King of the Hill found.' });
        }
        console.log("kingOfTheHill.max_supply ", kingOfTheHill.max_supply)
        // Calculate the percentage for the King of the Hill
        let kingProgress = (kingOfTheHill.max_supply / 314500000000000) * 100;
        if (kingProgress > 100) {
            kingProgress = 100;
        }

        if (kingProgress < 0) {
            kingProgress = 0;
        }
        console.log("kingProgress", kingProgress.toFixed(18))
        return kingProgress.toFixed(18);

    } catch (error) {
        console.error(error);
        throw error;
    }
};

//get data of coin and trade latest one
exports.getLatestTradeAndCoin = async (req, res) => {
    try {
        const latestTrade = await Trade.findOne()
            .sort({ created_at: -1 }) // Sort by the most recent trade
            .populate('token_id', 'image name ticker token_address') // Assuming token_id refers to the coin
            .populate({
                path: 'account',
                select: 'user_name profile_photo'
                // Include additional user profile info
            })
            .exec();

        // Fetch the latest coin with populated user details
        const latestCoin = await CoinCreated.findOne()
            .sort({ time: -1 }) // Sort by the most recent coin creation
            .populate('creator', 'user_name profile_photo') // Include additional user profile info
            .exec();

        // Prepare the trade notification format
        const tradeNotification = {
            user_name: latestTrade.account.user_name,
            action: `${latestTrade.type} ${latestTrade.amount} of ${latestTrade.token_id.name}`,
            coin_photo: latestTrade.token_id.image,
            user_image: latestTrade.account.profile_photo,
            user_id: latestTrade.account._id
        };

        // Prepare the coin notification format
        const coinNotification = {
            user_name: latestCoin.creator.user_name,
            user_profile: latestCoin.creator.profile_photo,
            user_id: latestCoin.creator._id,
            action: `created ${latestCoin.name}`,
            coin_photo: latestCoin.image,
            date: latestCoin.time,
            token_id: latestCoin._id,
            ticker: latestCoin.ticker,
            replies: 0, // Set to 0 or fetch actual replies count if needed
            token_address: latestCoin.token_address
        };

        // Prepare the response data
        const response = {
            latestTrade: tradeNotification,
            latestCoin: coinNotification
        };

        return res.status(200).json({
            status: 200,
            message: 'Latest trade and coin fetched successfully.',
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
        console.log("test data", token_id, type, amount, account_type, token_amount, transaction_hash, account);

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

        console.log("before", supply);
        const token_cap = await getTokenLargestAccounts(token.token_address);
        const marketCap = token_cap.market_cap;
        // Update total token supply
        if (type === 'buy') {
            supply += parseFloat(amount);
            console.log("after buy", supply);
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
            console.log("after threshold", supply);

            // Update King of the Hill
            token.is_king_of_the_hill.value = true;
            token.is_king_of_the_hill.time = Date.now();
            token.badge = true;
        } else {
            token.is_king_of_the_hill.value = false;
        }

        await newTrade.save();
        await token.save();  // Save the updated token with new supply
        console.log("token", token.max_supply);

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
        console.log("initiated-noti", tradeNotification);
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
exports.postLaunchTrade = async (req, res, user, token, type, amount, account_type, token_amount, transaction_hash) => {

    let supply = token.max_supply;
    let token_address = token?.token_address;
    console.log("supply", supply, token?.token_address)
    if (isNaN(supply)) {
        return res.status(400).json({ message: 'Invalid token max supply.' });
    }

    let token_cap, token_price;
    if (account_type === 'solana') {
        token_cap = await getTokenLargestAccounts(token_address, token_amount);

        // const tokensObtained = 1073000191 - (32190005730 / (30 + token_amount)); // Bonding curve formula
        // token_price = token_amount / tokensObtained; // Calculate token price

    } if (account_type === 'ethereum' || account_type === 'bsc' || account_type === 'sepolia') {
        token_cap = await marketCapPolygon(token_address, token_amount);
        // const EthtokensObtained = await getPrice(token_address, token_amount);
        // token_price = EthtokensObtained;

    }
    const marketCap = token_cap.market_cap;
    if (type === 'buy') {
        console.log("buy")
        supply += parseFloat(amount);
        console.log("after buy", supply);
        token.market_cap = marketCap;
    } else if (type === 'sell') {
        token.max_supply = supply - parseFloat(amount);
        if (token.max_supply <= 0) {
            token.max_supply = 0;
        }
    }
    const newTrade = new Trade({
        account: user._id,
        token_id: token._id,
        type,
        amount,
        token_amount: req.body.amount,
        account_type,
        transaction_hash: transaction_hash
    });
    if (token.max_supply >= parseFloat(process.env.HALF_MARK)) {
        console.log("after threshold", supply);

        // Update King of the Hill
        token.is_king_of_the_hill.value = true;
        token.is_king_of_the_hill.time = Date.now();
        token.badge = true;
    } else {
        token.is_king_of_the_hill.value = false;
    }
    await newTrade.save();
    await token.save();


    await updateUserHoldings(user, token, type, amount);

    triggerTradeNotification(user, token, type, amount, account_type);
    tradeNotificationPusher(user, token, type, amount);

    return res.status(200).json({ status: 201, message: 'Trade created successfully.', data: newTrade, token });
};
//call from blockchain
const processBuy = async (req, res, token, amount, account_type) => {
    console.log("aara hn")
    let buyTokens, transactionHash, success, error;
    if (account_type === 'ethereum' || account_type === 'polygon') {
        buyTokens = await buyTokensOnBlockchain(token.token_address, amount);
        console.log("success", buyTokens.success,);
        transactionHash = buyTokens.transactionHash;
        success = buyTokens.success
        if (success == false) {
            return res.status(401).json({ status: 401, message: buyTokens.error })
        }
    } else if (account_type === 'solana') {
        console.log("solo")
        const userAta = await initializeUserATA(wallet.payer, token.token_address, mintaddy);
        buyTokens = await buyWithAddress(userAta);
        transactionHash = buyTokens.transactionHash;
        console.log("transactionHashin", transactionHash)
        success = buyTokens.success
        if (success == false) {
            return res.status(401).json({ status: 401, message: buyTokens.error })
        }
    }
    else if (account_type === 'tron') {
        console.log("tron")
        buyTokens = await buyOnTron(token.token_address, amount); // Assuming tron_address is provided
        transactionHash = buyTokens.transactionHash;
        success = buyTokens.success;
        if (success == false) {
            return res.status(401).json({ status: 401, message: buyTokens.error })
        }
    }

    return { transactionHash: transactionHash, success: success }
};

// Update market cap based on the blockchain type
const updateMarketCap = async (token, account_type) => {
    let marketCap;
    if (account_type === 'ethereum') {
        const token_cap = await getTokenLargestAccounts(token.token_address);
        marketCap = token_cap.market_cap;
    } else if (account_type === 'solana') {
        const token_cap = await marketCapPolygon(token.token_address);
        marketCap = token_cap.market_cap;
    }
    if (marketCap == NaN) {
        marketCap = 1
    }
    console.log("market cap", marketCap)
    return marketCap;
};

// Update user's coin holdings
const updateUserHoldings = async (user, token, type, amount) => {
    const coinIndex = user.coins_held.findIndex(coin => coin.coinId.toString() === token._id.toString());
    console.log("5");
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
    console.log("userr", user.coins_held);
    await user.save();
};
// Trigger trade notifications
const triggerTradeNotification = (user, token, type, amount, account_type) => {
    const tradeNotification = {
        user_name: user.user_name,
        action: `${type} ${amount} Sol of ${token.name}`,
        coin_photo: token.image,
        token_address: token.token_address,
        user_image: user.profile_photo,
    };
    if (account_type === 'solana') {
        pusher.trigger('solana-trades-channel', 'solana-trade-initiated', tradeNotification);
    }
    else if (account_type === 'ethereum' || account_type === 'polygon') {
        pusher.trigger('eth-trades-channel', 'eth-trade-initiated', tradeNotification);
    }
    else if (account_type === 'bsc') {
        pusher.trigger('bsc-trades-channel', 'bsc-trade-initiated', tradeNotification);
    }
    else if (account_type === 'sepolia') {
        pusher.trigger('sepolia-trades-channel', 'sepolia-trade-initiated', tradeNotification);
    }
};
const tradeNotificationPusher = (user, token, type, amount) => {
    // 1. Retrieve Data Asynchronously (Assuming Async Operations)
    const promises = [
        this.getKingOfTheHillPercentage(token.token_address),
        this.getBondingCurveProgress(token.token_address),
        this.getTrades(token.id),
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

            // 3. Trigger Pusher Notification
            pusher.trigger('percentage-chanel', 'new-percentage', percentageData);
        })
        .catch(error => {
            console.error('Error fetching data for notification:', error);
            // Implement error handling (e.g., fallback values, retry logic)
        });
};