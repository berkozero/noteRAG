import './popup.css';
import '../../components/QAInterface.css';
import { Auth } from '../../services/auth/auth.js';
import { logger } from '../../utils/logger.js';
import { messagingService } from '../../services/messaging/messaging.js';
import { notesService } from '../../services/notes/notes.js';
import { uiUtils } from '../../utils/ui.js';
import { storageService } from '../../services/storage/storage.js';
import QAInterface from '../../components/QAInterface.js';

// State variables
let isLoading = false;
let userInfo = null;
let qaInterface = null;

/**
 * Initialize the popup
 */
document.addEventListener('DOMContentLoaded', async () => {
    logger.info('Popup', 'Initializing popup');
    
    try {
        // Load user profile and notes first
        await loadUserProfile();
        await loadNotes();
        
        // Basic UI setup
        setupEventListeners();
        
        // Initialize QA Interface - this needs to be after the notes are loaded
        initQAInterface();
        
        // Focus search input if present
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.focus();
        }
        
        // Add debug button if in development mode
        if (process.env.NODE_ENV === 'development') {
            const debugBtn = document.createElement('button');
            debugBtn.className = 'debug-button';
            debugBtn.innerText = 'Debug';
            debugBtn.onclick = debugStorage;
            document.querySelector('.app').appendChild(debugBtn);
        }
    } catch (error) {
        logger.error('Popup', 'Error initializing popup:', error);
        showError('Failed to initialize. Please try again.');
    }
});

/**
 * Initialize the QA Interface component
 */
function initQAInterface() {
    try {
        const container = document.querySelector('.app');
        if (container) {
            qaInterface = new QAInterface(container);
            logger.info('Popup', 'QA Interface initialized');
        } else {
            logger.warn('Popup', 'Could not find app container for QA Interface');
        }
    } catch (error) {
        logger.error('Popup', 'Error initializing QA Interface', error);
    }
}

/**
 * Debug Storage - directly examine Chrome storage for notes
 */
function debugStorage() {
    // Direct check of Chrome storage for notes
    chrome.storage.local.get(['notes'], (result) => {
        const notes = result.notes || [];
        logger.info('Popup', `DIRECT CHECK: Found ${notes.length} notes in Chrome storage`);
        
        // Log details of each note
        if (notes.length > 0) {
            notes.forEach((note, index) => {
                logger.info('Popup', `NOTE ${index}: id=${note.id}, title=${note.title}, timestamp=${note.timestamp}`);
            });
        } else {
            logger.warn('Popup', 'No notes found in Chrome storage');
        }
    });
}

/**
 * Setup event listeners for UI elements
 */
function setupEventListeners() {
    // Logout button
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', uiUtils.debounce(handleSearch, 300));
    }
    
    // Handle visibility changes for cleanup
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            logger.info('Popup', 'Popup closing, cleaning up');
            if (messagingService.disconnect) {
                messagingService.disconnect();
            } else {
                logger.warn('Popup', 'messagingService.disconnect is not available');
            }
        }
    });
}

/**
 * Load notes from storage and display them in the UI
 */
async function loadNotes() {
    logger.info('Popup', 'Loading notes');
    try {
        // Check direct chrome storage first
        chrome.storage.local.get(['notes'], (result) => {
            const chromeNotes = result.notes || [];
            logger.info('Popup', `DIRECT: Found ${chromeNotes.length} notes in Chrome storage`);
        });
        
        // Now use our service
        const notes = await notesService.getAllNotes();
        logger.info('Popup', `Loaded ${notes.length} notes from storage service`);
        
        // Display notes without scores since this is not a search
        displayNotes(notes, false);
        
        // If no notes, show empty state
        const emptyState = document.getElementById('emptyState');
        if (emptyState && (!notes || notes.length === 0)) {
            emptyState.innerHTML = '<p>No notes yet. Select text on any webpage and use the context menu to save notes.</p>';
            emptyState.style.display = 'block';
        } else if (emptyState) {
            emptyState.style.display = 'none';
        }
    } catch (error) {
        logger.error('Popup', 'Error loading notes', error);
        showError('Failed to load notes. Please try again.');
    }
}

/**
 * Load user profile from Auth service
 * @returns {Promise<void>}
 */
async function loadUserProfile() {
  try {
    logger.info('Popup', 'Loading user profile');
    
    // First try to get user info from storage
    userInfo = await storageService.getUserInfo();
    
    // If no user info in storage, try to get a fresh copy from Google
    if (!userInfo) {
      logger.info('Popup', 'No user info in storage, checking auth status');
      const isAuthenticated = await Auth.isAuthenticated();
      
      if (isAuthenticated) {
        logger.info('Popup', 'User is authenticated, fetching profile from Google');
        const auth = new Auth();
        const token = await auth.getAuthToken(false);
        
        if (token) {
          userInfo = await auth.getUserInfo(token);
          await storageService.saveUserInfo(userInfo);
        }
      }
    }
    
    // If we still don't have user info, use defaults
    if (!userInfo) {
      logger.warn('Popup', 'Could not get user profile, using default');
      userInfo = {
        name: 'User',
        email: '',
        picture: ''
      };
    }
    
    updateUserProfile(userInfo);
    logger.info('Popup', 'User profile loaded successfully');
  } catch (error) {
    logger.warn('Popup', 'Failed to load user profile', error);
    // Continue without user profile, just use a default
    updateUserProfile({
      name: 'User',
      email: '',
      picture: ''
    });
  }
}

/**
 * Update user profile in the UI
 * @param {Object} userInfo - The user information
 */
function updateUserProfile(userInfo) {
    logger.info('Popup', 'Updating user profile', userInfo);
    
    // Use the existing user elements from popup.html
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar && userInfo.picture) {
        userAvatar.src = userInfo.picture;
        userAvatar.style.display = 'block';
    }
    
    const userName = document.getElementById('userName');
    if (userName) {
        userName.textContent = userInfo.name || 'User';
    }
    
    const userEmail = document.getElementById('userEmail');
    if (userEmail) {
        userEmail.textContent = userInfo.email || '';
    }
}

/**
 * Display notes in the UI
 * @param {Array} notes - The notes to display
 * @param {boolean} isSearchResults - Whether these are search results
 */
function displayNotes(notes, isSearchResults = false) {
    const notesContainer = document.getElementById('notesContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (!notesContainer) return;
    
    if (!notes || notes.length === 0) {
        // Show empty state
        notesContainer.innerHTML = '';
        if (emptyState) {
            emptyState.innerHTML = '<p>No notes yet. Select text on any webpage and use the context menu to save notes.</p>';
            emptyState.style.display = 'block';
        }
        return;
    }
    
    // Hide empty state if we have notes
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    // Sort notes - by relevance if search results, otherwise by timestamp
    let sortedNotes;
    if (isSearchResults) {
        // Get score value (from either similarity or score property)
        const getScoreValue = (note) => {
            return note.similarity !== undefined ? note.similarity : 
                   (note.score !== undefined ? note.score : 0);
        };
        
        // Sort by relevance score (highest first)
        sortedNotes = [...notes].sort((a, b) => getScoreValue(b) - getScoreValue(a));
    } else {
        // Sort by timestamp (newest first)
        sortedNotes = [...notes].sort((a, b) => b.timestamp - a.timestamp);
    }
    
    // Generate HTML for notes
    let notesHTML = '';
    sortedNotes.forEach(note => {
        const title = note.title || 'Untitled Note';
        const formattedDate = uiUtils.formatDate(note.timestamp);
        
        // Check if note has a similarity score (from search)
        const hasScore = isSearchResults && (note.similarity !== undefined || note.score !== undefined);
        const scoreValue = note.similarity !== undefined ? note.similarity : (note.score !== undefined ? note.score : null);
        const scoreHtml = hasScore ? 
            `<span class="relevance-score" style="margin-left:8px; background:#333; color:#4285f4; padding:2px 6px; border-radius:4px; font-size:11px;">
                ${Math.round(scoreValue * 100)}% match
            </span>` 
            : '';
        
        // Override the HTML structure completely to ensure consistent styling
        notesHTML += `
            <div class="note-item" style="background:#2d2d2d; border:1px solid #444; border-radius:6px; padding:12px; margin-bottom:12px; position:relative;">
                <button class="delete-note-btn" data-note-id="${note.id}" style="position:absolute; top:8px; right:8px; background:none; border:none; color:#a0a0a0; font-size:18px; cursor:pointer; z-index:10;">×</button>
                
                <div class="note-text" style="margin-bottom:8px; padding-right:24px; overflow-wrap:break-word;">
                    ${note.isHtml ? uiUtils.sanitizeHTML(note.text) : uiUtils.processContent(note.text, false)}
                </div>
                
                <div class="note-meta" style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#a0a0a0;">
                    <div style="display:flex; align-items:center; overflow:hidden;">
                        <a href="${note.url ? uiUtils.escapeHTML(note.url) : '#'}" 
                           target="_blank" 
                           class="note-link" 
                           style="color:#4285f4; text-decoration:none; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${!note.url ? 'display:none;' : ''}">
                            ${uiUtils.escapeHTML(title)}
                        </a>
                        ${scoreHtml}
                    </div>
                    <span class="note-date">${formattedDate}</span>
                </div>
            </div>
        `;
    });
    
    // Update the container
    notesContainer.innerHTML = notesHTML;
    
    // Debug the delete buttons to ensure they exist
    const deleteButtons = notesContainer.querySelectorAll('.delete-note-btn');
    logger.info('Popup', `Added listeners to ${deleteButtons.length} delete buttons`);
    
    // Add event listeners to delete buttons - using capture phase to ensure the event fires
    deleteButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            const noteId = this.getAttribute('data-note-id');
            logger.info('Popup', `Delete button clicked for note: ${noteId}`);
            
            if (noteId) {
                // Provide visual feedback that the delete was clicked
                this.style.color = '#ff4444';
            handleDeleteNote(noteId);
            } else {
                logger.error('Popup', 'Delete button clicked but no note ID found');
            }
        }, true);
    });
}

/**
 * Handle note deletion
 * @param {string} noteId - The ID of the note to delete
 */
async function handleDeleteNote(noteId) {
    if (!noteId) {
        logger.warn('Popup', 'No note ID provided for deletion');
        return;
    }
    
    try {
        logger.info('Popup', `Attempting to delete note: ${noteId}`);
        const success = await notesService.deleteNote(noteId);
        
        if (success) {
            logger.info('Popup', `Note deleted successfully: ${noteId}`);
            await loadNotes();
        } else {
            logger.error('Popup', `Failed to delete note: ${noteId}`);
            showError('Failed to delete note. Please try again.');
        }
    } catch (error) {
        logger.error('Popup', `Error deleting note ${noteId}:`, error);
        showError('Error deleting note. Please try again.');
    }
}

/**
 * Handle search
 */
async function handleSearch(event) {
    // Ensure we have a valid event and target
    if (!event || !event.target) {
        logger.warn('Popup', 'Invalid search event');
        return;
    }
    
    const query = event.target.value.trim();
    const notesContainer = document.getElementById('notesContainer');
    
    if (!notesContainer) {
        logger.warn('Popup', 'Notes container not found');
        return;
    }
    
    try {
        // Show loading state 
        const loadingHtml = '<div class="loading" style="text-align: center; padding: 20px; color: #666;">Searching...</div>';
        notesContainer.innerHTML = loadingHtml;
        
        // Add slight delay to ensure UI updates before potentially long search
        await new Promise(resolve => setTimeout(resolve, 10));
        
        logger.info('Popup', `Search initiated: "${query}"`);
        
        // Get notes based on query
        let notes;
        if (query === '') {
            notes = await notesService.getAllNotes();
            // Display the results without scores since this is not a search
            displayNotes(notes, false);
        } else {
            notes = await notesService.searchNotes(query, { includeScores: true });
            // Display the results with scores since this is a search
            displayNotes(notes, true);
        }
        
        // Update UI elements
        const countElement = document.getElementById('noteCount');
        if (countElement) {
            countElement.textContent = `${notes.length} note${notes.length === 1 ? '' : 's'}`;
        }
    } catch (error) {
        logger.error('Popup', 'Error during search:', error);
        notesContainer.innerHTML = '<div class="error">Search failed. Please try again.</div>';
    }
}

/**
 * Handle logout
 */
async function handleLogout() {
    logger.info('Popup', 'Logout requested');
    try {
        await Auth.logout();
    } catch (error) {
        logger.error('Popup', 'Error during logout', error);
        showError('Logout failed. Please try again.');
    }
}

/**
 * Show error in the UI
 * @param {string} message - The error message
 */
function showError(message) {
    let container = document.querySelector('.popup-container');
    
    // If container doesn't exist, try to find or create a suitable container
    if (!container) {
        container = document.body; // Fall back to body if popup-container doesn't exist
        
        // Create a popup container if body doesn't exist (shouldn't happen but just in case)
        if (!container) {
            logger.error('Popup', 'No container found to show error');
            console.error('Error:', message); // At least log to console
            return;
        }
    }
    
    // Create error element if uiUtils.showError is not available
    try {
    uiUtils.showError(message, container);
    } catch (err) {
        logger.error('Popup', 'Error using uiUtils.showError', err);
        
        // Manual fallback for showing errors
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        errorElement.style.backgroundColor = '#ffebee';
        errorElement.style.color = '#c62828';
        errorElement.style.padding = '10px';
        errorElement.style.margin = '10px 0';
        errorElement.style.borderRadius = '4px';
        errorElement.style.fontWeight = 'bold';
        
        // Add close button
        const closeButton = document.createElement('span');
        closeButton.textContent = '×';
        closeButton.style.float = 'right';
        closeButton.style.cursor = 'pointer';
        closeButton.style.marginLeft = '10px';
        closeButton.onclick = () => {
            container.removeChild(errorElement);
        };
        
        errorElement.prepend(closeButton);
        container.prepend(errorElement);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorElement.parentNode) {
                errorElement.parentNode.removeChild(errorElement);
            }
        }, 5000);
    }
}

// Global error handler
window.addEventListener('error', (event) => {
    logger.error('Popup', 'Global error', event.error);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    logger.error('Popup', 'Unhandled rejection', event.reason);
});
  