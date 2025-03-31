/**
 * Simple test script for the NoteRAG server
 * This script tests basic embedding and search functionality
 */
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3000/api';

// Sample notes for testing
const testNotes = [
  {
    id: 'test-note-1',
    title: 'Machine Learning Concepts',
    text: 'Machine learning is a branch of artificial intelligence that focuses on building systems that learn from data. Key concepts include supervised learning, unsupervised learning, and reinforcement learning.',
    url: 'https://example.com/ml',
    timestamp: Date.now()
  },
  {
    id: 'test-note-2',
    title: 'JavaScript Promises',
    text: 'Promises in JavaScript represent the eventual completion or failure of an asynchronous operation and its resulting value. They help simplify asynchronous code and avoid callback hell.',
    url: 'https://example.com/js',
    timestamp: Date.now() - 1000
  },
  {
    id: 'test-note-3',
    title: 'Healthy Diet Tips',
    text: 'A balanced diet should include a variety of fruits, vegetables, whole grains, lean proteins, and healthy fats. It\'s important to stay hydrated and limit processed foods.',
    url: 'https://example.com/health',
    timestamp: Date.now() - 2000
  }
];

/**
 * Test embedding generation
 */
async function testEmbeddings() {
  console.log('\n=== Testing Embeddings Generation ===');
  
  for (const note of testNotes) {
    try {
      console.log(`\nGenerating embeddings for note: ${note.id}`);
      const response = await fetch(`${API_URL}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note })
      });
      
      const result = await response.json();
      console.log('Response:', result);
      
      if (result.success) {
        console.log(`✅ Successfully created embeddings for note: ${note.id}`);
      } else {
        console.log(`❌ Failed to create embeddings: ${result.message}`);
      }
    } catch (error) {
      console.error(`❌ Error creating embeddings for note ${note.id}:`, error.message);
    }
  }
}

/**
 * Test semantic search
 */
async function testSearch() {
  console.log('\n=== Testing Semantic Search ===');
  
  const searchQueries = [
    'machine learning techniques',
    'javascript async',
    'nutrition tips'
  ];
  
  for (const query of searchQueries) {
    try {
      console.log(`\nSearching for: "${query}"`);
      const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
      const result = await response.json();
      
      console.log(`Found ${result.results?.length || 0} results`);
      
      if (result.results?.length > 0) {
        console.log('Top results:');
        result.results.forEach((item, index) => {
          console.log(`  ${index + 1}. ID: ${item.id}, Score: ${item.score.toFixed(4)}`);
        });
        console.log('✅ Search successful');
      } else {
        console.log('❌ No results found');
      }
    } catch (error) {
      console.error(`❌ Error searching for "${query}":`, error.message);
    }
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting NoteRAG server tests...');
  
  try {
    // Test server availability
    console.log('\nChecking server availability...');
    const response = await fetch(BASE_URL);
    
    if (response.ok) {
      console.log('✅ Server is available');
      
      // Run the tests
      await testEmbeddings();
      await testSearch();
      
      console.log('\n=== All Tests Completed ===');
    } else {
      console.error('❌ Server is not available. Please start the server first.');
    }
  } catch (error) {
    console.error('❌ Error connecting to server:', error.message);
    console.log('Please make sure the server is running on http://localhost:3000');
  }
}

// Run the tests
runTests(); 