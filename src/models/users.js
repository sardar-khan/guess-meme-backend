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
        default: 'http://13.60.36.211:5000/uploads/0x76399c8A5027fD58A1D1b07500ccC8a223BEE0c31739357237108defaultguessmeme.png'
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
    followers_count: { type: Number, default: 0 },
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

module.exports = User;

