const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ThreadSchema = new Schema({
    token_id: { type: Schema.Types.ObjectId, ref: 'coin_created', required: true },
    text: { type: String, required: true },
    thread_id: { type: String, required: true, unique: true },
    reply_id: { type: String, default: null },
    image: {
        type: String,
        default: null
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    replies: [{ type: Schema.Types.ObjectId, ref: 'Thread' }] // Array of nested threads (replies)
});

const Thread = mongoose.model('thread', ThreadSchema);
module.exports = Thread;
