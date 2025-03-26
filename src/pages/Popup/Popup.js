import './popup.css';
import { Auth } from '../../services/auth/auth.js';
import DOMPurify from 'dompurify';

// Connection handling
let port = null;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

function setupConnection() {
    if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('[Popup] Max reconnection attempts reached');
        return;
    }

    try {
        console.log('[Popup] Attempting to connect to background script...');
        port = chrome.runtime.connect({ name: "popup" });
        
        port.onDisconnect.addListener(() => {
            const error = chrome.runtime.lastError;
            console.log('[Popup] Disconnected from background script', error ? `Error: ${error.message}` : '');
            
            // Only attempt reconnect if this wasn't a normal popup close
            if (document.visibilityState !== 'hidden') {
                connectionAttempts++;
                setTimeout(setupConnection, 1000);
            }
        });
        
        // Setup message handling
        port.onMessage.addListener((msg) => {
            console.log('[Popup] Message received:', msg);
        });
        
        console.log('[Popup] Connection established successfully');
        connectionAttempts = 0; // Reset counter on successful connection
    } catch (error) {
        console.error('[Popup] Connection error:', error);
        connectionAttempts++;
    }
}

// Handle visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        // Popup is closing, clean up connection
        if (port) {
            try {
                port.disconnect();
            } catch (e) {
                console.log('[Popup] Error during disconnect:', e);
            }
        }
    }
});

// Initialize connection when popup loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Popup] DOM loaded, setting up connection...');
    setupConnection();
    
    // Rest of your initialization code...
    try {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) return;
        
        const notesContainer = document.getElementById('notesContainer');
        if (!notesContainer) {
            console.error('Notes container not found');
            return;
        }
        
        await loadNotes();
        
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }
        
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(handleSearch, 300));
        }
    } catch (error) {
        console.error('Error initializing popup:', error);
    }
});

async function checkAuth() {
    try {
        // First check if we have user info in storage
        const result = await chrome.storage.local.get(['userInfo']);
        
        if (result.userInfo) {
            return true;
        }

        // If no user info, try to get a token silently (non-interactive)
        try {
            const token = await new Promise((resolve, reject) => {
                chrome.identity.getAuthToken({ interactive: false }, (token) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(token);
                    }
                });
            });

            if (token) {
                // We have a valid token, get user info
                const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const userInfo = await response.json();
                await chrome.storage.local.set({ userInfo });
                return true;
            }
        } catch (error) {
            console.log('Silent token refresh failed:', error);
        }

        // No valid token or user info, redirect to login
        window.location.href = '../Login/Login.html';
        return false;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '../Login/Login.html';
        return false;
    }
}

// Add search functionality
async function handleSearch(event) {
    const query = event.target.value.trim();
    const notesContainer = document.getElementById('notesContainer');
    
    if (!notesContainer) return;
    
    try {
        // Get all notes from storage
        const result = await chrome.storage.local.get(['notes']);
        const notes = result.notes || [];
        
        if (query === '') {
            // If search is empty, show all notes
            displayNotes(notes);
            return;
        }
        
        // Filter notes based on search query
        const filteredNotes = notes.filter(note => {
            const searchableText = `${note.title} ${note.text}`.toLowerCase();
            return searchableText.includes(query.toLowerCase());
        });
        
        // Display filtered notes
        displayNotes(filteredNotes);
        
        // Update empty state message
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            if (filteredNotes.length === 0) {
                emptyState.innerHTML = '<p>No matching notes found.</p>';
                emptyState.style.display = 'block';
            } else {
                emptyState.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error searching notes:', error);
        notesContainer.innerHTML = '<div class="error">Error searching notes. Please try again.</div>';
    }
}

// Add debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Separate the logout handler for cleaner code
async function handleLogout() {
    console.log('Logout button clicked');
    
    try {
        // Clear user authentication data
        await chrome.storage.local.remove(['userInfo', 'token']);
        console.log('User data cleared');
        
        // Clear auth tokens if available
        if (chrome.identity && chrome.identity.clearAllCachedAuthTokens) {
            await new Promise(resolve => chrome.identity.clearAllCachedAuthTokens(resolve));
            console.log('Auth tokens cleared');
        }
        
        // Try to send logout message
        try {
            await chrome.runtime.sendMessage({action: 'userLoggedOut'});
        } catch (e) {
            console.error('Error sending logout message:', e);
        }
        
        // Redirect to login
        const loginUrl = chrome.runtime.getURL('pages/Login/Login.html');
        console.log('Redirecting to:', loginUrl);
        window.location.href = loginUrl;
    } catch (error) {
        console.error('Error during logout:', error);
    }
}

// Function to delete a note
function deleteNote(noteId) {
    if (!noteId) return;
    
    // Convert to number if it's stored as string
    const id = parseInt(noteId, 10);
    
    chrome.storage.local.get(['notes'], function(result) {
        let notes = result.notes || [];
        
        // Find the note index
        const noteIndex = notes.findIndex(note => note.id === id);
        
        if (noteIndex !== -1) {
            // Remove the note
            notes.splice(noteIndex, 1);
            
            // Save updated notes
            chrome.storage.local.set({ notes }, function() {
                console.log('Note deleted:', id);
                
                // Refresh the notes display
                loadNotes();
            });
        }
    });
}

// Function to load and display notes
async function loadNotes() {
    const notesContainer = document.getElementById('notesContainer');
    if (!notesContainer) return;

    // Show loading
    notesContainer.innerHTML = '<div class="loading">Loading notes...</div>';
    
    try {
        // Get notes from storage
        const result = await chrome.storage.local.get(['notes', 'userInfo']);
        
        // Handle user info if available
        const userInfo = result.userInfo;
        if (!userInfo) {
            window.location.href = '../Login/Login.html';
            return;
        }

        // Update user profile
        updateUserProfile(userInfo);
        
        // Handle notes display
        const notes = result.notes || [];
        displayNotes(notes);
        
    } catch (error) {
        console.error('Error loading notes:', error);
        notesContainer.innerHTML = '<div class="error-message">Error loading notes. Please try again.</div>';
    }
}

// Function to update user profile
function updateUserProfile(userInfo) {
    const avatarElement = document.getElementById('userAvatar');
    if (avatarElement && userInfo.picture) {
        avatarElement.src = userInfo.picture;
        avatarElement.style.display = 'block';
    }
    
    const nameElement = document.getElementById('userName');
    if (nameElement) {
        nameElement.textContent = userInfo.name || 'User';
    }
    
    const emailElement = document.getElementById('userEmail');
    if (emailElement) {
        emailElement.textContent = userInfo.email || '';
    }
}

// Function to display notes
function displayNotes(notes) {
    const notesContainer = document.getElementById('notesContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (!notes.length) {
        notesContainer.innerHTML = '';
        if (emptyState) {
            emptyState.style.display = 'block';
        }
        return;
    }
    
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    notesContainer.innerHTML = notes.map(note => {
        const date = new Date(note.timestamp);
        const formattedDate = date.toLocaleDateString() + ' ' + 
                             date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Process note content based on type
        let noteContent;
        if (note.isHtml) {
            // Sanitize HTML using DOMPurify
            noteContent = DOMPurify.sanitize(note.text, { 
                ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'span', 'div', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
                ALLOWED_ATTR: ['href', 'style', 'class']
            });
        } else {
            // For plain text, preserve newlines by converting to <br> tags
            noteContent = (note.content || note.text || '')
                .replace(/\n/g, '<br>')
                .split('<br>')
                .map(line => line.trim() ? line : '&nbsp;')
                .join('<br>');
        }
        
        return `
            <div class="note-item">
                <button class="delete-note-btn" data-note-id="${note.id}">×</button>
                <div class="note-header">
                    <div class="note-text">${noteContent}</div>
                </div>
                <div class="note-meta">
                    <a href="${escapeHTML(note.url)}" target="_blank" class="note-link">${escapeHTML(note.title)}</a>
                    <span class="note-date">${formattedDate}</span>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers for delete buttons
    notesContainer.querySelectorAll('.delete-note-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const noteId = btn.getAttribute('data-note-id');
            if (noteId) deleteNote(noteId);
        });
    });
}

// Helper function to escape HTML
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Function to handle redirection to login
function redirectToLogin() {
    // Only redirect if we haven't already
    if (window.location.href.indexOf('Login.html') === -1) {
        const loginUrl = chrome.runtime.getURL('pages/Login/Login.html');
        console.log('Redirecting to:', loginUrl);
        window.location.href = loginUrl;
    }
}
  