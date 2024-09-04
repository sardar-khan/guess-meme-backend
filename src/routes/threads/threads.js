
const threadController = require('../../controllers/threads')
const express = require("express");
const auth = require("../../config/auth");
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/post', auth, upload.single('image'), threadController.createThread);
router.get('/view/:token_id', threadController.getThreads)
module.exports = router;
