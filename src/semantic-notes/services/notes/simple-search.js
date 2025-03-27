/**
 * Simple search service for notes
 * Implements keyword, semantic, and hybrid search
 */
const embeddings = require('../embeddings/simple-embeddings');
const storage = require('./simple-storage');
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * Initialize the search service
 * @returns {Promise<boolean>} Success status
 */
async function init() {
  logger.info('Initializing simple search service');
  
  try {
    const embeddingsInitialized = await embeddings.init();
    if (!embeddingsInitialized) {
      logger.error('Failed to initialize embeddings service');
      return false;
    }
    
    logger.info('Simple search service initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize search service', error);
    return false;
  }
}

/**
 * Perform a keyword search on notes
 * @param {string} query - The search query
 * @param {Object} options - Search options
 * @param {number} [options.limit=10] - Maximum number of results
 * @returns {Promise<Array>} Matching notes
 */
async function keywordSearch(query, options = {}) {
  const { limit = config.search.maxResultsPerPage } = options;
  
  try {
    // If empty query, return all notes (sorted by recency)
    if (!query || query.trim() === '') {
      const allNotes = await storage.getAllNotes();
      
      // Sort by recency (most recent first)
      const sorted = allNotes.sort((a, b) => {
        const dateA = new Date(a.updated || a.created);
        const dateB = new Date(b.updated || b.created);
        return dateB - dateA;
      });
      
      return sorted.slice(0, limit);
    }
    
    // Get all notes
    const allNotes = await storage.getAllNotes();
    
    // Normalize query for case-insensitive matching
    const normalizedQuery = query.toLowerCase();
    
    // Filter notes that match the query
    const matches = allNotes.filter(note => {
      const title = (note.title || '').toLowerCase();
      const content = (note.content || '').toLowerCase();
      const url = (note.url || '').toLowerCase();
      
      return (
        title.includes(normalizedQuery) ||
        content.includes(normalizedQuery) ||
        url.includes(normalizedQuery)
      );
    });
    
    // Sort by relevance (simple implementation)
    const scored = matches.map(note => {
      const title = (note.title || '').toLowerCase();
      const content = (note.content || '').toLowerCase();
      
      // More weight for title matches
      let score = 0;
      if (title.includes(normalizedQuery)) score += 2;
      if (content.includes(normalizedQuery)) score += 1;
      
      return { ...note, score };
    });
    
    // Sort by score (highest first), then by recency
    const sorted = scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      
      const dateA = new Date(a.updated || a.created);
      const dateB = new Date(b.updated || b.created);
      return dateB - dateA;
    });
    
    // Remove the score property from results
    const results = sorted.map(({ score, ...note }) => note);
    
    logger.debug(`Keyword search for "${query}" found ${results.length} matches`);
    return results.slice(0, limit);
  } catch (error) {
    logger.error(`Error in keyword search for "${query}"`, error);
    return [];
  }
}

/**
 * Perform a semantic search on notes
 * @param {string} query - The search query
 * @param {Object} options - Search options
 * @param {number} [options.limit=10] - Maximum number of results
 * @param {number} [options.threshold=0.7] - Minimum similarity score
 * @param {boolean} [options.includeScores=false] - Include similarity scores
 * @returns {Promise<Array>} Matching notes
 */
async function semanticSearch(query, options = {}) {
  const { 
    limit = config.search.maxResultsPerPage, 
    threshold = 0.7, 
    includeScores = false 
  } = options;
  
  try {
    // If empty query, return empty results
    if (!query || query.trim() === '') {
      return [];
    }
    
    // Query embeddings service
    const results = await embeddings.queryDocuments(query, {
      limit,
      threshold,
      includeScores
    });
    
    // Get the full notes for the results
    const notes = [];
    for (const result of results) {
      const note = await storage.getNote(result.id);
      if (note) {
        // Add score if requested
        if (includeScores && result.score !== undefined) {
          notes.push({ ...note, score: result.score });
        } else {
          notes.push(note);
        }
      }
    }
    
    logger.debug(`Semantic search for "${query}" found ${notes.length} matches`);
    return notes;
  } catch (error) {
    logger.error(`Error in semantic search for "${query}"`, error);
    return [];
  }
}

/**
 * Perform a hybrid search (combining keyword and semantic)
 * @param {string} query - The search query
 * @param {Object} options - Search options
 * @param {number} [options.limit=10] - Maximum number of results
 * @param {number} [options.threshold=0.7] - Minimum similarity score
 * @param {boolean} [options.includeScores=false] - Include similarity scores
 * @returns {Promise<Array>} Matching notes
 */
async function hybridSearch(query, options = {}) {
  const { 
    limit = config.search.maxResultsPerPage, 
    threshold = 0.7, 
    includeScores = false 
  } = options;
  
  try {
    // If empty query, return recent notes
    if (!query || query.trim() === '') {
      return keywordSearch('', { limit });
    }
    
    // Run both search types in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      semanticSearch(query, { ...options, limit: limit * 2, includeScores: true })
        .catch(err => {
          logger.error('Error in semantic part of hybrid search', err);
          return [];
        }),
      keywordSearch(query, { limit: limit * 2 })
        .catch(err => {
          logger.error('Error in keyword part of hybrid search', err);
          return [];
        })
    ]);
    
    // Combine results, prioritizing semantic matches
    const combinedResultsMap = new Map();
    
    // Add semantic results first
    for (const result of semanticResults) {
      combinedResultsMap.set(result.id, {
        ...result,
        source: 'semantic',
        rank: result.score || 0.5 // Default score if missing
      });
    }
    
    // Add keyword results with lower rank if not already included
    for (const result of keywordResults) {
      if (!combinedResultsMap.has(result.id)) {
        combinedResultsMap.set(result.id, {
          ...result,
          source: 'keyword',
          rank: 0.4 // Lower than semantic by default
        });
      }
    }
    
    // Convert to array and sort by rank
    let combined = Array.from(combinedResultsMap.values())
      .sort((a, b) => b.rank - a.rank)
      .slice(0, limit);
    
    // Remove internal properties if scores not requested
    if (!includeScores) {
      combined = combined.map(({ source, rank, score, ...note }) => note);
    }
    
    logger.debug(`Hybrid search for "${query}" found ${combined.length} matches`);
    logger.debug(`Semantic: ${semanticResults.length}, Keyword: ${keywordResults.length}`);
    
    return combined;
  } catch (error) {
    logger.error(`Error in hybrid search for "${query}"`, error);
    
    // Fallback to keyword search if hybrid fails
    try {
      return await keywordSearch(query, { limit });
    } catch (fallbackError) {
      logger.error('Fallback keyword search also failed', fallbackError);
      return [];
    }
  }
}

module.exports = {
  init,
  keywordSearch,
  semanticSearch,
  hybridSearch
}; 