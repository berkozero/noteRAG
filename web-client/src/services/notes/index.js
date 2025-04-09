import axios from 'axios';
import { authService } from '../authService';

// API URL configuration
const API_URL = process.env.REACT_APP_API_URL || 'https://localhost:3443';

/**
 * Helper method to get authentication headers
 */
const getAuthHeaders = async () => {
  const token = await authService.getToken();
  
  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : undefined
    }
  };
};

/**
 * Notes service for managing notes in the web application
 */
class NotesService {
  /**
   * Get all notes from the server
   */
  async getAllNotes() {
    try {
      const authConfig = await getAuthHeaders();
      const response = await axios.get(`${API_URL}/api/notes`, authConfig);
      
      // Sort by timestamp in descending order (newest first)
      return response.data.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error getting notes:', error);
      throw new Error('Failed to fetch notes from server');
    }
  }

  /**
   * Get a single note by ID
   */
  async getNote(noteId) {
    try {
      const authConfig = await getAuthHeaders();
      const response = await axios.get(`${API_URL}/api/notes/${noteId}`, authConfig);
      return response.data;
    } catch (error) {
      console.error(`Error getting note ${noteId}:`, error);
      throw new Error('Failed to fetch note from server');
    }
  }

  /**
   * Create a new note
   */
  async createNote(note) {
    try {
      const authConfig = await getAuthHeaders();
      const response = await axios.post(`${API_URL}/api/notes`, note, authConfig);
      return response.data;
    } catch (error) {
      console.error('Error creating note:', error);
      throw new Error('Failed to create note on server');
    }
  }

  /**
   * Delete a note by ID
   */
  async deleteNote(noteId) {
    try {
      const authConfig = await getAuthHeaders();
      await axios.delete(`${API_URL}/api/notes/${noteId}`, authConfig);
      return { success: true };
    } catch (error) {
      console.error(`Error deleting note ${noteId}:`, error);
      throw new Error('Failed to delete note from server');
    }
  }

  /**
   * Search notes (for future implementation)
   */
  async searchNotes(query) {
    try {
      const authConfig = await getAuthHeaders();
      const response = await axios.post(`${API_URL}/api/search`, { query }, authConfig);
      return response.data;
    } catch (error) {
      console.error('Error searching notes:', error);
      throw new Error('Failed to search notes');
    }
  }

  /**
   * Ask questions about notes (for future implementation)
   */
  async askQuestion(question) {
    try {
      const authConfig = await getAuthHeaders();
      const response = await axios.post(`${API_URL}/api/qa`, { question }, authConfig);
      return response.data;
    } catch (error) {
      console.error('Error asking question:', error);
      throw new Error('Failed to get answer for question');
    }
  }
}

export const notesService = new NotesService();
export default notesService; 