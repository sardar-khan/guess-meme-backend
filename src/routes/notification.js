const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationPusher');

router.post('/send-notification', notificationController.sendNotification);

module.exports = router;