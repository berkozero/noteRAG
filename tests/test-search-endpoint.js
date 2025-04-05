/**
 * Test script for the search endpoint
 * 
 * This script verifies that the semanticSearch function in api-client.js
 * correctly calls the server's search endpoint and processes the results.
 */

// Import the API client directly
const apiClient = require('../src/services/notes/api-client');

// Disable certificate validation for self-signed certs in Node.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test queries
const testQueries = [
  'blockchain',
  'AI',
  'foundation',
  'test'
];

/**
 * Run the test
 */
async function runTest() {
  console.log(`${colors.blue}=== Testing Semantic Search Endpoint ===\n${colors.reset}`);
  
  // First check if the server is available
  const isAvailable = await apiClient.isServerAvailable();
  if (!isAvailable) {
    console.log(`${colors.red}❌ Server is not available. Please start the server before running this test.${colors.reset}`);
    console.log(`   Start the server with: python server_manager.py start --https --port 3444`);
    return;
  }
  
  console.log(`${colors.green}✅ Server is available${colors.reset}`);
  console.log(`   Using endpoint: ${apiClient.getCurrentConfig().baseUrl}/search\n`);
  
  // Test each query
  for (const query of testQueries) {
    console.log(`${colors.yellow}Testing query: "${query}"${colors.reset}`);
    
    try {
      const results = await apiClient.semanticSearch(query);
      
      if (!results.success) {
        console.log(`${colors.red}❌ Search failed: ${results.message}${colors.reset}`);
        continue;
      }
      
      console.log(`${colors.green}✅ Found ${results.results.length} results${colors.reset}`);
      
      // Show a preview of each result
      results.results.forEach((result, i) => {
        const title = result.title || 'Untitled';
        const text = result.text.length > 40 ? result.text.substring(0, 40) + '...' : result.text;
        const score = result.score ? (result.score * 100).toFixed(1) + '%' : 'N/A';
        
        console.log(`   ${i+1}. ${title} (${score})`);
        console.log(`      ${text}`);
      });
      
      console.log(''); // Empty line between queries
    } catch (error) {
      console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
    }
  }
  
  console.log(`${colors.blue}=== Test Completed ===\n${colors.reset}`);
}

// Run the test
runTest().catch(error => {
  console.error(`${colors.red}Unhandled error: ${error.message}${colors.reset}`);
  console.error(error.stack);
}); 