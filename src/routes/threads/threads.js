
const threadController = require('../../controllers/threads')
const express = require("express");
const auth = require("../../config/auth");
const router = express.Router();
const multer = require('multer');
router.post('/post', auth, threadController.createThread);
router.get('/view/:token_id', threadController.getThreads);
router.post('/toggle-like', auth, threadController.toggleLike);
router.post('/check-like-status', auth, threadController.checkLikeStatus);
router.get('/user-likes', auth, threadController.viewUserLikes)
module.exports = router;
