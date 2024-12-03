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
            user_id: user.id,
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
            .limit(limit).populate({
                path: 'user_id', // Reference to the User model
                select: 'user_name profile_photo' // Fields to include
            });

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

exports.toggleLike = async (req, res) => {
    const { thread_id } = req.body; // ID of the thread or reply
    const wallet_address = req.user.address;

    try {
        const user = await User.findOne({ 'wallet_address.address': wallet_address });
        if (!user) {
            return res.status(401).json({ status: 401, message: "Please connect your wallet to like/unlike." });
        }

        const thread = await Thread.findById(thread_id);
        if (!thread) {
            return res.status(404).json({ status: 404, message: "Thread or reply not found." });
        }

        // Check if the user has already liked the thread/reply
        const likeIndex = thread.likes.findIndex(like => like.user_id.toString() === user.id.toString());
        if (likeIndex !== -1) {
            // Unlike the thread/reply
            thread.likes.splice(likeIndex, 1);
            await thread.save();
            return res.status(200).json({ status: 200, message: "Unlike successful." });
        } else {
            // Like the thread/reply
            thread.likes.push({ user_id: user.id });
            await thread.save();
            return res.status(200).json({ status: 200, message: "Like successful." });
        }
    } catch (error) {
        console.error(`Error toggling like: ${error.message}`);
        return res.status(500).json({ status: 500, message: "Something went wrong.", error: error.message });
    }
};

//like status 
exports.checkLikeStatus = async (req, res) => {
    const { thread_id } = req.body; // Thread or Reply ID
    const wallet_address = req.user.address;

    try {
        const user = await User.findOne({ 'wallet_address.address': wallet_address });
        if (!user) {
            return res.status(404).json({ status: 404, message: "User not found." });
        }

        const thread = await Thread.findById(thread_id);
        if (!thread) {
            return res.status(404).json({ message: "Thread or reply not found." });
        }

        const liked = thread.likes.some(like => like.user_id.toString() === user.id.toString());

        return res.status(200).json({
            status: 200,
            message: liked ? "You have liked this thread/reply." : "You have not liked this thread/reply.",
            liked
        });
    } catch (error) {
        console.error(`Error checking like status: ${error.message}`);
        return res.status(500).json({ message: "Something went wrong.", error: error.message });
    }
};
//view user likes
exports.viewUserLikes = async (req, res) => {
    const wallet_address = req.user.address;

    try {
        const user = await User.findOne({ 'wallet_address.address': wallet_address });
        if (!user) {
            return res.status(404).json({ status: 404, message: "User not found." });
        }

        const likedThreads = await Thread.find({ 'likes.user_id': user.id })
            .select('text thread_id reply_id likes.createdAt')
            .populate({
                path: 'token_id',
                select: 'name image' // Include token details if available
            });

        const count = likedThreads.length;

        return res.status(200).json({
            status: 200,
            message: "User's liked threads and replies.",
            count,
            data: likedThreads
        });
    } catch (error) {
        console.error(`Error fetching user's likes: ${error.message}`);
        return res.status(500).json({ message: "Something went wrong.", error: error.message });
    }
};
