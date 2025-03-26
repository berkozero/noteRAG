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
        chrome.storage.local.get(['notes'], (result) => {
            const notes = result.notes || [];
            const newNote = {
                text: info.selectionText,
                title: tab.title,
                url: tab.url,
                timestamp: Date.now(),
                id: Date.now()
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
}); 