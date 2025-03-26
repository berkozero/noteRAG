import DOMPurify from 'dompurify';
import { logger } from './logger';

/**
 * UI utilities for common operations
 */
export const uiUtils = {
  /**
   * Initialize DOMPurify configuration for the application
   */
  initDOMPurify() {
    // Configure DOMPurify to make all links open in new tabs
    DOMPurify.addHook('afterSanitizeAttributes', function(node) {
      // If the node is a link
      if (node.tagName === 'A') {
        // Set target and rel attributes for security
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    
    logger.info('UI', 'DOMPurify initialized');
  },
  
  /**
   * Sanitize HTML content
   * @param {string} content - The HTML content to sanitize
   * @returns {string} - Sanitized HTML
   */
  sanitizeHTML(content) {
    return DOMPurify.sanitize(content, { 
      ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'span', 'div', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      ALLOWED_ATTR: ['href', 'style', 'class', 'target', 'rel']
    });
  },
  
  /**
   * Process text content for display
   * @param {string} text - The text to process
   * @param {boolean} isHtml - Whether the text is HTML
   * @returns {string} - Processed content ready for display
   */
  processContent(text, isHtml) {
    if (!text) return '';
    
    if (isHtml) {
      return this.sanitizeHTML(text);
    } else {
      // For plain text, preserve newlines by converting to <br> tags
      return text
        .replace(/\n/g, '<br>')
        .split('<br>')
        .map(line => line.trim() ? line : '&nbsp;')
        .join('<br>');
    }
  },
  
  /**
   * Count approximate lines in content
   * @param {string} content - The content to analyze
   * @param {boolean} isHtml - Whether the content is HTML
   * @returns {number} - Estimated line count
   */
  countLines(content, isHtml) {
    if (!content) return 0;
    
    let lineCount = 0;
    
    if (isHtml) {
      // For HTML content, count <br>, <p>, <li> and other block elements
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = DOMPurify.sanitize(content);
      // Count line breaks
      lineCount += (content.match(/<br\s*\/?>/gi) || []).length;
      // Count paragraphs
      lineCount += tempDiv.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, div').length;
      // If no structure elements found, do a character-based estimate
      if (lineCount === 0) {
        lineCount = Math.ceil(content.length / 80); // Rough estimate: 80 chars per line
      }
    } else {
      // For plain text, count newlines
      lineCount = (content.match(/\n/g) || []).length + 1;
      // If very few newlines but lots of text, estimate based on characters
      if (lineCount < 3 && content.length > 240) {
        lineCount = Math.ceil(content.length / 80); // Rough estimate: 80 chars per line
      }
    }
    
    return lineCount;
  },
  
  /**
   * Escape HTML special characters
   * @param {string} str - The string to escape
   * @returns {string} - Escaped string
   */
  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
  
  /**
   * Create a debounced function
   * @param {Function} func - The function to debounce
   * @param {number} wait - The debounce wait time in ms
   * @returns {Function} - The debounced function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  /**
   * Show an error message in the UI
   * @param {string} message - The error message
   * @param {HTMLElement} container - The container to append the error to
   */
  showError(message, container) {
    if (!container) {
      logger.error('UI', 'Cannot show error: container not found');
      return;
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    container.appendChild(errorDiv);
  },
  
  /**
   * Format a date for display
   * @param {number} timestamp - The timestamp to format
   * @returns {string} - Formatted date string
   */
  formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + 
           date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }
}; 