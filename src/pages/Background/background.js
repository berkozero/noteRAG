// Create context menu when extension is installed
import { logger } from '../../utils/logger';
import { notesService } from '../../services/notes/notes';

chrome.runtime.onInstalled.addListener((details) => {
    logger.info('Background', 'Extension installed', details.reason);
    
    // Create context menu item
    chrome.contextMenus.create({
        id: "saveToNoteRAG",
        title: "Save to NoteRAG",
        contexts: ["selection"]
    });
    
    // Add sample notes on first install
    if (details.reason === 'install') {
        logger.info('Background', 'First install, creating welcome notes');
        createWelcomeNotes();
    }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "saveToNoteRAG") {
        // Execute script to get the selected HTML content
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: captureSelection
        }, (results) => {
            if (chrome.runtime.lastError) {
                logger.error('Background', 'Error capturing selection', chrome.runtime.lastError);
                // Fallback to plain text if there's an error
                saveNote(info.selectionText, tab, false);
                return;
            }
            
            const result = results && results[0];
            if (result && result.result) {
                saveNote(result.result, tab, true);
            } else {
                // Fallback to plain text if script execution failed
                saveNote(info.selectionText, tab, false);
            }
        });
    }
});

// Function to save the note to storage
async function saveNote(content, tab, isHtml) {
    try {
        logger.info('Background', 'Saving new note from selection');
        
        // Use the notesService to save the note (which uses the unified storage system)
        const success = await notesService.createNote(content, tab, isHtml);
        
        if (success) {
            logger.info('Background', 'Note saved successfully');
            await notesService.showSuccessIcon();
        } else {
            logger.error('Background', 'Failed to save note');
        }
    } catch (error) {
        logger.error('Background', 'Error saving note', error);
    }
}

// Function to capture selected HTML content
function captureSelection() {
    try {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }
        
        const range = selection.getRangeAt(0);
        const fragment = range.cloneContents();
        
        // Create a temporary container
        const div = document.createElement('div');
        div.appendChild(fragment);
        
        // Return the HTML content
        return div.innerHTML;
    } catch (error) {
        console.error('Error capturing selection:', error);
        return null;
    }
}

/**
 * Create welcome notes for first-time users
 */
async function createWelcomeNotes() {
    try {
        // Import noteTests for creating test notes
        const { noteTests } = await import('../../services/notes/test-notes');
        
        // Create 3 test notes with different content
        logger.info('Background', 'Creating 3 sample notes');
        
        // Add a slight delay between notes to ensure different timestamps
        await noteTests.createTestNote();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await noteTests.createTestNote();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await noteTests.createTestNote();
        
        logger.info('Background', 'Welcome notes created successfully');
    } catch (error) {
        logger.error('Background', 'Error creating welcome notes', error);
    }
} 