/**
 * QA Integration Test
 * 
 * Tests the integration of the QA Interface with the Popup.
 */

// Mock DOM for Popup
document.body.innerHTML = `
<div class="app">
  <main>
    <div class="search">
      <input type="text" id="searchInput" placeholder="Search notes...">
    </div>
    <div id="notesContainer" class="notes-list"></div>
  </main>
</div>
`;

// Mock dependencies
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../src/services/notes/notes', () => ({
  notesService: {
    askQuestion: jest.fn().mockImplementation(async (question) => {
      if (!question) {
        return {
          success: false,
          error: 'Please provide a question'
        };
      }
      return {
        success: true,
        answer: `Mock answer to: ${question}`,
        sources: [
          { id: 'note1', title: 'Test Note 1', text: 'This is the first test note content' },
          { id: 'note2', title: 'Test Note 2', text: 'This is the second test note content' }
        ]
      };
    }),
    searchNotes: jest.fn().mockResolvedValue([])
  }
}));

// Import the QA Interface
import QAInterface from '../src/components/QAInterface';

describe('QA Interface Integration Test', () => {
  let qaInterface;
  
  beforeEach(() => {
    // Clear mocks and DOM changes
    jest.clearAllMocks();
    document.body.innerHTML = `
    <div class="app">
      <main>
        <div class="search">
          <input type="text" id="searchInput" placeholder="Search notes...">
        </div>
        <div id="notesContainer" class="notes-list"></div>
      </main>
    </div>
    `;
    
    // Initialize QA Interface
    qaInterface = new QAInterface(document.querySelector('.app'));
  });
  
  test('initializes and adds elements to DOM', () => {
    // Check if elements were created
    expect(document.querySelector('.search-mode-toggle')).not.toBeNull();
    expect(document.querySelector('.qa-interface')).not.toBeNull();
    expect(document.querySelector('.question-input')).not.toBeNull();
    expect(document.querySelector('.ask-button')).not.toBeNull();
  });
  
  test('toggles between search and ask modes', () => {
    // Initial state: search mode
    const qaInterface = document.querySelector('.qa-interface');
    const searchContainer = document.querySelector('.search');
    const modeToggle = document.querySelector('.search-mode-toggle');
    
    expect(qaInterface.style.display).toBe('none');
    expect(searchContainer.classList.contains('hidden')).toBe(false);
    
    // Click toggle button
    modeToggle.click();
    
    // Should be in ask mode
    expect(qaInterface.style.display).toBe('block');
    expect(searchContainer.classList.contains('hidden')).toBe(true);
    
    // Click toggle button again
    modeToggle.click();
    
    // Should be back in search mode
    expect(qaInterface.style.display).toBe('none');
    expect(searchContainer.classList.contains('hidden')).toBe(false);
  });
  
  test('asks questions and displays answers', async () => {
    // Get reference to the QA component instance created in beforeEach
    // This is important to access the internal methods directly
    
    // Switch to ask mode
    document.querySelector('.search-mode-toggle').click();
    
    // Type a question
    const questionInput = document.querySelector('.question-input');
    questionInput.value = 'What is RAG?';
    
    // Directly call the handleAsk method which is what the button click would trigger
    await qaInterface.handleAsk();
    
    // Wait for the async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if answer is displayed
    const answerContent = document.querySelector('.answer-content');
    expect(answerContent).not.toBeNull();
    expect(answerContent.textContent).toContain('Mock answer to: What is RAG?');
    
    // Check if sources are displayed
    const sources = document.querySelectorAll('.source-item');
    expect(sources.length).toBe(2);
    expect(sources[0].textContent).toContain('Test Note 1');
    expect(sources[1].textContent).toContain('Test Note 2');
  });
  
  test('handles empty questions', async () => {
    // Switch to ask mode
    document.querySelector('.search-mode-toggle').click();
    
    // Empty question
    const questionInput = document.querySelector('.question-input');
    questionInput.value = '';
    
    // Directly call the handleAsk method
    await qaInterface.handleAsk();
    
    // Wait for UI to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if error is displayed
    const error = document.querySelector('.error');
    expect(error).not.toBeNull();
    expect(error.textContent).toContain('Please enter a question');
  });
}); 