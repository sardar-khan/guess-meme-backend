const express = require('express');
const router = express.Router();
const tradeController = require('../../controllers/trades');
const auth = require('../../config/auth');

// Create a new trade
router.post('/initiate', auth, tradeController.createTrade);
router.get('/view/:token_id', async (req, res) => {
    const { token_id } = req.params;
    console.log("token_id", token_id)
    const { page = 1, limit = 10 } = req.query; // Default values if not provided
    try {
        const trades = tradeController.getTrades(token_id, page, limit);
        return res.status(200).json({
            status: 200,
            message: 'Trades fetched successfully.',
            data: (await trades).data,
            totalTrades: (await trades).totalTrades,
            currentPage: (await trades).currentPage,
            totalPages: Math.ceil((await trades).totalTrades / limit),

        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
});
router.get('/creator-trade/:token_id/:creator_id', tradeController.getUserTradeSummary)
router.get('/coin_of_hill/:type', tradeController.getKingOfTheHill);
router.post('/king-of-hill-progress', async (req, res) => {
    const tokenAddress = req.body.token_address;

    try {
        const percentage = await tradeController.getKingOfTheHillPercentage(tokenAddress);
        return res.status(200).json({
            status: 200,
            message: 'King of the Hill fetched successfully.',
            data: {
                token_address: tokenAddress,
                king_progress: percentage
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
});
router.post('/progress-curve-bond', async (req, res) => {
    const tokenAddress = req.body.token_address;

    try {
        const percentage = await tradeController.getBondingCurveProgress(tokenAddress);
        return res.status(200).json({
            status: 200,
            message: 'Bonding curve progress fetched successfully.',
            data: {
                token_address: tokenAddress,
                progress: percentage
            }
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: error.message });
    }
});
router.get('/graph-data', tradeController.getGraphDataa);
router.get('/lastest-data/:type', tradeController.getLatestTradeAndCoin);
router.get('/graph-random-data', tradeController.getRandomGraphData);
router.get('/get-sol-price-in-usd', tradeController.fetchLastestSolPriceInUsd)
router.get('/get-eth-price-in-usd', tradeController.fetchLastestEthPriceInUsd)
module.exports = router;