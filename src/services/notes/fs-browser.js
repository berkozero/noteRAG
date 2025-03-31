/**
 * Browser-compatible implementation of the fs module
 * This module simulates the fs module using either localStorage or chrome.storage.local
 * depending on the environment (browser vs service worker)
 */

// File system namespace prefix for storage
const FS_PREFIX = 'noteRAG_fs_';

// Detect environment (service worker vs browser context)
const isServiceWorker = typeof window === 'undefined' || typeof localStorage === 'undefined';

// Storage implementation that works in both contexts
const storage = {
  // Get all items with keys starting with prefix
  async getAll() {
    if (isServiceWorker) {
      return new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
          const filtered = {};
          for (const key in items) {
            if (key.startsWith(FS_PREFIX)) {
              filtered[key.substring(FS_PREFIX.length)] = items[key];
            }
          }
          resolve(filtered);
        });
      });
    } else {
      const files = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(FS_PREFIX)) {
          const path = key.substring(FS_PREFIX.length);
          try {
            files[path] = JSON.parse(localStorage.getItem(key));
          } catch (e) {
            console.error('Error parsing localStorage item:', key, e);
          }
        }
      }
      return files;
    }
  },

  // Get a single item by key
  async get(key) {
    const storageKey = `${FS_PREFIX}${key}`;
    if (isServiceWorker) {
      return new Promise((resolve) => {
        chrome.storage.local.get(storageKey, (result) => {
          resolve(result[storageKey] || null);
        });
      });
    } else {
      const data = localStorage.getItem(storageKey);
      try {
        return data ? JSON.parse(data) : null;
      } catch (e) {
        console.error('Error parsing localStorage item:', storageKey, e);
        return null;
      }
    }
  },

  // Set a single item by key
  async set(key, value) {
    const storageKey = `${FS_PREFIX}${key}`;
    if (isServiceWorker) {
      return new Promise((resolve) => {
        const data = {};
        data[storageKey] = value;
        chrome.storage.local.set(data, resolve);
      });
    } else {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch (e) {
        console.error('Error setting localStorage item:', storageKey, e);
      }
      return Promise.resolve();
    }
  },

  // Remove a single item by key
  async remove(key) {
    const storageKey = `${FS_PREFIX}${key}`;
    if (isServiceWorker) {
      return new Promise((resolve) => {
        chrome.storage.local.remove(storageKey, resolve);
      });
    } else {
      localStorage.removeItem(storageKey);
      return Promise.resolve();
    }
  },

  // Check if a key exists
  async has(key) {
    const result = await this.get(key);
    return result !== null;
  }
};

// Helper to get all "files" in the virtual file system
const getAllFiles = async () => {
  const files = await storage.getAll();
  return files;
};

// Ensure a directory exists (creates parent directories if needed)
const ensureDirSync = async (dirPath) => {
  if (!dirPath) return;
  
  // Clean the path
  const cleanPath = dirPath.replace(/\/$/, '') + '/';
  
  // Create the directory entry
  await storage.set(cleanPath, { 
    isDirectory: true,
    created: Date.now(),
    modified: Date.now()
  });
  
  // Create parent directories recursively
  const parent = cleanPath.split('/').slice(0, -2).join('/');
  if (parent) {
    await ensureDirSync(parent);
  }
};

// Check if a path exists
const existsSync = async (path) => {
  return await storage.has(path);
};

// Create or update a file
const writeFileSync = async (path, data, options = {}) => {
  const isObject = typeof data === 'object';
  const content = isObject ? JSON.stringify(data) : String(data);
  
  // Create parent directory if needed
  const dirPath = path.split('/').slice(0, -1).join('/');
  if (dirPath) {
    await ensureDirSync(dirPath);
  }
  
  const existingFile = await storage.get(path);
  const created = existingFile ? existingFile.created : Date.now();
  
  await storage.set(path, {
    isDirectory: false,
    content,
    encoding: options.encoding || 'utf8',
    created,
    modified: Date.now()
  });
};

// Read a file
const readFileSync = async (path, options = {}) => {
  const file = await storage.get(path);
  
  if (file === null) {
    const error = new Error(`ENOENT: no such file or directory, open '${path}'`);
    error.code = 'ENOENT';
    throw error;
  }
  
  if (file.isDirectory) {
    const error = new Error(`EISDIR: illegal operation on a directory, read '${path}'`);
    error.code = 'EISDIR';
    throw error;
  }
  
  // If options is a string, it's the encoding
  const encoding = typeof options === 'string' ? options : options.encoding;
  
  return file.content;
};

// Delete a file
const unlinkSync = async (path) => {
  const file = await storage.get(path);
  
  if (file === null) {
    const error = new Error(`ENOENT: no such file or directory, unlink '${path}'`);
    error.code = 'ENOENT';
    throw error;
  }
  
  if (file.isDirectory) {
    const error = new Error(`EISDIR: illegal operation on a directory, unlink '${path}'`);
    error.code = 'EISDIR';
    throw error;
  }
  
  await storage.remove(path);
};

// Remove a directory
const rmdirSync = async (path) => {
  const file = await storage.get(path);
  
  if (file === null) {
    const error = new Error(`ENOENT: no such file or directory, rmdir '${path}'`);
    error.code = 'ENOENT';
    throw error;
  }
  
  if (!file.isDirectory) {
    const error = new Error(`ENOTDIR: not a directory, rmdir '${path}'`);
    error.code = 'ENOTDIR';
    throw error;
  }
  
  // Check if directory is empty (in a real file system)
  // Here we'll just remove it regardless
  await storage.remove(path);
};

// List files in a directory
const readdirSync = async (path) => {
  const allFiles = await storage.getAll();
  const cleanPath = path.replace(/\/$/, '') + '/';
  
  // Find all files that start with the path
  const dirContents = [];
  for (const filePath in allFiles) {
    if (filePath !== cleanPath && 
        filePath.startsWith(cleanPath) && 
        !filePath.substring(cleanPath.length).includes('/')) {
      // Get just the filename
      const fileName = filePath.substring(cleanPath.length);
      if (fileName) {
        dirContents.push(fileName);
      }
    }
  }
  
  return dirContents;
};

// Debug the entire filesystem (prints all files and directories)
const debugFilesystem = async () => {
  const files = await getAllFiles();
  const filesList = Object.keys(files);
  
  const result = {
    totalFiles: filesList.length,
    directories: [],
    files: []
  };
  
  for (const path of filesList) {
    const item = files[path];
    if (item.isDirectory) {
      result.directories.push(path);
    } else {
      result.files.push(path);
    }
  }
  
  return result;
};

// Export the filesystem API
export default {
  ensureDirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  rmdirSync,
  getAllFiles,
  debugFilesystem
}; 