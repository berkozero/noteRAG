/**
 * API Client for NoteRAG Semantic Search Server
 * 
 * This module provides an interface to the server-side semantic search functionality.
 * It includes fallback mechanisms to ensure notes continue to work even when the server is unavailable.
 */

import { logger } from '../../utils/logger';

// API configuration
const API_CONFIG = {
  baseUrl: 'http://localhost:3000/api',
  timeout: 5000, // 5 seconds timeout
  retries: 2
};

// Request tracking
const pendingRequests = new Map();

// Content-based deduplication cache with TTL (30 seconds)
const recentContentRequests = new Map();

/**
 * Create a content key for deduplication
 * @param {Object} note - Note to create key for
 * @returns {string} Content-based key
 * @private
 */
function _createContentKey(note) {
  // Use first 50 chars of content + title as a simple signature
  const text = (note.text || '').substring(0, 50);
  const title = (note.title || '').substring(0, 20);
  return `${title}_${text}`;
}

/**
 * Check if the API server is available
 * @returns {Promise<boolean>} Whether the server is available
 */
async function isServerAvailable() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    // The server has a root endpoint at http://localhost:3000/ (not /api/)
    // Use this to check server availability
    const response = await fetch('http://localhost:3000', {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const isAvailable = response.ok;
    
    logger.info('ApiClient', `Server availability check: ${isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}`);
    return isAvailable;
  } catch (error) {
    logger.warn('ApiClient', 'Server availability check failed', error);
    return false;
  }
}

/**
 * Create a new note on the server (source of truth)
 * @param {Object} note - Note object to create
 * @returns {Promise<Object>} Response from the server
 */
export async function createNote(note) {
  try {
    // Check for duplicate content request in the last 30 seconds
    const contentKey = _createContentKey(note);
    if (recentContentRequests.has(contentKey)) {
      logger.info('ApiClient', `Deduplicating identical content request in last 30s for note "${note.title}"`);
      return recentContentRequests.get(contentKey);
    }
    
    // Create the request promise
    const requestPromise = (async () => {
      try {
        const available = await isServerAvailable();
        if (!available) {
          return {
            success: false,
            message: 'Server unavailable'
          };
        }

        // Extract only the fields that the server expects/needs
        // Server will generate the ID for us
        const serverNote = {
          text: note.text,
          title: note.title,
          timestamp: note.timestamp || Date.now()
        };

        logger.info('ApiClient', `Creating new note "${serverNote.title}" on server`);
        
        const response = await fetch(`${API_CONFIG.baseUrl}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(serverNote)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          return {
            success: false,
            error: errorData.detail || `Server responded with ${response.status}: ${response.statusText}`,
            message: `Server responded with ${response.status}: ${response.statusText}`
          };
        }
        
        const result = await response.json();
        logger.info('ApiClient', `Successfully created note ${result.id} on server`);
        return result;
      } finally {
        // After a delay, remove from content cache (30 seconds)
        setTimeout(() => {
          recentContentRequests.delete(contentKey);
          logger.debug('ApiClient', `Removed content request cache for "${note.title}"`);
        }, 30000);
      }
    })();
    
    // Store in content cache
    recentContentRequests.set(contentKey, requestPromise);
    
    return await requestPromise;
  } catch (error) {
    logger.error('ApiClient', 'Failed to create note on server', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Update an existing note on the server
 * @param {string} noteId - ID of the note to update
 * @param {Object} noteData - Updated note data
 * @returns {Promise<Object>} Response from the server
 */
export async function updateNote(noteId, noteData) {
  try {
    const available = await isServerAvailable();
    if (!available) {
      throw new Error('Server unavailable');
    }

    logger.info('ApiClient', `Updating note ${noteId} on server`);
    
    const response = await fetch(`${API_CONFIG.baseUrl}/notes/${noteId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(noteData)
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    logger.info('ApiClient', `Successfully updated note ${noteId} on server`);
    return result;
  } catch (error) {
    logger.error('ApiClient', `Failed to update note ${noteId} on server`, error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get a specific note from the server
 * @param {string} noteId - ID of the note to retrieve
 * @returns {Promise<Object>} The requested note
 */
export async function getNote(noteId) {
  try {
    const available = await isServerAvailable();
    if (!available) {
      throw new Error('Server unavailable');
    }

    logger.info('ApiClient', `Fetching note ${noteId} from server`);
    
    const response = await fetch(`${API_CONFIG.baseUrl}/notes/${noteId}`);
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const note = await response.json();
    logger.info('ApiClient', `Successfully retrieved note ${noteId} from server`);
    return note;
  } catch (error) {
    logger.error('ApiClient', `Failed to get note ${noteId} from server`, error);
    return null;
  }
}

/**
 * Get all notes from the server
 * @returns {Promise<Array>} All notes from the server
 */
export async function getAllNotes() {
  try {
    const available = await isServerAvailable();
    if (!available) {
      throw new Error('Server unavailable');
    }

    logger.info('ApiClient', 'Fetching all notes from server');
    
    const response = await fetch(`${API_CONFIG.baseUrl}/notes`);
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const notes = await response.json();
    logger.info('ApiClient', `Successfully retrieved ${notes.length} notes from server`);
    return notes;
  } catch (error) {
    logger.error('ApiClient', 'Failed to get all notes from server', error);
    return [];
  }
}

/**
 * Delete a note from the server
 * @param {string} noteId - ID of the note to delete
 * @returns {Promise<Object>} Response from the server
 */
export async function deleteNote(noteId) {
  try {
    const available = await isServerAvailable();
    if (!available) {
      throw new Error('Server unavailable');
    }

    logger.info('ApiClient', `Deleting note ${noteId} from server`);
    
    const response = await fetch(`${API_CONFIG.baseUrl}/notes/${noteId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    logger.info('ApiClient', `Successfully deleted note ${noteId} from server`);
    return result;
  } catch (error) {
    logger.error('ApiClient', `Failed to delete note ${noteId} from server`, error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Perform a semantic search
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
export async function semanticSearch(query, options = {}) {
  try {
    const available = await isServerAvailable();
    if (!available) {
      throw new Error('Server unavailable');
    }
    
    logger.info('ApiClient', `Performing semantic search for query: "${query}"`);
    
    // Build query parameters
    const params = new URLSearchParams({
      query: query,
      limit: options.limit || 10
    });
    
    const response = await fetch(`${API_CONFIG.baseUrl}/notes/search?${params}`);
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const results = await response.json();
    logger.info('ApiClient', `Search found ${results.length} results`);
    return {
      success: true,
      results
    };
  } catch (error) {
    logger.error('ApiClient', 'Failed to perform semantic search', error);
    return {
      success: false,
      message: error.message,
      results: []
    };
  }
}

// Legacy compatibility function
export async function generateEmbeddings(note, createNote = false) {
  try {
    if (createNote) {
      // If creating a new note, use the new createNote function
      return await createNote(note);
    } else {
      // If updating, use the updateNote function
      return await updateNote(note.id, note);
    }
  } catch (error) {
    logger.error('ApiClient', 'Failed to generate embeddings (legacy function)', error);
    return {
      success: false,
      message: error.message
    };
  }
}

// Legacy compatibility function
export async function deleteEmbeddings(noteId) {
  return await deleteNote(noteId);
}

export default {
  isServerAvailable,
  createNote,
  updateNote,
  getNote,
  getAllNotes,
  deleteNote,
  semanticSearch
}; 