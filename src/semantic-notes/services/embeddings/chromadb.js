/**
 * ChromaDB service for embedding and vector storage
 */
const { ChromaClient, OpenAIEmbeddingFunction } = require('chromadb');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');
const logger = require('../../utils/logger');
const config = require('../../config');

// Constants
const COLLECTION_NAME = 'semantic_notes';
const DATA_DIR = path.join(process.cwd(), 'data', 'chroma');

// Variables
let client = null;
let collection = null;
let embeddingFunction = null;

/**
 * Initialize ChromaDB and collection
 */
async function init() {
  try {
    logger.info('ChromaDB', `Initializing ChromaDB at ${DATA_DIR}`);
    
    // Ensure data directory exists
    await fs.ensureDir(DATA_DIR);
    
    // Create embedding function using OpenAI API
    embeddingFunction = new OpenAIEmbeddingFunction({
      openai_api_key: config.embeddings.apiKey,
      model_name: config.embeddings.model
    });
    
    // Create a ChromaDB client
    client = new ChromaClient();
    
    // Get or create collection
    try {
      collection = await client.getCollection({
        name: COLLECTION_NAME,
        embeddingFunction
      });
      logger.info('ChromaDB', `Using existing collection: ${COLLECTION_NAME}`);
    } catch (error) {
      // Collection doesn't exist, create it
      collection = await client.createCollection({
        name: COLLECTION_NAME,
        embeddingFunction,
        metadata: { 
          description: "Semantic notes with embeddings"
        }
      });
      logger.info('ChromaDB', `Created new collection: ${COLLECTION_NAME}`);
    }
    
    return true;
  } catch (error) {
    logger.error('ChromaDB', 'Error initializing ChromaDB', error);
    return false;
  }
}

/**
 * Get embedding for text
 * @param {string} text - Text to embed
 * @returns {Promise<Array<number>>} - Embedding vector
 */
async function getEmbedding(text) {
  if (!embeddingFunction) {
    await init();
  }
  
  if (!text || text.trim() === '') {
    return null;
  }
  
  try {
    const embeddings = await embeddingFunction.generate([text]);
    return embeddings[0];
  } catch (error) {
    logger.error('ChromaDB', 'Error generating embedding', error);
    return null;
  }
}

/**
 * Add a document to ChromaDB
 * @param {string} id - Document ID
 * @param {string} text - Document text
 * @param {Object} metadata - Document metadata
 * @returns {Promise<boolean>} - Success status
 */
async function addDocument(id, text, metadata = {}) {
  if (!collection) {
    logger.error('ChromaDB', 'Error adding document: ChromaDB collection not initialized');
    throw new Error('ChromaDB collection not initialized');
  }
  
  try {
    await collection.add({
      ids: [id],
      documents: [text],
      metadatas: [metadata]
    });
    
    logger.info('ChromaDB', `Added document with ID: ${id}`);
    return true;
  } catch (error) {
    logger.error('ChromaDB', `Error adding document: ${error.message}`, error);
    throw error;
  }
}

/**
 * Update a document in ChromaDB
 * @param {string} id - Document ID
 * @param {string} text - Document text
 * @param {Object} metadata - Document metadata
 * @returns {Promise<boolean>} - Success status
 */
async function updateDocument(id, text, metadata = {}) {
  if (!collection) {
    logger.error('ChromaDB', 'Error updating document: ChromaDB collection not initialized');
    throw new Error('ChromaDB collection not initialized');
  }
  
  try {
    await collection.update({
      ids: [id],
      documents: [text],
      metadatas: [metadata]
    });
    
    logger.info('ChromaDB', `Updated document with ID: ${id}`);
    return true;
  } catch (error) {
    logger.error('ChromaDB', `Error updating document: ${error.message}`, error);
    throw error;
  }
}

/**
 * Delete a document from ChromaDB
 * @param {string} id - Document ID
 * @returns {Promise<boolean>} - Success status
 */
async function deleteDocument(id) {
  if (!collection) {
    logger.error('ChromaDB', 'Error deleting document: ChromaDB collection not initialized');
    throw new Error('ChromaDB collection not initialized');
  }
  
  try {
    await collection.delete({
      ids: [id]
    });
    
    logger.info('ChromaDB', `Deleted document with ID: ${id}`);
    return true;
  } catch (error) {
    logger.error('ChromaDB', `Error deleting document: ${error.message}`, error);
    throw error;
  }
}

/**
 * Query documents by similarity
 * @param {string} query - Query text
 * @param {Object} options - Query options
 * @returns {Promise<Array<Object>>} - Results
 */
async function queryDocuments(query, options = {}) {
  if (!collection) {
    logger.error('ChromaDB', 'Error querying documents: ChromaDB collection not initialized');
    throw new Error('ChromaDB collection not initialized');
  }
  
  const { limit = 5, includeScore = true, threshold = 0 } = options;
  
  try {
    const results = await collection.query({
      queryTexts: [query],
      nResults: limit,
      include: ["documents", "metadatas", "distances"]
    });
    
    // Format results
    const matches = [];
    
    if (results.ids.length > 0 && results.ids[0].length > 0) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const id = results.ids[0][i];
        const document = results.documents[0][i];
        const metadata = results.metadatas[0][i];
        const distance = results.distances[0][i];
        
        // Convert distance to similarity score (1 - distance)
        const score = 1 - distance;
        
        // Only include results above threshold
        if (score >= threshold) {
          const result = {
            id,
            text: document,
            ...metadata
          };
          
          if (includeScore) {
            result.score = score;
          }
          
          matches.push(result);
        }
      }
    }
    
    return matches;
  } catch (error) {
    logger.error('ChromaDB', `Error querying documents: ${error.message}`, error);
    throw error;
  }
}

/**
 * Get count of documents in collection
 * @returns {Promise<number>} - Document count
 */
async function getCount() {
  if (!collection) {
    return 0;
  }
  
  try {
    const count = await collection.count();
    return count;
  } catch (error) {
    logger.error('ChromaDB', `Error getting count: ${error.message}`, error);
    return 0;
  }
}

/**
 * Get all document IDs in collection
 * @returns {Promise<Array<string>>} - Document IDs
 */
async function getAllIds() {
  if (!collection) {
    return [];
  }
  
  try {
    const result = await collection.get({
      include: []
    });
    
    return result.ids || [];
  } catch (error) {
    logger.error('ChromaDB', `Error getting all IDs: ${error.message}`, error);
    return [];
  }
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