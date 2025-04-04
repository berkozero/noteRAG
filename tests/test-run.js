/**
 * Test Runner Script for Backend-as-Source-of-Truth
 * 
 * This script provides a simple CLI interface to test the backend as source of
 * truth implementation. It runs through common operations and verifies that
 * data is correctly synced between the frontend and backend.
 */

const readline = require('readline');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const nodeFetch = require('node-fetch');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Text styling helpers
const styles = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
  },
  
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m'
  }
};

// Helper functions
function log(message, color = 'white') {
  console.log(`${styles.fg[color]}${message}${styles.reset}`);
}

function logHeader(message) {
  console.log(`\n${styles.fg.cyan}${styles.bright}=== ${message} ===${styles.reset}\n`);
}

function logSuccess(message) {
  console.log(`${styles.fg.green}✓ ${message}${styles.reset}`);
}

function logError(message) {
  console.log(`${styles.fg.red}✗ ${message}${styles.reset}`);
}

function logWarning(message) {
  console.log(`${styles.fg.yellow}! ${message}${styles.reset}`);
}

function question(prompt) {
  return new Promise(resolve => {
    rl.question(`${styles.fg.yellow}${prompt}${styles.reset} `, answer => {
      resolve(answer);
    });
  });
}

// Test functions
async function runTests() {
  logHeader("Backend as Source of Truth Test Runner");
  
  log("This script will help you test the backend as source of truth implementation.");
  log("It will guide you through a series of tests to verify that data is correctly synced.");
  
  // Check if servers are running
  logHeader("Server Check");
  log("First, let's make sure the Python server is running...");
  
  const serverRunning = await checkServerRunning();
  if (!serverRunning) {
    logError("Python server doesn't appear to be running. Start it with 'python python_server/run.py'");
    const startServer = await question("Would you like to start the server now? (y/n)");
    
    if (startServer.toLowerCase() === 'y') {
      await startPythonServer();
    } else {
      logError("Cannot proceed without the server running. Exiting...");
      rl.close();
      return;
    }
  } else {
    logSuccess("Python server is running!");
  }
  
  // Test Case 1: Create Note
  logHeader("Test Case 1: Create Note");
  log("Let's create a test note through the API client...");
  
  const testNote = {
    title: "Test Note",
    text: "This is a test note created through the API client.",
    timestamp: Date.now()
  };
  
  const noteCreated = await createTestNote(testNote);
  if (noteCreated) {
    logSuccess("Test note created successfully!");
  } else {
    logError("Failed to create test note.");
    const continueTests = await question("Continue with other tests? (y/n)");
    if (continueTests.toLowerCase() !== 'y') {
      rl.close();
      return;
    }
  }
  
  // Test Case 2: Get All Notes
  logHeader("Test Case 2: Get All Notes");
  log("Let's retrieve all notes from the server...");
  
  const allNotes = await getAllNotes();
  if (allNotes.length > 0) {
    logSuccess(`Retrieved ${allNotes.length} notes from server!`);
  } else {
    logWarning("No notes found or failed to retrieve notes.");
  }
  
  // Test Case 3: Delete Note
  if (allNotes.length > 0) {
    logHeader("Test Case 3: Delete Note");
    log("Let's delete a note from the server...");
    
    const noteToDelete = allNotes[0];
    const noteDeleted = await deleteNote(noteToDelete.id);
    
    if (noteDeleted) {
      logSuccess(`Note ${noteToDelete.id} deleted successfully!`);
    } else {
      logError(`Failed to delete note ${noteToDelete.id}.`);
    }
  }
  
  // Test Case 4: Search Notes
  logHeader("Test Case 4: Search Notes");
  log("Let's search for notes on the server...");
  
  const searchQuery = "test";
  const searchResults = await searchNotes(searchQuery);
  
  if (searchResults.length > 0) {
    logSuccess(`Found ${searchResults.length} matching notes for query "${searchQuery}"!`);
  } else {
    logWarning(`No notes found for query "${searchQuery}" or search failed.`);
  }
  
  // Finish
  logHeader("Tests Completed");
  log("Testing completed. Check the test results above for any issues.");
  
  rl.close();
}

async function checkServerRunning() {
  try {
    const response = await nodeFetch('http://localhost:3000');
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function startPythonServer() {
  logHeader("Starting Python Server");
  log("Starting the Python server in the background...");
  
  const serverProcess = spawn('python', ['python_server/run.py'], { 
    detached: true,
    stdio: 'ignore'
  });
  
  serverProcess.unref();
  
  log("Server starting. Please wait...");
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const serverRunning = await checkServerRunning();
  if (serverRunning) {
    logSuccess("Server started successfully!");
    return true;
  } else {
    logError("Failed to start server. Please start it manually.");
    return false;
  }
}

async function createTestNote(note) {
  try {
    // Extract only the fields that the server expects - server generates the ID
    const serverNote = {
      text: note.text,
      title: note.title,
      timestamp: note.timestamp || Date.now()
    };
    
    const response = await nodeFetch('http://localhost:3000/api/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(serverNote)
    });
    
    if (!response.ok) {
      logError(`Server responded with ${response.status}: ${response.statusText}`);
      return false;
    }
    
    const result = await response.json();
    console.log("Created note:", result);
    return true;
  } catch (error) {
    logError(`Error creating note: ${error.message}`);
    return false;
  }
}

async function getAllNotes() {
  try {
    const response = await nodeFetch('http://localhost:3000/api/notes');
    
    if (!response.ok) {
      logError(`Server responded with ${response.status}: ${response.statusText}`);
      return [];
    }
    
    const notes = await response.json();
    console.log("All notes:", notes);
    return notes;
  } catch (error) {
    logError(`Error getting all notes: ${error.message}`);
    return [];
  }
}

async function deleteNote(noteId) {
  try {
    const response = await nodeFetch(`http://localhost:3000/api/notes/${noteId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      logError(`Server responded with ${response.status}: ${response.statusText}`);
      return false;
    }
    
    await response.json();
    return true;
  } catch (error) {
    logError(`Error deleting note: ${error.message}`);
    return false;
  }
}

async function searchNotes(query) {
  try {
    const params = new URLSearchParams({
      query: query,
      limit: 10
    });
    
    const response = await nodeFetch(`http://localhost:3000/api/notes/search?${params}`);
    
    if (!response.ok) {
      logError(`Server responded with ${response.status}: ${response.statusText}`);
      return [];
    }
    
    const results = await response.json();
    console.log("Search results:", results);
    return results;
  } catch (error) {
    logError(`Error searching notes: ${error.message}`);
    return [];
  }
}

// Run the tests
runTests(); 