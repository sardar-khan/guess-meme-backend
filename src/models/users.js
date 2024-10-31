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
        maxlength: 10
    },
    profile_photo: {
        type: String,
        default: 'https://ibb.co/7zrpRwk'
    },
    bio: {
        type: String,
        default: 'some bio'
    },
    wallet_address: [{
        blockchain: {
            type: String,
            required: true,
            enum: ['ethereum', 'tron', 'solana']
        },
        address: {
            type: String,
            required: true,
            unique: true
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
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

module.exports = User;

