/**
 * ChromaDB-based search service for notes
 */
const chromadb = require('../embeddings/chromadb');
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * Initialize the search service
 * @returns {Promise<boolean>} - Success status
 */
async function init() {
  try {
    // ChromaDB is already initialized by the storage adapter
    logger.info('ChromaSearch', 'Search service initialized');
    return true;
  } catch (error) {
    logger.error('ChromaSearch', 'Failed to initialize search service', error);
    return false;
  }
}

/**
 * Perform a keyword search for notes
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Search results
 */
async function keywordSearch(query, options = {}) {
  try {
    const { limit = 5 } = options;
    
    // Empty query returns all documents
    if (!query || query.trim() === '') {
      // Get all notes
      const ids = await chromadb.getAllIds();
      
      if (ids.length === 0) {
        return { success: true, matches: [] };
      }
      
      // Get all documents and filter manually
      const allMatches = [];
      
      for (const id of ids) {
        const results = await chromadb.queryDocuments('', {
          filter: { ids: [id] },
          includeScore: false
        });
        
        if (results && results.length > 0) {
          allMatches.push(results[0]);
        }
      }
      
      // Sort by timestamp (newest first)
      allMatches.sort((a, b) => b.timestamp - a.timestamp);
      
      return {
        success: true,
        matches: allMatches.slice(0, limit)
      };
    }
    
    // Normalize query
    const normalizedQuery = query.toLowerCase().trim();
    
    // Get all documents and filter manually
    const ids = await chromadb.getAllIds();
    const matches = [];
    
    for (const id of ids) {
      const results = await chromadb.queryDocuments('', {
        filter: { ids: [id] },
        includeScore: false
      });
      
      if (results && results.length > 0) {
        const note = results[0];
        const text = note.text.toLowerCase();
        const title = (note.title || '').toLowerCase();
        
        if (
          text.includes(normalizedQuery) ||
          title.includes(normalizedQuery)
        ) {
          matches.push(note);
        }
      }
    }
    
    // Sort by timestamp (newest first)
    matches.sort((a, b) => b.timestamp - a.timestamp);
    
    logger.info('ChromaSearch', `Keyword search found ${matches.length} matches for "${query}"`);
    
    return {
      success: true,
      matches: matches.slice(0, limit)
    };
  } catch (error) {
    logger.error('ChromaSearch', `Error during keyword search: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Perform a semantic search for notes
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Search results
 */
async function semanticSearch(query, options = {}) {
  try {
    const { limit = 5, includeScore = true, threshold = 0.7 } = options;
    
    if (!query || query.trim() === '') {
      return {
        success: true,
        matches: []
      };
    }
    
    // Query ChromaDB
    const matches = await chromadb.queryDocuments(query, {
      limit,
      includeScore,
      threshold
    });
    
    logger.info('ChromaSearch', `Semantic search found ${matches.length} matches for "${query}"`);
    
    return {
      success: true,
      matches
    };
  } catch (error) {
    logger.error('ChromaSearch', `Error during semantic search: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Perform a hybrid search (both keyword and semantic)
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Search results
 */
async function hybridSearch(query, options = {}) {
  try {
    const { limit = 5 } = options;
    
    if (!query || query.trim() === '') {
      return keywordSearch(query, options);
    }
    
    // First, perform a semantic search
    let semanticResults = { success: false, matches: [] };
    try {
      semanticResults = await semanticSearch(query, {
        ...options,
        limit: limit * 2 // Get more results to allow merging
      });
    } catch (error) {
      logger.warn('ChromaSearch', `Semantic search failed, fallback to keyword: ${error.message}`);
    }
    
    // Then, perform a keyword search
    let keywordResults = { success: false, matches: [] };
    try {
      keywordResults = await keywordSearch(query, {
        ...options,
        limit: limit * 2 // Get more results to allow merging
      });
    } catch (error) {
      logger.warn('ChromaSearch', `Keyword search failed: ${error.message}`);
    }
    
    // Combine results from both searches
    const combinedMatches = [];
    const seenIds = new Set();
    
    // Add semantic results first (they're typically more relevant)
    if (semanticResults.success && semanticResults.matches.length > 0) {
      for (const match of semanticResults.matches) {
        if (!seenIds.has(match.id)) {
          seenIds.add(match.id);
          combinedMatches.push(match);
        }
      }
    }
    
    // Add keyword results
    if (keywordResults.success && keywordResults.matches.length > 0) {
      for (const match of keywordResults.matches) {
        if (!seenIds.has(match.id)) {
          seenIds.add(match.id);
          combinedMatches.push(match);
        }
      }
    }
    
    // Limit results
    const finalMatches = combinedMatches.slice(0, limit);
    
    logger.info('ChromaSearch', `Hybrid search found ${finalMatches.length} matches for "${query}"`);
    
    return {
      success: true,
      matches: finalMatches
    };
  } catch (error) {
    logger.error('ChromaSearch', `Error during hybrid search: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  init,
  keywordSearch,
  semanticSearch,
  hybridSearch
}; 