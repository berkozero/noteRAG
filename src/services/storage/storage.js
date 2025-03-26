import { logger } from '../../utils/logger';

/**
 * Centralized storage service for managing extension data
 */
export const storageService = {
  /**
   * Save a note to storage
   * @param {Object} note - The note to save
   * @returns {Promise<void>}
   */
  async saveNote(note) {
    try {
      const result = await this.getData('notes');
      const notes = result.notes || [];
      notes.unshift(note);
      await this.saveData({ notes });
      return true;
    } catch (error) {
      logger.error('Storage', 'Failed to save note', error);
      return false;
    }
  },

  /**
   * Get all notes from storage
   * @returns {Promise<Array>}
   */
  async getNotes() {
    try {
      const result = await this.getData('notes');
      return result.notes || [];
    } catch (error) {
      logger.error('Storage', 'Failed to get notes', error);
      return [];
    }
  },

  /**
   * Delete a note by ID
   * @param {string|number} noteId - The ID of the note to delete
   * @returns {Promise<boolean>}
   */
  async deleteNote(noteId) {
    try {
      const result = await this.getData('notes');
      const notes = result.notes || [];
      const id = parseInt(noteId, 10);
      
      const noteIndex = notes.findIndex(note => note.id === id);
      if (noteIndex === -1) return false;
      
      notes.splice(noteIndex, 1);
      await this.saveData({ notes });
      return true;
    } catch (error) {
      logger.error('Storage', 'Failed to delete note', error);
      return false;
    }
  },

  /**
   * Save user information to storage
   * @param {Object} userInfo - The user information to save
   * @returns {Promise<void>}
   */
  async saveUserInfo(userInfo) {
    try {
      await this.saveData({ userInfo });
      return true;
    } catch (error) {
      logger.error('Storage', 'Failed to save user info', error);
      return false;
    }
  },

  /**
   * Get user information from storage
   * @returns {Promise<Object|null>}
   */
  async getUserInfo() {
    try {
      const result = await this.getData('userInfo');
      return result.userInfo || null;
    } catch (error) {
      logger.error('Storage', 'Failed to get user info', error);
      return null;
    }
  },

  /**
   * Clear authentication data from storage
   * @returns {Promise<boolean>}
   */
  async clearAuthData() {
    try {
      await chrome.storage.local.remove(['userInfo', 'authToken']);
      return true;
    } catch (error) {
      logger.error('Storage', 'Failed to clear auth data', error);
      return false;
    }
  },

  /**
   * Save data to chrome.storage.local
   * @param {Object} data - The data to save
   * @returns {Promise<void>}
   */
  async saveData(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },

  /**
   * Get data from chrome.storage.local
   * @param {string|string[]} keys - The key(s) to retrieve
   * @returns {Promise<Object>}
   */
  async getData(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }
}; 