const userController = require('../../controllers/users/users')
const express = require("express");
const auth = require("../../config/auth");
const router = express.Router();
const multer = require('multer');
const { getTokenAddressAndCurveAddress, getTokenLargestAccounts } = require('../../web3/test');
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
router.post('/view-token', userController.viewCoinAginstToken);
//holders
router.post('/top-holders', userController.topHolders);
router.get('/user-profile', userController.viewUser);

router.get('/token-address', getTokenAddressAndCurveAddress);
router.post('/market-cap', getTokenLargestAccounts);

//add coin reviews 
router.post('/feedback', auth, userController.addReview)
module.exports = router;
