/**
 * API Client Tests
 * 
 * This file contains tests for the API client to verify it correctly
 * communicates with the backend server.
 */

// Mock the logger to avoid console output during tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Import the api client
const apiClient = require('../src/services/notes/api-client');

describe('API Client', () => {
  beforeEach(() => {
    // Reset mock between tests
    global.fetch.mockReset();
    
    // Setup default successful server check
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({ ok: true })
    );
  });
  
  describe('createNote', () => {
    it('should send note data to the correct endpoint', async () => {
      // Setup mock response
      global.fetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'note_123', title: 'Test', text: 'Content' })
        })
      );
      
      const note = { title: 'Test', text: 'Content', timestamp: Date.now() };
      await apiClient.createNote(note);
      
      // Check that it called the correct endpoint with the right data
      expect(global.fetch).toHaveBeenCalledTimes(2); // Server check + actual request
      expect(global.fetch.mock.calls[1][0]).toBe('http://localhost:3000/api/notes');
      expect(global.fetch.mock.calls[1][1].method).toBe('POST');
      
      // Verify payload
      const sentData = JSON.parse(global.fetch.mock.calls[1][1].body);
      expect(sentData).toEqual(note);
    });
    
    it('should handle server errors', async () => {
      // Set up mock to simulate server error
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error' }),
      });

      const note = { title: 'Test Note', text: 'Test content' };
      
      // Call the function and get the result
      const result = await apiClient.createNote(note);
      
      // Verify we get an error object with the expected detail
      expect(result.error).toBeDefined();
      expect(result.error).toBe('Internal server error');
    });
  });
  
  describe('updateNote', () => {
    it('should send update to the correct endpoint', async () => {
      // Setup mock response
      global.fetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'note_123', title: 'Updated', text: 'Content' })
        })
      );
      
      const noteId = 'note_123';
      const noteData = { title: 'Updated', text: 'Content' };
      await apiClient.updateNote(noteId, noteData);
      
      // Check that it called the correct endpoint with the right data
      expect(global.fetch).toHaveBeenCalledTimes(2); // Server check + actual request
      expect(global.fetch.mock.calls[1][0]).toBe('http://localhost:3000/api/notes/note_123');
      expect(global.fetch.mock.calls[1][1].method).toBe('PUT');
      
      // Verify payload
      const sentData = JSON.parse(global.fetch.mock.calls[1][1].body);
      expect(sentData).toEqual(noteData);
    });
  });
  
  describe('getNote', () => {
    it('should fetch a note from the correct endpoint', async () => {
      // Setup mock response
      global.fetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'note_123', title: 'Test', text: 'Content' })
        })
      );
      
      const noteId = 'note_123';
      const note = await apiClient.getNote(noteId);
      
      // Check that it called the correct endpoint
      expect(global.fetch).toHaveBeenCalledTimes(2); // Server check + actual request
      expect(global.fetch.mock.calls[1][0]).toBe('http://localhost:3000/api/notes/note_123');
      
      // Verify response
      expect(note).toEqual({ id: 'note_123', title: 'Test', text: 'Content' });
    });
  });
  
  describe('getAllNotes', () => {
    it('should fetch all notes from the correct endpoint', async () => {
      // Setup mock response
      const mockNotes = [
        { id: 'note_123', title: 'Test 1', text: 'Content 1' },
        { id: 'note_456', title: 'Test 2', text: 'Content 2' }
      ];
      
      global.fetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockNotes)
        })
      );
      
      const notes = await apiClient.getAllNotes();
      
      // Check that it called the correct endpoint
      expect(global.fetch).toHaveBeenCalledTimes(2); // Server check + actual request
      expect(global.fetch.mock.calls[1][0]).toBe('http://localhost:3000/api/notes');
      
      // Verify response
      expect(notes).toEqual(mockNotes);
    });
  });
  
  describe('deleteNote', () => {
    it('should delete a note from the correct endpoint', async () => {
      // Setup mock response
      global.fetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'success' })
        })
      );
      
      const noteId = 'note_123';
      const result = await apiClient.deleteNote(noteId);
      
      // Check that it called the correct endpoint
      expect(global.fetch).toHaveBeenCalledTimes(2); // Server check + actual request
      expect(global.fetch.mock.calls[1][0]).toBe('http://localhost:3000/api/notes/note_123');
      expect(global.fetch.mock.calls[1][1].method).toBe('DELETE');
      
      // Verify response
      expect(result).toEqual({ status: 'success' });
    });
  });
  
  describe('semanticSearch', () => {
    it('should search notes using the correct endpoint', async () => {
      // Setup mock response
      const mockResults = [
        { id: 'note_123', title: 'Test 1', text: 'Content 1', score: 0.95 },
        { id: 'note_456', title: 'Test 2', text: 'Content 2', score: 0.85 }
      ];
      
      global.fetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResults)
        })
      );
      
      const query = 'test query';
      const result = await apiClient.semanticSearch(query, { limit: 5 });
      
      // Check that it called the correct endpoint with the right parameters
      expect(global.fetch).toHaveBeenCalledTimes(2); // Server check + actual request
      expect(global.fetch.mock.calls[1][0]).toContain('http://localhost:3000/api/notes/search');
      // Either format of URL encoding is acceptable
      expect(
        global.fetch.mock.calls[1][0].includes('query=test+query') || 
        global.fetch.mock.calls[1][0].includes('query=test%20query')
      ).toBe(true);
      expect(global.fetch.mock.calls[1][0]).toContain('limit=5');
      
      // Verify response
      expect(result.success).toBe(true);
      expect(result.results).toEqual(mockResults);
    });
  });
}); 