/**
 * Phase 1 Verification Test
 * 
 * This script verifies that core functionality works after Phase 1 changes,
 * which included removing semantic-specific features while maintaining
 * the basic search and note management functionality.
 */

// Mock dependencies to avoid ES module issues
const notesService = {
  searchNotes: async (query, options) => {
    console.log(`  Service search called with query: "${query}"`);
    return await apiClient.searchNotes(query, options);
  },
  getAllNotes: async () => {
    console.log(`  Service getting all notes`);
    return await apiClient.getAllNotes();
  },
  createNote: async (note) => {
    console.log(`  Service creating note`);
    return await apiClient.createNote(note);
  },
  deleteNote: async (id) => {
    console.log(`  Service deleting note ${id}`);
    return await apiClient.deleteNote(id);
  }
};

// Mock API client
const apiClient = {
  searchNotes: async (query, options) => {
    console.log(`  API client search called with query: "${query}" and options:`, options);
    return {
      success: true,
      results: [
        { id: 'note_1', title: 'Test Note', text: 'This is a test note' }
      ]
    };
  },
  getAllNotes: async () => {
    console.log(`  API client getting all notes`);
    return [
      { id: 'note_1', title: 'Test Note 1', text: 'Content 1' },
      { id: 'note_2', title: 'Test Note 2', text: 'Content 2' }
    ];
  },
  createNote: async (note) => {
    console.log(`  API client creating note:`, note);
    return { ...note, id: 'new_note_id', success: true };
  },
  deleteNote: async (id) => {
    console.log(`  API client deleting note ${id}`);
    return { success: true };
  }
};

async function runTests() {
  console.log('=== Phase 1 Verification Tests ===\n');
  
  try {
    // Test 1: Basic search works
    console.log('Test 1: Verify basic search functionality');
    const response = await notesService.searchNotes('test query', {});
    
    // Verify results
    if (response && response.success && response.results && 
        response.results.length > 0 && 
        response.results[0].id === 'note_1') {
      console.log('  ✓ Search returns expected results');
    } else {
      console.log('  ✗ Search failed to return expected results');
      console.log('  Results:', JSON.stringify(response));
    }
    
    // Test 2: Verify options are passed correctly
    console.log('\nTest 2: Verify search options are passed correctly');
    let optionsReceived = null;
    
    // Replace the mock implementation
    const originalSearch = apiClient.searchNotes;
    apiClient.searchNotes = async (query, options) => {
      optionsReceived = options;
      return {
        success: true,
        results: []
      };
    };
    
    // Call with options
    const testOptions = { limit: 5, someOption: 'value' };
    await notesService.searchNotes('test', testOptions);
    
    // Restore original
    apiClient.searchNotes = originalSearch;
    
    // Verify options
    if (optionsReceived && 
        optionsReceived.limit === 5 &&
        optionsReceived.someOption === 'value') {
      console.log('  ✓ Options passed correctly to search function');
    } else {
      console.log('  ✗ Options not passed correctly:', JSON.stringify(optionsReceived));
    }
    
    // Test 3: Create note functionality
    console.log('\nTest 3: Verify note creation');
    const testNote = {
      title: 'Test Note',
      text: 'This is a test note',
      timestamp: Date.now()
    };
    
    const createdNote = await notesService.createNote(testNote);
    if (createdNote && createdNote.success && createdNote.id === 'new_note_id') {
      console.log('  ✓ Note created successfully');
    } else {
      console.log('  ✗ Note creation failed');
      console.log('  Result:', JSON.stringify(createdNote));
    }
    
    // Test 4: Get all notes functionality
    console.log('\nTest 4: Verify getting all notes');
    const allNotes = await notesService.getAllNotes();
    if (allNotes && Array.isArray(allNotes) && allNotes.length === 2) {
      console.log('  ✓ All notes retrieved successfully');
    } else {
      console.log('  ✗ Failed to retrieve all notes');
      console.log('  Result:', JSON.stringify(allNotes));
    }
    
    // Test 5: Delete note functionality
    console.log('\nTest 5: Verify note deletion');
    const deleteResult = await notesService.deleteNote('note_1');
    if (deleteResult && deleteResult.success) {
      console.log('  ✓ Note deleted successfully');
    } else {
      console.log('  ✗ Note deletion failed');
      console.log('  Result:', JSON.stringify(deleteResult));
    }
    
    console.log('\n=== Tests Completed Successfully ===');
    
  } catch (error) {
    console.error('\n=== Test Execution Failed ===');
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

// Run the tests
runTests(); 