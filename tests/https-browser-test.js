/**
 * Browser HTTPS Connection Test
 * 
 * This script tests the HTTPS connection from the browser to our server.
 * It helps verify that the Content Security Policy is correctly configured
 * and that the browser can establish a secure connection.
 * 
 * To use this test:
 * 1. Start the HTTPS server: python server_manager.py start --https
 * 2. Open this file in a browser
 */

// HTTPS configuration
const config = {
  protocol: 'https',
  host: 'localhost',
  port: 3444,
  endpoints: [
    '/health',
    '/api/notes',
    '/api/query?q=test'
  ]
};

// Test results container
const results = {
  success: 0,
  failed: 0,
  tests: []
};

// DOM elements
let resultsList;

document.addEventListener('DOMContentLoaded', () => {
  // Create the UI
  createUI();
  
  // Run the tests
  runTests();
});

/**
 * Create the user interface
 */
function createUI() {
  // Main container
  const container = document.getElementById('container') || document.body;
  container.innerHTML = `
    <div class="test-container">
      <h1>HTTPS Connection Test</h1>
      <p>Testing connection to: <code>${config.protocol}://${config.host}:${config.port}</code></p>
      
      <div class="test-controls">
        <button id="run-tests">Run Tests</button>
      </div>
      
      <div class="test-results">
        <h2>Test Results</h2>
        <div class="results-summary" id="results-summary">
          Running tests...
        </div>
        <ul class="results-list" id="results-list"></ul>
      </div>
    </div>
  `;
  
  // Style the UI
  const style = document.createElement('style');
  style.textContent = `
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 20px; }
    .test-container { background: #f5f5f5; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { margin-top: 0; color: #333; }
    code { background: #e0e0e0; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
    .test-controls { margin: 20px 0; }
    button { background: #4285f4; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
    button:hover { background: #3b78e7; }
    .results-summary { margin: 15px 0; font-weight: bold; }
    .results-list { list-style: none; padding: 0; }
    .results-list li { padding: 10px; margin-bottom: 8px; border-radius: 4px; }
    .result-success { background: #e6f4ea; border-left: 4px solid #34a853; }
    .result-failed { background: #fce8e6; border-left: 4px solid #ea4335; }
    .endpoint { font-family: monospace; font-weight: bold; }
    .error-details { margin-top: 5px; color: #d93025; font-family: monospace; font-size: 14px; }
  `;
  document.head.appendChild(style);
  
  // Get elements
  resultsList = document.getElementById('results-list');
  const runButton = document.getElementById('run-tests');
  
  // Add event listeners
  runButton.addEventListener('click', runTests);
}

/**
 * Run all HTTPS tests
 */
async function runTests() {
  // Reset results
  results.success = 0;
  results.failed = 0;
  results.tests = [];
  resultsList.innerHTML = '';
  
  document.getElementById('results-summary').textContent = 'Running tests...';
  
  // Test base URL
  await testEndpoint('/');
  
  // Test all endpoints
  for (const endpoint of config.endpoints) {
    await testEndpoint(endpoint);
  }
  
  // Update summary
  updateSummary();
}

/**
 * Test a specific endpoint
 * @param {string} endpoint - The endpoint to test
 */
async function testEndpoint(endpoint) {
  const url = `${config.protocol}://${config.host}:${config.port}${endpoint}`;
  const testResult = {
    endpoint,
    url,
    success: false,
    error: null,
    response: null
  };
  
  try {
    const response = await fetch(url);
    
    if (response.ok) {
      testResult.success = true;
      testResult.status = response.status;
      testResult.response = await response.json();
      results.success++;
    } else {
      testResult.success = false;
      testResult.status = response.status;
      testResult.error = `HTTP Error: ${response.status} ${response.statusText}`;
      results.failed++;
    }
  } catch (error) {
    testResult.success = false;
    testResult.error = error.message;
    results.failed++;
  }
  
  // Add to results
  results.tests.push(testResult);
  
  // Display the result
  displayResult(testResult);
}

/**
 * Display a single test result
 * @param {Object} result - The test result object
 */
function displayResult(result) {
  const item = document.createElement('li');
  item.className = result.success ? 'result-success' : 'result-failed';
  
  let content = `
    <div class="result-header">
      <span class="endpoint">${result.endpoint}</span>
      <span class="status">${result.success ? '✅ Success' : '❌ Failed'}</span>
    </div>
  `;
  
  if (result.status) {
    content += `<div class="status-code">Status: ${result.status}</div>`;
  }
  
  if (!result.success && result.error) {
    content += `<div class="error-details">${result.error}</div>`;
  }
  
  item.innerHTML = content;
  resultsList.appendChild(item);
}

/**
 * Update the summary of test results
 */
function updateSummary() {
  const summaryElement = document.getElementById('results-summary');
  summaryElement.textContent = `Tests completed: ${results.success} succeeded, ${results.failed} failed`;
  summaryElement.style.color = results.failed === 0 ? '#34a853' : '#ea4335';
} 