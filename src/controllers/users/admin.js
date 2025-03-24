const Admin = require("../../models/admin");
const jwt = require("jsonwebtoken");
const CoinDeploymentRequest = require("../../models/coins_deploy_request");
const bcrypt = require('bcrypt');
const CoinCreated = require("../../models/coin_created");
const { deployTokenOnBlockchain } = require("../../web3/tokens");
const { wallet } = require("../../web3/solana/config");
//signup
exports.adminSignup = async (req, res) => {
    const { admin_name, email, password, wallet_address } = req.body;

    try {
        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email });

        if (existingAdmin) {
            return res.status(400).json({ message: 'Admin already exists' });
        }

        // Create new admin
        const newAdmin = new Admin({
            admin_name,
            email,
            password,
            wallet_address // Add wallet address to the admin data
        });

        // Save new admin to the database
        await newAdmin.save();

        // Create JWT token
        const token = jwt.sign(
            { admin_id: newAdmin._id, email },
            process.env.TOKEN_KEY,
            { expiresIn: "1d" }
        );

        // Save token
        newAdmin.token = token;
        await newAdmin.save();

        // Return success response with admin data
        return res.status(201).json({
            message: "Admin registered successfully",
            admin: { id: newAdmin._id, admin_name, email, wallet_address, token }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};
//login
exports.adminSignin = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if the admin exists
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(400).json({ message: 'Admin not found' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        // Create new token
        const token = jwt.sign(
            { admin_id: admin._id, email },
            process.env.TOKEN_KEY,
            { expiresIn: "1d" }
        );

        // Save new token to the admin document
        admin.token = token;
        await admin.save();

        // Return success response with admin data
        return res.status(200).json({
            message: "Admin signed in successfully",
            admin: { id: admin._id, admin_name: admin.admin_name, email, token }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};
//view request of deployments
exports.viewCoinDeploymentRequests = async (req, res) => {
    const email = req.user.email;
    try {
        const admin = await Admin.findOne({ email: email });
        if (!admin) {
            return res.status(200).json({ status: 200, message: "Unauthorized User only admin can view this" });
        }
        // Fetch all coin deployment requests
        const deploymentRequests = await CoinDeploymentRequest.find().sort({ createdAt: -1 });

        // Send a response with the deployment requests
        return res.status(200).json({
            status: 200,
            message: "Coin deployment requests fetched successfully",
            data: deploymentRequests
        });
    } catch (error) {
        console.error(error);
        return res.status(200).json({
            status: 500,
            message: "Error fetching coin deployment requests",
            error: error.message
        });
    }
};
//deploy the coin 
exports.deployCoin = async (req, res) => {
    const email = req.user.email;
    try {
        const admin = await Admin.findOne({ email: email });
        if (!admin) {
            return res.status(200).json({ status: 200, message: "Unauthorized User only admin can view this" });
        }
        const { coin_id } = req.body;
        const deployment_request = await CoinDeploymentRequest.findOne({ coin_id: coin_id });
        if (!deployment_request) {
            return res.status(200).json({ status: 401, message: 'Request is not found' })
        }
        // else if (deployment_request.status == 'approved') {
        //     return res.status(200).json({ status: 401, message: 'This token already deployed' })
        // }
        else {
            const token = await CoinCreated.findById(coin_id);
            if (!token) {
                return res.status(200).json({ status: 401, message: 'Coin not found.' });
            }
            //call the smart contract fucntion deploy or create token 
            const tokenData = {
                name: token.name,
                symbol: 'ST',
                totalSupply: token.max_supply,
            };
            const txHash = await deployTokenOnBlockchain(tokenData); // Deploy token via smart contract
            console.log('Token deployed, transaction hash:', txHash);
            token.status = 'deployed';
            token.transaction_hash = txHash.hash;
            token.token_address = txHash.token_address
            await token.save();
            deployment_request.status = 'approved';
            await deployment_request.save();
            return res.status(200).json({ status: 200, message: 'Token successfully deployed.', transactionHash: txHash });

        }
    } catch (error) {

    }
}
//ftech admin token addresses
exports.fetchAddresses = async (req, res) => {
    const { type } = req.params;
    try {
        let admin_address;
        if (type == 'solana') {
            admin_address = wallet.publicKey.toBase58()
        }
        else if (type === 'ethereum') {
            admin_address = process.env.WALLET_ADDRESS;
        }
        return res.status(200).json({ status: 200, message: `admin address of type: ${type}`, address: admin_address })
    } catch (error) {
        console.error(error);
        return res.status(200).json({
            status: 500,
            message: "Error fetching coin deployment requests",
            error: error.message
        });
    }
}