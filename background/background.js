// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveNote",
    title: "Save to Smart Notes",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "saveNote") {
    try {
      // Get existing notes
      const result = await chrome.storage.local.get(['notes']);
      const notes = result.notes || [];
      
      // Create new note
      const note = {
        text: info.selectionText,
        url: tab.url,
        date: new Date().toISOString(),
        title: tab.title
      };
      
      // Add new note and save
      notes.push(note);
      await chrome.storage.local.set({ notes });
      
      // Show success badge
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      
      // Clear badge after 2 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 2000);
    } catch (error) {
      console.error('Error saving note:', error);
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
    }
  }
});
  