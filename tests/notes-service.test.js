/**
 * Notes Service Tests
 * 
 * This file contains tests for the notes service module, verifying
 * that it correctly implements the backend as source of truth pattern.
 */

// Mock dependencies
jest.mock('../src/services/notes/api-client', () => ({
  createNote: jest.fn(),
  getNote: jest.fn(),
  getAllNotes: jest.fn(),
  deleteNote: jest.fn(),
  semanticSearch: jest.fn()
}));

jest.mock('../src/services/notes/note-storage', () => ({
  noteStorage: {
    saveNote: jest.fn(),
    getNote: jest.fn(),
    getAllNotes: jest.fn(),
    deleteNote: jest.fn()
  }
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../src/utils/sanitizer', () => ({
  sanitizeHTML: jest.fn(text => text)
}));

// Import the modules
const apiClient = require('../src/services/notes/api-client');
const { noteStorage } = require('../src/services/notes/note-storage');
const { notesService } = require('../src/services/notes/notes');

describe('Notes Service', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });
  
  describe('createNote', () => {
    it('should call API to create note and update local cache', async () => {
      // Setup mocks
      const mockNote = { id: 'note_123', title: 'Test', text: 'Content' };
      apiClient.createNote.mockResolvedValue(mockNote);
      
      // Call the function
      const tab = { title: 'Test Page', url: 'https://example.com' };
      const result = await notesService.createNote('Content', tab, false);
      
      // Verify interactions
      expect(apiClient.createNote).toHaveBeenCalled();
      expect(noteStorage.saveNote).toHaveBeenCalledWith(mockNote);
      expect(result).toBe(true);
    });
    
    it('should handle API errors', async () => {
      // Setup mocks to simulate an error
      apiClient.createNote.mockResolvedValue({ success: false });
      
      // Call the function
      const result = await notesService.createNote('Content', {}, false);
      
      // Verify interactions
      expect(result).toBe(false);
      expect(noteStorage.saveNote).not.toHaveBeenCalled();
    });
  });
  
  describe('getNote', () => {
    it('should get a note from the backend and cache it', async () => {
      // Setup mocks
      const mockNote = { id: 'note_123', title: 'Test', text: 'Content' };
      apiClient.getNote.mockResolvedValue(mockNote);
      
      // Call the function
      const result = await notesService.getNote('note_123');
      
      // Call again to test caching
      const cachedResult = await notesService.getNote('note_123');
      
      // Verify interactions
      expect(apiClient.getNote).toHaveBeenCalledTimes(1);
      expect(apiClient.getNote).toHaveBeenCalledWith('note_123');
      expect(result).toEqual(mockNote);
      expect(cachedResult).toEqual(mockNote);
    });
    
    it('should fall back to local storage on API error', async () => {
      // Setup mocks to simulate an error
      const mockNote = { id: 'note_123', title: 'Test', text: 'Content' };
      apiClient.getNote.mockRejectedValue(new Error('API error'));
      noteStorage.getNote.mockResolvedValue(mockNote);
      
      // Call the function
      const result = await notesService.getNote('note_123');
      
      // Verify fallback
      expect(apiClient.getNote).toHaveBeenCalledWith('note_123');
      expect(noteStorage.getNote).toHaveBeenCalledWith('note_123');
      expect(result).toEqual(mockNote);
    });
  });
  
  describe('getAllNotes', () => {
    it('should get all notes from the backend', async () => {
      // Setup mocks
      const mockNotes = [
        { id: 'note_123', title: 'Test 1', text: 'Content 1' },
        { id: 'note_456', title: 'Test 2', text: 'Content 2' }
      ];
      apiClient.getAllNotes.mockResolvedValue(mockNotes);
      
      // Call the function
      const result = await notesService.getAllNotes();
      
      // Verify interactions
      expect(apiClient.getAllNotes).toHaveBeenCalled();
      expect(result).toEqual(mockNotes);
    });
    
    it('should fall back to local storage on API error', async () => {
      // Setup mocks to simulate an error
      const mockNotes = [
        { id: 'note_123', title: 'Test 1', text: 'Content 1' },
        { id: 'note_456', title: 'Test 2', text: 'Content 2' }
      ];
      apiClient.getAllNotes.mockRejectedValue(new Error('API error'));
      noteStorage.getAllNotes.mockResolvedValue(mockNotes);
      
      // Call the function
      const result = await notesService.getAllNotes();
      
      // Verify fallback
      expect(apiClient.getAllNotes).toHaveBeenCalled();
      expect(noteStorage.getAllNotes).toHaveBeenCalled();
      expect(result).toEqual(mockNotes);
    });
  });
  
  describe('deleteNote', () => {
    it('should delete a note from the backend and local storage', async () => {
      // Setup mocks
      apiClient.deleteNote.mockResolvedValue({ success: true });
      
      // Call the function
      const result = await notesService.deleteNote('note_123');
      
      // Verify interactions
      expect(apiClient.deleteNote).toHaveBeenCalledWith('note_123');
      expect(noteStorage.deleteNote).toHaveBeenCalledWith('note_123');
      expect(result).toBe(true);
    });
    
    it('should handle API errors', async () => {
      // Setup mocks to simulate an error
      apiClient.deleteNote.mockResolvedValue({ success: false });
      
      // Call the function
      const result = await notesService.deleteNote('note_123');
      
      // Verify no local delete
      expect(result).toBe(false);
    });
  });
  
  describe('searchNotes', () => {
    it('should perform semantic search via the API', async () => {
      // Setup mocks
      const mockResults = [
        { id: 'note_123', title: 'Test 1', text: 'Content 1' },
        { id: 'note_456', title: 'Test 2', text: 'Content 2' }
      ];
      apiClient.semanticSearch.mockResolvedValue({ 
        success: true, 
        results: mockResults 
      });
      
      // Call the function
      const result = await notesService.searchNotes('test query');
      
      // Verify interactions
      expect(apiClient.semanticSearch).toHaveBeenCalledWith('test query', {});
      expect(result).toEqual(mockResults);
    });
    
    it('should handle search failures', async () => {
      // Setup mocks
      apiClient.semanticSearch.mockResolvedValue({ 
        success: false, 
        message: 'Search failed'
      });
      
      // Call the function
      const result = await notesService.searchNotes('test query');
      
      // Verify interactions
      expect(result).toEqual([]);
    });
  });
  
  describe('syncWithBackend', () => {
    it('should get all notes from backend and update local cache', async () => {
      // Setup mocks
      const mockNotes = [
        { id: 'note_123', title: 'Test 1', text: 'Content 1' },
        { id: 'note_456', title: 'Test 2', text: 'Content 2' }
      ];
      apiClient.getAllNotes.mockResolvedValue(mockNotes);
      
      // Call the function
      const result = await notesService.syncWithBackend();
      
      // Verify interactions
      expect(apiClient.getAllNotes).toHaveBeenCalled();
      expect(noteStorage.saveNote).toHaveBeenCalledTimes(2);
      expect(noteStorage.saveNote).toHaveBeenCalledWith(mockNotes[0]);
      expect(noteStorage.saveNote).toHaveBeenCalledWith(mockNotes[1]);
      expect(result).toBe(true);
    });
  });
}); 