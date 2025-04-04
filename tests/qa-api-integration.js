/**
 * Q&A API Integration Test
 * 
 * This script tests the integration between our client code and the Q&A API.
 * Run this to verify that the API endpoint functions correctly.
 */

const apiClient = require('../src/services/notes/api-client');

/**
 * Run the integration tests
 */
async function runTests() {
  console.log('=== Q&A API Integration Test ===\n');
  
  try {
    // Test 1: Server availability
    console.log('Test 1: Checking server availability');
    const available = await apiClient.isServerAvailable();
    if (available) {
      console.log('  ✓ Server is available');
    } else {
      console.log('  ✗ Server is not available');
      console.log('  Please start the server before running this test');
      return;
    }
    
    // Test 2: Basic question
    console.log('\nTest 2: Testing basic question');
    try {
      const testQuestion = 'What is RAG?';
      console.log(`  Asking: "${testQuestion}"`);
      
      const response = await apiClient.askQuestion(testQuestion);
      
      if (response && !response.error) {
        console.log('  ✓ Received answer from API');
        console.log(`  Answer: "${response.answer.substring(0, 100)}${response.answer.length > 100 ? '...' : ''}"`);
        console.log(`  Sources: ${response.sources ? response.sources.length : 0}`);
      } else {
        console.log('  ✗ Failed to get answer');
        console.log(`  Error: ${response.error}`);
      }
    } catch (error) {
      console.log('  ✗ Error asking question');
      console.log(`  Error: ${error.message}`);
    }
    
    // Test 3: More specific question with contexts
    console.log('\nTest 3: Testing question that should return sources');
    try {
      const testQuestion = 'What are notes used for in this extension?';
      console.log(`  Asking: "${testQuestion}"`);
      
      const response = await apiClient.askQuestion(testQuestion, { limit: 3 });
      
      if (response && !response.error) {
        console.log('  ✓ Received answer from API');
        console.log(`  Answer: "${response.answer.substring(0, 100)}${response.answer.length > 100 ? '...' : ''}"`);
        
        if (response.sources && response.sources.length > 0) {
          console.log(`  Found ${response.sources.length} sources:`);
          response.sources.forEach((source, i) => {
            console.log(`    [${i+1}] ${source.title || 'Untitled'} (ID: ${source.id})`);
          });
        } else {
          console.log('  No sources found in response');
        }
      } else {
        console.log('  ✗ Failed to get answer');
        console.log(`  Error: ${response.error}`);
      }
    } catch (error) {
      console.log('  ✗ Error asking question');
      console.log(`  Error: ${error.message}`);
    }
    
    console.log('\n=== Test Completed ===');
  } catch (error) {
    console.error('\n=== Test Failed ===');
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

// Run the tests
runTests(); 