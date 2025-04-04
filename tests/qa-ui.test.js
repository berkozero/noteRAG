/**
 * Unit Tests for Q&A UI Component
 * 
 * These tests verify the UI component for the question answering functionality.
 */

// Mock DOM elements
document.body.innerHTML = `
<div id="qa-container">
  <div class="search-container">
    <input type="text" id="searchInput" placeholder="Search notes...">
    <button id="search-mode-toggle">Ask</button>
  </div>
  <div id="qa-interface" style="display: none;">
    <textarea id="question-input" placeholder="Ask a question about your notes..."></textarea>
    <button id="ask-button">Ask</button>
    <div id="answer-container"></div>
    <div id="sources-container"></div>
  </div>
</div>
`;

// Mock the notesService
const notesServiceMock = {
  askQuestion: jest.fn(),
  searchNotes: jest.fn()
};

// Import the logger to spy on it
const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Mock UI class for testing
class QAInterface {
  constructor(container, notesService, logger) {
    this.container = container;
    this.notesService = notesService;
    this.logger = logger;
    
    // Find UI elements
    this.qaInterface = document.getElementById('qa-interface');
    this.questionInput = document.getElementById('question-input');
    this.askButton = document.getElementById('ask-button');
    this.answerContainer = document.getElementById('answer-container');
    this.sourcesContainer = document.getElementById('sources-container');
    this.modeToggle = document.getElementById('search-mode-toggle');
    
    // Bind events
    this.askButton.addEventListener('click', this.handleAsk.bind(this));
    this.modeToggle.addEventListener('click', this.toggleMode.bind(this));
    
    // Initial state
    this.isVisible = false;
  }
  
  toggleMode() {
    this.isVisible = !this.isVisible;
    this.qaInterface.style.display = this.isVisible ? 'block' : 'none';
    this.modeToggle.textContent = this.isVisible ? 'Search' : 'Ask';
    
    if (this.isVisible) {
      this.questionInput.focus();
    }
  }
  
  async handleAsk() {
    const question = this.questionInput.value.trim();
    
    if (!question) {
      this.showError('Please enter a question');
      return;
    }
    
    try {
      // Show loading state
      this.answerContainer.innerHTML = '<div class="loading">Thinking...</div>';
      this.sourcesContainer.innerHTML = '';
      
      // Get answer from service
      const response = await this.notesService.askQuestion(question);
      
      if (!response || response.success === false) {
        this.showError(response.error || 'Failed to get an answer');
        return;
      }
      
      // Display answer and sources
      this.displayAnswer(response.answer);
      this.displaySources(response.sources);
      
    } catch (error) {
      this.logger.error('QA UI', 'Error asking question', error);
      this.showError('An error occurred while processing your question');
    }
  }
  
  displayAnswer(answer) {
    this.answerContainer.innerHTML = `<div class="answer">${answer}</div>`;
  }
  
  displaySources(sources) {
    if (!sources || sources.length === 0) {
      this.sourcesContainer.innerHTML = '';
      return;
    }
    
    let sourcesHtml = '<div class="sources-header">Sources:</div><div class="sources-list">';
    
    sources.forEach((source, index) => {
      sourcesHtml += `
        <div class="source-item">
          <div class="source-number">[${index + 1}]</div>
          <div class="source-content">
            <div class="source-title">${source.title || 'Untitled Note'}</div>
            <div class="source-text">${source.text}</div>
          </div>
        </div>
      `;
    });
    
    sourcesHtml += '</div>';
    this.sourcesContainer.innerHTML = sourcesHtml;
  }
  
  showError(message) {
    this.answerContainer.innerHTML = `<div class="error">${message}</div>`;
  }
}

describe('Q&A UI Component', () => {
  let qaUI;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize component
    qaUI = new QAInterface(
      document.getElementById('qa-container'),
      notesServiceMock,
      loggerMock
    );
  });
  
  test('toggles visibility correctly', () => {
    // Initial state should be hidden
    expect(qaUI.isVisible).toBe(false);
    expect(qaUI.qaInterface.style.display).toBe('none');
    
    // Toggle on
    qaUI.toggleMode();
    expect(qaUI.isVisible).toBe(true);
    expect(qaUI.qaInterface.style.display).toBe('block');
    expect(qaUI.modeToggle.textContent).toBe('Search');
    
    // Toggle off
    qaUI.toggleMode();
    expect(qaUI.isVisible).toBe(false);
    expect(qaUI.qaInterface.style.display).toBe('none');
    expect(qaUI.modeToggle.textContent).toBe('Ask');
  });
  
  test('handles empty questions correctly', async () => {
    // Set empty question
    qaUI.questionInput.value = '';
    
    // Try to ask
    await qaUI.handleAsk();
    
    // Verify service was not called
    expect(notesServiceMock.askQuestion).not.toHaveBeenCalled();
    
    // Verify error is shown
    expect(qaUI.answerContainer.innerHTML).toContain('Please enter a question');
  });
  
  test('displays answer and sources correctly', async () => {
    // Mock successful response
    const mockResponse = {
      success: true,
      answer: 'This is a test answer',
      sources: [
        { id: 'note1', title: 'Test Note', text: 'Source content' }
      ]
    };
    notesServiceMock.askQuestion.mockResolvedValueOnce(mockResponse);
    
    // Set question and ask
    qaUI.questionInput.value = 'Test question';
    await qaUI.handleAsk();
    
    // Verify service was called with correct question
    expect(notesServiceMock.askQuestion).toHaveBeenCalledWith('Test question');
    
    // Verify answer is displayed
    expect(qaUI.answerContainer.innerHTML).toContain('This is a test answer');
    
    // Verify sources are displayed
    expect(qaUI.sourcesContainer.innerHTML).toContain('Test Note');
    expect(qaUI.sourcesContainer.innerHTML).toContain('Source content');
  });
  
  test('handles service errors correctly', async () => {
    // Mock error response
    const mockResponse = {
      success: false,
      error: 'Service error',
      answer: '',
      sources: []
    };
    notesServiceMock.askQuestion.mockResolvedValueOnce(mockResponse);
    
    // Set question and ask
    qaUI.questionInput.value = 'Test question';
    await qaUI.handleAsk();
    
    // Verify error is shown
    expect(qaUI.answerContainer.innerHTML).toContain('Service error');
    
    // Verify sources container is empty
    expect(qaUI.sourcesContainer.innerHTML).toBe('');
  });
}); 