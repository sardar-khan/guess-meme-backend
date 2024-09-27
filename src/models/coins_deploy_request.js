const mongoose = require('mongoose');

const coin_deployment_schema = new mongoose.Schema({
    coin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CoinCreated', required: true }, // Reference to the coin being deployed
    user_address: { type: String, required: true },
    fee: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    admin_response: { type: String, default: '' }, // Optional field for admin comments
},
    {
        timestamps: true
    });

const CoinDeploymentRequest = mongoose.model('coin_deployment_request', coin_deployment_schema);

module.exports = CoinDeploymentRequest;
