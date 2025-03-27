/**
 * Notes service that provides a unified interface for note management
 * Uses simple storage for notes and advanced search with vector embeddings
 */
const storage = require('./simple-storage');
const search = require('./advanced-search');
const logger = require('../../utils/logger');

/**
 * Initialize the notes service
 * @returns {Promise<boolean>} Success status
 */
async function init() {
  logger.info('Initializing notes service');
  
  try {
    // Initialize storage
    const storageInitialized = await storage.init();
    if (!storageInitialized) {
      throw new Error('Failed to initialize storage');
    }
    
    // Initialize search
    const searchInitialized = await search.init();
    if (!searchInitialized) {
      logger.warn('Search initialization failed, search functionality may be limited');
    }
    
    // Index existing notes to ensure search works for all notes
    const notes = await getAllNotes();
    logger.info(`Indexing ${notes.length} existing notes`);
    
    let indexedCount = 0;
    for (const note of notes) {
      try {
        // Make sure each note is properly indexed for search
        await search.addToIndex(note.id, note);
        indexedCount++;
      } catch (error) {
        logger.error(`Error adding note ${note.id} to search index`, error);
      }
    }
    
    logger.info(`Successfully indexed ${indexedCount} of ${notes.length} notes`);
    
    logger.info('Notes service initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize notes service', error);
    return false;
  }
}

/**
 * Index all existing notes in the search service
 * This ensures that all notes are searchable
 * @returns {Promise<void>}
 */
async function indexExistingNotes() {
  try {
    const allNotes = await storage.getAllNotes();
    logger.info(`Indexing ${allNotes.length} existing notes`);
    
    let indexedCount = 0;
    for (const note of allNotes) {
      try {
        await search.addToIndex(note.id, note);
        indexedCount++;
      } catch (error) {
        logger.error(`Error indexing note ${note.id}`, error);
      }
    }
    
    logger.info(`Successfully indexed ${indexedCount} of ${allNotes.length} notes`);
  } catch (error) {
    logger.error('Error indexing existing notes', error);
  }
}

/**
 * Create a new note
 * @param {Object} note - Note data
 * @param {string} [note.title] - Note title
 * @param {string} [note.content] - Note content
 * @param {string} [note.url] - Related URL
 * @param {boolean} [note.isHtml] - Whether content is HTML
 * @returns {Promise<Object>} Created note
 */
async function createNote(note) {
  logger.debug('Creating new note');
  
  try {
    // Add the note to storage
    const newNote = await storage.addNote(note);
    
    // Index the note for search
    await search.addToIndex(newNote.id, newNote);
    
    return newNote;
  } catch (error) {
    logger.error('Error creating note', error);
    throw error;
  }
}

/**
 * Get a note by ID
 * @param {string} id - Note ID
 * @returns {Promise<Object|null>} The note or null if not found
 */
async function getNote(id) {
  logger.debug(`Getting note with ID ${id}`);
  
  try {
    return await storage.getNote(id);
  } catch (error) {
    logger.error(`Error getting note with ID ${id}`, error);
    throw error;
  }
}

/**
 * Get all notes
 * @returns {Promise<Array>} All notes
 */
async function getAllNotes() {
  logger.debug('Getting all notes');
  
  try {
    return await storage.getAllNotes();
  } catch (error) {
    logger.error('Error getting all notes', error);
    throw error;
  }
}

/**
 * Update a note
 * @param {string} id - Note ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object|null>} Updated note or null if not found
 */
async function updateNote(id, updates) {
  logger.debug(`Updating note with ID ${id}`);
  
  try {
    // Update the note in storage
    const updatedNote = await storage.updateNote(id, updates);
    
    if (updatedNote) {
      // Update the note in the search index
      await search.updateIndex(id, updatedNote);
    }
    
    return updatedNote;
  } catch (error) {
    logger.error(`Error updating note with ID ${id}`, error);
    throw error;
  }
}

/**
 * Delete a note
 * @param {string} id - Note ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteNote(id) {
  logger.debug(`Deleting note with ID ${id}`);
  
  try {
    // Delete the note from storage
    const success = await storage.deleteNote(id);
    
    if (success) {
      // Remove the note from the search index
      await search.removeFromIndex(id);
    }
    
    return success;
  } catch (error) {
    logger.error(`Error deleting note with ID ${id}`, error);
    throw error;
  }
}

/**
 * Search for notes using keyword, semantic, or hybrid search
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {number} [options.limit=10] - Maximum number of results
 * @param {boolean} [options.includeScores=false] - Include similarity scores
 * @returns {Promise<Array>} Matching notes
 */
async function searchNotes(query, options = {}) {
  const { 
    limit = 10,
    includeScores = false
  } = options;
  
  logger.debug(`Searching for "${query}" using semantic search`);
  
  try {
    // Always use semantic search for improved contextual understanding
    return await search.semanticSearch(query, { limit, includeScores });
  } catch (error) {
    logger.error(`Error searching for "${query}"`, error);
    
    // Fallback to simple keyword search only if semantic search fails
    try {
      logger.debug(`Semantic search failed, falling back to keyword search`);
      return await search.keywordSearch(query, { limit });
    } catch (fallbackError) {
      logger.error('Fallback search also failed', fallbackError);
      return [];
    }
  }
}

/**
 * Generate embeddings for all notes
 * @returns {Promise<Object>} - Generation results
 */
async function generateEmbeddings() {
  logger.info('Notes', 'Generating embeddings for all notes');
  
  try {
    return await search.generateEmbeddingsForNotes();
  } catch (error) {
    logger.error('Notes', `Error generating embeddings: ${error.message}`, error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  init,
  createNote,
  getNote,
  getAllNotes,
  updateNote,
  deleteNote,
  searchNotes,
  generateEmbeddings
}; 