const userController = require('../../controllers/users/users')
const express = require("express");
const auth = require("../../config/auth");
const router = express.Router();
const multer = require('multer');
const { getTokenAddressAndCurveAddress, getTokenLargestAccounts, marketCapPolygon } = require('../../web3/test');
const { getBondingCurve } = require('../../web3/tokens');
const upload = multer({ storage: multer.memoryStorage() });
//user registration
router.post('/register', userController.addWallets);
router.post('/edit-profile', auth, upload.single('profile_photo'), userController.updateUserProfile);
router.get('/logout', auth, userController.logout);
router.get('/view-profile', auth, userController.viewProfile);
//coins
router.get('/coins-holding', auth, userController.coinsHoldingByUser);
router.get('/coins-created', auth, userController.coinsCreatedByUser);
router.post('/held-coin', auth, userController.heldCoin);
router.post('/create-coin', auth, userController.createCoin);
router.get('/view-coins', userController.viewCoin);
router.get('/metadata/:coinId', userController.metadata)
//tokens
router.post('/view-token/:token_id', userController.viewCoinAginstId);
router.post('/token-details/:token_address', userController.viewCoinAginsAddress)
//holders
router.post('/top-holders',
    async (req, res) => {
        const { token_address } = req.body;

        try {
            const holders = userController.topHolders(token_address);
            return res.status(200).json({
                status: 200,
                message: 'Top holders fetched successfully.',
                data: (await holders).data
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ status: 500, error: error.message });

        }

    });
router.get('/user-profile', userController.viewUser);
//top three coins
router.get('/top-three-coins/:type', userController.topThreeCoins)
router.post('/toggle-follow', auth, userController.toggleFollow);
router.post('/check-follow', auth, userController.canFollow)
router.get('/notifications', auth, userController.getNotifications)
router.get('/token-address', getTokenAddressAndCurveAddress);
router.post('/market-cap', getTokenLargestAccounts);
router.post('/polygon/market-cap', marketCapPolygon)
router.get('/sol/marketcap', getTokenLargestAccounts)
//router
router.get("/get-bonding", getBondingCurve)
//add coin reviews 
router.post('/feedback', auth, userController.addReview)
//reset notification count
router.get('/reset-notification-count', auth, userController.markNotificationsAsRead)
module.exports = router;
