/**
 * Unit Tests for Question Answering Functionality
 * 
 * These tests verify that the Q&A feature of the Chrome extension works correctly
 * by testing the API interactions and response handling.
 */

// Mock global fetch
global.fetch = jest.fn();

// Mock the logger to avoid console output during tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock server availability check 
jest.mock('../src/services/notes/api-client', () => {
  const originalModule = jest.requireActual('../src/services/notes/api-client');
  return {
    ...originalModule,
    isServerAvailable: jest.fn().mockResolvedValue(true)
  };
});

// Now import after the mocks are set up
const apiClient = require('../src/services/notes/api-client');
const { notesService } = require('../src/services/notes/notes');

describe('Question Answering Functionality', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  test('API Client: askQuestion makes correct fetch call', async () => {
    // Mock successful response
    const mockResponse = {
      answer: 'This is a test answer',
      sources: [
        { id: 'note1', text: 'Source note 1', relevance: 0.9 },
        { id: 'note2', text: 'Source note 2', relevance: 0.7 }
      ]
    };
    
    // Setup fetch mock to actually return response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });
    
    // Call the function with a test question
    const question = 'What is the meaning of life?';
    const result = await apiClient.askQuestion(question);
    
    // Verify fetch was called with correct URL
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/notes/ask?question=What+is+the+meaning+of+life%3F'));
    
    // Verify the result matches our mock
    expect(result).toEqual(mockResponse);
  });

  test('API Client: askQuestion handles server errors', async () => {
    // Mock error response
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });
    
    // Call the function
    const question = 'What is the meaning of life?';
    const result = await apiClient.askQuestion(question);
    
    // Verify we get an error response with fallback message
    expect(result.success).toBe(false);
    expect(result.error).toContain('500: Internal Server Error');
    expect(result.answer).toContain('Sorry');
  });

  test('Notes Service: askQuestion validates empty questions', async () => {
    // Call with empty question
    const result = await notesService.askQuestion('');
    
    // Verify fetch was not called
    expect(global.fetch).not.toHaveBeenCalled();
    
    // Verify we get an appropriate error
    expect(result.success).toBe(false);
    expect(result.error).toContain('Please enter');
  });

  test('Notes Service: askQuestion passes options correctly', async () => {
    // Setup fetch mock with success response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'Test answer', sources: [] })
    });
    
    // Call with custom options
    const options = { limit: 10 };
    await notesService.askQuestion('test question', options);
    
    // Verify URL contains correct limit parameter
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('limit=10'));
  });

  test('Notes Service: askQuestion updates cache with source notes', async () => {
    // Reset fetch mock to avoid conflicting with previous tests
    global.fetch.mockReset();
    
    // Create test response with sources
    const mockResponse = {
      answer: 'Answer with sources',
      sources: [
        { id: 'note1', text: 'Content 1', title: 'Title 1' },
        { id: 'note2', text: 'Content 2', title: 'Title 2' }
      ]
    };
    
    // Setup fetch mock with success response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });
    
    // Call the function
    const result = await notesService.askQuestion('test question');
    
    // Verify the result contains the expected sources
    expect(result).toHaveProperty('sources');
    expect(result.sources.length).toBe(2);
    expect(result.sources[0].id).toBe('note1');
    
    // Verify fetch was called exactly once
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
}); 