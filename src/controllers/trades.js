const CoinCreated = require("../models/coin_created");
const Trade = require("../models/trades");
const User = require("../models/users");
const pusher = require('../../src/config/pusher');
const { getTokenLargestAccounts, marketCapPolygon } = require("../web3/test");
const buyers_requests = require("../models/buyers_requests");
const { buyTokensOnBlockchain } = require("../web3/tokens");
const { buyWithAddress } = require("../web3/solana/buyTokens");
const { buyOnTron } = require("../web3/tron/tronTrades");
exports.createTrade = async (req, res) => {
    const { token_id, type, amount, account_type, token_amount } = req.body;
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
            console.log("here");
            return this.postLaunchTrade(req, res, user, token, type, amount, account_type);
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
};


//get the all trades aginst the token
exports.getTrades = async (req, res) => {
    const { token_id } = req.params;
    console.log("token_id", token_id)
    const { page = 1, limit = 10 } = req.query; // Default values if not provided

    try {
        const trades = await Trade.find({ token_id })
            .populate('account', 'user_name profile_photo')
            .populate('token_id', 'name ticker description image')
            .skip((page - 1) * limit) // Skip the trades of previous pages
            .limit(parseInt(limit)); // Limit the number of trades to fetch

        const totalTrades = await Trade.countDocuments({ token_id }); // Total number of trades for the token

        if (!trades.length) {
            return res.status(404).json({ message: 'No trades found for this token.' });
        }

        return res.status(200).json({
            status: 200,
            message: 'Trades fetched successfully.',
            data: trades,
            currentPage: page,
            totalPages: Math.ceil(totalTrades / limit),
            totalTrades: totalTrades
        });
    } catch (error) {
        console.error(error);
        return res.status(200).json({ status: 500, error: error.message });
    }
};

//fgwfggfe
exports.getBondingCurveProgress = async (req, res) => {
    const { token_address } = req.body;

    try {
        const token = await CoinCreated.findOne({ token_address });

        if (!token) {
            return res.status(404).json({ message: 'Token not found.' });
        }
        console.log("Hey token", token.max_supply)

        let progress = (token.max_supply / 629000000000000) * 100;  // Bonding curve progress in percentage
        if (progress > 100) {
            progress = 100;
        }
        if (progress < 0) {
            progress = 0;
        }
        const progressPercentage = progress.toFixed(18);
        return res.status(200).json({
            status: 200,
            message: 'Bonding curve progress fetched successfully.',
            data: {
                token_address: token.token_address,
                progress: progressPercentage
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
};

//get the coin of hill
exports.getKingOfTheHill = async (req, res) => {
    try {
        const kingOfTheHill = await CoinCreated.findOne({ 'is_king_of_the_hill.value': true })
            .sort({ 'is_king_of_the_hill.time': -1 });;

        if (!kingOfTheHill) {
            return res.status(404).json({ message: 'No King of the Hill found.' });
        }
        const user_data = await User.findById(kingOfTheHill.creator)

        return res.status(200).json({
            status: 200,
            message: 'King of the Hill fetched successfully.',
            data: {
                kingOfTheHill,
                user_profile: user_data.profile_photo,
                user_name: user_data.user_name,
                user_id: user_data._id
            }

        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
};


//graph data 
exports.getGraphData = async (req, res) => {
    try {
        const { token_id } = req.query;

        // Validate input
        if (!token_id) {
            return res.status(400).json({ error: 'token_id is required' });
        }


        // Get the current date and the start of the year
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        // Query trades within the specified date range
        const trades = await Trade.find({
            token_id: token_id,

            created_at: { $gte: startOfYear, $lte: now }
        }).sort({ created_at: 1 });

        // Check if trades are available
        if (trades.length === 0) {
            return res.status(404).json({ error: 'No trades found for the specified token and date range' });
        }

        // Process trades to calculate daily statistics
        const dailyData = {};

        trades.forEach(trade => {
            const date = trade.created_at.toISOString().split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = {
                    open: trade.amount,
                    high: trade.amount,
                    low: trade.amount,
                    close: trade.amount
                };
            } else {
                dailyData[date].high = Math.max(dailyData[date].high, trade.amount);
                dailyData[date].low = Math.min(dailyData[date].low, trade.amount);
                dailyData[date].close = trade.amount;
            }
        });

        // Ensure opening price is correctly set for each day
        const result = Object.keys(dailyData).map(date => ({
            time: date,
            open: dailyData[date].open,
            high: dailyData[date].high,
            low: dailyData[date].low,
            close: dailyData[date].close
        }));

        return res.json({
            status: 200,
            data: result
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
};



//get the  king of hill progress
exports.getKingOfTheHillPercentage = async (req, res) => {
    try {
        const { token_address } = req.body;
        const kingOfTheHill = await CoinCreated.findOne({ token_address: token_address })
        if (!kingOfTheHill) {
            return res.status(404).json({ message: 'No King of the Hill found.' });
        }

        // Calculate the percentage for the King of the Hill
        let kingProgress = (kingOfTheHill.max_supply / 314500000000000) * 100;
        if (kingProgress > 100) {
            kingProgress = 100;
        }

        if (kingProgress < 0) {
            kingProgress = 0;
        }
        kingProgress = kingProgress.toFixed(18);

        return res.status(200).json({
            status: 200,
            message: 'King of the Hill fetched successfully.',
            data: {
                token_address: kingOfTheHill.token_address,
                king_progress: kingProgress
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
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
            token.market_cap = marketCap;
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
exports.postLaunchTrade = async (req, res, user, token, type, amount, account_type) => {
    let supply = parseFloat(token.max_supply);
    if (isNaN(supply)) {
        return res.status(400).json({ message: 'Invalid token max supply.' });
    }

    const newTrade = new Trade({
        account: user._id,
        token_id: token._id,
        type,
        amount,
        token_amount: req.body.token_amount,
        account_type,
        transaction_hash: null
    });

    await newTrade.save();

    let transactionHash = null;
    if (type === 'buy') {
        console.log("her3")
        transactionHash = await processBuy(req, res, token, amount, account_type);
        token.max_supply = supply + parseFloat(amount);
    } else if (type === 'sell') {
        token.max_supply = supply - parseFloat(amount);
        if (token.max_supply < 0) token.max_supply = 0;
    }

    // token.market_cap = await updateMarketCap(token, account_type);
    await token.save();

    newTrade.transaction_hash = transactionHash;
    await updateUserHoldings(user, token, type, amount);

    triggerTradeNotification(user, token, type, amount);

    return res.status(200).json({ status: 201, message: 'Trade created successfully.', data: newTrade });
};
//call from blockchain
const processBuy = async (req, res, token, amount, account_type) => {
    let buyTokens, transactionHash, success, error;
    if (account_type === 'ethereum') {
        buyTokens = await buyTokensOnBlockchain(token.token_address, amount);
        console.log("success", buyTokens.success,);
        transactionHash = buyTokens.transactionHash;
        success = buyTokens.success
        if (success == false) {
            return res.status(401).json({ status: 401, message: buyTokens.error })
        }
    } else if (account_type === 'solana') {
        buyTokens = await buyWithAddress(token.token_address);
        transactionHash = buyTokens.transactionHash;
        success = buyTokens.success
    }
    else if (account_type === 'tron') {
        buyTokens = await buyOnTron(token.tron_address, amount); // Assuming tron_address is provided
        transactionHash = buyTokens.transactionHash;
        success = buyTokens.success;
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

    await user.save();
};
// Trigger trade notifications
const triggerTradeNotification = (user, token, type, amount) => {
    const tradeNotification = {
        user_name: user.user_name,
        action: `${type} ${amount} Sol of ${token.name}`,
        coin_photo: token.image,
        token_address: token.token_address,
        user_image: user.profile_photo,
    };

    pusher.trigger('trades-channel', 'trade-initiated', tradeNotification);
};