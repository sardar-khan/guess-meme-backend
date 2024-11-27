const express = require('express');
const router = express.Router();
const tradeController = require('../../controllers/trades');
const auth = require('../../config/auth');

// Create a new trade
router.post('/initiate', auth, tradeController.createTrade);
router.get('/view/:token_id', tradeController.getTrades)
router.get('/coin_of_hill/:type', tradeController.getKingOfTheHill);
router.post('/king-of-hill-progress', tradeController.getKingOfTheHillPercentage)
router.post('/progress-curve-bond', tradeController.getBondingCurveProgress);
router.get('/graph-data', tradeController.getGraphData);
router.get('/lastest-data', tradeController.getLatestTradeAndCoin)
module.exports = router;