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
 * Generate embeddings for a note with proper request deduplication
 * @param {Object} note - Note object to embed
 * @param {boolean} createNote - Whether to create a new note (default: false)
 * @returns {Promise<Object>} Response from the server
 */
export async function generateEmbeddings(note, createNote = false) {
  try {
    // Create content-based key for deduplication
    const contentKey = _createContentKey(note);
    
    // Check for duplicate content request in the last 30 seconds
    if (recentContentRequests.has(contentKey)) {
      logger.info('ApiClient', `Deduplicating identical content request in last 30s for note "${note.title}"`);
      return recentContentRequests.get(contentKey);
    }
    
    // Check if there's already a pending request for this note ID
    if (pendingRequests.has(note.id)) {
      logger.info('ApiClient', `Request for note ${note.id} already in progress, reusing promise`);
      return pendingRequests.get(note.id);
    }

    logger.info('ApiClient', `Sending note ${note.id} for embedding generation`);
    
    // Create the request promise
    const requestPromise = (async () => {
      try {
        // Use the embeddings/update endpoint when we don't want to create a note
        const endpoint = createNote ? 'embeddings' : 'embeddings/update';
        
        const response = await fetch(`${API_CONFIG.baseUrl}/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ note })
        });
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        logger.info('ApiClient', `Successfully generated embeddings for note ${note.id}`);
        return result;
      } finally {
        // Clean up the pending request regardless of success/failure
        pendingRequests.delete(note.id);
        
        // After a delay, remove from content cache too (30 seconds)
        setTimeout(() => {
          recentContentRequests.delete(contentKey);
          logger.debug('ApiClient', `Removed content request cache for "${note.title}"`);
        }, 30000);
      }
    })();
    
    // Store the promise for this note ID
    pendingRequests.set(note.id, requestPromise);
    
    // Also store by content key
    recentContentRequests.set(contentKey, requestPromise);
    
    return await requestPromise;
  } catch (error) {
    logger.error('ApiClient', 'Failed to generate embeddings', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Delete embeddings for a note
 * @param {string} noteId - ID of the note to delete embeddings for
 * @returns {Promise<Object>} Response from the server
 */
export async function deleteEmbeddings(noteId) {
  try {
    // Check if server is available
    const available = await isServerAvailable();
    if (!available) {
      logger.warn('ApiClient', 'Server unavailable, skipping embeddings deletion');
      return { 
        success: false, 
        message: 'Server unavailable' 
      };
    }
    
    logger.info('ApiClient', `Deleting embeddings for note ${noteId}`);
    
    const response = await fetch(`${API_CONFIG.baseUrl}/embeddings/${noteId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    logger.info('ApiClient', `Successfully deleted embeddings for note ${noteId}`);
    return result;
  } catch (error) {
    logger.error('ApiClient', 'Failed to delete embeddings', error);
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
    // Check if server is available
    const available = await isServerAvailable();
    if (!available) {
      logger.warn('ApiClient', 'Server unavailable, cannot perform semantic search');
      return { 
        success: false, 
        message: 'Server unavailable', 
        results: [] 
      };
    }
    
    logger.info('ApiClient', `Performing semantic search for query: "${query}"`);
    
    // Build query parameters
    const params = new URLSearchParams({
      q: query,
      limit: options.limit || 10
    });
    
    const response = await fetch(`${API_CONFIG.baseUrl}/search?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    logger.info('ApiClient', `Semantic search returned ${result.results?.length || 0} results`);
    return result;
  } catch (error) {
    logger.error('ApiClient', 'Semantic search failed', error);
    return {
      success: false,
      message: error.message,
      results: []
    };
  }
}

export default {
  isServerAvailable,
  generateEmbeddings,
  deleteEmbeddings,
  semanticSearch
}; 