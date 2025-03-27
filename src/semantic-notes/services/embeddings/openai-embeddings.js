/**
 * OpenAI-based embedding service for generating high-quality embeddings
 * for semantic search capabilities
 */
const fs = require('fs-extra');
const path = require('path');
const { OpenAIEmbeddings } = require('@langchain/openai');
const config = require('../../config');
const logger = require('../../utils/logger');

// Cache for document embeddings to avoid redundant API calls
let embeddingCache = {};

// Path for saving embeddings cache
const CACHE_FILE_PATH = config.cache.cacheFilePath;

// OpenAI embeddings instance
let embeddings = null;

/**
 * Initialize the embedding service
 * @returns {Promise<boolean>} Success status
 */
async function init() {
  logger.info('Initializing OpenAI embedding service');
  
  try {
    // Check for API key
    if (!config.openai.apiKey) {
      logger.warn('OpenAI API key not found, embeddings will not work properly');
      return false;
    }
    
    // Initialize OpenAI embeddings with the configured API key and model
    embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openai.apiKey,
      modelName: config.openai.embeddingModel,
    });
    
    logger.info(`Using OpenAI model: ${config.openai.embeddingModel}`);
    
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
    logger.error('Failed to initialize OpenAI embedding service', error);
    return false;
  }
}

/**
 * Get embedding for text using OpenAI
 * @param {string} text - Text to get embedding for
 * @returns {Promise<number[]>} Embedding vector
 */
async function getEmbedding(text) {
  if (!text || typeof text !== 'string') {
    logger.warn('Empty or invalid text provided for embedding');
    return [];
  }
  
  try {
    // Check if embeddings service is initialized
    if (!embeddings) {
      throw new Error('OpenAI embeddings service not initialized');
    }
    
    // Generate embeddings using OpenAI
    const embedding = await embeddings.embedQuery(text);
    logger.debug(`Created OpenAI embedding for text (${text.length} chars)`);
    return embedding;
  } catch (error) {
    logger.error('Error generating OpenAI embedding', error);
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