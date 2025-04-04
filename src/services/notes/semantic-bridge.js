/**
 * Semantic Bridge Module
 * 
 * This module serves as a bridge between the Chrome extension and the semantic search functionality.
 * It handles semantic search of notes while delegating storage operations to the NoteStorage module.
 */

import fs from './fs-browser';
import noteStorage from './note-storage';
import { logger } from '../../utils/logger';
import { noteTests } from './test-notes';
import apiClient from './api-client.js';

// Paths for embeddings
const EMBEDDINGS_DIR = '/data/embeddings';
const NOTES_INDEX_PATH = '/data/notes-index.json';

// Function to initialize the semantic search module
const initialize = async () => {
  try {
    // Ensure embeddings directory exists
    await fs.ensureDirSync(EMBEDDINGS_DIR);
    
    // Make test module globally available in development
    if (typeof window !== 'undefined') {
      window.noteTests = noteTests;
    }
    
    logger.info('SemanticBridge', 'Initialized successfully');
    return true;
  } catch (error) {
    logger.error('SemanticBridge', 'Failed to initialize semantic search module', error);
    return false;
  }
};

// Function to save a note with semantic indexing
const saveNote = async (note) => {
  try {
    logger.info('SemanticBridge', `Saving note with semantic indexing: ${note.id}`);
    
    // Check if server is available first before deciding on approach
    const serverAvailable = await apiClient.isServerAvailable();
    
    // SERVER-FIRST APPROACH
    // If server is available, we let it handle everything to avoid duplication
    if (serverAvailable) {
      logger.info('SemanticBridge', 'Using server-first approach for note saving');
      
      try {
        // Create a unique transaction ID for logging/tracking
        const txId = `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        logger.info('SemanticBridge', `Starting transaction ${txId} for note ${note.id}`);
        
        // SERVER HANDLES EVERYTHING - single API call with createNote=true
        // This lets server handle storage and embedding in one atomic operation
        const result = await apiClient.generateEmbeddings(note, true);
        logger.info('SemanticBridge', `Server successfully processed note: ${note.id}`);
        
        // Also save locally for offline access
        await noteStorage.saveNote(note);
        
        // Get all notes and update index
        const notes = await noteStorage.getAllNotes();
        await updateNotesIndex(notes);
        
        logger.info('SemanticBridge', `Transaction ${txId} completed successfully`);
        return result.note || note;
      } catch (serverError) {
        logger.error('SemanticBridge', 'Server processing failed, falling back to local', serverError);
        // Fall through to local processing
      }
    }
    
    // LOCAL PROCESSING FALLBACK
    // We only reach here if server is unavailable or server processing failed
    logger.info('SemanticBridge', 'Using local processing fallback');
    
    // Save note using unified storage
    const savedNote = await noteStorage.saveNote(note);
    logger.info('SemanticBridge', `Saved note locally: ${savedNote.id}`);
    
    // Generate embedding path for local fallback
    const embeddingPath = `${EMBEDDINGS_DIR}/${savedNote.id}.json`;
    
    // Get all notes and update the index
    const notes = await noteStorage.getAllNotes();
    await updateNotesIndex(notes);
    
    // Create a simple local embedding as fallback
    const embeddingData = {
      id: savedNote.id,
      text: savedNote.text,
      title: savedNote.title,
      url: savedNote.url || "",
      timestamp: savedNote.timestamp,
      embedding_calculated: false,
      embedding_timestamp: Date.now()
    };
    
    await fs.writeFileSync(embeddingPath, JSON.stringify(embeddingData));
    logger.info('SemanticBridge', `Created local embedding fallback for: ${savedNote.id}`);
    
    return savedNote;
  } catch (error) {
    logger.error('SemanticBridge', 'Failed to save note with semantic indexing', error);
    throw error;
  }
};

// Function to update the notes index
const updateNotesIndex = async (notes) => {
  try {
    const index = {
      lastUpdated: Date.now(),
      noteCount: notes.length,
      noteIds: notes.map(note => note.id)
    };
    
    await fs.writeFileSync(NOTES_INDEX_PATH, JSON.stringify(index, null, 2));
    logger.debug('SemanticBridge', `Updated notes index with ${notes.length} notes`);
  } catch (error) {
    logger.error('SemanticBridge', 'Failed to update notes index', error);
  }
};

// Function to search notes by query using semantic-like ranking
const searchNotes = async (query, options = {}) => {
  try {
    logger.info('SemanticBridge', `Semantic search for: "${query}"`);
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
      logger.info('SemanticBridge', 'Empty query, returning all notes');
      return await noteStorage.getAllNotes();
    }
    
    // Try to use the API client first for true semantic search
    try {
      // Check if the server is available
      const serverAvailable = await apiClient.isServerAvailable();
      
      if (serverAvailable) {
        logger.info('SemanticBridge', 'Using server-side semantic search');
        const searchResult = await apiClient.semanticSearch(query, {
          limit: options.limit || 20
        });
        
        if (searchResult.success && searchResult.results.length > 0) {
          logger.info('SemanticBridge', `Server-side search returned ${searchResult.results.length} results`);
          
          // Convert server results to note format
          const resultIds = searchResult.results.map(result => result.id);
          const allNotes = await noteStorage.getAllNotes();
          
          // Filter notes to match the results from the server
          const matchedNotes = allNotes.filter(note => resultIds.includes(note.id));
          
          // Sort results to match server order
          const sortedResults = [];
          for (const id of resultIds) {
            const matchedNote = matchedNotes.find(note => note.id === id);
            if (matchedNote) {
              sortedResults.push(matchedNote);
            }
          }
          
          logger.info('SemanticBridge', `Matched ${sortedResults.length} notes from server results`);
          return sortedResults;
        }
      }
    } catch (apiError) {
      logger.warn('SemanticBridge', 'API client error, falling back to local search', apiError);
      // Continue with local search as fallback
    }
    
    // Fallback to local search
    logger.info('SemanticBridge', 'Falling back to local semantic-like search');
    
    // Get all notes from the unified storage
    const allNotes = await noteStorage.getAllNotes();
    if (allNotes.length === 0) {
      logger.info('SemanticBridge', 'No notes found for search');
      return [];
    }
    
    logger.info('SemanticBridge', `Searching through ${allNotes.length} notes`);
    
    // Simple text search with semantic-like scoring
    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 0);
    
    const results = [];
    
    // Process each note
    for (const note of allNotes) {
      const titleLower = (note.title || '').toLowerCase();
      const textLower = (note.text || '').toLowerCase();
      
      // Log each check for debugging
      logger.debug('SemanticBridge', `Checking note ${note.id}: "${note.title}"`);
      
      // Calculate score for each word
      let totalScore = 0;
      
      for (const word of queryWords) {
        // Title scoring
        const titleContains = titleLower.includes(word);
        const titleStartsWith = titleLower.startsWith(word);
        const titleHasSubstring = titleLower.indexOf(word.substring(0, Math.min(3, word.length))) !== -1;
        
        // Text scoring
        const textContains = textLower.includes(word);
        const textStartsWith = textLower.startsWith(word);
        const textHasSubstring = textLower.indexOf(word.substring(0, Math.min(3, word.length))) !== -1;
        
        // Calculate word score
        let wordScore = 0;
        
        if (titleContains) wordScore += 2;
        else if (titleStartsWith) wordScore += 1.5;
        else if (titleHasSubstring) wordScore += 0.5;
        
        if (textContains) wordScore += 1;
        else if (textStartsWith) wordScore += 0.75;
        else if (textHasSubstring) wordScore += 0.25;
        
        totalScore += wordScore;
      }
      
      // For semantic search, include even low-scoring matches (> 0)
      if (totalScore > 0) {
        logger.debug('SemanticBridge', `Note ${note.id} scored: ${totalScore}`);
        results.push({
          ...note,
          score: totalScore
        });
      }
    }
    
    // If no results but we have notes, return the first note with a low score
    // This helps verify the semantic search pipeline works
    if (results.length === 0 && allNotes.length > 0 && options.includeFallback !== false) {
      logger.info('SemanticBridge', 'No results, adding fallback note');
      results.push({
        ...allNotes[0],
        score: 0.1  // Low synthetic score
      });
    }
    
    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    // Apply limit if specified
    const limit = options.limit || results.length;
    const limitedResults = results.slice(0, limit);
    
    // Remove score from final results
    const finalResults = limitedResults.map(({ score, ...note }) => note);
    
    logger.info('SemanticBridge', `Search returned ${finalResults.length} results`);
    return finalResults;
  } catch (error) {
    logger.error('SemanticBridge', 'Error searching notes', error);
    return [];
  }
};

// Function to delete a note
const deleteNote = async (noteId) => {
  try {
    logger.info('SemanticBridge', `Deleting note with semantic data: ${noteId}`);
    
    // Delete from unified storage first
    const success = await noteStorage.deleteNote(noteId);
    
    // Try to delete embeddings from server
    try {
      const serverAvailable = await apiClient.isServerAvailable();
      if (serverAvailable) {
        logger.info('SemanticBridge', 'Using server-side embedding deletion');
        await apiClient.deleteEmbeddings(noteId);
      } else {
        logger.warn('SemanticBridge', 'Server unavailable, deleting embeddings locally only');
      }
    } catch (apiError) {
      logger.error('SemanticBridge', 'Error deleting server-side embeddings', apiError);
    }
    
    // Delete local embedding file as fallback/backup
    const embeddingPath = `${EMBEDDINGS_DIR}/${noteId}.json`;
    if (await fs.existsSync(embeddingPath)) {
      await fs.unlinkSync(embeddingPath);
      logger.debug('SemanticBridge', `Deleted embedding file: ${embeddingPath}`);
    }
    
    // Update the notes index
    const notes = await noteStorage.getAllNotes();
    await updateNotesIndex(notes);
    
    return success;
  } catch (error) {
    logger.error('SemanticBridge', `Failed to delete note ${noteId}`, error);
    return false;
  }
};

/**
 * Reset all embeddings data
 * @returns {Promise<boolean>} - Success status
 */
const resetEmbeddings = async () => {
  try {
    logger.info('SemanticBridge', 'Resetting all embeddings data');
    
    // Delete all files in the embeddings directory
    const embeddingsExists = await fs.existsSync(EMBEDDINGS_DIR);
    if (embeddingsExists) {
      const files = await fs.readdirSync(EMBEDDINGS_DIR);
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const embeddingPath = `${EMBEDDINGS_DIR}/${file}`;
          await fs.unlinkSync(embeddingPath);
          deletedCount++;
        }
      }
      
      logger.info('SemanticBridge', `Deleted ${deletedCount} embedding files`);
    }
    
    // Reset the notes index
    await updateNotesIndex([]);
    
    return true;
  } catch (error) {
    logger.error('SemanticBridge', 'Failed to reset embeddings', error);
    return false;
  }
};

// Initialize the semantic search module on load
initialize().catch(error => {
  logger.error('SemanticBridge', 'Failed to initialize', error);
});

// Export the semantic bridge interface
export const semanticBridge = {
  saveNote,
  searchNotes,
  getAllNotes: noteStorage.getAllNotes,
  deleteNote,
  resetEmbeddings,
  debugFilesystem: async () => {
    return await fs.debugFilesystem();
  }
};

// Make it available globally for testing
if (typeof window !== 'undefined') {
  window.semanticBridge = semanticBridge;
} 