const crypto = require('crypto');

function generateUsername(walletAddress) {
    // Hash the wallet address using SHA-256
    const hash = crypto.createHash('sha256').update(walletAddress).digest('hex').substring(0, 7);;

    // Convert the hash to a readable format (e.g., Base64)
    const base64Hash = Buffer.from(hash, 'hex').toString('base64');

    // Optionally, truncate or modify the hash to fit username requirements
    // For example, take the first 10 characters of the Base64 hash
    const username = base64Hash.substring(0, 10);

    return username;
}
module.exports = {
    generateUsername
}