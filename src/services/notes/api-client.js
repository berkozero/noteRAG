/**
 * API Client for NoteRAG Server
 * 
 * This module provides an interface to the server-side functionality.
 * It includes fallback mechanisms to ensure notes continue to work even when the server is unavailable.
 */

import { logger } from '../../utils/logger';

// API configuration
const API_CONFIG = {
  baseUrl: 'http://localhost:8000/api',
  timeout: 10000, // 10 seconds timeout
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
    
    // Check server availability using the API endpoint
    const response = await fetch(`${API_CONFIG.baseUrl}/notes`, {
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
 * @returns {Promise<Array>} Array of note objects
 */
export async function getAllNotes() {
  try {
    // First check server availability with detailed logging
    logger.info('ApiClient', 'Checking server availability before fetching all notes');
    const available = await isServerAvailable();
    
    if (!available) {
      logger.error('ApiClient', 'Failed to get all notes from server - Server unavailable');
      throw new Error('Server unavailable');
    }

    logger.info('ApiClient', `Fetching all notes from server at ${API_CONFIG.baseUrl}/notes`);
    
    const response = await fetch(`${API_CONFIG.baseUrl}/notes`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.error('ApiClient', `Server responded with ${response.status}: ${response.statusText}`, errorText);
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const notes = await response.json();
    logger.info('ApiClient', `Successfully retrieved ${notes.length} notes from server`);
    return notes;
  } catch (error) {
    logger.error('ApiClient', 'Failed to get all notes from server', error);
    // Return an empty array instead of throwing, to avoid breaking the UI
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
 * Search notes
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
export async function searchNotes(query, options = {}) {
  try {
    const available = await isServerAvailable();
    if (!available) {
      throw new Error('Server unavailable');
    }
    
    logger.info('ApiClient', `Performing search for query: "${query}"`);
    
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
    logger.error('ApiClient', 'Failed to perform search', error);
    return {
      success: false,
      message: error.message,
      results: []
    };
  }
}

// For backward compatibility, keep semanticSearch as alias to searchNotes
export const semanticSearch = searchNotes;

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

/**
 * Ask a question about the notes and get an AI-generated answer
 * @param {string} question - The question to ask
 * @returns {Promise<Object>} The answer and sources used
 */
async function askQuestion(question) {
  try {
    const requestId = `ask_${Date.now()}`;
    logger.info('ApiClient', `[${requestId}] Starting question request: "${question.substring(0, 30)}..."`);
    
    // Verify server availability first with explicit logging
    const available = await isServerAvailable();
    if (!available) {
      logger.error('ApiClient', `[${requestId}] Server unavailable, cannot process question`);
      return {
        success: false,
        error: 'Server is currently unavailable. Please try again later.'
      };
    }
    
    logger.info('ApiClient', `[${requestId}] Server available, sending question to ${API_CONFIG.baseUrl}/ask`);
    
    const startTime = Date.now();
    const response = await fetch(`${API_CONFIG.baseUrl}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      },
      body: JSON.stringify({ question })
    });
    
    const requestTime = Date.now() - startTime;
    logger.info('ApiClient', `[${requestId}] Received response in ${requestTime}ms, status: ${response.status}`);
    
    if (!response.ok) {
      // Try to get error details from response
      let errorDetail = 'Unknown server error';
      try {
        const errorData = await response.json();
        errorDetail = errorData.error || `Server error: ${response.status} ${response.statusText}`;
        logger.error('ApiClient', `[${requestId}] Error response:`, errorData);
      } catch (parseError) {
        errorDetail = `Server error: ${response.status} ${response.statusText}`;
        logger.error('ApiClient', `[${requestId}] Could not parse error response:`, parseError);
      }
      
      return {
        success: false,
        error: errorDetail
      };
    }
    
    const data = await response.json();
    logger.info('ApiClient', `[${requestId}] Successfully parsed response data`);
    
    // Validate the response format
    if (!data.answer) {
      logger.error('ApiClient', `[${requestId}] Invalid response format, missing answer:`, data);
      return {
        success: false,
        error: 'Server returned invalid response format'
      };
    }
    
    logger.info('ApiClient', `[${requestId}] Request completed successfully with ${data.sources?.length || 0} sources`);
    
    return {
      success: true,
      answer: data.answer,
      sources: data.sources || []
    };
  } catch (error) {
    logger.error('ApiClient', 'Exception during question processing', error);
    return {
      success: false,
      error: 'Could not connect to server: ' + (error.message || 'Unknown error')
    };
  }
}

/**
 * Run a diagnostic check on the server connection
 * Helps identify issues with the server configuration
 */
async function testServerConnection() {
  try {
    logger.info('ApiClient', '=== Running server connection diagnostics ===');
    
    // Test base URL without API path
    const baseUrl = API_CONFIG.baseUrl.split('/api')[0];
    logger.info('ApiClient', `Testing base URL: ${baseUrl}`);
    
    try {
      const baseResponse = await fetch(baseUrl, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });
      logger.info('ApiClient', `Base URL response: ${baseResponse.status} ${baseResponse.statusText}`);
    } catch (e) {
      logger.error('ApiClient', `Base URL test failed: ${e.message}`);
    }
    
    // Test API endpoint
    logger.info('ApiClient', `Testing API URL: ${API_CONFIG.baseUrl}`);
    try {
      const apiResponse = await fetch(API_CONFIG.baseUrl, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });
      logger.info('ApiClient', `API URL response: ${apiResponse.status} ${apiResponse.statusText}`);
    } catch (e) {
      logger.error('ApiClient', `API URL test failed: ${e.message}`);
    }
    
    // Test notes endpoint specifically
    logger.info('ApiClient', `Testing notes endpoint: ${API_CONFIG.baseUrl}/notes`);
    try {
      const notesResponse = await fetch(`${API_CONFIG.baseUrl}/notes`, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });
      logger.info('ApiClient', `Notes endpoint response: ${notesResponse.status} ${notesResponse.statusText}`);
      
      if (notesResponse.ok) {
        const data = await notesResponse.json();
        logger.info('ApiClient', `Notes data retrieved: ${data.length} notes`);
      }
    } catch (e) {
      logger.error('ApiClient', `Notes endpoint test failed: ${e.message}`);
    }
    
    logger.info('ApiClient', '=== Diagnostics complete ===');
  } catch (e) {
    logger.error('ApiClient', 'Diagnostics failed', e);
  }
}

// Run diagnostics on module load to help identify issues
testServerConnection();

export default {
  isServerAvailable,
  createNote,
  updateNote,
  getNote,
  getAllNotes,
  deleteNote,
  searchNotes,
  askQuestion
}; 