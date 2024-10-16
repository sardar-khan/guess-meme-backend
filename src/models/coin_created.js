const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CoinCreatedSchema = new Schema({
    coinId: { type: String, ref: 'Coin' },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    ticker: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    twitter_link: { type: String, default: '' },
    telegram_link: { type: String, default: '' },
    bonding_curve: { type: String },
    market_cap: { type: Number, default: 0 },
    website: { type: String, default: '' },
    token_address: { type: String },
    max_supply: { type: Number, required: true },
    max_buy_percentage: { type: Number },
    bonding_curve: { type: String },
    bonding_curve_progress: { type: Number, default: 0 }, // In percentage
    is_king_of_the_hill: {
        time: { type: Date, default: null },
        value: { type: Boolean, default: false }
    },
    badge: { type: Boolean, default: false },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    timer: { type: Date },
    coin_status: { type: Boolean, default: false },
    time: { type: Date, default: Date.now },
    status: { type: String, enum: ['created', 'deployed'] },
    is_created: { type: Boolean },
    reviews: [{
        user: String,
        rating: Number,
        comment: String,
    },
    ], default: [],
});

const CoinCreated = mongoose.model('coin_created', CoinCreatedSchema);

module.exports = CoinCreated;
