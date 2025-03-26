import { logger } from '../../utils/logger';
import { storageService } from '../storage/storage';

/**
 * Service for managing notes
 */
export const notesService = {
  /**
   * Capture selection from a page
   * @returns {string|null} - HTML content of selection or null
   */
  captureSelection() {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return null;
      }
      
      const range = selection.getRangeAt(0);
      const fragment = range.cloneContents();
      
      // Create a temporary container
      const div = document.createElement('div');
      div.appendChild(fragment);
      
      // Return the HTML content
      return div.innerHTML;
    } catch (error) {
      logger.error('Notes', 'Error capturing selection', error);
      return null;
    }
  },
  
  /**
   * Create a new note from page selection
   * @param {string} content - The content to save
   * @param {Object} tab - The browser tab info
   * @param {boolean} isHtml - Whether the content is HTML
   * @returns {Promise<boolean>} - Success status
   */
  async createNote(content, tab, isHtml) {
    try {
      const note = {
        text: content,
        title: tab.title,
        url: tab.url,
        timestamp: Date.now(),
        id: Date.now(),
        isHtml: isHtml
      };
      
      const result = await storageService.saveNote(note);
      
      if (result) {
        logger.info('Notes', 'Note saved successfully');
        return true;
      } else {
        logger.error('Notes', 'Failed to save note');
        return false;
      }
    } catch (error) {
      logger.error('Notes', 'Error creating note', error);
      return false;
    }
  },
  
  /**
   * Show success icon when a note is saved
   * @returns {Promise<void>}
   */
  async showSuccessIcon() {
    try {
      // Show success icon (green icon)
      const greenIconPath = chrome.runtime.getURL('assets/icons/icon-green.png');
      const defaultIconPath = chrome.runtime.getURL('assets/icons/icon48.png');
      
      logger.info('Notes', 'Showing success icon');
      await chrome.action.setIcon({ path: greenIconPath });
      
      // Reset back to default icon after 2 seconds
      return new Promise(resolve => {
        setTimeout(async () => {
          logger.info('Notes', 'Reverting to default icon');
          await chrome.action.setIcon({ path: defaultIconPath });
          resolve();
        }, 2000);
      });
    } catch (error) {
      logger.error('Notes', 'Error showing success icon', error);
    }
  },
  
  /**
   * Get all notes from storage
   * @returns {Promise<Array>} - Array of notes
   */
  async getAllNotes() {
    return await storageService.getNotes();
  },
  
  /**
   * Search notes by query
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Filtered notes
   */
  async searchNotes(query) {
    try {
      const notes = await storageService.getNotes();
      
      if (!query) {
        return notes;
      }
      
      // Normalize query for searching
      const normalizedQuery = query.toLowerCase().trim();
      
      // Filter notes based on search query
      return notes.filter(note => {
        const content = note.text || '';
        const title = note.title || '';
        const searchableText = `${title} ${content}`.toLowerCase();
        return searchableText.includes(normalizedQuery);
      });
    } catch (error) {
      logger.error('Notes', 'Error searching notes', error);
      return [];
    }
  },
  
  /**
   * Delete a note
   * @param {string|number} noteId - ID of the note to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteNote(noteId) {
    return await storageService.deleteNote(noteId);
  }
}; 