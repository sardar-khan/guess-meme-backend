const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BuyRequestSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    token_id: {
        type: Schema.Types.ObjectId,
        ref: 'CoinCreated',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    token_amount: {
        type: Number,
        required: true
    },
    transaction_hash: {
        type: String
    },
    request_date: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
});

module.exports = mongoose.model('buy_requests', BuyRequestSchema);
