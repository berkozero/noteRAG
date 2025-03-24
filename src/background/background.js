// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveToNoteRAG",
    title: "Save to noteRAG",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "saveToNoteRAG") {
    const note = {
      id: Date.now(), // Unique ID for the note
      text: info.selectionText,
      url: tab.url,
      title: tab.title,
      timestamp: new Date().toISOString(),
      tags: [] // For future use
    };

    try {
      // Get existing notes
      const result = await chrome.storage.local.get(['notes']);
      const notes = result.notes || [];
      
      // Add new note
      notes.unshift(note); // Add to beginning of array
      
      // Save updated notes
      await chrome.storage.local.set({ notes });
      
      // Notify user
      chrome.action.setBadgeText({ text: '✓' });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 2000);
    } catch (error) {
      console.error('Error saving note:', error);
    }
  }
});
  