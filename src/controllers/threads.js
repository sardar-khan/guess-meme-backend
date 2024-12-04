const CoinCreated = require("../models/coin_created");
const Thread = require("../models/threads");
const User = require("../models/users");
const crypto = require('crypto');
const pusher = require('../config/pusher')
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
            // Send real-time notification using Pusher for replies
            const pusherData = {
                reply_id: newThread.reply_id,
                reply_text: newThread.text,
                parent_thread_id: parentThread.thread_id,
                user_name: user.user_name,
                created_at: newThread.createdAt,
            };

            pusher.trigger("threads-channel", "new-reply", pusherData);
            user.unread_notifications += 1;
            await user.save();  // Save the updated unread notification count
            console.log("Unread notifications count:", user.unread_notifications);
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
            .limit(limit)
            .populate({
                path: 'user_id', // Reference to the User model
                select: 'user_name profile_photo' // Fields to include
            });

        // Add total likes count for each thread
        const threadsWithLikes = threads.map(thread => ({
            ...thread.toObject(),
            totalLikes: thread.likes.length // Count the number of likes
        }));

        res.status(200).json({
            status: 200,
            message: 'Threads against given token.',
            data: threadsWithLikes,
            totalPages: Math.ceil(totalThreads / limit),
            currentPage: page
        });
    } catch (error) {
        console.error(`Error fetching threads: ${error.message}`);
        return res.status(500).json({ status: 500, error: error.message });
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
            return res.status(200).json({ status: 200, message: "Unlike successful.", like: false });
        } else {
            // Like the thread/reply
            thread.likes.push({ user_id: user.id });
            await thread.save();
            // Notify via Pusher (like event)
            pusher.trigger(`private-thread-${thread_id}`, 'like', {
                message: `${user.user_name} liked your thread.`,
                thread_id: thread_id,
                user_id: user.id,
            });
            user.unread_notifications += 1;
            await user.save();  // Save the updated unread notification count
            console.log("Unread notifications count:", user.unread_notifications);
            return res.status(200).json({ status: 200, message: "Like successful.", like: true });
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
        // Find the user by wallet address
        const user = await User.findOne({ 'wallet_address.address': wallet_address });
        if (!user) {
            return res.status(404).json({ status: 404, message: "User not found." });
        }

        // Find all threads where this user has liked
        const allThreads = await Thread.find({ 'likes.user_id': user.id })
            .populate({
                path: 'token_id',
                select: 'name image' // Include token details if available
            });
        const count = allThreads.reduce((sum, thread) => sum + thread.likes.length, 0);
        return res.status(200).json({
            status: 200,
            message: "User's likes retrieved successfully for all threads.",
            count,
            data: allThreads
        });
    } catch (error) {
        console.error(`Error fetching user's likes: ${error.message}`);
        return res.status(500).json({ message: "Something went wrong.", error: error.message });
    }
};

//view creator likes
exports.viewCreatorLikes = async (req, res) => {
    const wallet_address = req.user.address;

    try {
        const user = await User.findOne({ 'wallet_address.address': wallet_address });
        if (!user) {
            return res.status(404).json({ status: 404, message: "User not found." });
        }

        const likedThreads = await Thread.find({ user_id: user.id })
            .select('likes');
        // Calculate the total number of likes
        const count = likedThreads.reduce((sum, thread) => sum + thread.likes.length, 0);

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
//view mentiones 
exports.viewCreatorMentioned = async (req, res) => {
    const wallet_address = req.user.address;

    try {
        const user = await User.findOne({ 'wallet_address.address': wallet_address });
        if (!user) {
            return res.status(404).json({ status: 404, message: "User not found." });
        }

        const likedThreads = await Thread.find({ user_id: user.id })
            .select('replies');
        console.log("likedThreads", likedThreads)
        // Calculate the total number of likes
        const count = likedThreads.reduce((sum, thread) => sum + thread.replies.length, 0);

        return res.status(200).json({
            status: 200,
            message: "User's liked threads and replies.",
            count,
        });
    } catch (error) {
        console.error(`Error fetching user's likes: ${error.message}`);
        return res.status(500).json({ message: "Something went wrong.", error: error.message });
    }
};