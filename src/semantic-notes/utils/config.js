/**
 * Configuration utility for loading environment variables
 */
require('dotenv').config();
const path = require('path');

const config = {
  // OpenAI API configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  },
  
  // File paths
  paths: {
    notesFile: process.env.NOTES_FILE_PATH || path.join(__dirname, '../../data/notes.json'),
    cacheFile: process.env.CACHE_FILE_PATH || path.join(__dirname, '../../data/cache.json'),
  },
  
  // Application settings
  settings: {
    maxResultsPerPage: parseInt(process.env.MAX_RESULTS_PER_PAGE || '10', 10),
    enableEmbeddingCache: process.env.ENABLE_EMBEDDING_CACHE !== 'false',
  }
};

// Validate required configuration
function validateConfig() {
  const missing = [];
  
  // Check for required API keys if embedding is enabled
  if (!config.openai.apiKey) {
    missing.push('OPENAI_API_KEY');
  }
  
  return missing;
}

// Export with validation function
module.exports = {
  ...config,
  validateConfig
}; 