/**
 * HTTPS Connection Test
 * 
 * This script tests the connection to our HTTPS server.
 * Run with: node tests/test-https-connection.js
 */

// Disable certificate validation for self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Fetch API is not available in Node.js by default
const https = require('https');

// HTTPS connection configuration
const config = {
  protocol: 'https',
  host: 'localhost',
  port: 3444
};

// Test endpoints
const endpoints = [
  '/health',
  '/api/notes',
  '/api/query?q=test'
];

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

console.log(`${colors.blue}=== HTTPS Connection Test ===\n${colors.reset}`);
console.log(`Testing connection to: ${colors.yellow}${config.protocol}://${config.host}:${config.port}${colors.reset}\n`);

// Test all endpoints
let completedTests = 0;
let successfulTests = 0;

// First test the base URL
testEndpoint('/');

// Then test each specific endpoint
endpoints.forEach(endpoint => {
  testEndpoint(endpoint);
});

/**
 * Test a specific endpoint
 * @param {string} endpoint - The endpoint to test
 */
function testEndpoint(endpoint) {
  const url = `${config.protocol}://${config.host}:${config.port}${endpoint}`;
  console.log(`Testing: ${colors.yellow}${url}${colors.reset}`);
  
  const req = https.get(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      completedTests++;
      
      if (res.statusCode === 200) {
        successfulTests++;
        console.log(`${colors.green}✓ Success${colors.reset} - Status: ${res.statusCode}`);
        try {
          // Try to parse as JSON
          const jsonData = JSON.parse(data);
          console.log('Response:', jsonData);
        } catch (e) {
          // If not JSON, show truncated response
          console.log(`Response: ${data.substring(0, 100)}${data.length > 100 ? '...' : ''}`);
        }
      } else {
        console.log(`${colors.red}✗ Failed${colors.reset} - Status: ${res.statusCode}`);
        console.log(`Response: ${data}`);
      }
      
      console.log(); // Empty line for readability
      
      // If all tests are done, print summary
      if (completedTests === endpoints.length + 1) {
        printSummary();
      }
    });
  });
  
  req.on('error', (error) => {
    completedTests++;
    console.log(`${colors.red}✗ Error${colors.reset}: ${error.message}`);
    console.log(); // Empty line for readability
    
    // If all tests are done, print summary
    if (completedTests === endpoints.length + 1) {
      printSummary();
    }
  });
  
  req.end();
}

/**
 * Print a summary of the test results
 */
function printSummary() {
  console.log(`${colors.blue}=== Test Summary ===\n${colors.reset}`);
  
  const total = endpoints.length + 1;
  const percentage = Math.round((successfulTests / total) * 100);
  
  if (successfulTests === total) {
    console.log(`${colors.green}All tests passed! (${successfulTests}/${total})${colors.reset}`);
    console.log(`\n${colors.green}✅ HTTPS connection is working correctly!${colors.reset}`);
  } else {
    console.log(`${colors.yellow}${successfulTests}/${total} tests passed (${percentage}%)${colors.reset}`);
    
    if (successfulTests === 0) {
      console.log(`\n${colors.red}❌ HTTPS connection is not working at all.${colors.reset}`);
      console.log(`\nPossible issues:`);
      console.log(`1. The server may not be running on port ${config.port}`);
      console.log(`2. The server might not be configured for HTTPS`);
      console.log(`3. SSL certificates may be invalid or not properly configured`);
    } else {
      console.log(`\n${colors.yellow}⚠️ HTTPS connection is partially working.${colors.reset}`);
      console.log(`\nCheck the specific endpoint failures above.`);
    }
  }
} 