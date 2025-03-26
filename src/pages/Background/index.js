import './Background';
import { logger } from '../../utils/logger';
import { messagingService } from '../../services/messaging/messaging';
import { notesService } from '../../services/notes/notes';
import { storageService } from '../../services/storage/storage';

// Initialize background script
function initBackgroundScript() {
  logger.info('Background', 'Script loaded');
  
  // Initialize messaging service
  messagingService.initBackground();
  
  // Register message handlers
  registerMessageHandlers();
  
  // Register context menu handlers
  setupContextMenu();
}

// Register message handlers
function registerMessageHandlers() {
  // Handler for the user logout message
  messagingService.registerHandler('background', 'userLoggedOut', async (message, sender, sendResponse) => {
    logger.info('Background', 'User logged out, updating icon');
    
    // Get file paths
    const defaultIconPath = chrome.runtime.getURL('assets/icons/icon48.png');
    const loginUrl = chrome.runtime.getURL('pages/Login/login.html');
    
    // Update popup to login page
    await chrome.action.setPopup({ popup: loginUrl });
    
    // Clear auth data
    await storageService.clearAuthData();
    logger.info('Background', 'Cleared auth data from storage');
    
    // Update icon and clean up
    await chrome.action.setIcon({ path: defaultIconPath });
    logger.info('Background', 'Icon updated successfully');
    
    // Close any existing connections
    disconnectPopup();
    
    // Send response
    sendResponse({ success: true });
    
    // Try to notify any open popups
    try {
      chrome.runtime.sendMessage({ action: 'forceReload' }).catch(() => {
        logger.info('Background', 'Force reload message ignored - popup likely closed');
      });
    } catch (error) {
      logger.info('Background', 'Force reload message failed - popup likely closed');
    }
  });
  
  // Handler for refreshing the popup after login
  messagingService.registerHandler('background', 'refreshPopup', async (message, sender, sendResponse) => {
    logger.info('Background', 'Refreshing popup');
    
    // Update icon
    const iconPath = chrome.runtime.getURL('assets/icons/icon48.png');
    logger.info('Background', 'Updating icon with path:', iconPath);
    
    await chrome.action.setIcon({ path: iconPath });
    logger.info('Background', 'Icon updated, now updating popup URL');
    
    // Update popup URL
    const popupUrl = chrome.runtime.getURL('pages/Popup/popup.html');
    logger.info('Background', 'Setting popup URL to:', popupUrl);
    
    await chrome.action.setPopup({ popup: popupUrl });
    logger.info('Background', 'Popup URL updated successfully');
    
    // Notify any active connections
    if (messagingService.connections.has('popup')) {
      logger.info('Background', 'Found active popup connection, sending refresh message');
      const popupPort = messagingService.connections.get('popup');
      messagingService.sendToPort(popupPort, { type: 'FORCE_REFRESH' });
    }
    
    sendResponse({ success: true });
  });
}

// Setup context menu for note capturing
function setupContextMenu() {
  // We'll only create the context menu during installation or update
  chrome.runtime.onInstalled.addListener((details) => {
    logger.info('Background', `Extension ${details.reason}`, details);
    
    // Clear any existing menus and create our menu
    chrome.contextMenus.removeAll(() => {
      try {
        chrome.contextMenus.create({
          id: "saveToNoteRAG",
          title: "Save to NoteRAG",
          contexts: ["selection"]
        }, () => {
          if (chrome.runtime.lastError) {
            logger.error('Background', 'Error creating context menu', chrome.runtime.lastError);
          } else {
            logger.info('Background', 'Context menu created successfully');
          }
        });
      } catch (error) {
        logger.error('Background', 'Exception creating context menu', error);
      }
    });
  });
  
  // Handle context menu clicks
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "saveToNoteRAG") {
      handleNoteSave(info, tab);
    }
  });
}

// Handle saving a note from context menu
async function handleNoteSave(info, tab) {
  // Execute script to get the selected HTML content
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Capture the selected HTML content directly
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
      }
    });
    
    const result = results && results[0];
    if (result && result.result) {
      await saveNote(result.result, tab, true);
    } else {
      // Fallback to plain text
      await saveNote(info.selectionText, tab, false);
    }
  } catch (error) {
    logger.error('Background', 'Error capturing selection:', error);
    // Fallback to plain text
    await saveNote(info.selectionText, tab, false);
  }
}

// Save note and show success icon
async function saveNote(content, tab, isHtml) {
  const success = await notesService.createNote(content, tab, isHtml);
  
  if (success) {
    await notesService.showSuccessIcon();
  }
}

// Disconnect popup connection
function disconnectPopup() {
  if (messagingService.connections.has('popup')) {
    logger.info('Background', 'Closing existing popup connection');
    const popupPort = messagingService.connections.get('popup');
    try {
      popupPort.disconnect();
    } catch (error) {
      logger.error('Background', 'Error disconnecting popup:', error);
    }
    messagingService.connections.delete('popup');
  }
}

// Initialize the background script
initBackgroundScript(); 