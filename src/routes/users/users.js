const userController = require('../../controllers/users/users')
const express = require("express");
const auth = require("../../config/auth");
const router = express.Router();
const multer = require('multer');
const { getTokenAddressAndCurveAddress, getTokenLargestAccounts } = require('../../controllers/web3/test');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/signup', userController.createUser);
router.post('/edit-profile', auth, upload.single('profile_photo'), userController.updateUserProfile);
router.get('/logout', auth, userController.logout);
router.get('/view-profile', auth, userController.viewProfile);
router.get('/coins-holding', auth, userController.coinsHoldingByUser);
router.get('/coins-created', auth, userController.coinsCreatedByUser);
router.post('/held-coin', auth, userController.heldCoin);
router.post('/create-coin', auth, userController.createCoin);
router.get('/view-coins', userController.viewCoin);
router.post('/view-token', userController.viewCoinAginstToken);
router.post('/top-holders', userController.topHolders);
router.get('/user-profile', userController.viewUser);

router.get('/token-address', getTokenAddressAndCurveAddress);
router.post('/market-cap', getTokenLargestAccounts)
module.exports = router;
