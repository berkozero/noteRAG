/**
 * Manual HTTPS connection test script
 * 
 * This script tests the direct HTTPS connection to our server.
 * Run with: node tests/manual-https-test.js
 */

// HTTPS connection configuration
const HTTPS_CONFIG = {
  protocol: 'https',
  host: 'localhost',
  port: 3443
};

// Test URL
const testUrl = `${HTTPS_CONFIG.protocol}://${HTTPS_CONFIG.host}:${HTTPS_CONFIG.port}/health`;

// Global process.env settings for Node.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore self-signed certificate errors

// Perform the test
async function testHttpsConnection() {
  console.log(`🔍 Testing direct HTTPS connection to: ${testUrl}`);
  
  try {
    const response = await fetch(testUrl);
    
    if (response.ok) {
      console.log('✅ HTTPS connection successful!');
      const data = await response.json();
      console.log('Response:', data);
    } else {
      console.log(`❌ HTTPS connection failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ HTTPS connection error:', error.message);
    console.error('Make sure the server is running with: python server_manager.py start --https');
  }
}

// Run the test
testHttpsConnection(); 