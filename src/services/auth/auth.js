export class Auth {
    constructor() {
        console.log('[Auth] Initializing Auth class');
    }

    async login() {
        console.log('[Auth] Starting login process');
        try {
            console.log('[Auth] Requesting auth token...');
            const token = await this.getAuthToken(true);
            
            if (!token) {
                console.log('[Auth] Login cancelled by user');
                return;
            }
            
            console.log('[Auth] Token received successfully');
            
            console.log('[Auth] Getting user info...');
            const userInfo = await this.getUserInfo(token);
            console.log('[Auth] User info received:', JSON.stringify(userInfo, null, 2));
            
            console.log('[Auth] Saving user info to storage...');
            await this.saveUserInfo(userInfo);
            console.log('[Auth] User info saved successfully');
            
            // Send refresh message and wait for response
            console.log('[Auth] Sending refresh message to background script...');
            try {
                await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({ action: 'refreshPopup' }, (response) => {
                        console.log('[Auth] Refresh message response:', response);
                        if (response && response.success) {
                            resolve();
                        } else {
                            reject(new Error('Failed to refresh popup'));
                        }
                    });
                });
                
                // Instead of closing, redirect to popup page
                console.log('[Auth] Redirecting to popup...');
                const popupUrl = chrome.runtime.getURL('pages/Popup/popup.html');
                window.location.href = popupUrl;
            } catch (error) {
                console.error('[Auth] Error during refresh:', error);
                // If refresh fails, still try to redirect
                const popupUrl = chrome.runtime.getURL('pages/Popup/popup.html');
                window.location.href = popupUrl;
            }
        } catch (error) {
            console.error('[Auth] Login failed:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = `Login failed: ${error.message}`;
            const container = document.querySelector('.login-container');
            if (container) {
                container.appendChild(errorDiv);
            } else {
                console.error('[Auth] Could not find login-container to show error');
            }
        }
    }

    async getAuthToken(interactive = false) {
        return new Promise((resolve, reject) => {
            console.log('[Auth] Getting auth token, interactive:', interactive);
            const manifest = chrome.runtime.getManifest();
            console.log('[Auth] OAuth2 config:', JSON.stringify(manifest.oauth2, null, 2));
            
            chrome.identity.getAuthToken({ 
                interactive: interactive
            }, (token) => {
                if (chrome.runtime.lastError) {
                    const error = chrome.runtime.lastError;
                    console.error('[Auth] getAuthToken error:', error);
                    if (error.message.includes('canceled')) {
                        console.log('[Auth] User cancelled the login');
                        resolve(null);
                    } else {
                        reject(error);
                    }
                } else {
                    console.log('[Auth] Token obtained successfully');
                    resolve(token);
                }
            });
        });
    }

    async getUserInfo(token) {
        console.log('[Auth] Fetching user info from Google...');
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const userInfo = await response.json();
            console.log('[Auth] User info fetched successfully');
            return userInfo;
        } catch (error) {
            console.error('[Auth] getUserInfo error:', error);
            throw error;
        }
    }

    async saveUserInfo(userInfo) {
        console.log('[Auth] Saving user info to chrome.storage.local...');
        try {
            await chrome.storage.local.set({ userInfo });
            console.log('[Auth] User info saved successfully');
        } catch (error) {
            console.error('[Auth] saveUserInfo error:', error);
            throw error;
        }
    }

    static async logout() {
        console.log('[Auth] Starting logout process');
        try {
            // Get current token
            const token = await new Auth().getAuthToken();
            if (token) {
                console.log('[Auth] Revoking auth token');
                try {
                    // First revoke the token with Google
                    await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
                        method: 'GET'
                    });
                } catch (error) {
                    console.error('[Auth] Error revoking token:', error);
                    // Continue with logout even if revocation fails
                }

                console.log('[Auth] Removing cached auth token');
                // Remove token from Chrome's cache
                await new Promise((resolve) => {
                    chrome.identity.removeCachedAuthToken({ token }, () => {
                        resolve();
                    });
                });
            }

            console.log('[Auth] Removing user info from storage');
            // Remove all auth-related data
            await chrome.storage.local.remove(['userInfo', 'authToken']);
            
            // Notify background script about logout
            console.log('[Auth] Notifying background script about logout');
            try {
                await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({ action: 'userLoggedOut' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn('[Auth] Error sending logout message:', chrome.runtime.lastError);
                            // Resolve anyway since we want to continue with logout
                            resolve();
                        } else {
                            console.log('[Auth] Logout message response:', response);
                            resolve();
                        }
                    });
                });
            } catch (error) {
                console.warn('[Auth] Failed to notify background script:', error);
                // Continue with logout even if notification fails
            }
            
            console.log('[Auth] Logout successful');
            
            // Use chrome.runtime.getURL for proper path
            const loginUrl = chrome.runtime.getURL('pages/Login/login.html');
            console.log('[Auth] Redirecting to:', loginUrl);
            
            // Set a small timeout to ensure background script has time to process
            setTimeout(() => {
                window.close();
            }, 100);
        } catch (error) {
            console.error('[Auth] Logout failed:', error);
            // Even if there's an error, try to redirect to login
            try {
                const loginUrl = chrome.runtime.getURL('pages/Login/login.html');
                window.location.href = loginUrl;
            } catch (e) {
                console.error('[Auth] Failed to redirect after error:', e);
                alert('Logout failed. Please try again.');
            }
        }
    }
}

// Global error handler
window.addEventListener('error', (event) => {
    console.error('[Auth] Global error:', event.error);
    // Prevent the error from breaking the UI
    event.preventDefault();
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('[Auth] Unhandled promise rejection:', event.reason);
    // Prevent the error from breaking the UI
    event.preventDefault();
}); 