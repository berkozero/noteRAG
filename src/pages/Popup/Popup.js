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
    } catch (error) {
        logger.error('Popup', 'Error initializing popup', error);
        showError('Failed to initialize popup. Please try again.');
    }
});

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
 * Load and display notes
 */
async function loadNotes() {
    const notesContainer = document.getElementById('notesContainer');
    if (!notesContainer) {
        logger.error('Popup', 'Notes container not found');
        return;
    }
    
    try {
        // Get user info and update profile
        const userInfo = await storageService.getUserInfo();
        if (userInfo) {
            updateUserProfile(userInfo);
        }
        
        const notes = await notesService.getAllNotes();
        displayNotes(notes);
    } catch (error) {
        logger.error('Popup', 'Error loading notes', error);
        notesContainer.innerHTML = '<div class="error">Error loading notes. Please try again.</div>';
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
        
        notesHTML += `
            <div class="note-item">
                <button class="delete-note-btn" data-note-id="${note.id}">×</button>
                <div class="note-text">
                    ${note.isHtml ? uiUtils.sanitizeHTML(note.text) : uiUtils.processContent(note.text, false)}
                </div>
                <div class="note-meta">
                    <a href="${note.url ? uiUtils.escapeHTML(note.url) : '#'}" 
                       target="_blank" 
                       class="note-link" 
                       ${!note.url ? 'style="display:none"' : ''}>
                        ${uiUtils.escapeHTML(title)}
                    </a>
                    <span class="note-date">${formattedDate}</span>
                </div>
            </div>
        `;
    });
    
    // Update the container
    notesContainer.innerHTML = notesHTML;
    
    // Add event listeners to delete buttons
    const deleteButtons = notesContainer.querySelectorAll('.delete-note-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const noteId = event.target.getAttribute('data-note-id');
            handleDeleteNote(noteId);
        });
    });
}

/**
 * Handle note deletion
 * @param {string|number} noteId - The ID of the note to delete
 */
async function handleDeleteNote(noteId) {
    if (!noteId) return;
    
    try {
        // Convert to number if it's stored as string
        const id = parseInt(noteId, 10);
        const success = await notesService.deleteNote(id);
        
        if (success) {
            logger.info('Popup', `Note deleted: ${id}`);
            await loadNotes();
        } else {
            logger.error('Popup', `Failed to delete note: ${id}`);
            showError('Failed to delete note. Please try again.');
        }
    } catch (error) {
        logger.error('Popup', 'Error deleting note', error);
        showError('Error deleting note. Please try again.');
    }
}

/**
 * Handle search input
 * @param {Event} event - The input event
 */
async function handleSearch(event) {
    const query = event.target.value.trim();
    
    try {
        let notes;
        if (query === '') {
            notes = await notesService.getAllNotes();
        } else {
            notes = await notesService.searchNotes(query);
        }
        
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
    const container = document.querySelector('.popup-container');
    uiUtils.showError(message, container);
}

// Global error handler
window.addEventListener('error', (event) => {
    logger.error('Popup', 'Global error', event.error);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    logger.error('Popup', 'Unhandled rejection', event.reason);
});
  