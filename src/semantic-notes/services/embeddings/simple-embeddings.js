/**
 * Simple embedding service that creates basic vector representations
 * for text-based semantic search without external dependencies
 */
const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const logger = require('../../utils/logger');

// In-memory cache of document embeddings
let embeddingCache = {};

// Embedding dimensions (smaller than OpenAI but works for simple cases)
const EMBEDDING_DIMENSIONS = 384;

// Path for saving embeddings
const CACHE_FILE_PATH = config.cache.cacheFilePath;

/**
 * Initialize the embedding service
 * @returns {Promise<boolean>} Success status
 */
async function init() {
  logger.info('Initializing simple embedding service');
  
  try {
    // Ensure the cache directory exists
    const cacheDir = path.dirname(CACHE_FILE_PATH);
    await fs.ensureDir(cacheDir);
    
    // Load existing embeddings if available
    if (await fs.pathExists(CACHE_FILE_PATH)) {
      embeddingCache = await fs.readJson(CACHE_FILE_PATH);
      logger.info(`Loaded ${Object.keys(embeddingCache).length} embeddings from cache`);
    } else {
      logger.info('No embedding cache found, starting with empty cache');
      await fs.writeJson(CACHE_FILE_PATH, {});
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize embedding service', error);
    return false;
  }
}

/**
 * Creates a simple embedding vector from text
 * This is a very basic approach that creates character frequency vectors
 * @param {string} text - Text to convert to embedding
 * @returns {number[]} Simple embedding vector
 */
function createSimpleEmbedding(text) {
  // Normalize the text
  const normalizedText = text.toLowerCase().trim();
  
  if (!normalizedText) {
    // Return zero vector for empty text
    return Array(EMBEDDING_DIMENSIONS).fill(0);
  }
  
  // Create a frequency map of characters
  const freqMap = {};
  for (const char of normalizedText) {
    freqMap[char] = (freqMap[char] || 0) + 1;
  }
  
  // Create embedding vector with character frequencies and random noise
  // This isn't a good embedding but it's simple and provides some basic functionality
  const embedding = Array(EMBEDDING_DIMENSIONS).fill(0);
  
  // Fill part of the vector with character frequencies
  const chars = Object.keys(freqMap);
  for (let i = 0; i < Math.min(chars.length, EMBEDDING_DIMENSIONS / 2); i++) {
    const char = chars[i];
    const idx = char.charCodeAt(0) % (EMBEDDING_DIMENSIONS / 2);
    embedding[idx] = freqMap[char] / normalizedText.length; // Normalize by text length
  }
  
  // Fill the rest with word-level features
  const words = normalizedText.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.length > 0) {
      // Use word length and position as features
      const idx = (EMBEDDING_DIMENSIONS / 2) + (i % (EMBEDDING_DIMENSIONS / 2));
      if (idx < EMBEDDING_DIMENSIONS) {
        embedding[idx] = word.length / 20; // Normalize by assuming max word length of 20
      }
    }
  }
  
  // Normalize the vector to unit length
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return magnitude === 0 
    ? embedding 
    : embedding.map(val => val / magnitude);
}

/**
 * Get embedding for text
 * @param {string} text - Text to get embedding for
 * @returns {Promise<number[]>} Embedding vector
 */
async function getEmbedding(text) {
  if (!text || typeof text !== 'string') {
    logger.warn('Empty or invalid text provided for embedding');
    return Array(EMBEDDING_DIMENSIONS).fill(0);
  }
  
  try {
    // Create simple embedding
    const embedding = createSimpleEmbedding(text);
    logger.debug(`Created embedding for text (${text.length} chars)`);
    return embedding;
  } catch (error) {
    logger.error('Error generating embedding', error);
    throw error;
  }
}

/**
 * Add a document to the embedding store
 * @param {string} id - Document ID
 * @param {string} text - Document text
 * @param {Object} metadata - Document metadata
 * @returns {Promise<boolean>} Success status
 */
async function addDocument(id, text, metadata = {}) {
  try {
    // Get embedding for text
    const embedding = await getEmbedding(text);
    
    // Store in cache
    embeddingCache[id] = { embedding, metadata };
    
    // Save cache to disk if enabled
    if (config.cache.enableEmbeddingCache) {
      await fs.writeJson(CACHE_FILE_PATH, embeddingCache);
    }
    
    logger.debug(`Added document with ID ${id} to embedding store`);
    return true;
  } catch (error) {
    logger.error(`Error adding document ${id}`, error);
    throw error;
  }
}

/**
 * Update a document in the embedding store
 * @param {string} id - Document ID
 * @param {string} text - Updated document text
 * @param {Object} metadata - Updated document metadata
 * @returns {Promise<boolean>} Success status
 */
async function updateDocument(id, text, metadata = {}) {
  try {
    // Check if document exists
    if (!embeddingCache[id]) {
      logger.warn(`Document ${id} not found for update`);
      return false;
    }
    
    // Get embedding for updated text
    const embedding = await getEmbedding(text);
    
    // Update in cache
    embeddingCache[id] = { embedding, metadata };
    
    // Save cache to disk if enabled
    if (config.cache.enableEmbeddingCache) {
      await fs.writeJson(CACHE_FILE_PATH, embeddingCache);
    }
    
    logger.debug(`Updated document with ID ${id} in embedding store`);
    return true;
  } catch (error) {
    logger.error(`Error updating document ${id}`, error);
    throw error;
  }
}

/**
 * Delete a document from the embedding store
 * @param {string} id - Document ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteDocument(id) {
  try {
    // Check if document exists
    if (!embeddingCache[id]) {
      logger.warn(`Document ${id} not found for deletion`);
      return false;
    }
    
    // Delete from cache
    delete embeddingCache[id];
    
    // Save cache to disk if enabled
    if (config.cache.enableEmbeddingCache) {
      await fs.writeJson(CACHE_FILE_PATH, embeddingCache);
    }
    
    logger.debug(`Deleted document with ID ${id} from embedding store`);
    return true;
  } catch (error) {
    logger.error(`Error deleting document ${id}`, error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} Similarity score (0-1)
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  
  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  
  // Cosine similarity is already normalized if vectors are unit vectors
  return Math.max(0, Math.min(1, dotProduct));
}

/**
 * Query for similar documents
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {number} [options.limit=5] - Maximum number of results
 * @param {number} [options.threshold=0.7] - Minimum similarity score
 * @param {boolean} [options.includeScores=false] - Include similarity scores
 * @returns {Promise<Array>} Matching documents
 */
async function queryDocuments(query, options = {}) {
  const { 
    limit = config.search.maxResultsPerPage, 
    threshold = 0.7, 
    includeScores = false 
  } = options;
  
  try {
    // Get query embedding
    const queryEmbedding = await getEmbedding(query);
    
    // Calculate similarities for all documents
    const results = Object.entries(embeddingCache)
      .map(([id, { embedding, metadata }]) => {
        const score = cosineSimilarity(queryEmbedding, embedding);
        return { id, score, metadata };
      })
      .filter(item => item.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    logger.debug(`Query found ${results.length} matching documents`);
    
    // Format results
    return includeScores
      ? results 
      : results.map(({ id, metadata }) => ({ id, metadata }));
  } catch (error) {
    logger.error('Error querying documents', error);
    throw error;
  }
}

/**
 * Get the count of documents in the store
 * @returns {Promise<number>} Document count
 */
async function getCount() {
  return Object.keys(embeddingCache).length;
}

/**
 * Get all document IDs
 * @returns {Promise<string[]>} Array of document IDs
 */
async function getAllIds() {
  return Object.keys(embeddingCache);
}

module.exports = {
  init,
  getEmbedding,
  addDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  getCount,
  getAllIds
}; 