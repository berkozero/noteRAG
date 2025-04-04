import './popup.css';
import { Auth } from '../../services/auth/auth.js';
import { logger } from '../../utils/logger.js';
import { messagingService } from '../../services/messaging/messaging.js';
import { notesService } from '../../services/notes/notes.js';
import { uiUtils } from '../../utils/ui.js';
import { storageService } from '../../services/storage/storage.js';

/**
 * Initialize the popup
 */
document.addEventListener('DOMContentLoaded', async () => {
    logger.info('Popup', 'DOM loaded, initializing popup');
    try {
        // Initialize UI utilities
        uiUtils.initDOMPurify();
        
        // Debug storage
        debugStorage();
        
        // Connect to background script
        await messagingService.connectToBackground();
        
        // Check for authentication by looking directly at storage
        // This avoids triggering OAuth errors in the console
        const userInfo = await storageService.getUserInfo();
        if (!userInfo) {
            logger.info('Popup', 'No user info found, redirecting to login');
            window.location.href = chrome.runtime.getURL('pages/Login/login.html');
            return;
        }
        
        // Setup UI event listeners
        setupEventListeners();
        
        // Load notes
        await loadNotes();
        
        // Add semantic search toggle - but don't block other functionality if it fails
        try {
            addSemanticSearchToggle();
        } catch (toggleError) {
            logger.warn('Popup', 'Failed to add semantic search toggle, continuing without it', toggleError);
            // Continue without the toggle
        }
    } catch (error) {
        logger.error('Popup', 'Error initializing popup', error);
        showError('Failed to initialize popup. Please try again.');
    }
});

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
        
        // Display notes
        displayNotes(notes);
        
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
 */
function displayNotes(notes) {
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
    
    // Sort notes by timestamp (newest first)
    const sortedNotes = [...notes].sort((a, b) => b.timestamp - a.timestamp);
    
    // Generate HTML for notes
    let notesHTML = '';
    sortedNotes.forEach(note => {
        const title = note.title || 'Untitled Note';
        const formattedDate = uiUtils.formatDate(note.timestamp);
        
        // Override the HTML structure completely to ensure consistent styling
        notesHTML += `
            <div class="note-item" style="background:#2d2d2d; border:1px solid #444; border-radius:6px; padding:12px; margin-bottom:12px; position:relative;">
                <button class="delete-note-btn" data-note-id="${note.id}" style="position:absolute; top:8px; right:8px; background:none; border:none; color:#a0a0a0; font-size:18px; cursor:pointer; z-index:10;">×</button>
                
                <div class="note-text" style="margin-bottom:8px; padding-right:24px; overflow-wrap:break-word;">
                    ${note.isHtml ? uiUtils.sanitizeHTML(note.text) : uiUtils.processContent(note.text, false)}
                </div>
                
                <div class="note-meta" style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#a0a0a0;">
                    <a href="${note.url ? uiUtils.escapeHTML(note.url) : '#'}" 
                       target="_blank" 
                       class="note-link" 
                       style="color:#4285f4; text-decoration:none; max-width:70%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${!note.url ? 'display:none;' : ''}">
                        ${uiUtils.escapeHTML(title)}
                    </a>
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
 * Add semantic search toggle to the UI
 */
function addSemanticSearchToggle() {
    // First find the search container, or create one if it doesn't exist
    let searchContainer = document.querySelector('.search-container');
    
    // If search container doesn't exist, find a good place to create it
    if (!searchContainer) {
        logger.info('Popup', 'Search container not found, creating one');
        
        // Create a search container
        searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        
        // Find the search input 
        const searchInput = document.getElementById('searchInput');
        
        if (searchInput) {
            // If we have a search input, wrap it in the container
            const parentElement = searchInput.parentElement;
            searchContainer.appendChild(searchInput.cloneNode(true));
            
            // Replace the original search input with our container
            if (parentElement) {
                parentElement.replaceChild(searchContainer, searchInput);
                
                // Reattach event listener to the new search input
                const newSearchInput = searchContainer.querySelector('#searchInput');
                if (newSearchInput) {
                    newSearchInput.addEventListener('input', uiUtils.debounce(handleSearch, 300));
                }
            } else {
                // If no parent, just insert before the notes container
                const notesContainer = document.getElementById('notesContainer');
                if (notesContainer && notesContainer.parentElement) {
                    notesContainer.parentElement.insertBefore(searchContainer, notesContainer);
                } else {
                    // Last resort - append to the body
                    const container = document.querySelector('.popup-container') || document.body;
                    container.insertBefore(searchContainer, container.firstChild);
                }
            }
        } else {
            // No search input exists, add container to the top of the popup
            const container = document.querySelector('.popup-container') || document.body;
            container.insertBefore(searchContainer, container.firstChild);
            
            // Create a search input
            const newSearchInput = document.createElement('input');
            newSearchInput.type = 'text';
            newSearchInput.id = 'searchInput';
            newSearchInput.className = 'search-input';
            newSearchInput.placeholder = 'Search notes...';
            searchContainer.appendChild(newSearchInput);
            
            // Add event listener
            newSearchInput.addEventListener('input', uiUtils.debounce(handleSearch, 300));
        }
    }
    
    // If still no search container, log error and exit
    if (!searchContainer) {
        logger.error('Popup', 'Could not create search container, semantic toggle not added');
        return;
    }
    
    // Create toggle container
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'semantic-toggle-container';
    toggleContainer.style.display = 'flex';
    toggleContainer.style.alignItems = 'center';
    toggleContainer.style.marginTop = '8px';
    toggleContainer.style.fontSize = '12px';
    
    // Create toggle switch
    const toggleSwitch = document.createElement('label');
    toggleSwitch.className = 'switch';
    toggleSwitch.style.position = 'relative';
    toggleSwitch.style.display = 'inline-block';
    toggleSwitch.style.width = '30px';
    toggleSwitch.style.height = '17px';
    toggleSwitch.style.marginRight = '8px';
    
    // Create toggle input
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.id = 'semanticToggle';
    toggleInput.style.opacity = '0';
    toggleInput.style.width = '0';
    toggleInput.style.height = '0';
    
    // Create toggle slider
    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'slider';
    toggleSlider.style.position = 'absolute';
    toggleSlider.style.cursor = 'pointer';
    toggleSlider.style.top = '0';
    toggleSlider.style.left = '0';
    toggleSlider.style.right = '0';
    toggleSlider.style.bottom = '0';
    toggleSlider.style.backgroundColor = '#ccc';
    toggleSlider.style.transition = '.4s';
    toggleSlider.style.borderRadius = '17px';
    
    // Create toggle label
    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = 'Semantic Search';
    
    // Add style for checked state
    const style = document.createElement('style');
    style.textContent = `
        #semanticToggle:checked + .slider {
            background-color: #2196F3;
        }
        
        #semanticToggle:checked + .slider:before {
            transform: translateX(13px);
        }
        
        .slider:before {
            content: "";
            position: absolute;
            height: 13px;
            width: 13px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }
    `;
    document.head.appendChild(style);
    
    // Add toggle components to container
    toggleSwitch.appendChild(toggleInput);
    toggleSwitch.appendChild(toggleSlider);
    toggleContainer.appendChild(toggleSwitch);
    toggleContainer.appendChild(toggleLabel);
    
    // Add toggle container after search input
    searchContainer.appendChild(toggleContainer);
    
    // Add event listener for toggle changes
    toggleInput.addEventListener('change', () => {
        // When toggled, perform a new search with current query
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            handleSearch({ target: searchInput });
        }
    });
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
        
        // Check if semantic search is enabled (safely)
        let useSemanticSearch = false;
        try {
            const semanticToggle = document.getElementById('semanticToggle');
            useSemanticSearch = semanticToggle && semanticToggle.checked;
            logger.info('Popup', `Search initiated: "${query}" (Semantic: ${useSemanticSearch})`);
        } catch (toggleError) {
            logger.warn('Popup', 'Could not determine semantic search status, using standard search', toggleError);
        }
        
        // Get notes based on query
        let notes;
        if (query === '') {
            notes = await notesService.getAllNotes();
        } else {
            notes = await notesService.searchNotes(query, useSemanticSearch);
        }
        
        // Display the results
        displayNotes(notes);
        
        // Update empty state message if needed
        const emptyState = document.getElementById('emptyState');
        if (emptyState && notes.length === 0 && query !== '') {
            emptyState.innerHTML = '<p>No matching notes found.</p>';
            emptyState.style.display = 'block';
        }
    } catch (error) {
        logger.error('Popup', 'Error searching notes', error);
        showError('Error searching notes. Please try again.');
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
  