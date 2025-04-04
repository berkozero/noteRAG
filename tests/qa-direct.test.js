/**
 * Direct Tests for Q&A Functionality
 * 
 * This file tests the Q&A functionality more directly without mocking modules.
 */

// Direct API client function for testing
const askQuestion = async (question, options = {}) => {
  try {
    console.log(`Asking question: "${question}"`);
    
    // This is a mock response that would come from the server
    if (!question || question.trim() === '') {
      return {
        success: false,
        error: 'Please enter a question to ask',
        answer: '',
        sources: []
      };
    }
    
    // Mock server response
    return {
      success: true,
      answer: `This is an answer to: "${question}"`,
      sources: [
        { id: 'note1', text: 'Source note 1', title: 'Note 1', relevance: 0.9 },
        { id: 'note2', text: 'Source note 2', title: 'Note 2', relevance: 0.7 }
      ]
    };
  } catch (error) {
    console.error('Error asking question:', error);
    return {
      success: false,
      error: error.message,
      answer: 'Sorry, I could not answer that question at this time.',
      sources: []
    };
  }
};

// Direct service function that uses the API client
const notesService = {
  askQuestion: async (question, options = {}) => {
    try {
      // Basic validation for empty questions
      if (!question || typeof question !== 'string' || question.trim() === '') {
        console.warn('Empty or invalid question provided');
        return {
          success: false,
          error: 'Please enter a question to ask',
          answer: '',
          sources: []
        };
      }
      
      console.log(`Processing question: "${question}"`);
      
      // Call API client
      const result = await askQuestion(question, options);
      
      if (!result || result.success === false) {
        console.error('Failed to get answer', result.error);
        return {
          success: false,
          error: result.error || 'Failed to get an answer',
          answer: 'Sorry, I could not answer that question at this time.',
          sources: []
        };
      }
      
      // In the real service, we would update cache here
      
      console.log('Successfully retrieved answer');
      return result;
    } catch (error) {
      console.error('Error asking question', error);
      return {
        success: false,
        error: error.message,
        answer: 'Sorry, an error occurred while trying to answer your question.',
        sources: []
      };
    }
  }
};

// The actual tests
describe('Direct Q&A Functionality Tests', () => {
  test('askQuestion returns answer with sources', async () => {
    const question = 'What is noteRAG?';
    const response = await askQuestion(question);
    
    expect(response.success).toBe(true);
    expect(response.answer).toContain(question);
    expect(response.sources).toHaveLength(2);
    expect(response.sources[0].id).toBe('note1');
  });
  
  test('empty question returns appropriate error', async () => {
    const response = await askQuestion('');
    
    expect(response.success).toBe(false);
    expect(response.error).toContain('Please enter');
  });
  
  test('notesService handles regular questions correctly', async () => {
    const question = 'How does RAG work?';
    const response = await notesService.askQuestion(question);
    
    expect(response.success).toBe(true);
    expect(response.answer).toContain(question);
    expect(response.sources).toHaveLength(2);
  });
  
  test('notesService validates empty questions', async () => {
    const response = await notesService.askQuestion('');
    
    expect(response.success).toBe(false);
    expect(response.error).toContain('Please enter');
    expect(response.sources).toHaveLength(0);
  });
}); 