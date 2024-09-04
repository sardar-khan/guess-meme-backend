const crypto = require('crypto');
function generateId() {
    // Generate a random byte string
    const randomBytes = crypto.randomBytes(4).toString('hex');
    // Prefix with '#' and return
    return '#' + randomBytes;
}
module.exports = {
    generateId
}