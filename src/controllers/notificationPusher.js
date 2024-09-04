const pusher = require('../config/pusher');

exports.sendNotification = async (req, res) => {
    try {
        const { channel, event, message } = req.body; // Assuming channel, event, and message are sent in the request body

        // Trigger the notification
        pusher.trigger(channel, event, {
            message: message
        });

        return res.status(200).json({ status: 200, message: 'Notification sent successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, error: 'An error occurred while sending the notification' });
    }
};