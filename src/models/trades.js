const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TradeSchema = new Schema({
    account: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token_id: { type: Schema.Types.ObjectId, ref: 'coin_created', required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['buy', 'sell'] },
    token_amount: { type: String, required: true },
    account_type: { type: String, required: true },
    transaction_hash: { type: String },
    total_token_supply: { type: Number, default: 0 },
    reserve_balance: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const Trade = mongoose.model('Trade', TradeSchema);

module.exports = Trade;
