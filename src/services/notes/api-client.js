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
 * Generate embeddings for a note
 * @param {Object} note - Note object to embed
 * @returns {Promise<Object>} Response from the server
 */
export async function generateEmbeddings(note) {
  try {
    // First check if server is available
    const available = await isServerAvailable();
    if (!available) {
      logger.warn('ApiClient', 'Server unavailable, skipping embeddings generation');
      return { 
        success: false, 
        message: 'Server unavailable' 
      };
    }
    
    logger.info('ApiClient', `Sending note ${note.id} for embedding generation`);
    
    // Log exactly what URL we're calling
    const url = `${API_CONFIG.baseUrl}/embeddings`;
    logger.info('ApiClient', `POST request to ${url}`);
    
    const response = await fetch(url, {
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