const CoinCreated = require("../models/coin_created");
const Thread = require("../models/threads");
const User = require("../models/users");
const crypto = require('crypto');
const { generateId } = require("../services/threads/thread");

exports.createThread = async (req, res) => {
    const wallet_address = req.user.address;
    const { text, token_id, reply_id, image } = req.body;

    try {
        const user = await User.findOne({ 'wallet_address.address': wallet_address })
        if (!user) {
            return res.status(200).json({ status: 401, message: "Failed to post please connect your wallet" });
        }

        // Check if the token exists
        const token = await CoinCreated.findById(token_id);
        if (!token) {
            return res.status(200).json({ status: 404, message: 'Token not found.' });
        }
        const threadId = generateId();
        const newThread = new Thread({
            text: text,
            image: image,
            token_id: token_id,
            thread_id: threadId,
            reply_id: reply_id || null // Link to the parent thread if replying
        });
        await newThread.save();

        if (reply_id) {
            console.log("herrr");
            // Find the parent thread and update its replies
            const parentThread = await Thread.findOne({ reply_id });
            console.log("parentThread", parentThread)
            if (!parentThread) {
                return res.status(200).json({ status: 404, message: 'Parent thread not found.' });
            }
            parentThread.replies.push(newThread._id);
            await parentThread.save();
        }

        const user_name = user.user_name;
        const user_profile = user.profile_photo;

        return res.status(200).json({ status: 201, message: 'Thread created successfully.', data: newThread, user_name: user_name, profile: user_profile });
    } catch (error) {
        console.error(error);
        return res.status(200).json({ status: 500, error: error.message });
    }
};

exports.getThreads = async (req, res) => {
    const { token_id } = req.params;
    const page = parseInt(req.query.page) || 1; // Current page number, default is 1
    const limit = parseInt(req.query.limit) || 10; // Number of items per page, default is 10

    try {
        const totalThreads = await Thread.countDocuments({ token_id });

        const threads = await Thread.find({ token_id })
            .skip((page - 1) * limit)
            .limit(limit);

        res.status(200).json({
            status: 200,
            message: 'Threads against given token.',
            data: threads,
            totalPages: Math.ceil(totalThreads / limit),
            currentPage: page
        });

    } catch (error) {
        console.error(error);
        return res.status(200).json({ status: 500, error: error.message });
    }
};
