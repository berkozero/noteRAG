/**
 * Notes Service
 * 
 * Central service for managing notes within the extension.
 * Implements the source of truth pattern by using the server for all operations,
 * with local state used only for caching.
 */

import { logger } from '../../utils/logger';
import * as apiClient from './api-client';
import noteStorage from './note-storage';
import { sanitizeHTML } from '../../utils/sanitizer';

// Create local cache for frequently accessed notes
const noteCache = new Map();

// Success icon settings
const SUCCESS_ICON_TIMEOUT = 1200; // Time to show the success icon (milliseconds)

/**
 * Create a new note from selected content
 * @param {string} content - The selected content
 * @param {Object} tab - The browser tab info
 * @param {boolean} isHtml - Whether the content is HTML (false for plain text)
 * @returns {Promise<boolean>} Whether the note was created successfully
 */
export async function createNote(content, tab, isHtml = false) {
    try {
        logger.info('Notes', 'Creating new note from selection');
        
        // Basic input validation
        if (!content || typeof content !== 'string' || content.trim() === '') {
            logger.warn('Notes', 'Empty or invalid content, not creating note');
            return false;
        }
        
        // Clean up HTML content if needed
        let cleanText = content;
        if (isHtml) {
            cleanText = sanitizeHTML(content);
        }
        
        // Create timestamp (used as part of the ID)
        const timestamp = Date.now();
        
        // Create a title from the tab or a fallback
        const title = tab && tab.title ? tab.title : 'Note from selection';
        
        // Source URL
        const sourceUrl = tab && tab.url ? tab.url : null;
        
        // Create the note object
        const note = {
            title,
            text: cleanText,
            timestamp,
            sourceUrl
        };
        
        // Save to backend (source of truth)
        logger.info('Notes', 'Saving note to backend');
        const savedNote = await apiClient.createNote(note);
        
        if (!savedNote || savedNote.success === false) {
            logger.error('Notes', 'Failed to save note to backend');
            return false;
        }
        
        // Update local cache
        logger.info('Notes', 'Updating local cache');
        await updateLocalCache(savedNote);
        
        logger.info('Notes', `Note created successfully with ID: ${savedNote.id}`);
        return true;
    } catch (error) {
        logger.error('Notes', 'Error creating note', error);
        return false;
    }
}

/**
 * Get a note by ID
 * @param {string} noteId - The note ID to retrieve
 * @returns {Promise<Object|null>} The note or null if not found
 */
export async function getNote(noteId) {
    try {
        // First check the cache
        if (noteCache.has(noteId)) {
            logger.info('Notes', `Found note ${noteId} in cache`);
            return noteCache.get(noteId);
        }
        
        // If not in cache, get from backend
        logger.info('Notes', `Fetching note ${noteId} from backend`);
        const note = await apiClient.getNote(noteId);
        
        // If found, update cache
        if (note) {
            noteCache.set(noteId, note);
        }
        
        return note;
    } catch (error) {
        logger.error('Notes', `Error getting note ${noteId}`, error);
        
        // Fall back to local storage if backend is unavailable
        logger.info('Notes', `Falling back to local storage for note ${noteId}`);
        return await noteStorage.getNote(noteId);
    }
}

/**
 * Get all notes
 * @returns {Promise<Array>} Array of all notes
 */
export async function getAllNotes() {
    try {
        // Get from backend
        logger.info('Notes', 'Fetching all notes from backend');
        const notes = await apiClient.getAllNotes();
        
        // Update cache with all notes
        notes.forEach(note => {
            noteCache.set(note.id, note);
        });
        
        return notes;
    } catch (error) {
        logger.error('Notes', 'Error getting all notes', error);
        
        // Fall back to local storage
        logger.info('Notes', 'Falling back to local storage for all notes');
        return await noteStorage.getAllNotes();
    }
}

/**
 * Delete a note
 * @param {string} noteId - The note ID to delete
 * @returns {Promise<boolean>} Whether the note was deleted successfully
 */
export async function deleteNote(noteId) {
    try {
        // Delete from backend
        logger.info('Notes', `Deleting note ${noteId} from backend`);
        const result = await apiClient.deleteNote(noteId);
        
        if (result.success === false) {
            logger.error('Notes', `Failed to delete note ${noteId} from backend`);
            return false;
        }
        
        // Remove from cache
        noteCache.delete(noteId);
        
        // Also remove from local storage
        await noteStorage.deleteNote(noteId);
        
        logger.info('Notes', `Note ${noteId} deleted successfully`);
        return true;
    } catch (error) {
        logger.error('Notes', `Error deleting note ${noteId}`, error);
        return false;
    }
}

/**
 * Search notes
 * @param {string} query - The search query
 * @param {Object} options - Search options (limit, etc.)
 * @returns {Promise<Array>} Array of matching notes
 */
export async function searchNotes(query, options = {}) {
    try {
        logger.info('Notes', `Searching notes with query: "${query}"`);
        
        // Use the API client to search - it already handles server communication
        const results = await apiClient.searchNotes(query, options);
        
        if (results.success === false) {
            logger.error('Notes', 'Search failed');
            return [];
        }
        
        // Update cache with search results
        results.results.forEach(note => {
            noteCache.set(note.id, note);
        });
        
        return results.results;
    } catch (error) {
        logger.error('Notes', 'Error searching notes', error);
        return [];
    }
}

/**
 * Update local cache with a note
 * @param {Object} note - The note to cache
 * @private
 */
async function updateLocalCache(note) {
    try {
        // Update in-memory cache
        noteCache.set(note.id, note);
        
        // Also update local storage for offline capability
        await noteStorage.saveNote(note);
    } catch (error) {
        logger.error('Notes', 'Error updating local cache', error);
    }
}

/**
 * Show success icon in the toolbar
 * @returns {Promise<void>}
 */
export async function showSuccessIcon() {
    try {
        // Change the extension icon to the success icon
        chrome.action.setIcon({
            path: {
                16: '../assets/icons/success16.png',
                32: '../assets/icons/success32.png',
                48: '../assets/icons/success48.png',
                128: '../assets/icons/success128.png'
            }
        });
        
        // Reset the icon after a timeout
        setTimeout(() => {
            chrome.action.setIcon({
                path: {
                    16: '../assets/icons/icon16.png',
                    32: '../assets/icons/icon32.png',
                    48: '../assets/icons/icon48.png',
                    128: '../assets/icons/icon128.png'
                }
            });
        }, SUCCESS_ICON_TIMEOUT);
    } catch (error) {
        logger.error('Notes', 'Error showing success icon', error);
    }
}

/**
 * Synchronize local cache with backend
 * @returns {Promise<boolean>} Whether the sync was successful
 */
export async function syncWithBackend() {
    try {
        logger.info('Notes', 'Synchronizing with backend');
        
        // Get all notes from backend
        const notes = await apiClient.getAllNotes();
        
        // Update local cache with all notes
        for (const note of notes) {
            await updateLocalCache(note);
        }
        
        logger.info('Notes', 'Sync complete');
        return true;
    } catch (error) {
        logger.error('Notes', 'Error synchronizing with backend', error);
        return false;
    }
}

// Export as a single object for easier consumption
export const notesService = {
    createNote,
    getNote,
    getAllNotes,
    deleteNote,
    searchNotes,
    showSuccessIcon,
    syncWithBackend
}; 