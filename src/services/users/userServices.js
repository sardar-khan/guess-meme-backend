const crypto = require('crypto');

function generateUsername(walletAddress, blockchain) {
    // Hash the wallet address using SHA-256
    const combinedString = `${walletAddress}:${blockchain}`;

    // Hash the combined string using SHA-256
    const hash = crypto.createHash('sha256').update(combinedString).digest('hex');
    // Convert the hash to a readable format (e.g., Base64)
    const base64Hash = Buffer.from(hash, 'hex').toString('base64');

    // Optionally, truncate or modify the hash to fit username requirements
    // For example, take the first 10 characters of the Base64 hash
    const username = base64Hash.substring(0, 15);

    return username;
}
module.exports = {
    generateUsername
}