/**
 * Unified Note Storage Module
 * 
 * This module provides a single interface for storing and retrieving notes,
 * handling both local filesystem storage and Chrome storage.
 */

import fs from './fs-browser';
import { logger } from '../../utils/logger';

class NoteStorage {
  constructor(options = {}) {
    // Storage options with defaults
    this.options = {
      useLocalStorage: options.useLocalStorage !== false,
      useChromeStorage: options.useChromeStorage !== false,
      localStoragePath: options.localStoragePath || '/data/notes'
    };
    
    this.initialized = false;
    this.initPromise = this.initialize();
  }
  
  /**
   * Initialize the storage system
   */
  async initialize() {
    if (this.initialized) return true;
    
    try {
      // Ensure local directories exist if using local storage
      if (this.options.useLocalStorage) {
        await fs.ensureDirSync(this.options.localStoragePath);
        logger.info('NoteStorage', 'Local storage directories created');
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      logger.error('NoteStorage', 'Failed to initialize storage', error);
      return false;
    }
  }
  
  /**
   * Ensure storage is initialized before performing operations
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initPromise;
    }
  }
  
  /**
   * Save a note to storage
   * @param {Object} note - The note to save
   * @returns {Promise<Object>} - The saved note
   */
  async saveNote(note) {
    await this.ensureInitialized();
    
    try {
      // Ensure the note has required fields
      if (!note.id) {
        note.id = `note_${Date.now()}`; // Always use underscore format for consistency
      } else if (note.id.includes('-')) {
        // Convert any hyphen IDs to underscore format for consistency
        note.id = note.id.replace(/-/g, '_');
        logger.debug('NoteStorage', `Standardized ID format: ${note.id}`);
      }
      
      if (!note.timestamp) note.timestamp = Date.now();
      
      // Log the note being saved
      logger.info('NoteStorage', `Saving note: ${note.id}`);
      logger.debug('NoteStorage', 'Note content:', { 
        id: note.id, 
        title: note.title, 
        timestamp: note.timestamp
      });
      
      // Track if we're updating or creating
      const isUpdate = await this.noteExists(note.id);
      
      // Save to local filesystem if enabled
      if (this.options.useLocalStorage) {
        const filePath = `${this.options.localStoragePath}/${note.id}.json`;
        await fs.writeFileSync(filePath, JSON.stringify(note, null, 2));
        logger.info('NoteStorage', `Note saved to local storage: ${note.id}`);
      }
      
      // Save to Chrome storage if enabled
      if (this.options.useChromeStorage) {
        // First check what's already in Chrome storage
        const directCheck = await new Promise((resolve) => {
          chrome.storage.local.get(['notes'], (result) => {
            const existingNotes = result.notes || [];
            logger.info('NoteStorage', `DIRECT: Found ${existingNotes.length} notes in Chrome storage before save`);
            resolve(existingNotes);
          });
        });
        
        // Get all notes through the normal method
        const notes = await this.getAllNotes();
        
        // Find and update existing note or add new one
        const existingIndex = notes.findIndex(n => n.id === note.id);
        if (existingIndex >= 0) {
          notes[existingIndex] = { ...note };
          logger.info('NoteStorage', `Updating existing note at index ${existingIndex}`);
        } else {
          notes.unshift(note); // Add to beginning of array
          logger.info('NoteStorage', `Adding new note to beginning of array, new total: ${notes.length}`);
        }
        
        // Save back to Chrome storage
        await new Promise((resolve, reject) => {
          logger.info('NoteStorage', `Saving ${notes.length} notes to Chrome storage`);
          chrome.storage.local.set({ notes }, () => {
            if (chrome.runtime.lastError) {
              logger.error('NoteStorage', 'Error saving to Chrome storage:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              // Verify the save worked
              chrome.storage.local.get(['notes'], (result) => {
                const savedNotes = result.notes || [];
                logger.info('NoteStorage', `VERIFY: Found ${savedNotes.length} notes in Chrome storage after save`);
                resolve();
              });
            }
          });
        });
        
        logger.info('NoteStorage', `Note saved to Chrome storage: ${note.id}`);
      }
      
      // Return the saved note
      return note;
    } catch (error) {
      logger.error('NoteStorage', 'Failed to save note', error);
      throw error;
    }
  }
  
  /**
   * Check if a note exists
   * @param {string} noteId - The note ID to check
   * @returns {Promise<boolean>} - Whether the note exists
   */
  async noteExists(noteId) {
    await this.ensureInitialized();
    
    // Check local storage if enabled
    if (this.options.useLocalStorage) {
      const filePath = `${this.options.localStoragePath}/${noteId}.json`;
      return await fs.existsSync(filePath);
    }
    
    // Check Chrome storage if enabled
    if (this.options.useChromeStorage) {
      const notes = await this.getAllNotes();
      return notes.some(note => note.id === noteId);
    }
    
    return false;
  }
  
  /**
   * Get a note by ID
   * @param {string} noteId - The note ID to retrieve
   * @returns {Promise<Object|null>} - The note or null if not found
   */
  async getNote(noteId) {
    await this.ensureInitialized();
    
    try {
      // Try local storage first if enabled
      if (this.options.useLocalStorage) {
        const filePath = `${this.options.localStoragePath}/${noteId}.json`;
        if (await fs.existsSync(filePath)) {
          const noteContent = await fs.readFileSync(filePath);
          return JSON.parse(noteContent);
        }
      }
      
      // Fall back to Chrome storage if enabled
      if (this.options.useChromeStorage) {
        const notes = await this.getAllNotes();
        return notes.find(note => note.id === noteId) || null;
      }
      
      return null;
    } catch (error) {
      logger.error('NoteStorage', `Failed to get note ${noteId}`, error);
      return null;
    }
  }
  
  /**
   * Get all notes from storage
   * @returns {Promise<Array>} - Array of notes
   */
  async getAllNotes() {
    await this.ensureInitialized();
    
    try {
      logger.info('NoteStorage', 'Getting all notes');
      const noteSources = [];
      let notes = [];
      
      // Get notes from local storage if enabled
      if (this.options.useLocalStorage) {
        try {
          const files = await fs.readdirSync(this.options.localStoragePath);
          logger.debug('NoteStorage', `Found ${files.length} files in local storage directory`);
          
          const localNotes = [];
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              const notePath = `${this.options.localStoragePath}/${file}`;
              try {
                const noteContent = await fs.readFileSync(notePath);
                const note = JSON.parse(noteContent);
                logger.debug('NoteStorage', `Loaded note from local: ${note.id}, Title: ${note.title}`);
                localNotes.push(note);
              } catch (error) {
                logger.error('NoteStorage', `Error parsing note ${file}`, error);
              }
            }
          }
          
          if (localNotes.length > 0) {
            logger.info('NoteStorage', `Total notes from local storage: ${localNotes.length}`);
            notes = [...localNotes];
            noteSources.push('local');
          }
        } catch (fsError) {
          logger.error('NoteStorage', 'Error reading from local storage', fsError);
        }
      }
      
      // Get notes from Chrome storage if enabled
      if (this.options.useChromeStorage) {
        try {
          // Direct Chrome storage check
          const chromeNotes = await new Promise((resolve) => {
            chrome.storage.local.get('notes', (result) => {
              const retrievedNotes = result.notes || [];
              logger.info('NoteStorage', `Retrieved ${retrievedNotes.length} notes from Chrome storage`);
              
              // Log first few notes for debugging
              retrievedNotes.slice(0, 3).forEach((note, i) => {
                logger.debug('NoteStorage', `Chrome note ${i}: ${note.id}, Title: ${note.title}`);
              });
              
              resolve(retrievedNotes);
            });
          });
          
          if (chromeNotes.length > 0) {
            // If we already have notes from local storage, merge them
            if (notes.length > 0) {
              // Deduplicate based on content similarity, not just ID
              const existingContentMap = new Map();
              
              // Create a map of existing note content for deduplication
              notes.forEach(note => {
                const contentKey = this._getContentKey(note);
                existingContentMap.set(contentKey, note);
                
                // Also track by ID
                existingContentMap.set(note.id, note);
              });
              
              // Add chrome notes that don't exist in local storage (by content or ID)
              for (const chromeNote of chromeNotes) {
                const contentKey = this._getContentKey(chromeNote);
                
                // Skip if we have this note already by content or ID
                if (!existingContentMap.has(contentKey) && !existingContentMap.has(chromeNote.id)) {
                  notes.push(chromeNote);
                  existingContentMap.set(contentKey, chromeNote);
                  existingContentMap.set(chromeNote.id, chromeNote);
                }
              }
              
              logger.info('NoteStorage', `After deduplication, merged notes total: ${notes.length}`);
            } else {
              // Just use Chrome notes, but deduplicate them
              const uniqueNotes = [];
              const contentSet = new Set();
              
              for (const note of chromeNotes) {
                const contentKey = this._getContentKey(note);
                if (!contentSet.has(contentKey)) {
                  uniqueNotes.push(note);
                  contentSet.add(contentKey);
                }
              }
              
              notes = uniqueNotes;
              logger.info('NoteStorage', `Deduplicated Chrome notes: ${chromeNotes.length} → ${notes.length}`);
            }
            
            noteSources.push('chrome');
          }
        } catch (chromeError) {
          logger.error('NoteStorage', 'Error retrieving from Chrome storage', chromeError);
        }
      }
      
      // Sort by timestamp (newest first)
      notes.sort((a, b) => b.timestamp - a.timestamp);
      
      logger.info('NoteStorage', `Returning ${notes.length} notes from sources: ${noteSources.join(', ') || 'none'}`);
      return notes;
    } catch (error) {
      logger.error('NoteStorage', 'Failed to get all notes', error);
      return [];
    }
  }
  
  /**
   * Generate a content key for deduplication
   * This creates a simple hash of the note's content for comparison
   * @private
   */
  _getContentKey(note) {
    // Combine text + title to check for duplicates
    const text = (note.text || '').trim();
    const title = (note.title || '').trim();
    
    // Use first 50 chars of content + title as a simple signature
    const textStart = text.substring(0, 50);
    const titleStart = title.substring(0, 20);
    
    return `${titleStart}_${textStart}`;
  }
  
  /**
   * Delete a note by ID
   * @param {string} noteId - The note ID to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteNote(noteId) {
    await this.ensureInitialized();
    
    try {
      let success = false;
      
      // Delete from local storage if enabled
      if (this.options.useLocalStorage) {
        const filePath = `${this.options.localStoragePath}/${noteId}.json`;
        if (await fs.existsSync(filePath)) {
          await fs.unlinkSync(filePath);
          success = true;
          logger.info('NoteStorage', `Note deleted from local storage: ${noteId}`);
        }
      }
      
      // Delete from Chrome storage if enabled
      if (this.options.useChromeStorage) {
        const notes = await this.getAllNotes();
        const initialLength = notes.length;
        
        // Filter out the note to delete
        const filteredNotes = notes.filter(note => note.id !== noteId);
        
        if (filteredNotes.length < initialLength) {
          // Save the filtered notes back to Chrome storage
          await new Promise((resolve) => {
            chrome.storage.local.set({ notes: filteredNotes }, resolve);
          });
          success = true;
          logger.info('NoteStorage', `Note deleted from Chrome storage: ${noteId}`);
        }
      }
      
      return success;
    } catch (error) {
      logger.error('NoteStorage', `Failed to delete note ${noteId}`, error);
      return false;
    }
  }
  
  /**
   * Search notes by text query (local search only)
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Matching notes
   */
  async searchNotes(query) {
    await this.ensureInitialized();
    
    try {
      // If query is empty, return all notes
      if (!query || query.trim() === '') {
        return await this.getAllNotes();
      }
      
      // Get all notes
      const allNotes = await this.getAllNotes();
      
      // Normalize query
      const normalizedQuery = query.toLowerCase().trim();
      
      // Filter notes based on query
      return allNotes.filter(note => {
        const title = (note.title || '').toLowerCase();
        const text = (note.text || '').toLowerCase();
        return title.includes(normalizedQuery) || text.includes(normalizedQuery);
      });
    } catch (error) {
      logger.error('NoteStorage', 'Failed to search notes', error);
      return [];
    }
  }
  
  /**
   * Reset storage by clearing all notes
   * @returns {Promise<boolean>} - Success status
   */
  async resetAllNotes() {
    await this.ensureInitialized();
    
    try {
      logger.info('NoteStorage', 'Resetting all notes storage');
      let success = false;
      
      // Clear Chrome storage if enabled
      if (this.options.useChromeStorage) {
        await new Promise((resolve) => {
          chrome.storage.local.set({ notes: [] }, resolve);
        });
        logger.info('NoteStorage', 'Chrome storage notes cleared');
        success = true;
      }
      
      // Clear local storage if enabled
      if (this.options.useLocalStorage) {
        const files = await fs.readdirSync(this.options.localStoragePath);
        let deletedCount = 0;
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const notePath = `${this.options.localStoragePath}/${file}`;
            await fs.unlinkSync(notePath);
            deletedCount++;
          }
        }
        
        logger.info('NoteStorage', `Local storage cleared, deleted ${deletedCount} notes`);
        success = true;
      }
      
      return success;
    } catch (error) {
      logger.error('NoteStorage', 'Failed to reset notes storage', error);
      return false;
    }
  }
}

// Export a singleton instance with default options
const noteStorage = new NoteStorage();

export default noteStorage;

// Also export the class for custom instances
export { NoteStorage }; 