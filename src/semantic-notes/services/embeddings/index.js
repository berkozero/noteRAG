/**
 * Embedding service for generating and managing text embeddings
 */
const openaiService = require('./openai');
const cacheService = require('./cache');
const logger = require('../../utils/logger');

/**
 * Initialize the embedding service
 * @returns {Promise<boolean>} - Success status
 */
async function init() {
  try {
    await cacheService.loadCache();
    return true;
  } catch (error) {
    logger.error('Embeddings', 'Failed to initialize embedding service', error);
    return false;
  }
}

/**
 * Get embedding for text, using cache if available
 * @param {string} text - Text to get embedding for
 * @returns {Promise<Object>} - Embedding result
 */
async function getEmbedding(text) {
  try {
    if (!text || text.trim() === '') {
      return {
        success: false,
        error: 'Empty text provided'
      };
    }
    
    // Normalize the text
    const normalizedText = text.trim();
    
    // Try to get from cache first
    const cachedEmbedding = cacheService.getFromCache(normalizedText);
    if (cachedEmbedding) {
      logger.info('Embeddings', 'Using cached embedding');
      return {
        success: true,
        embedding: cachedEmbedding,
        fromCache: true
      };
    }
    
    // If not in cache, generate from API
    const result = await openaiService.generateEmbedding(normalizedText);
    
    if (result.success) {
      // Store in cache for future use
      await cacheService.storeInCache(normalizedText, result.embedding);
      return result;
    } else {
      return result;
    }
  } catch (error) {
    logger.error('Embeddings', `Error getting embedding: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process a batch of texts to get embeddings
 * @param {string[]} texts - Array of texts
 * @param {boolean} useBatchApi - Whether to use batch API
 * @returns {Promise<Object>} - Result with embeddings
 */
async function getEmbeddingBatch(texts, useBatchApi = true) {
  try {
    if (!texts || texts.length === 0) {
      return {
        success: false,
        error: 'No texts provided'
      };
    }
    
    // Normalize texts
    const normalizedTexts = texts.map(text => text.trim()).filter(text => text !== '');
    
    if (normalizedTexts.length === 0) {
      return {
        success: false,
        error: 'All texts were empty after normalization'
      };
    }
    
    // Filter texts that are already in cache
    const cachedResults = {};
    const textsToProcess = [];
    
    for (const text of normalizedTexts) {
      const cachedEmbedding = cacheService.getFromCache(text);
      if (cachedEmbedding) {
        cachedResults[text] = cachedEmbedding;
      } else {
        textsToProcess.push(text);
      }
    }
    
    // If all embeddings were cached, return early
    if (textsToProcess.length === 0) {
      logger.info('Embeddings', 'All embeddings were in cache');
      
      // Create ordered results
      const embeddings = normalizedTexts.map(text => cachedResults[text]);
      
      return {
        success: true,
        embeddings,
        fromCache: true
      };
    }
    
    // Get remaining embeddings
    let newEmbeddings = [];
    
    if (useBatchApi && textsToProcess.length > 1) {
      // Use batch API for multiple texts
      const batchResult = await openaiService.generateEmbeddingBatch(textsToProcess);
      
      if (batchResult.success) {
        newEmbeddings = batchResult.embeddings;
        
        // Store each in cache
        for (let i = 0; i < textsToProcess.length; i++) {
          await cacheService.storeInCache(textsToProcess[i], newEmbeddings[i]);
        }
      } else {
        return batchResult; // Return error from batch API
      }
    } else {
      // Process one by one
      for (const text of textsToProcess) {
        const result = await openaiService.generateEmbedding(text);
        
        if (result.success) {
          newEmbeddings.push(result.embedding);
          await cacheService.storeInCache(text, result.embedding);
        } else {
          logger.error('Embeddings', `Failed to get embedding for text: ${text.substring(0, 50)}...`);
          // Add a null for failed embedding to maintain order
          newEmbeddings.push(null);
        }
      }
    }
    
    // Combine cached and new embeddings in the original order
    const allEmbeddings = normalizedTexts.map(text => {
      if (cachedResults[text]) {
        return cachedResults[text];
      } else {
        const index = textsToProcess.indexOf(text);
        return index !== -1 ? newEmbeddings[index] : null;
      }
    });
    
    return {
      success: true,
      embeddings: allEmbeddings,
      partialCache: Object.keys(cachedResults).length > 0
    };
  } catch (error) {
    logger.error('Embeddings', `Error in batch embedding: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  init,
  getEmbedding,
  getEmbeddingBatch
}; 