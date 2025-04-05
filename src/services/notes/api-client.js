/**
 * API Client for NoteRAG Server
 * 
 * This module provides an interface to the server-side functionality.
 * It includes fallback mechanisms to ensure notes continue to work even when the server is unavailable.
 */

import { logger } from '../../utils/logger';

// Server configuration
const SERVER_CONFIG = {
  protocol: 'https',  // Default to secure HTTPS protocol
  host: 'localhost',
  port: 3444,         // Updated port for our HTTPS server
  path: 'api'
};

// API configuration
const API_CONFIG = {
  baseUrl: `${SERVER_CONFIG.protocol}://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}/${SERVER_CONFIG.path}`,
  timeout: 10000, // 10 seconds timeout
  retries: 2
};

// Fallback configuration (HTTP) - used if HTTPS connection fails
const FALLBACK_CONFIG = {
  baseUrl: `http://${SERVER_CONFIG.host}:3000/${SERVER_CONFIG.path}`,
  timeout: 10000,
  retries: 1
};

// Request tracking
const pendingRequests = new Map();

// Content-based deduplication cache with TTL (30 seconds)
const recentContentRequests = new Map();

// Track if we've fallen back to HTTP
let usingFallback = false;

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
 * Get the current API configuration based on connection status
 * @returns {Object} The current API configuration
 */
export function getCurrentConfig() {
  return usingFallback ? FALLBACK_CONFIG : API_CONFIG;
}

/**
 * Check if the API server is available
 * @param {boolean} tryFallback - Whether to try the fallback configuration if primary fails
 * @returns {Promise<boolean>} Whether the server is available
 */
export async function isServerAvailable(tryFallback = true) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    // Use current configuration
    const config = getCurrentConfig();
    
    // Check server availability using the API endpoint
    const response = await fetch(`${config.baseUrl}/notes`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const isAvailable = response.ok;
    
    logger.info('ApiClient', `Server availability check (${usingFallback ? 'HTTP fallback' : 'HTTPS'}): ${isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}`);
    return isAvailable;
  } catch (error) {
    logger.warn('ApiClient', `Server availability check failed (${usingFallback ? 'HTTP fallback' : 'HTTPS'})`, error);
    
    // If primary config failed and fallback is allowed, try fallback
    if (!usingFallback && tryFallback) {
      logger.info('ApiClient', 'Trying fallback HTTP configuration');
      usingFallback = true;
      return await isServerAvailable(false); // Don't allow nested fallback
    }
    
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

        // Get the current configuration
        const config = getCurrentConfig();
        logger.info('ApiClient', `Creating new note "${serverNote.title}" on server (${usingFallback ? 'HTTP fallback' : 'HTTPS'})`);
        
        const response = await fetch(`${config.baseUrl}/notes`, {
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

    // Get the current configuration
    const config = getCurrentConfig();
    logger.info('ApiClient', `Updating note ${noteId} on server (${usingFallback ? 'HTTP fallback' : 'HTTPS'})`);
    
    const response = await fetch(`${config.baseUrl}/notes/${noteId}`, {
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

    // Get the current configuration
    const config = getCurrentConfig();
    logger.info('ApiClient', `Fetching note ${noteId} from server (${usingFallback ? 'HTTP fallback' : 'HTTPS'})`);
    
    const response = await fetch(`${config.baseUrl}/notes/${noteId}`);
    
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
 * @returns {Promise<Array>} Array of notes
 */
export async function getAllNotes() {
  try {
    const available = await isServerAvailable();
    if (!available) {
      throw new Error('Server unavailable');
    }

    // Get the current configuration
    const config = getCurrentConfig();
    logger.info('ApiClient', `Fetching all notes from server (${usingFallback ? 'HTTP fallback' : 'HTTPS'})`);
    
    const response = await fetch(`${config.baseUrl}/notes`);
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const notes = await response.json();
    logger.info('ApiClient', `Successfully retrieved ${notes.length} notes from server`);
    return notes;
  } catch (error) {
    logger.error('ApiClient', 'Failed to get notes from server', error);
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

    // Get the current configuration
    const config = getCurrentConfig();
    logger.info('ApiClient', `Deleting note ${noteId} from server (${usingFallback ? 'HTTP fallback' : 'HTTPS'})`);
    
    const response = await fetch(`${config.baseUrl}/notes/${noteId}`, {
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
 * Search notes by semantic similarity
 * @param {string} query - Search query
 * @param {Object} options - Search options (limit, etc.)
 * @returns {Promise<Object>} Search results
 */
export async function semanticSearch(query, options = {}) {
  try {
    const available = await isServerAvailable();
    if (!available) {
      return {
        success: false,
        message: 'Server unavailable',
        results: []
      };
    }
    
    // Build query parameters
    const params = new URLSearchParams({
      q: query  // Parameter expected by server is 'q'
    });
    
    if (options.limit) {
      params.append('limit', options.limit);
    }

    // Get the current configuration
    const config = getCurrentConfig();
    logger.info('ApiClient', `Searching notes with query: "${query}" (${usingFallback ? 'HTTP fallback' : 'HTTPS'})`);
    
    // Use the correct API endpoint for semantic search
    const response = await fetch(`${config.baseUrl}/search?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    // The API returns { results: [...] } now
    const data = await response.json();
    const results = data.results || [];
    
    logger.info('ApiClient', `Search returned ${results.length} results`);
    
    return {
      success: true,
      results
    };
  } catch (error) {
    logger.error('ApiClient', 'Search failed', error);
    return {
      success: false,
      message: error.message,
      results: []
    };
  }
}

/**
 * Ask a question about the notes and get an answer
 * @param {string} question - The question to ask
 * @param {Object} options - Options for the question (e.g., maxResults)
 * @returns {Promise<Object>} The answer and source notes
 */
export async function askQuestion(question, options = {}) {
  try {
    // Generate a request ID for tracking
    const requestId = `ask_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    logger.debug('ApiClient', `[${requestId}] Ask question request started`);

    const available = await isServerAvailable();
    if (!available) {
      logger.warn('ApiClient', `[${requestId}] Server unavailable for ask question`);
      return {
        success: false,
        message: 'Server unavailable',
        answer: null,
        sources: []
      };
    }
    
    // Build query parameters
    const params = new URLSearchParams({
      q: question
    });
    
    if (options.maxResults) {
      params.append('top_k', options.maxResults);
    }

    // Get the current configuration
    const config = getCurrentConfig();
    logger.info('ApiClient', `[${requestId}] Asking question: "${question.substring(0, 50)}..." (${usingFallback ? 'HTTP fallback' : 'HTTPS'})`);
    
    const response = await fetch(`${config.baseUrl}/query?${params.toString()}`);
    
    if (!response.ok) {
      logger.error('ApiClient', `[${requestId}] Server error: ${response.status}`);
      
      let errorDetail = 'Unknown error';
      try {
        const errorData = await response.json();
        errorDetail = errorData.detail || `Server responded with ${response.status}`;
      } catch (e) {
        errorDetail = `Server responded with ${response.status}: ${response.statusText}`;
      }
      
      return {
        success: false,
        message: errorDetail,
        answer: null,
        sources: []
      };
    }
    
    // Parse the response
    const data = await response.json();
    
    // Validate response format
    if (!data.answer && !data.response) {
      logger.error('ApiClient', `[${requestId}] Invalid response format: missing answer`);
      return {
        success: false,
        message: 'Invalid server response format',
        answer: null,
        sources: []
      };
    }
    
    // Normalize the response format
    const result = {
      success: true,
      answer: data.answer || data.response, // Handle different response formats
      sources: data.sources || data.source_nodes || []
    };
    
    logger.info('ApiClient', `[${requestId}] Question answered successfully with ${result.sources.length} sources`);
    return result;
  } catch (error) {
    logger.error('ApiClient', 'Failed to ask question', error);
    return {
      success: false,
      message: error.message,
      answer: null,
      sources: []
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
  semanticSearch,
  askQuestion,
  usingFallback
}; 