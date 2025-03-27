/**
 * Search service for notes with semantic capabilities
 */
const embeddings = require('../embeddings');
const storage = require('./storage');
const vectorUtils = require('../../utils/vector');
const logger = require('../../utils/logger');
const config = require('../../utils/config');

/**
 * Initialize the search service
 * @returns {Promise<boolean>} - Success status
 */
async function init() {
  try {
    await embeddings.init();
    return true;
  } catch (error) {
    logger.error('Search', 'Failed to initialize search service', error);
    return false;
  }
}

/**
 * Basic keyword search for notes
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Search results
 */
async function keywordSearch(query, options = {}) {
  try {
    const { limit = config.settings.maxResultsPerPage } = options;
    
    if (!query || query.trim() === '') {
      const allNotes = await storage.getAllNotes();
      return {
        success: true,
        notes: allNotes.slice(0, limit),
        total: allNotes.length
      };
    }
    
    const notes = await storage.getAllNotes();
    const normalizedQuery = query.toLowerCase().trim();
    
    // Filter notes by keyword
    const matchingNotes = notes.filter(note => {
      const content = (note.text || '').toLowerCase();
      const title = (note.title || '').toLowerCase();
      const tags = (note.tags || []).join(' ').toLowerCase();
      return content.includes(normalizedQuery) || title.includes(normalizedQuery) || tags.includes(normalizedQuery);
    });
    
    // Sort by recency (newest first)
    const sortedNotes = matchingNotes.sort((a, b) => b.timestamp - a.timestamp);
    
    logger.info('Search', `Keyword search found ${matchingNotes.length} matches for "${query}"`);
    
    return {
      success: true,
      notes: sortedNotes.slice(0, limit),
      total: sortedNotes.length
    };
  } catch (error) {
    logger.error('Search', `Error in keyword search: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Semantic search using embeddings
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Search results
 */
async function semanticSearch(query, options = {}) {
  try {
    const {
      limit = config.settings.maxResultsPerPage,
      threshold = 0.5, // Minimum similarity score
      includeScores = false
    } = options;
    
    if (!query || query.trim() === '') {
      const allNotes = await storage.getAllNotes();
      return {
        success: true,
        notes: allNotes.slice(0, limit),
        total: allNotes.length
      };
    }
    
    // Get embedding for the query
    const queryEmbResult = await embeddings.getEmbedding(query);
    
    if (!queryEmbResult.success) {
      logger.error('Search', `Failed to get embedding for query: ${queryEmbResult.error}`);
      return {
        success: false,
        error: `Failed to generate embedding: ${queryEmbResult.error}`
      };
    }
    
    // Get all notes
    const notes = await storage.getAllNotes();
    
    // Filter notes that have embeddings
    const notesWithEmbeddings = notes.filter(note => note.embedding && note.embedding.length > 0);
    
    // If no notes have embeddings, return an empty result
    if (notesWithEmbeddings.length === 0) {
      logger.info('Search', 'No notes with embeddings found. Run embedding generation first.');
      return {
        success: true,
        notes: [],
        total: 0,
        needsEmbeddings: true
      };
    }
    
    // Rank notes by similarity
    const rankedResults = vectorUtils.rankBySimilarity(
      notesWithEmbeddings,
      queryEmbResult.embedding,
      {
        threshold,
        limit: limit * 2 // Get more than we need to filter later
      }
    );
    
    // Prepare the result notes
    const resultNotes = rankedResults.slice(0, limit).map(result => {
      if (includeScores) {
        return {
          ...result.item,
          similarity: result.score
        };
      }
      return result.item;
    });
    
    logger.info('Search', `Semantic search found ${rankedResults.length} matches for "${query}"`);
    
    return {
      success: true,
      notes: resultNotes,
      total: rankedResults.length
    };
  } catch (error) {
    logger.error('Search', `Error in semantic search: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Hybrid search combining keyword and semantic search
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Search results
 */
async function hybridSearch(query, options = {}) {
  try {
    const {
      limit = config.settings.maxResultsPerPage,
      keywordWeight = 0.3,
      semanticWeight = 0.7,
      includeScores = false
    } = options;
    
    if (!query || query.trim() === '') {
      const allNotes = await storage.getAllNotes();
      return {
        success: true,
        notes: allNotes.slice(0, limit),
        total: allNotes.length
      };
    }
    
    // Perform both searches
    const keywordResults = await keywordSearch(query, { limit: limit * 2 });
    const semanticResults = await semanticSearch(query, { 
      limit: limit * 2, 
      threshold: 0.3,
      includeScores: true
    });
    
    if (!keywordResults.success) {
      logger.error('Search', `Keyword search failed: ${keywordResults.error}`);
      // Fall back to semantic search only
      return semanticResults;
    }
    
    if (!semanticResults.success || !semanticResults.notes || semanticResults.notes.length === 0) {
      logger.info('Search', 'Semantic search failed or returned no results, using keyword search');
      // Fall back to keyword search
      return keywordResults;
    }
    
    // Get all notes and create a map by ID
    const allNotes = await storage.getAllNotes();
    const notesMap = new Map();
    
    for (const note of allNotes) {
      notesMap.set(note.id, { ...note, keywordScore: 0, semanticScore: 0 });
    }
    
    // Update with keyword scores
    for (let i = 0; i < keywordResults.notes.length; i++) {
      const note = keywordResults.notes[i];
      const score = 1 - (i / keywordResults.notes.length); // Normalize to [0,1]
      
      if (notesMap.has(note.id)) {
        notesMap.get(note.id).keywordScore = score;
      }
    }
    
    // Update with semantic scores
    for (const note of semanticResults.notes) {
      if (notesMap.has(note.id)) {
        notesMap.get(note.id).semanticScore = note.similarity || 0;
      }
    }
    
    // Calculate combined scores
    const scoredNotes = Array.from(notesMap.values())
      .map(note => ({
        ...note,
        combinedScore: (note.keywordScore * keywordWeight) + (note.semanticScore * semanticWeight)
      }))
      .filter(note => note.combinedScore > 0)
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit);
    
    // Prepare final results
    const resultNotes = scoredNotes.map(note => {
      if (includeScores) {
        return {
          ...note,
          similarity: note.combinedScore
        };
      }
      
      // Remove the scoring properties
      const { keywordScore, semanticScore, combinedScore, ...cleanNote } = note;
      return cleanNote;
    });
    
    logger.info('Search', `Hybrid search found ${scoredNotes.length} matches for "${query}"`);
    
    return {
      success: true,
      notes: resultNotes,
      total: scoredNotes.length
    };
  } catch (error) {
    logger.error('Search', `Error in hybrid search: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate embeddings for all notes
 * @returns {Promise<Object>} - Generation results
 */
async function generateEmbeddingsForNotes() {
  try {
    // Get all notes
    const notes = await storage.getAllNotes();
    
    if (notes.length === 0) {
      return {
        success: true,
        processed: 0,
        skipped: 0,
        total: 0
      };
    }
    
    logger.info('Search', `Generating embeddings for ${notes.length} notes`);
    
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    
    // Process notes in batches of 5
    for (let i = 0; i < notes.length; i += 5) {
      const batch = notes.slice(i, i + 5);
      
      // Filter notes that don't have embeddings yet
      const notesToProcess = batch.filter(note => !note.embedding);
      
      if (notesToProcess.length === 0) {
        skipped += batch.length;
        continue;
      }
      
      // Get texts for embedding
      const texts = notesToProcess.map(note => {
        // Combine title and text for better embedding
        let content = note.text || '';
        if (note.title) {
          content = `${note.title}. ${content}`;
        }
        return content;
      });
      
      // Get embeddings for batch
      const embeddingResult = await embeddings.getEmbeddingBatch(texts);
      
      if (embeddingResult.success) {
        // Update each note with its embedding
        for (let j = 0; j < notesToProcess.length; j++) {
          const note = notesToProcess[j];
          const embedding = embeddingResult.embeddings[j];
          
          if (embedding) {
            await storage.updateNote(note.id, { embedding });
            processed++;
          } else {
            failed++;
          }
        }
      } else {
        failed += notesToProcess.length;
        logger.error('Search', `Failed to generate embeddings for batch: ${embeddingResult.error}`);
      }
      
      // Add the notes that already had embeddings to skipped count
      skipped += batch.length - notesToProcess.length;
    }
    
    logger.info('Search', `Embedding generation complete: ${processed} processed, ${skipped} skipped, ${failed} failed`);
    
    return {
      success: true,
      processed,
      skipped,
      failed,
      total: notes.length
    };
  } catch (error) {
    logger.error('Search', `Error generating embeddings: ${error.message}`, error);
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
  hybridSearch,
  generateEmbeddingsForNotes
}; 