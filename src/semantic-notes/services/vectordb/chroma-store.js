/**
 * In-memory vector store service for efficient semantic search
 * Uses OpenAI embeddings for semantic similarity
 */
const { OpenAIEmbeddings } = require('@langchain/openai');
const config = require('../../config');
const logger = require('../../utils/logger');

// In-memory document store
let documents = {};
let embeddingsCache = {};

// OpenAI embeddings instance
let embeddings = null;

/**
 * Initialize the vector store
 * @returns {Promise<boolean>} Success status
 */
async function init() {
  logger.info('Initializing in-memory vector store with OpenAI embeddings');
  
  try {
    // Check for API key
    if (!config.openai.apiKey) {
      logger.warn('OpenAI API key not found, embeddings will not work properly');
      return false;
    }
    
    // Initialize OpenAI embeddings
    embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openai.apiKey,
      modelName: config.openai.embeddingModel,
    });
    
    logger.info(`Using OpenAI model: ${config.openai.embeddingModel}`);
    
    // Reset document store
    documents = {};
    embeddingsCache = {};
    
    const count = Object.keys(documents).length;
    logger.info(`In-memory vector store initialized with ${count} documents`);
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize in-memory vector store', error);
    return false;
  }
}

/**
 * Add a document to the vector store
 * @param {string} id - Document ID
 * @param {string} text - Document text
 * @param {Object} metadata - Document metadata
 * @returns {Promise<boolean>} Success status
 */
async function addDocument(id, text, metadata = {}) {
  try {
    if (!embeddings) {
      throw new Error('Vector store not initialized');
    }
    
    // Generate embedding for the text
    const embedding = await embeddings.embedQuery(text);
    
    // Check for existing document with same ID
    if (documents[id]) {
      logger.warn(`Document with ID ${id} already exists, updating instead`);
      return updateDocument(id, text, metadata);
    }
    
    // Store document and embedding
    documents[id] = { text, metadata };
    embeddingsCache[id] = embedding;
    
    logger.debug(`Added document with ID ${id} to in-memory vector store`);
    return true;
  } catch (error) {
    logger.error(`Error adding document ${id} to vector store`, error);
    throw error;
  }
}

/**
 * Update a document in the vector store
 * @param {string} id - Document ID
 * @param {string} text - Updated document text
 * @param {Object} metadata - Updated document metadata
 * @returns {Promise<boolean>} Success status
 */
async function updateDocument(id, text, metadata = {}) {
  try {
    if (!embeddings) {
      throw new Error('Vector store not initialized');
    }
    
    // Generate embedding for the text
    const embedding = await embeddings.embedQuery(text);
    
    // Update document and embedding
    documents[id] = { text, metadata };
    embeddingsCache[id] = embedding;
    
    logger.debug(`Updated document with ID ${id} in in-memory vector store`);
    return true;
  } catch (error) {
    logger.error(`Error updating document ${id} in vector store`, error);
    throw error;
  }
}

/**
 * Delete a document from the vector store
 * @param {string} id - Document ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteDocument(id) {
  try {
    // Check if document exists
    if (!documents[id]) {
      logger.warn(`Document with ID ${id} not found for deletion`);
      return false;
    }
    
    // Delete document and embedding
    delete documents[id];
    delete embeddingsCache[id];
    
    logger.debug(`Deleted document with ID ${id} from in-memory vector store`);
    return true;
  } catch (error) {
    logger.error(`Error deleting document ${id} from vector store`, error);
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
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Query for similar documents
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {number} [options.limit=10] - Maximum number of results
 * @param {number} [options.threshold=0.1] - Minimum similarity score (0-1)
 * @param {boolean} [options.includeScores=false] - Include similarity scores in results
 * @returns {Promise<Array>} Matching documents
 */
async function queryDocuments(query, options = {}) {
  const { 
    limit = config.search.maxResultsPerPage, 
    threshold = 0.1, // Much lower threshold for better conceptual matching
    includeScores = false 
  } = options;
  
  try {
    if (!embeddings) {
      throw new Error('Vector store not initialized');
    }
    
    // Generate embedding for the query
    const queryEmbedding = await embeddings.embedQuery(query);
    
    // Calculate similarity for all documents
    const results = [];
    
    logger.debug(`Searching across ${Object.keys(documents).length} documents with query: "${query}"`);
    
    for (const [id, embedding] of Object.entries(embeddingsCache)) {
      const score = cosineSimilarity(queryEmbedding, embedding);
      const { text, metadata } = documents[id];
      
      logger.debug(`Document ${id} (${metadata?.title || 'Untitled'}) similarity score: ${score.toFixed(4)}`);
      
      if (score >= threshold) {
        if (includeScores) {
          results.push({ id, text, score, metadata });
        } else {
          results.push({ id, text, metadata });
        }
      }
    }
    
    // Sort by similarity score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    // Limit results
    const limitedResults = results.slice(0, limit);
    
    logger.debug(`Query found ${limitedResults.length} matching documents with threshold ${threshold}`);
    return limitedResults;
  } catch (error) {
    logger.error('Error querying documents from vector store', error);
    throw error;
  }
}

/**
 * Get the count of documents in the store
 * @returns {Promise<number>} Document count
 */
async function getCount() {
  return Object.keys(documents).length;
}

/**
 * Get all document IDs
 * @returns {Promise<string[]>} Array of document IDs
 */
async function getAllIds() {
  return Object.keys(documents);
}

module.exports = {
  init,
  addDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  getCount,
  getAllIds
}; 