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
            chrome.storage.local.set({ notes });
        });
    }
}); 