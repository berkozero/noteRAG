/**
 * ChromaDB storage adapter
 * Maintains compatibility with the storage API but uses ChromaDB under the hood
 */
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const chromadb = require('../embeddings/chromadb');
const logger = require('../../utils/logger');
const config = require('../../config');

// Path to metadata file (for data that ChromaDB doesn't handle well)
const METADATA_FILE_PATH = path.join(process.cwd(), 'data', 'chroma-metadata.json');

// In-memory cache of metadata
const metadataCache = {};

/**
 * Initialize storage
 */
async function init() {
  try {
    // Initialize ChromaDB
    await chromadb.init();
    
    // Ensure metadata file exists
    await ensureMetadataFile();
    
    logger.info('ChromaStorage', 'Storage adapter initialized successfully');
    return true;
  } catch (error) {
    logger.error('ChromaStorage', 'Failed to initialize storage adapter', error);
    return false;
  }
}

/**
 * Ensure the metadata file exists and load it
 */
async function ensureMetadataFile() {
  try {
    // Create directory if it doesn't exist
    await fs.ensureDir(path.dirname(METADATA_FILE_PATH));
    
    // Create file if it doesn't exist
    if (!await fs.pathExists(METADATA_FILE_PATH)) {
      await fs.writeJson(METADATA_FILE_PATH, {}, { spaces: 2 });
    }
    
    // Load metadata into cache
    const metadata = await fs.readJson(METADATA_FILE_PATH);
    Object.assign(metadataCache, metadata);
    
    return true;
  } catch (error) {
    logger.error('ChromaStorage', 'Error ensuring metadata file', error);
    return false;
  }
}

/**
 * Save metadata cache to file
 */
async function saveMetadataCache() {
  try {
    await fs.writeJson(METADATA_FILE_PATH, metadataCache, { spaces: 2 });
    return true;
  } catch (error) {
    logger.error('ChromaStorage', 'Error saving metadata cache', error);
    return false;
  }
}

/**
 * Get all notes from ChromaDB
 * @returns {Promise<Array>} - All notes
 */
async function getAllNotes() {
  try {
    // Get all document IDs
    const ids = await chromadb.getAllIds();
    
    if (ids.length === 0) {
      return [];
    }
    
    // Get full notes from metadata cache
    const notes = ids.map(id => metadataCache[id]).filter(Boolean);
    
    // Sort by timestamp (newest first)
    notes.sort((a, b) => b.timestamp - a.timestamp);
    
    return notes;
  } catch (error) {
    logger.error('ChromaStorage', 'Error getting all notes', error);
    return [];
  }
}

/**
 * Add a new note
 * @param {Object} noteData - Note data
 * @returns {Promise<Object>} - Created note
 */
async function addNote(noteData) {
  try {
    // Generate ID if not provided
    const id = noteData.id || uuidv4();
    
    // Create note object
    const newNote = {
      id,
      text: noteData.text,
      title: noteData.title || 'Untitled',
      url: noteData.url || '',
      isHtml: noteData.isHtml || false,
      timestamp: noteData.timestamp || Date.now()
    };
    
    // Store in ChromaDB
    try {
      await chromadb.addDocument(id, newNote.text, {
        title: newNote.title,
        url: newNote.url,
        timestamp: newNote.timestamp,
        isHtml: newNote.isHtml
      });
    } catch (error) {
      logger.error('ChromaStorage', `Error adding note to ChromaDB: ${error.message}`, error);
      throw new Error(`Failed to add note to ChromaDB: ${error.message}`);
    }
    
    // Store in metadata cache
    metadataCache[id] = newNote;
    await saveMetadataCache();
    
    return newNote;
  } catch (error) {
    logger.error('ChromaStorage', 'Error adding note', error);
    throw error;
  }
}

/**
 * Update an existing note
 * @param {string} id - Note ID
 * @param {Object} noteData - Updated note data
 * @returns {Promise<Object>} - Updated note
 */
async function updateNote(id, noteData) {
  try {
    // Get existing note
    const existingNote = metadataCache[id];
    
    if (!existingNote) {
      throw new Error(`Note with ID ${id} not found`);
    }
    
    // Update note object
    const updatedNote = {
      ...existingNote,
      ...noteData,
      id // Ensure ID doesn't change
    };
    
    // Update in ChromaDB
    try {
      await chromadb.updateDocument(id, updatedNote.text, {
        title: updatedNote.title,
        url: updatedNote.url,
        timestamp: updatedNote.timestamp,
        isHtml: updatedNote.isHtml
      });
    } catch (error) {
      logger.error('ChromaStorage', `Error updating note in ChromaDB: ${error.message}`, error);
      throw new Error(`Failed to update note in ChromaDB: ${error.message}`);
    }
    
    // Update in metadata cache
    metadataCache[id] = updatedNote;
    await saveMetadataCache();
    
    return updatedNote;
  } catch (error) {
    logger.error('ChromaStorage', 'Error updating note', error);
    throw error;
  }
}

/**
 * Delete a note
 * @param {string} id - Note ID
 * @returns {Promise<boolean>} - Success status
 */
async function deleteNote(id) {
  try {
    // Delete from ChromaDB
    try {
      await chromadb.deleteDocument(id);
    } catch (error) {
      logger.error('ChromaStorage', `Error deleting note from ChromaDB: ${error.message}`, error);
      throw new Error(`Failed to delete note from ChromaDB: ${error.message}`);
    }
    
    // Delete from metadata cache
    delete metadataCache[id];
    await saveMetadataCache();
    
    return true;
  } catch (error) {
    logger.error('ChromaStorage', 'Error deleting note', error);
    return false;
  }
}

module.exports = {
  init,
  getAllNotes,
  addNote,
  updateNote,
  deleteNote
}; 