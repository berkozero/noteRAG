/**
 * Browser-compatible implementation of basic file system operations
 * Uses localStorage for persistence
 */

const browserFS = {
  // Storage prefix to avoid collisions
  storagePrefix: 'noteRAG_fs_',
  
  /**
   * Write data to a file (localStorage)
   * @param {string} filePath - Path to file
   * @param {string} data - Data to write
   * @param {Object} options - Options (ignored in browser)
   * @returns {Promise<void>}
   */
  writeFile: async (filePath, data, options = {}) => {
    try {
      const key = browserFS.storagePrefix + filePath;
      localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error writing to browser storage:', error);
      throw error;
    }
  },
  
  /**
   * Read data from a file (localStorage)
   * @param {string} filePath - Path to file
   * @param {Object} options - Options (ignored in browser)
   * @returns {Promise<string>} - File contents
   */
  readFile: async (filePath, options = {}) => {
    try {
      const key = browserFS.storagePrefix + filePath;
      const data = localStorage.getItem(key);
      
      if (data === null) {
        throw new Error(`ENOENT: File not found: ${filePath}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error reading from browser storage:', error);
      throw error;
    }
  },
  
  /**
   * Check if a file exists (in localStorage)
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} - Whether the file exists
   */
  exists: async (filePath) => {
    try {
      const key = browserFS.storagePrefix + filePath;
      return localStorage.getItem(key) !== null;
    } catch (error) {
      console.error('Error checking existence in browser storage:', error);
      return false;
    }
  },
  
  /**
   * Create directory (no-op in browser)
   * @param {string} dirPath - Path to directory
   * @returns {Promise<void>}
   */
  mkdir: async (dirPath) => {
    // No-op in browser
    return true;
  },
  
  /**
   * Remove a file (from localStorage)
   * @param {string} filePath - Path to file
   * @returns {Promise<void>}
   */
  unlink: async (filePath) => {
    try {
      const key = browserFS.storagePrefix + filePath;
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from browser storage:', error);
      throw error;
    }
  }
};

// Add synchronous versions of functions
browserFS.writeFileSync = (filePath, data, options = {}) => {
  const key = browserFS.storagePrefix + filePath;
  localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
  return true;
};

browserFS.readFileSync = (filePath, options = {}) => {
  const key = browserFS.storagePrefix + filePath;
  const data = localStorage.getItem(key);
  
  if (data === null) {
    throw new Error(`ENOENT: File not found: ${filePath}`);
  }
  
  return data;
};

browserFS.existsSync = (filePath) => {
  const key = browserFS.storagePrefix + filePath;
  return localStorage.getItem(key) !== null;
};

browserFS.mkdirSync = (dirPath) => {
  // No-op in browser
  return true;
};

browserFS.unlinkSync = (filePath) => {
  const key = browserFS.storagePrefix + filePath;
  localStorage.removeItem(key);
  return true;
};

module.exports = browserFS; 