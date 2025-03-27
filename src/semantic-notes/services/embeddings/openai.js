/**
 * OpenAI embedding service for generating text embeddings
 */
const { OpenAI } = require('openai');
const config = require('../../utils/config');
const logger = require('../../utils/logger');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

/**
 * Generate embeddings for text using OpenAI's API
 * @param {string} text - The text to generate embeddings for
 * @returns {Promise<Object>} - The embedding response
 */
async function generateEmbedding(text) {
  try {
    logger.info('OpenAI', `Generating embedding for text (${text.length} chars)`);
    
    const response = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: text,
      encoding_format: 'float'
    });
    
    if (response && response.data && response.data.length > 0) {
      logger.info('OpenAI', `Successfully generated embedding with ${response.data[0].embedding.length} dimensions`);
      return {
        success: true,
        embedding: response.data[0].embedding,
        usage: response.usage,
        model: response.model
      };
    } else {
      logger.error('OpenAI', 'Invalid response format from OpenAI API');
      return {
        success: false,
        error: 'Invalid response format from API'
      };
    }
  } catch (error) {
    logger.error('OpenAI', `Error generating embedding: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts - Array of texts to generate embeddings for
 * @returns {Promise<Object>} - The batch embedding response
 */
async function generateEmbeddingBatch(texts) {
  try {
    if (!texts || texts.length === 0) {
      return {
        success: false,
        error: 'No texts provided for embedding'
      };
    }
    
    logger.info('OpenAI', `Generating embeddings for ${texts.length} texts`);
    
    const response = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: texts,
      encoding_format: 'float'
    });
    
    if (response && response.data && response.data.length === texts.length) {
      const embeddings = response.data.map(item => item.embedding);
      logger.info('OpenAI', `Successfully generated ${embeddings.length} embeddings`);
      
      return {
        success: true,
        embeddings,
        usage: response.usage,
        model: response.model
      };
    } else {
      logger.error('OpenAI', 'Invalid or incomplete response from API');
      return {
        success: false,
        error: 'Invalid response format from API'
      };
    }
  } catch (error) {
    logger.error('OpenAI', `Error generating batch embeddings: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  generateEmbedding,
  generateEmbeddingBatch
}; 