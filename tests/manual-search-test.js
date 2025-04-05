/**
 * Manual Test Script for Search Endpoint
 * 
 * This script tests the search endpoint directly without relying on the API client.
 */

// Disable certificate validation for self-signed certs
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

// Server configuration
const SERVER_CONFIG = {
  protocol: 'https',
  host: 'localhost',
  port: 3444,
  path: 'api'
};

// API endpoint
const API_ENDPOINT = `${SERVER_CONFIG.protocol}://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}/${SERVER_CONFIG.path}`;

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
  console.log(`${colors.blue}=== Manual Testing of Search Endpoint ===\n${colors.reset}`);
  
  // First check if the server is available
  try {
    const healthResponse = await fetch(`${SERVER_CONFIG.protocol}://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Server responded with ${healthResponse.status}`);
    }
    
    console.log(`${colors.green}✅ Server is available${colors.reset}`);
    console.log(`   Using endpoint: ${API_ENDPOINT}/search\n`);
  } catch (error) {
    console.log(`${colors.red}❌ Server is not available: ${error.message}${colors.reset}`);
    console.log(`   Start the server with: python server_manager.py start --https --port 3444`);
    return;
  }
  
  // Test each query
  for (const query of testQueries) {
    console.log(`${colors.yellow}Testing query: "${query}"${colors.reset}`);
    
    try {
      // Build the search URL with parameters
      const searchUrl = `${API_ENDPOINT}/search?q=${encodeURIComponent(query)}`;
      console.log(`   URL: ${searchUrl}`);
      
      // Make the request
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        console.log(`${colors.red}❌ Search failed with status: ${response.status}${colors.reset}`);
        try {
          const errorData = await response.json();
          console.log(`   Error: ${JSON.stringify(errorData)}`);
        } catch {
          console.log(`   Error: ${response.statusText}`);
        }
        continue;
      }
      
      // Parse the response
      const data = await response.json();
      const results = data.results || [];
      
      console.log(`${colors.green}✅ Found ${results.length} results${colors.reset}`);
      
      // Show a preview of each result
      results.forEach((result, i) => {
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