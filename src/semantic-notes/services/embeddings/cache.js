/**
 * Cache service for embeddings to minimize API calls
 */
const fs = require('fs-extra');
const crypto = require('crypto');
const config = require('../../utils/config');
const logger = require('../../utils/logger');

// Cache structure
let embeddingCache = {};
let cacheLoaded = false;

/**
 * Generate a hash key for text
 * @param {string} text - Text to hash
 * @returns {string} - Hash
 */
function generateCacheKey(text) {
  return crypto
    .createHash('md5')
    .update(text)
    .digest('hex');
}

/**
 * Load cache from file
 * @returns {Promise<boolean>} - Success status
 */
async function loadCache() {
  if (!config.settings.enableEmbeddingCache) {
    logger.info('Cache', 'Embedding cache is disabled');
    return false;
  }
  
  if (cacheLoaded) {
    return true;
  }
  
  try {
    await fs.ensureFile(config.paths.cacheFile);
    
    // Check if file is empty
    const stats = await fs.stat(config.paths.cacheFile);
    if (stats.size === 0) {
      await fs.writeJson(config.paths.cacheFile, {});
      logger.info('Cache', `Created empty cache file at ${config.paths.cacheFile}`);
      embeddingCache = {};
    } else {
      const data = await fs.readJson(config.paths.cacheFile);
      embeddingCache = data;
      const cacheSize = Object.keys(embeddingCache).length;
      logger.info('Cache', `Loaded ${cacheSize} embeddings from cache`);
    }
    
    cacheLoaded = true;
    return true;
  } catch (error) {
    logger.error('Cache', `Error loading cache: ${error.message}`, error);
    embeddingCache = {};
    return false;
  }
}

/**
 * Save cache to file
 * @returns {Promise<boolean>} - Success status
 */
async function saveCache() {
  if (!config.settings.enableEmbeddingCache) {
    return false;
  }
  
  try {
    await fs.ensureFile(config.paths.cacheFile);
    await fs.writeJson(config.paths.cacheFile, embeddingCache, { spaces: 2 });
    logger.debug('Cache', `Saved embedding cache with ${Object.keys(embeddingCache).length} entries`);
    return true;
  } catch (error) {
    logger.error('Cache', `Error saving cache: ${error.message}`, error);
    return false;
  }
}

/**
 * Get embedding from cache
 * @param {string} text - Text to look up
 * @returns {number[]|null} - Embedding vector or null if not found
 */
function getFromCache(text) {
  if (!config.settings.enableEmbeddingCache || !cacheLoaded) {
    return null;
  }
  
  const key = generateCacheKey(text);
  const cachedItem = embeddingCache[key];
  
  if (cachedItem) {
    logger.debug('Cache', 'Cache hit for embedding');
    return cachedItem;
  }
  
  logger.debug('Cache', 'Cache miss for embedding');
  return null;
}

/**
 * Store embedding in cache
 * @param {string} text - Text to store
 * @param {number[]} embedding - Embedding vector
 * @returns {Promise<boolean>} - Success status
 */
async function storeInCache(text, embedding) {
  if (!config.settings.enableEmbeddingCache) {
    return false;
  }
  
  await loadCache();
  
  try {
    const key = generateCacheKey(text);
    embeddingCache[key] = embedding;
    
    // Save to disk every few entries
    const cacheSize = Object.keys(embeddingCache).length;
    if (cacheSize % 5 === 0) {
      await saveCache();
    }
    
    return true;
  } catch (error) {
    logger.error('Cache', `Error storing in cache: ${error.message}`, error);
    return false;
  }
}

module.exports = {
  getFromCache,
  storeInCache,
  loadCache,
  saveCache
}; 