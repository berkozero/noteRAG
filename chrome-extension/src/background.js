// chrome-extension/src/background.js
import { notesService } from './services/notesService';

console.log("NoteRAG Background Service Worker Started.");

// Authentication token storage key
const TOKEN_KEY = 'noterag_auth_token';
const CONTEXT_MENU_ID = 'addNoteToNoteRAG';

// Function to get the token (async)
async function getToken() {
    try {
        const result = await chrome.storage.local.get([TOKEN_KEY]);
        return result[TOKEN_KEY];
    } catch (error) {
        console.error("Error getting token from storage:", error);
        return null;
    }
}

async function setToken(token) {
    try {
        if (token) {
            await chrome.storage.local.set({ [TOKEN_KEY]: token });
            console.log("Token stored successfully.");
        } else {
            await chrome.storage.local.remove(TOKEN_KEY);
            console.log("Token removed successfully.");
        }
        updateContextMenu(); // Update menu visibility after token change
        return true;
    } catch (error) {
        console.error("Error setting token in storage:", error);
        return false;
    }
}

// Listener for messages from the popup or other extension parts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in background:", request);

    if (request.action === "getToken") {
        getToken().then(token => {
            sendResponse({ token: token });
        });
        return true; // Indicates we will send a response asynchronously
    }

    if (request.action === "setToken") {
        setToken(request.token).then(success => {
            sendResponse({ success: success });
        });
        return true; // Indicates we will send a response asynchronously
    }

    // Add handlers for API calls here later
    // e.g., if (request.action === "getNotes") { ... }

    // Default response if action not handled
    // sendResponse({ success: false, error: "Unknown action" }); 
    // return false; // Or omit return if not sending response for unhandled actions
});

// Intercept network requests to add Auth header (if needed - approach tbd)
// chrome.webRequest.onBeforeSendHeaders.addListener(...);

// --- Context Menu Management ---
async function updateContextMenu() {
    const token = await getToken();
    chrome.contextMenus.remove(CONTEXT_MENU_ID, () => {
        // Ignore error if menu didn't exist
        if (chrome.runtime.lastError) { /* console.log("No existing menu to remove.") */ }
        
        if (token) {
            chrome.contextMenus.create({
                id: CONTEXT_MENU_ID,
                title: "Add selected text to NoteRAG",
                contexts: ["selection"]
            });
            console.log("Context menu created.");
        } else {
             console.log("Context menu removed (user logged out).");
        }
    });
}

// On Install/Update: Set up initial context menu state
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed/updated. Setting up context menu.");
    updateContextMenu();
});

// On Service Worker Startup (redundant if onInstalled runs, but safe)
// updateContextMenu(); 

// Listener for Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log("Context menu listener fired! Info:", info);
    
    if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText) {
        const selectedText = info.selectionText.trim();
        const noteTitle = `Note from: ${tab.title || 'page'}`;
        console.log(`Context menu clicked. Adding text: "${selectedText.substring(0, 30)}..."`);

        const token = await getToken();
        console.log("Token retrieved INSIDE context menu handler:", token ? `Bearer ${token.substring(0,15)}...` : 'NULL_OR_UNDEFINED');
        
        if (!token) {
            console.error("Cannot add note: User not logged in (token missing).");
            chrome.notifications.create({
                type: 'basic',
                title: 'NoteRAG Error',
                message: 'Please log in to the NoteRAG extension first.'
            });
            return;
        }

        try {
            // Use notesService directly from background script, passing the freshly retrieved token
            await notesService.addNote(token, noteTitle, selectedText);
            console.log("Note added successfully via context menu.");
            chrome.notifications.create({
                type: 'basic',
                title: 'NoteRAG Success',
                message: `Note added: "${selectedText.substring(0, 50)}..."`
            });
        } catch (error) {
            // Log more specific error details
            let errorMessage = error.message || 'Unknown error';
            if (error.response && error.response.data && error.response.data.detail) {
                 // If the backend provided a specific detail message (FastAPI style)
                 errorMessage = error.response.data.detail;
            }
            console.error(`Failed to add note via context menu: ${errorMessage}`);
            console.error("Full error object:");
            console.dir(error); // Log the full error object structure
            
            chrome.notifications.create({
                type: 'basic',
                // iconUrl: 'icons/icon48.png', // Removed to fix image loading error
                title: 'NoteRAG Error',
                message: `Failed to add note. ${errorMessage}` // Ensure template literal is correctly closed
            });
        }
    }
});