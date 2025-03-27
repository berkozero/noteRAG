/**
 * Vector similarity calculation utilities
 */
const logger = require('./logger');

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Similarity score between -1 and 1
 */
function cosineSimilarity(vecA, vecB) {
  try {
    if (!vecA || !vecB || !vecA.length || !vecB.length) {
      return 0;
    }
    
    if (vecA.length !== vecB.length) {
      throw new Error(`Vector dimensions don't match: ${vecA.length} vs ${vecB.length}`);
    }
    
    // Calculate dot product
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    // Calculate magnitudes
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    // Calculate cosine similarity
    return dotProduct / (normA * normB);
  } catch (error) {
    logger.error('Vector', `Error calculating cosine similarity: ${error.message}`, error);
    return 0;
  }
}

/**
 * Calculate Euclidean distance between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Distance (lower is more similar)
 */
function euclideanDistance(vecA, vecB) {
  try {
    if (!vecA || !vecB || !vecA.length || !vecB.length) {
      return Infinity;
    }
    
    if (vecA.length !== vecB.length) {
      throw new Error(`Vector dimensions don't match: ${vecA.length} vs ${vecB.length}`);
    }
    
    // Calculate squared differences
    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
      const diff = vecA[i] - vecB[i];
      sum += diff * diff;
    }
    
    // Calculate square root for final distance
    return Math.sqrt(sum);
  } catch (error) {
    logger.error('Vector', `Error calculating Euclidean distance: ${error.message}`, error);
    return Infinity;
  }
}

/**
 * Rank items by similarity to a query embedding
 * @param {Array<Object>} items - Array of items with embeddings
 * @param {number[]} queryEmbedding - Query embedding
 * @param {Object} options - Options
 * @returns {Array<Object>} - Ranked items with scores
 */
function rankBySimilarity(items, queryEmbedding, options = {}) {
  try {
    const {
      embeddingKey = 'embedding',
      similarityFn = cosineSimilarity,
      threshold = 0,
      limit = null
    } = options;
    
    if (!items || !items.length || !queryEmbedding) {
      return [];
    }
    
    // Calculate similarity scores
    const scoredItems = items
      .map(item => {
        const embedding = item[embeddingKey];
        if (!embedding) return null;
        
        const score = similarityFn(embedding, queryEmbedding);
        return { item, score };
      })
      .filter(result => result !== null && result.score >= threshold)
      .sort((a, b) => b.score - a.score);
    
    // Apply limit if provided
    const limitedItems = limit ? scoredItems.slice(0, limit) : scoredItems;
    
    return limitedItems;
  } catch (error) {
    logger.error('Vector', `Error ranking by similarity: ${error.message}`, error);
    return [];
  }
}

module.exports = {
  cosineSimilarity,
  euclideanDistance,
  rankBySimilarity
}; 