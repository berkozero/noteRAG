chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "saveSelectedText",
      title: "Save selected text",
      contexts: ["selection"]
    });
  });
  
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "saveSelectedText") {
      const selectedText = info.selectionText;
      const pageUrl = info.pageUrl;
      const dateSaved = new Date().toLocaleString();
  
      const newNote = { text: selectedText, url: pageUrl, date: dateSaved };
  
      chrome.storage.local.get({ notes: [] }, (result) => {
        const notes = result.notes;
        notes.push(newNote);
        chrome.storage.local.set({ notes });
      });
    }
  });
  