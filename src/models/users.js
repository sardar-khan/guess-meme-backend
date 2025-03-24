const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;
const CoinHeldSchema = new Schema({
    coinId: { type: String, ref: 'Coin', required: true },
    amount: { type: Number, required: true },
});

const UserSchema = new Schema({
    user_name: {
        type: String,
        unique: true,
        maxlength: 15
    },
    profile_photo: {
        type: String,
        default: '/uploads/0xD10FA29B5c9bF9158B7AfD907341Ba95707F61271742362707272group 159.png'
    },
    bio: {
        type: String,
        default: 'some bio'
    },
    wallet_address: [{
        blockchain: {
            type: String,
            required: true,
            enum: ['ethereum', 'tron', 'solana', 'polygon', 'sepolia', 'bsc']
        },
        address: {
            type: String,
            required: true
        }
    }],
    trust_score: {
        type: Number, default: 0
    },
    token: {
        type: String
    },
    instagram_link: { type: String, default: '' },
    x_link: { type: String, default: '' },
    coins_held: [CoinHeldSchema],
    trades: [{ type: Schema.Types.ObjectId, ref: 'Trade' }],
    coins_created: [{
        type: Schema.Types.ObjectId,
        ref: 'coin_created'
    }],
    followers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    unread_notifications: {
        type: Number,
        default: 0, // Default to 0 unread notifications
    },
    hide_followers: {
        type: Boolean,
        default: false,
    },
    hide_following: {
        type: Boolean,
        default: false,
    },
    hide_notification: {
        type: Boolean,
        default: false
    },
    hide_purchase: {
        type: Boolean,
        default: false
    },
    followers_count: { type: Number, default: 0 },
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

module.exports = User;

