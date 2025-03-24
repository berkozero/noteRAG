import { Auth } from '../../services/auth/auth.js';

// Connect to background page to signal popup is open
const port = chrome.runtime.connect({ name: "popup" });

async function checkAuth() {
    const result = await chrome.storage.local.get(['userInfo']);
    if (!result.userInfo) {
        window.location.href = '../Login/Login.html';
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup loaded');
    
    // Get the notes container
    const notesContainer = document.getElementById('notes-container');
    
    // Add explicit logout button handling immediately
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            console.log('Logout button clicked');
            
            // Clear user authentication data
            chrome.storage.local.remove(['userInfo', 'token'], function() {
                console.log('User data cleared');
                
                // If your extension uses chrome.identity, also clear that
                if (chrome.identity && chrome.identity.clearAllCachedAuthTokens) {
                    chrome.identity.clearAllCachedAuthTokens(function() {
                        console.log('Auth tokens cleared');
                    });
                }
                
                // Simplified approach - just try to send message without waiting
                try {
                    chrome.runtime.sendMessage({action: 'userLoggedOut'});
                } catch (e) {
                    console.error('Error sending logout message:', e);
                }
                
                // Always redirect to login
                const loginUrl = chrome.runtime.getURL('pages/Login/Login.html');
                console.log('Redirecting to:', loginUrl);
                window.location.href = loginUrl;
            });
        });
        console.log('Logout event listener attached');
    } else {
        console.error('Logout button not found in the DOM');
    }
    
    // Function to load and display notes
    function loadNotes() {
        // Show loading
        notesContainer.innerHTML = '<div class="loading">Loading notes...</div>';
        
        // Get notes from storage
        chrome.storage.local.get(['notes', 'userInfo'], function(result) {
            // Handle user info if available
            const userInfo = result.userInfo;
            if (userInfo) {
                // Only display avatar if we have a picture URL
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
            } else {
                // No user info - redirect to login page
                const loginUrl = chrome.runtime.getURL('pages/Login/Login.html');
                console.log('No user info, redirecting to:', loginUrl);
                window.location.href = loginUrl;
                return;
            }
            
            // Handle notes display
            const notes = result.notes || [];
            
            // Clear the container
            notesContainer.innerHTML = '';
            
            if (notes.length === 0) {
                // Show message if no notes
                notesContainer.innerHTML = `
                    <div class="no-notes">
                        <p>No saved notes yet.</p>
                        <p>Right-click on text on any webpage and select "Save to NoteRAG".</p>
                    </div>
                `;
            } else {
                // Display each note
                notes.forEach(function(note) {
                    // Create note element
                    const noteElement = document.createElement('div');
                    noteElement.className = 'note-item';
                    
                    // Format date
                    const date = new Date(note.timestamp);
                    const formattedDate = date.toLocaleDateString() + ' ' + 
                                         date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    
                    // Create note HTML
                    noteElement.innerHTML = `
                        <div class="note-text">${escapeHTML(note.text)}</div>
                        <div class="note-meta">
                            <a href="${escapeHTML(note.url)}" target="_blank" class="note-link">${escapeHTML(note.title)}</a>
                            <span class="note-date">${formattedDate}</span>
                        </div>
                    `;
                    
                    // Add to container
                    notesContainer.appendChild(noteElement);
                });
            }
            
            // Reset the icon to default
            const defaultIconPath = chrome.runtime.getURL('assets/icons/icon48.png');
            chrome.action.setIcon({ path: defaultIconPath });
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
    
    // Load notes immediately
    loadNotes();
});

// Function to handle redirection to login
function redirectToLogin() {
    // Only redirect if we haven't already
    if (window.location.href.indexOf('Login.html') === -1) {
        const loginUrl = chrome.runtime.getURL('pages/Login/Login.html');
        console.log('Redirecting to:', loginUrl);
        window.location.href = loginUrl;
    }
}
  