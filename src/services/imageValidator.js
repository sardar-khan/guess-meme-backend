const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// SightEngine API credentials
const SIGHTENGINE_API_USER = process.env.SIGHTENGINE_API_USER
const SIGHTENGINE_API_SECRET = process.env.SIGHTENGINE_API_SECRET;

async function validateImageWithSightEngine(file) {
    try {
        console.log("hi")
        // Make sure we have a valid file object
        if (!file || !file.path) {
            throw new Error('Invalid file object');
        }

        // Verify the file exists before attempting to create a read stream
        try {
            await fs.promises.access(file.path);
        } catch (error) {
            console.error(`File does not exist at path: ${file.path}`);
            throw new Error(`File not found: ${file.path}`);
        }

        // Create form data for SightEngine API
        const form = new FormData();
        form.append('media', fs.createReadStream(file.path));
        form.append('api_user', SIGHTENGINE_API_USER);
        form.append('api_secret', SIGHTENGINE_API_SECRET);
        form.append('models', 'nudity-2.1,weapon,alcohol,recreational_drug,medical,properties,type,quality,offensive-2.0,faces,scam,text-content,face-attributes,gore-2.0,text,qr-content,tobacco,genai,violence,self-harm,money,gambling');

        // Make request to SightEngine API
        const response = await axios.post('https://api.sightengine.com/1.0/check.json', form, {
            headers: {
                ...form.getHeaders()
            }
        });

        // Process the response
        const result = response.data;


        const prob_score_per = 0.7; 5

        let isValid = true;
        let reason = [];

        // Check nudity
        if (result.nudity &&
            (result.nudity.mildly_suggestive > prob_score_per)) {
            isValid = false;
            reason.push('nudity');
        }

        // Check scam
        if (result.alcohol && result.alcohol.prob > prob_score_per) {
            console.log("alchol aa gya h")
            isValid = false;
            reason.push('alchol');
        }


        return {
            valid: isValid,
            reason: reason.length > 0 ? reason.join(',') : null,
            details: result
        };
    } catch (error) {
        console.error('Error validating image with SightEngine:', error);
        throw new Error('Image validation failed');
    }
}

module.exports = validateImageWithSightEngine;