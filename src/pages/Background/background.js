// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
    
    // Create context menu item
    chrome.contextMenus.create({
        id: "saveToNoteRAG",
        title: "Save to NoteRAG",
        contexts: ["selection"]
    });
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
                console.error('[Background] Error capturing selection:', chrome.runtime.lastError);
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
function saveNote(content, tab, isHtml) {
    chrome.storage.local.get(['notes'], (result) => {
        const notes = result.notes || [];
        const newNote = {
            text: content,
            title: tab.title,
            url: tab.url,
            timestamp: Date.now(),
            id: Date.now(),
            isHtml: isHtml
        };
        notes.unshift(newNote);
        chrome.storage.local.set({ notes }, () => {
            console.log('[Background] Note saved successfully');
            
            // Show success icon (green icon)
            const greenIconPath = chrome.runtime.getURL('assets/icons/icon-green.png');
            const defaultIconPath = chrome.runtime.getURL('assets/icons/icon48.png');
            
            console.log('[Background] Showing success icon for 2 seconds');
            chrome.action.setIcon({ path: greenIconPath }, () => {
                // Reset back to default icon after 2 seconds
                setTimeout(() => {
                    console.log('[Background] Reverting to default icon');
                    chrome.action.setIcon({ path: defaultIconPath });
                }, 2000); // 2 seconds
            });
        });
    });
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