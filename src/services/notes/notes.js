import { logger } from '../../utils/logger';
import noteStorage from './note-storage';
import { semanticBridge } from './semantic-bridge';

/**
 * Service for managing notes with support for both regular and semantic search
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
      logger.info('Notes', 'Creating new note from selection');
      
      const note = {
        text: content,
        title: tab.title,
        url: tab.url,
        timestamp: Date.now(),
        id: `note-${Date.now()}`,
        isHtml: isHtml
      };
      
      // Use semanticBridge to save note with semantic indexing
      const result = await semanticBridge.saveNote(note);
      
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
    try {
      logger.info('Notes', 'Getting all notes');
      return await noteStorage.getAllNotes();
    } catch (error) {
      logger.error('Notes', 'Error getting all notes', error);
      return [];
    }
  },
  
  /**
   * Search notes by query
   * @param {string} query - Search query
   * @param {boolean} useSemanticSearch - Whether to use semantic search
   * @returns {Promise<Array>} - Matching notes
   */
  async searchNotes(query, useSemanticSearch = false) {
    try {
      logger.info('Notes', `Searching notes with query: "${query}", useSemanticSearch: ${useSemanticSearch}`);
      
      if (!query || query.trim() === '') {
        logger.info('Notes', 'Empty query, returning all notes');
        return await this.getAllNotes();
      }
      
      // Use semantic search if enabled
      if (useSemanticSearch) {
        logger.info('Notes', 'Using semantic search');
        try {
          return await semanticBridge.searchNotes(query, { limit: 20 });
        } catch (semanticError) {
          logger.error('Notes', 'Error in semantic search, falling back to standard search', semanticError);
          // Fall back to standard search
        }
      }
      
      // Standard keyword search
      logger.info('Notes', 'Using standard keyword search');
      const notes = await noteStorage.getAllNotes();
      
      // Normalize query for searching
      const normalizedQuery = query.toLowerCase().trim();
      
      // Filter notes based on search query
      const results = notes.filter(note => {
        const content = note.text || '';
        const title = note.title || '';
        const searchableText = `${title} ${content}`.toLowerCase();
        return searchableText.includes(normalizedQuery);
      });
      
      logger.info('Notes', `Standard search returned ${results.length} results`);
      return results;
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
    try {
      logger.info('Notes', `Deleting note: ${noteId}`);
      // Use semanticBridge to properly delete note and its embedding
      return await semanticBridge.deleteNote(noteId);
    } catch (error) {
      logger.error('Notes', `Error deleting note ${noteId}`, error);
      return false;
    }
  },
  
  /**
   * Reset all notes by clearing storage
   * @returns {Promise<boolean>} - Success status
   */
  async resetAllNotes() {
    try {
      logger.info('Notes', 'Resetting all notes');
      
      // Reset notes from both storage systems
      const success = await noteStorage.resetAllNotes();
      
      // Also reset embeddings if needed
      try {
        await semanticBridge.resetEmbeddings();
      } catch (embeddingError) {
        logger.warn('Notes', 'Failed to reset embeddings, continuing anyway', embeddingError);
      }
      
      return success;
    } catch (error) {
      logger.error('Notes', 'Error resetting notes', error);
      return false;
    }
  }
}; 