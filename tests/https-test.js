/**
 * HTTPS connection test for Node.js
 * 
 * This script tests the direct HTTPS connection to our server using Node.js.
 * Run with: node tests/https-test.js
 */

// Require the https module
const https = require('https');

// HTTPS connection configuration
const HTTPS_CONFIG = {
  protocol: 'https',
  host: 'localhost',
  port: 3443
};

// Test the connection
console.log(`🔍 Testing HTTPS connection to: ${HTTPS_CONFIG.protocol}://${HTTPS_CONFIG.host}:${HTTPS_CONFIG.port}/health`);

// Create an HTTPS request
const req = https.request({
  hostname: HTTPS_CONFIG.host,
  port: HTTPS_CONFIG.port,
  path: '/health',
  method: 'GET',
  rejectUnauthorized: false  // Ignore self-signed certificate errors
}, (res) => {
  console.log(`🔄 Status: ${res.statusCode}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ HTTPS connection successful!');
      console.log('Response:', JSON.parse(data));
    } else {
      console.log(`❌ HTTPS connection failed with status: ${res.statusCode}`);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ HTTPS connection error:', error.message);
  console.error('Make sure the server is running with: python server_manager.py start --https');
});

// End the request
req.end(); 