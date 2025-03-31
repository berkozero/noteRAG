/**
 * Test script for noteRAG extension and semantic notes integration
 * 
 * This script simulates the browser environment and tests the integration
 * between the Chrome extension and the semantic notes module
 */

// Simulate browser environment
global.window = {
  localStorage: {
    _data: {},
    getItem: function(key) {
      return this._data[key] || null;
    },
    setItem: function(key, value) {
      this._data[key] = value.toString();
    },
    removeItem: function(key) {
      delete this._data[key];
    },
    clear: function() {
      this._data = {};
    }
  }
};

// Mock Chrome API
global.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://abcdefgh/${path}`,
    lastError: null
  },
  storage: {
    local: {
      get: (keys, callback) => {
        const result = {};
        if (typeof keys === 'string') {
          result[keys] = window.localStorage.getItem(`chrome_${keys}`);
        } else if (Array.isArray(keys)) {
          keys.forEach(key => {
            result[key] = window.localStorage.getItem(`chrome_${key}`);
          });
        }
        callback(result);
      },
      set: (data, callback) => {
        Object.keys(data).forEach(key => {
          window.localStorage.setItem(`chrome_${key}`, JSON.stringify(data[key]));
        });
        callback();
      }
    }
  }
};

// Import modules
const { semanticBridge } = require('./dist/services/notes/semantic-bridge');

// Test adding a note
async function testAddNote() {
  console.log('=== Testing Save Note ===');
  
  try {
    const testNote = {
      id: Date.now(),
      title: 'Test Note',
      text: 'This is a test note created by the test-extension.js script',
      url: 'https://example.com/test',
      timestamp: Date.now(),
      isHtml: false
    };
    
    console.log('Saving test note...');
    const result = await semanticBridge.saveNote(testNote);
    
    if (result) {
      console.log('✅ Successfully saved test note with ID:', result.id);
      return result;
    } else {
      console.error('❌ Failed to save test note');
      return null;
    }
  } catch (error) {
    console.error('❌ Error saving test note:', error);
    return null;
  }
}

// Test searching notes
async function testSearchNotes(query) {
  console.log(`\n=== Testing Search Notes: "${query}" ===`);
  
  try {
    console.log('Searching notes...');
    const results = await semanticBridge.searchNotes(query);
    
    console.log(`✅ Found ${results.length} matching notes`);
    
    if (results.length > 0) {
      console.log('First result:');
      console.log('- Title:', results[0].title);
      console.log('- Content:', results[0].text.substring(0, 100) + (results[0].text.length > 100 ? '...' : ''));
    }
    
    return results;
  } catch (error) {
    console.error('❌ Error searching notes:', error);
    return [];
  }
}

// Run tests
async function runTests() {
  try {
    console.log('Testing noteRAG extension with semantic notes integration\n');
    
    // Test add note
    const savedNote = await testAddNote();
    
    if (savedNote) {
      // Test search note
      await testSearchNotes('test');
    }
    
    console.log('\nTests completed!');
  } catch (error) {
    console.error('Error during tests:', error);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  runTests();
} 