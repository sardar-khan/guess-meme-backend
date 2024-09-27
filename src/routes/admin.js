const express = require('express');
const router = express.Router();
const adminCOntroller = require('../controllers/users/admin');
const auth = require("../config/auth");
// Admin signup route
router.post('/signup', adminCOntroller.adminSignup);
// Admin signin route
router.post('/signin', adminCOntroller.adminSignin);
//admin view deployment requets
router.get('/coin-deployment-requests', auth, adminCOntroller.viewCoinDeploymentRequests)
//admin deploy coin
router.post('/deploy-coin', auth, adminCOntroller.deployCoin)
module.exports = router;
