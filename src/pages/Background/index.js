import './Background';

console.log('[Background] Script loaded');

// Keep track of active connections
const connections = new Map();

// Listen for connection attempts from popup
chrome.runtime.onConnect.addListener((port) => {
    console.log('[Background] New connection established with', port.name);
    
    // Store the connection
    connections.set(port.name, port);
    
    port.onMessage.addListener((msg) => {
        console.log('[Background] Message received from', port.name, ':', msg);
        // Handle any messages from the popup
        handleMessage(port, msg);
    });
    
    port.onDisconnect.addListener(() => {
        console.log('[Background] Port disconnected:', port.name);
        // Clean up the stored connection
        connections.delete(port.name);
        
        if (chrome.runtime.lastError) {
            console.log('[Background] Disconnect error:', chrome.runtime.lastError);
        }
    });
    
    // Send initial connection confirmation
    try {
        port.postMessage({ type: 'CONNECTION_ESTABLISHED' });
    } catch (error) {
        console.error('[Background] Error sending confirmation:', error);
    }
});

// Handle messages from popup
function handleMessage(port, msg) {
    try {
        switch (msg.type) {
            case 'PING':
                port.postMessage({ type: 'PONG' });
                break;
            // Add other message handlers as needed
            default:
                console.log('[Background] Unknown message type:', msg.type);
        }
    } catch (error) {
        console.error('[Background] Error handling message:', error);
    }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Message received:', JSON.stringify(message, null, 2));
    console.log('[Background] Message sender:', sender);
    
    try {
        if (message.action === 'userLoggedOut') {
            console.log('[Background] User logged out, updating icon');
            const defaultIconPath = chrome.runtime.getURL('assets/icons/icon48.png');
            const loginUrl = chrome.runtime.getURL('pages/Login/login.html');
            
            // Immediately set popup to login page
            chrome.action.setPopup({ popup: loginUrl });
            
            // Clear any stored auth data
            chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                console.log('[Background] Cleared auth data from storage');
            });
            
            // Update the icon
            chrome.action.setIcon({ path: defaultIconPath }, () => {
                console.log('[Background] Icon updated successfully');
                
                // Close any existing popup connections
                if (connections.has('popup')) {
                    console.log('[Background] Closing existing popup connection');
                    const popupPort = connections.get('popup');
                    try {
                        popupPort.disconnect();
                    } catch (error) {
                        console.error('[Background] Error disconnecting popup:', error);
                    }
                    connections.delete('popup');
                }
                
                // Send response before attempting to force reload
                sendResponse({ success: true });
                
                // Try to force reload, but don't wait for response
                try {
                    chrome.runtime.sendMessage({ action: 'forceReload' }).catch(() => {
                        // Ignore any errors from this message
                        console.log('[Background] Force reload message ignored - popup likely closed');
                    });
                } catch (error) {
                    // Ignore any errors from this message
                    console.log('[Background] Force reload message failed - popup likely closed');
                }
            });
            
            return true;
        } else if (message.action === 'refreshPopup') {
            console.log('[Background] Refreshing popup');
            
            // First update the icon
            const iconPath = chrome.runtime.getURL('assets/icons/icon48.png');
            console.log('[Background] Updating icon with path:', iconPath);
            
            chrome.action.setIcon({ path: iconPath }, () => {
                console.log('[Background] Icon updated, now updating popup URL');
                
                // Then update the popup URL
                const popupUrl = chrome.runtime.getURL('pages/Popup/popup.html');
                console.log('[Background] Setting popup URL to:', popupUrl);
                
                chrome.action.setPopup({ popup: popupUrl }, () => {
                    console.log('[Background] Popup URL updated successfully');
                    
                    // Try to force a refresh of the popup if it's open
                    if (connections.has('popup')) {
                        console.log('[Background] Found active popup connection, sending refresh message');
                        const popupPort = connections.get('popup');
                        popupPort.postMessage({ type: 'FORCE_REFRESH' });
                    }
                    
                    sendResponse({ success: true });
                });
            });
        }
    } catch (error) {
        console.error('[Background] Error handling message:', error);
        sendResponse({ error: error.message });
    }
    
    return true;
}); 