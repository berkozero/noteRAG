/**
 * Simple storage adapter for notes
 * Uses in-memory storage with persistence to a JSON file
 */
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const logger = require('../../utils/logger');

// In-memory cache of notes
let notesCache = [];

// Path to the notes file
const NOTES_FILE_PATH = config.storage.notesFilePath;

/**
 * Initialize the storage adapter
 * @returns {Promise<void>}
 */
async function init() {
  logger.info('Initializing simple storage adapter');
  logger.info(`Notes file path: ${NOTES_FILE_PATH}`);
  
  try {
    await ensureNotesFile();
    logger.info(`Simple storage adapter initialized with ${notesCache.length} notes`);
    
    // Log the type of notesCache to help with debugging
    logger.debug(`notesCache type: ${typeof notesCache}`);
    logger.debug(`notesCache is array: ${Array.isArray(notesCache)}`);
    if (notesCache.length > 0) {
      logger.debug(`First note: ${JSON.stringify(notesCache[0])}`);
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize simple storage adapter', error);
    return false;
  }
}

/**
 * Ensure the notes file exists
 * @returns {Promise<void>}
 */
async function ensureNotesFile() {
  try {
    // Ensure the directory exists
    const dir = path.dirname(NOTES_FILE_PATH);
    await fs.ensureDir(dir);
    
    // Check if the file exists
    const exists = await fs.pathExists(NOTES_FILE_PATH);
    logger.debug(`Notes file exists: ${exists}`);
    
    if (!exists) {
      // Create an empty notes file
      notesCache = [];
      await fs.writeJson(NOTES_FILE_PATH, []);
      logger.info('Created new empty notes file');
    } else {
      // Load existing notes
      const content = await fs.readJson(NOTES_FILE_PATH);
      logger.debug(`Loaded notes file content type: ${typeof content}`);
      logger.debug(`Loaded notes file content is array: ${Array.isArray(content)}`);
      
      if (Array.isArray(content)) {
        notesCache = content;
      } else {
        logger.warn('Notes file content is not an array, resetting to empty array');
        notesCache = [];
        await fs.writeJson(NOTES_FILE_PATH, []);
      }
      
      logger.info(`Loaded ${notesCache.length} notes from file`);
    }
  } catch (error) {
    logger.error('Error ensuring notes file', error);
    // Reset to empty array in case of error
    notesCache = [];
    throw error;
  }
}

/**
 * Save the notes cache to file
 * @returns {Promise<void>}
 */
async function saveNotes() {
  try {
    await fs.writeJson(NOTES_FILE_PATH, notesCache);
    logger.debug(`Saved ${notesCache.length} notes to file`);
  } catch (error) {
    logger.error('Failed to save notes', error);
    throw error;
  }
}

/**
 * Get all notes
 * @returns {Promise<Array>} All notes
 */
async function getAllNotes() {
  logger.debug(`Getting all ${notesCache.length} notes`);
  return notesCache;
}

/**
 * Get a note by ID
 * @param {string} id - Note ID
 * @returns {Promise<Object|null>} The note or null if not found
 */
async function getNote(id) {
  const note = notesCache.find(note => note.id === id);
  logger.debug(`Getting note with ID ${id}: ${note ? 'Found' : 'Not found'}`);
  return note || null;
}

/**
 * Add a new note
 * @param {Object} note - The note to add
 * @returns {Promise<Object>} The added note
 */
async function addNote(note) {
  // Ensure notesCache is an array
  if (!Array.isArray(notesCache)) {
    logger.warn('notesCache is not an array, resetting to empty array');
    notesCache = [];
  }

  // Generate a new ID if not provided
  const newNote = {
    ...note,
    id: note.id || uuidv4(),
    created: note.created || new Date().toISOString(),
    updated: new Date().toISOString()
  };
  
  logger.debug(`Adding new note with ID ${newNote.id}`);
  
  // Add the note to the cache
  notesCache.push(newNote);
  
  // Save the updated cache
  await saveNotes();
  
  return newNote;
}

/**
 * Update an existing note
 * @param {string} id - The ID of the note to update
 * @param {Object} updates - The updates to apply
 * @returns {Promise<Object|null>} The updated note or null if not found
 */
async function updateNote(id, updates) {
  const index = notesCache.findIndex(note => note.id === id);
  
  if (index === -1) {
    logger.debug(`Note with ID ${id} not found for update`);
    return null;
  }
  
  // Update the note
  const updatedNote = {
    ...notesCache[index],
    ...updates,
    updated: new Date().toISOString()
  };
  
  // Replace the old note with the updated one
  notesCache[index] = updatedNote;
  
  // Save the updated cache
  await saveNotes();
  
  logger.debug(`Updated note with ID ${id}`);
  return updatedNote;
}

/**
 * Delete a note
 * @param {string} id - The ID of the note to delete
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteNote(id) {
  const initialLength = notesCache.length;
  notesCache = notesCache.filter(note => note.id !== id);
  
  if (notesCache.length === initialLength) {
    logger.debug(`Note with ID ${id} not found for deletion`);
    return false;
  }
  
  // Save the updated cache
  await saveNotes();
  
  logger.debug(`Deleted note with ID ${id}`);
  return true;
}

module.exports = {
  init,
  getAllNotes,
  getNote,
  addNote,
  updateNote,
  deleteNote
}; 