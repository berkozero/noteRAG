/**
 * Q&A Interface Component
 * 
 * This component provides a clean interface for asking questions about your notes
 * using RAG technology. It's designed to match UI elements from Perplexity and Notion AI.
 */
import { logger } from '../utils/logger';
import { notesService } from '../services/notes/notes';

class QAInterface {
  constructor(container) {
    this.container = container;
    
    // Find search container first - needed for correct setup
    this.searchContainer = this.container.querySelector('.search');
    this.searchInput = this.container.querySelector('#searchInput');
    
    // Create and inject DOM elements
    this.createInterface();
    
    // Find UI elements
    this.qaInterface = this.container.querySelector('.qa-interface');
    this.questionInput = this.container.querySelector('.question-input');
    this.askButton = this.container.querySelector('.ask-button');
    this.answerContainer = this.container.querySelector('.answer-container');
    this.sourcesContainer = this.container.querySelector('.sources-container');
    this.modeToggle = this.container.querySelector('.search-mode-toggle');
    
    // Bind events
    this.askButton.addEventListener('click', this.handleAsk.bind(this));
    this.modeToggle.addEventListener('click', this.toggleMode.bind(this));
    this.questionInput.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Initial state
    this.isVisible = false;
    this.isProcessing = false;
  }
  
  createInterface() {
    // Find the noteRAG heading element - typically the h1 or app-title element
    const appTitle = this.container.querySelector('h1');
    
    if (appTitle) {
      // Create toggle button (Ask button)
      const toggleButton = document.createElement('button');
      toggleButton.className = 'search-mode-toggle popup-ask-button';
      toggleButton.innerHTML = '<span>Ask</span>';
      toggleButton.title = 'Ask a question about your notes';
      
      // Insert the button right after the app title
      appTitle.parentNode.insertBefore(toggleButton, appTitle.nextSibling);
    } else if (this.searchContainer) {
      // Fallback to old location if title element not found
      const toggleButton = document.createElement('button');
      toggleButton.className = 'search-mode-toggle';
      toggleButton.innerHTML = '<span>Ask</span>';
      toggleButton.title = 'Ask a question about your notes';
      this.searchContainer.appendChild(toggleButton);
    } else {
      logger.warn('QA UI', 'Could not find app title or search container');
    }
    
    // Create the Q&A interface container
    const qaInterface = document.createElement('div');
    qaInterface.className = 'qa-interface';
    qaInterface.style.display = 'none';
    
    qaInterface.innerHTML = `
      <div class="qa-header">
        <button class="back-button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor"/>
          </svg>
          Back to Notes
        </button>
      </div>
      <div class="qa-input-container">
        <textarea 
          class="question-input" 
          placeholder="Ask a question about your notes..."></textarea>
        <button class="ask-button">Ask</button>
      </div>
      <div class="thinking-indicator">
        <div class="thinking-pulse"></div>
        <div class="thinking-text">Processing your question...</div>
      </div>
      <div class="answer-container"></div>
      <div class="sources-container"></div>
    `;
    
    // Add it to the container
    this.container.appendChild(qaInterface);
    
    // Find the back button and add event listener
    this.backButton = qaInterface.querySelector('.back-button');
    this.backButton.addEventListener('click', this.toggleMode.bind(this));
  }
  
  toggleMode() {
    this.isVisible = !this.isVisible;
    
    // Toggle visibility of interfaces
    this.qaInterface.style.display = this.isVisible ? 'block' : 'none';
    
    // Add/remove fullpage class
    if (this.isVisible) {
      this.qaInterface.classList.add('fullpage');
    } else {
      this.qaInterface.classList.remove('fullpage');
    }
    
    // Only hide the notes list, keep other elements
    const notesList = this.container.querySelector('#notesContainer');
    const emptyState = this.container.querySelector('#emptyState');
    
    if (this.searchContainer) {
      this.searchContainer.classList.toggle('hidden', this.isVisible);
    }
    
    if (notesList) {
      notesList.style.display = this.isVisible ? 'none' : 'block';
    }
    
    if (emptyState) {
      emptyState.style.display = 'none';
    }
    
    // Ensure app header remains visible - do not modify header elements
    
    // Update toggle button text
    this.modeToggle.innerHTML = this.isVisible ? 
      '<span>Search</span>' : 
      '<span>Ask</span>';
    
    // Focus appropriate input
    if (this.isVisible) {
      this.questionInput.focus();
    } else if (this.searchInput) {
      this.searchInput.focus();
    }
  }
  
  handleKeyDown(event) {
    // Submit on Enter (without Shift)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      logger.info('QA UI', 'Enter key pressed, handling ask');
      // Don't process if already processing
      if (!this.isProcessing) {
        this.handleAsk();
      }
    }
  }
  
  async handleAsk() {
    // Prevent multiple simultaneous requests
    if (this.isProcessing) {
      logger.info('QA UI', 'Already processing a question, ignoring');
      return;
    }
    
    const question = this.questionInput.value.trim();
    
    if (!question) {
      this.showError('Please enter a question');
      return;
    }
    
    try {
      // Set processing state
      this.isProcessing = true;
      
      // Show thinking indicator
      this.container.querySelector('.thinking-indicator').style.display = 'flex';
      
      // Clear previous results
      this.answerContainer.innerHTML = '';
      this.sourcesContainer.innerHTML = '';
      
      // Disable the input and button while processing
      this.questionInput.disabled = true;
      this.askButton.disabled = true;
      this.askButton.innerHTML = 'Processing...';
      
      // Log that we're about to call the service
      logger.info('QA UI', `Sending question to service: "${question}"`);
      
      // Get answer from service (with timeout)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out')), 30000)
      );
      
      const responsePromise = notesService.askQuestion(question);
      
      // Race between the actual request and the timeout
      const response = await Promise.race([responsePromise, timeoutPromise]);
      
      // Log the response
      logger.info('QA UI', 'Received response from service', response);
      
      // Hide thinking indicator
      this.container.querySelector('.thinking-indicator').style.display = 'none';
      
      // Re-enable the input and button
      this.questionInput.disabled = false;
      this.askButton.disabled = false;
      this.askButton.innerHTML = 'Ask';
      
      if (!response || response.success === false) {
        this.showError(response?.error || 'Failed to get an answer');
        return;
      }
      
      // Display answer and sources
      this.displayAnswer(response.answer);
      this.displaySources(response.sources);
      
    } catch (error) {
      // Hide thinking indicator
      this.container.querySelector('.thinking-indicator').style.display = 'none';
      
      // Re-enable the input and button
      this.questionInput.disabled = false;
      this.askButton.disabled = false;
      this.askButton.innerHTML = 'Ask';
      
      logger.error('QA UI', 'Error asking question', error);
      this.showError('An error occurred while processing your question. Check if the server is running correctly.');
    } finally {
      // Reset processing state
      this.isProcessing = false;
    }
  }
  
  displayAnswer(answer) {
    // Format answer with markdown-like syntax for better readability
    const formattedAnswer = answer
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/\n\n/g, '<br><br>') // Paragraphs
      .replace(/\n/g, '<br>'); // Line breaks
    
    this.answerContainer.innerHTML = `
      <div class="answer">
        <div class="answer-content">${formattedAnswer}</div>
        <div class="answer-actions">
          <button class="action-button copy-button" title="Copy answer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 4V16C8 17.1 8.9 18 10 18H18C19.1 18 20 17.1 20 16V7.4C20 7.1 19.9 6.9 19.7 6.7L17.3 4.3C17.1 4.1 16.9 4 16.6 4H10C8.9 4 8 4.9 8 6V6H16V9H8V4ZM16 4V6H18L16 4ZM4 8V20C4 21.1 4.9 22 6 22H14C15.1 22 16 21.1 16 20V18H14V20H6V8H4Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    // Add click handler for copy button
    const copyButton = this.answerContainer.querySelector('.copy-button');
    if (copyButton) {
      copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(answer).then(() => {
          copyButton.classList.add('copied');
          copyButton.title = 'Copied!';
          setTimeout(() => {
            copyButton.classList.remove('copied');
            copyButton.title = 'Copy answer';
          }, 2000);
        });
      });
    }
  }
  
  displaySources(sources) {
    if (!sources || sources.length === 0) {
      this.sourcesContainer.innerHTML = '';
      return;
    }
    
    let sourcesHtml = `
      <div class="sources-header">
        <span>Sources</span>
        <span class="sources-count">${sources.length}</span>
      </div>
      <div class="sources-list">
    `;
    
    sources.forEach((source, index) => {
      const snippetText = source.text.length > 150 ? 
        source.text.substring(0, 150) + '...' : 
        source.text;
      
      sourcesHtml += `
        <div class="source-item">
          <div class="source-number">[${index + 1}]</div>
          <div class="source-content">
            <div class="source-title">${source.title || 'Untitled Note'}</div>
            <div class="source-text">${snippetText}</div>
          </div>
        </div>
      `;
    });
    
    sourcesHtml += '</div>';
    this.sourcesContainer.innerHTML = sourcesHtml;
    
    // Add click handlers for expanding/collapsing sources
    const sourceItems = this.sourcesContainer.querySelectorAll('.source-item');
    sourceItems.forEach(item => {
      item.addEventListener('click', () => {
        item.classList.toggle('expanded');
      });
    });
  }
  
  showError(message) {
    this.answerContainer.innerHTML = `
      <div class="error">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
        </svg>
        <span>${message}</span>
      </div>
    `;
  }
}

export default QAInterface; 