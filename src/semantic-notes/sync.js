/**
 * Synchronization tool for Chrome extension notes and semantic notes
 * 
 * This script synchronizes notes from the Chrome extension's storage
 * to the semantic notes storage system, enabling semantic search on existing notes.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import the semantic notes services
const { init: initNotesService, createNote } = require('./services/notes');

/**
 * Process and convert Chrome extension notes to semantic notes format
 * @param {Array} chromeNotes - Array of notes from Chrome extension
 * @returns {Array} - Processed notes in semantic format
 */
function processNotes(chromeNotes) {
  return chromeNotes.map(note => ({
    title: note.title || 'Untitled',
    content: note.text || '',
    url: note.url || '',
    isHtml: note.isHtml || false,
    // Preserve original ID if possible
    externalId: note.id ? note.id.toString() : undefined
  }));
}

/**
 * Main sync function
 */
async function syncNotes() {
  try {
    console.log('Initializing notes service...');
    const initialized = await initNotesService();
    
    if (!initialized) {
      console.error('Failed to initialize semantic notes service');
      process.exit(1);
    }
    
    // Check if Chrome storage file exists
    const storageFilePath = path.resolve(__dirname, 'data/chrome-notes.json');
    
    if (!fs.existsSync(storageFilePath)) {
      console.error('Chrome notes file not found. Please export your notes first.');
      console.log('You can export notes by running:');
      console.log('  chrome.storage.local.get("notes", result => { console.log(JSON.stringify(result.notes)) })');
      console.log('in the browser console and saving the output to data/chrome-notes.json');
      process.exit(1);
    }
    
    // Read and parse Chrome notes
    const chromeNotesRaw = fs.readFileSync(storageFilePath, 'utf8');
    const chromeNotes = JSON.parse(chromeNotesRaw);
    
    if (!Array.isArray(chromeNotes)) {
      console.error('Invalid notes file format. Expected an array of notes.');
      process.exit(1);
    }
    
    console.log(`Found ${chromeNotes.length} notes to sync`);
    
    // Process notes to semantic format
    const semanticNotes = processNotes(chromeNotes);
    
    // Save notes to semantic storage
    console.log('Syncing notes to semantic storage...');
    let successCount = 0;
    
    for (const note of semanticNotes) {
      try {
        await createNote(note);
        successCount++;
        process.stdout.write(`Synced ${successCount}/${semanticNotes.length} notes\r`);
      } catch (error) {
        console.error(`Failed to sync note "${note.title}": ${error.message}`);
      }
    }
    
    console.log(`\nSync complete. Successfully synced ${successCount}/${semanticNotes.length} notes.`);
    
    if (successCount < semanticNotes.length) {
      console.log(`${semanticNotes.length - successCount} notes failed to sync.`);
    }
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  }
}

// Run the sync if this script is executed directly
if (require.main === module) {
  syncNotes().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { syncNotes }; 