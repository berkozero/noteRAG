const fs = require('fs');
require('dotenv').config();

// Read the manifest template
const manifestTemplate = require('./manifest.template.json');

// Replace the client ID with the one from environment variables
manifestTemplate.oauth2.client_id = process.env.GOOGLE_CLIENT_ID;

// Write the new manifest
fs.writeFileSync(
    'manifest.json',
    JSON.stringify(manifestTemplate, null, 2)
);

console.log('manifest.json created successfully!'); 