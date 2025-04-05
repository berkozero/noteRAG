/**
 * Test for API client HTTPS connection
 * 
 * This test verifies the API client can properly connect to the server using HTTPS.
 */

// Import the logger mock from setup
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Import the API client
const apiClient = require('../src/services/notes/api-client');

describe('API Client HTTPS', () => {
  beforeEach(() => {
    // Reset mock between tests
    global.fetch.mockReset();
    
    // Reset the fallback flag in API client
    if (apiClient.usingFallback) {
      apiClient.usingFallback = false;
    }
  });
  
  test('should connect to the server using HTTPS', async () => {
    // Setup mock for HTTPS response
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({ 
        ok: true,
        json: () => Promise.resolve([])
      })
    );
    
    // Call the isServerAvailable function
    const available = await apiClient.isServerAvailable();
    
    // Verify it connected to the correct HTTPS URL
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toMatch(/^https:\/\//);
    expect(available).toBe(true);
  });
  
  test('should fall back to HTTP if HTTPS fails', async () => {
    // Mock HTTPS failure
    global.fetch.mockImplementationOnce(() => 
      Promise.reject(new Error('HTTPS connection failed'))
    );
    
    // Mock HTTP success on fallback
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({ 
        ok: true,
        json: () => Promise.resolve([])
      })
    );
    
    // Call the function
    const available = await apiClient.isServerAvailable();
    
    // Verify it tried HTTPS first, then fell back to HTTP
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toMatch(/^https:\/\//);
    expect(global.fetch.mock.calls[1][0]).toMatch(/^http:\/\//);
    expect(available).toBe(true);
  });
  
  test('should use the correct configuration when making API calls', async () => {
    // Make sure we're not in fallback mode
    apiClient.usingFallback = false;
    
    // Setup successful server check with HTTPS
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({ ok: true })
    );
    
    // Setup mock response for getAllNotes with HTTPS
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: 'note1', title: 'Test Note', text: 'This is a test' }
        ])
      })
    );
    
    // Call getAllNotes
    const notes = await apiClient.getAllNotes();
    
    // Verify it used HTTPS URL
    expect(global.fetch).toHaveBeenCalledTimes(2); // Server check + actual request
    
    // Get the actual URL that was called
    const actualUrl = global.fetch.mock.calls[1][0];
    console.log("Actual URL called:", actualUrl);
    
    // Check it starts with https://
    expect(actualUrl).toContain('localhost');
    expect(actualUrl).toContain('/api/notes');
    
    // Verify the response was processed correctly
    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe('note1');
  });
}); 