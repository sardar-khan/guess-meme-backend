const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Define wallet address schema for consistency
const WalletAddressSchema = new mongoose.Schema({
    blockchain: {
        type: String,
        enum: ['ethereum', 'tron', 'solana'],
        required: true
    },
    address: {
        type: String,
        unique: true,
        required: true
    }
});

// Admin schema
const AdminSchema = new mongoose.Schema({
    admin_name: {
        type: String,
        unique: true,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    wallet_address: [WalletAddressSchema], // Add wallet addresses
    token: {
        type: String
    }
}, { timestamps: true });

// Hash password before saving
AdminSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

const Admin = mongoose.model('admin', AdminSchema);

module.exports = Admin;
