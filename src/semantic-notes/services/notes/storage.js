/**
 * File-based storage service for notes
 */
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const config = require('../../utils/config');
const logger = require('../../utils/logger');

// Default empty notes structure
const DEFAULT_NOTES = {
  notes: []
};

/**
 * Ensures the notes file exists, creating it if needed
 */
async function ensureNotesFile() {
  try {
    await fs.ensureFile(config.paths.notesFile);
    
    // Check if file is empty
    const stats = await fs.stat(config.paths.notesFile);
    if (stats.size === 0) {
      await fs.writeJson(config.paths.notesFile, DEFAULT_NOTES);
      logger.info('Storage', `Created empty notes file at ${config.paths.notesFile}`);
    }
  } catch (error) {
    logger.error('Storage', `Error ensuring notes file: ${error.message}`, error);
    throw error;
  }
}

/**
 * Get all notes from storage
 */
async function getAllNotes() {
  try {
    await ensureNotesFile();
    const data = await fs.readJson(config.paths.notesFile);
    return data.notes || [];
  } catch (error) {
    logger.error('Storage', `Error reading notes: ${error.message}`, error);
    return [];
  }
}

/**
 * Save all notes to storage
 */
async function saveAllNotes(notes) {
  try {
    await ensureNotesFile();
    await fs.writeJson(config.paths.notesFile, { notes }, { spaces: 2 });
    logger.debug('Storage', `Saved ${notes.length} notes to file`);
    return true;
  } catch (error) {
    logger.error('Storage', `Error saving notes: ${error.message}`, error);
    return false;
  }
}

/**
 * Add a new note to storage
 */
async function addNote(noteData) {
  try {
    const notes = await getAllNotes();
    
    // Create the note object with defaults
    const newNote = {
      id: noteData.id || uuidv4(),
      text: noteData.text || '',
      title: noteData.title || '',
      url: noteData.url || '',
      timestamp: noteData.timestamp || Date.now(),
      tags: noteData.tags || [],
      embedding: noteData.embedding || null
    };
    
    // Add to notes array
    notes.unshift(newNote);
    
    // Save all notes
    const success = await saveAllNotes(notes);
    if (success) {
      logger.info('Storage', `Added note: ${newNote.id}`);
      return newNote;
    }
    return null;
  } catch (error) {
    logger.error('Storage', `Error adding note: ${error.message}`, error);
    return null;
  }
}

/**
 * Update an existing note
 */
async function updateNote(id, noteData) {
  try {
    const notes = await getAllNotes();
    const index = notes.findIndex(note => note.id === id);
    
    if (index === -1) {
      logger.warn('Storage', `Note not found for update: ${id}`);
      return null;
    }
    
    // Update the note
    const updatedNote = {
      ...notes[index],
      ...noteData,
      id, // Ensure ID remains unchanged
      timestamp: noteData.timestamp || Date.now(), // Update timestamp unless provided
    };
    
    notes[index] = updatedNote;
    
    // Save all notes
    const success = await saveAllNotes(notes);
    if (success) {
      logger.info('Storage', `Updated note: ${id}`);
      return updatedNote;
    }
    return null;
  } catch (error) {
    logger.error('Storage', `Error updating note: ${error.message}`, error);
    return null;
  }
}

/**
 * Delete a note by ID
 */
async function deleteNote(id) {
  try {
    const notes = await getAllNotes();
    const filteredNotes = notes.filter(note => note.id !== id);
    
    if (filteredNotes.length === notes.length) {
      logger.warn('Storage', `Note not found for deletion: ${id}`);
      return false;
    }
    
    // Save filtered notes
    const success = await saveAllNotes(filteredNotes);
    if (success) {
      logger.info('Storage', `Deleted note: ${id}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Storage', `Error deleting note: ${error.message}`, error);
    return false;
  }
}

module.exports = {
  getAllNotes,
  addNote,
  updateNote,
  deleteNote,
  ensureNotesFile
}; 