
const threadController = require('../../controllers/threads')
const express = require("express");
const auth = require("../../config/auth");
const router = express.Router();
const multer = require('multer');
router.post('/post', auth, threadController.createThread);
router.get('/view/:token_id', threadController.getThreads)
module.exports = router;
