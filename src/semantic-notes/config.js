/**
 * Configuration module for the semantic notes application.
 * Loads environment variables and provides configuration settings.
 */

const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs-extra');

// Load environment variables from .env file at project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Define default configuration values
const DEFAULT_CONFIG = {
  // OpenAI API configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  },
  
  // Data storage configuration
  storage: {
    notesFilePath: process.env.NOTES_FILE_PATH || './src/semantic-notes/data/notes.json',
  },
  
  // Search configuration
  search: {
    maxResultsPerPage: parseInt(process.env.MAX_RESULTS_PER_PAGE || '10', 10),
  },
  
  // Cache configuration
  cache: {
    enableEmbeddingCache: process.env.ENABLE_EMBEDDING_CACHE === 'true',
    cacheFilePath: process.env.CACHE_FILE_PATH || './src/semantic-notes/data/cache.json',
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Ensure data directories exist
const dataDir = path.dirname(DEFAULT_CONFIG.storage.notesFilePath);
fs.ensureDirSync(dataDir);

const cacheDir = path.dirname(DEFAULT_CONFIG.cache.cacheFilePath);
fs.ensureDirSync(cacheDir);

module.exports = DEFAULT_CONFIG; 