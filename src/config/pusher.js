const Pusher = require('pusher');
const dotenv = require('dotenv');
dotenv.config();
const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true,
    timeout: 30000, // Increase timeout to 30 seconds

});

module.exports = pusher;