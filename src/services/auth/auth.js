import { logger } from '../../utils/logger';
import { messagingService } from '../messaging/messaging';
import { storageService } from '../storage/storage';
import { uiUtils } from '../../utils/ui';

/**
 * Authentication service for Google OAuth
 */
export class Auth {
    constructor() {
        logger.info('Auth', 'Initializing Auth class');
    }

    /**
     * Log in with Google
     * @returns {Promise<boolean>} - Whether login was successful
     */
    async login() {
        logger.info('Auth', 'Starting login process');
        try {
            // Clear existing tokens to start fresh
            await new Promise((resolve) => {
                chrome.identity.clearAllCachedAuthTokens(() => {
                    logger.info('Auth', 'Cleared existing tokens for a fresh login');
                    resolve();
                });
            });
            
            // Request auth token with interaction
            const token = await this.getAuthToken(true);
            
            if (!token) {
                logger.info('Auth', 'Login cancelled by user or no token received');
                this.showLoginError('Login was cancelled or no authorization was granted');
                return false;
            }
            
            logger.info('Auth', 'Token received successfully');
            
            // Get user info
            try {
                const userInfo = await this.getUserInfo(token);
                logger.info('Auth', 'User info received successfully');
                
                // Save to storage
                await storageService.saveUserInfo(userInfo);
                logger.info('Auth', 'User info saved to storage');
                
                // Redirect to main popup
                const popupUrl = chrome.runtime.getURL('pages/Popup/popup.html');
                window.location.href = popupUrl;
                return true;
                
            } catch (userInfoError) {
                logger.error('Auth', 'Error getting user info', userInfoError);
                
                // Remove the problematic token and show error
                chrome.identity.removeCachedAuthToken({ token }, () => {
                    logger.info('Auth', 'Removed problematic token');
                });
                
                this.showLoginError('Could not retrieve user profile');
                return false;
            }
        } catch (error) {
            logger.error('Auth', 'Login failed', error);
            this.showLoginError(error.message || 'Unknown error');
            return false;
        }
    }

    /**
     * Get auth token using the launchWebAuthFlow method which opens in a tab
     * @returns {Promise<string|null>} - The auth token or null if cancelled
     */
    async getAuthTokenWithTabFlow() {
        logger.info('Auth', 'Using tab-based OAuth flow for better UX');
        
        try {
            // Get the OAuth2 info from manifest
            const manifest = chrome.runtime.getManifest();
            const clientId = manifest.oauth2.client_id;
            
            if (!clientId) {
                throw new Error('OAuth2 client ID not found in manifest');
            }
            
            // Create the authentication URL with Google
            const redirectURL = chrome.identity.getRedirectURL();
            const scopes = [
                'https://www.googleapis.com/auth/userinfo.email', 
                'https://www.googleapis.com/auth/userinfo.profile'
            ];
            
            let authUrl = 'https://accounts.google.com/o/oauth2/auth';
            authUrl += `?client_id=${encodeURIComponent(clientId)}`;
            authUrl += `&response_type=token`;
            authUrl += `&redirect_uri=${encodeURIComponent(redirectURL)}`;
            authUrl += `&scope=${encodeURIComponent(scopes.join(' '))}`;
            
            // Launch authentication in a tab
            const responseUrl = await new Promise((resolve, reject) => {
                chrome.identity.launchWebAuthFlow({
                    url: authUrl,
                    interactive: true
                }, (responseUrl) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(responseUrl);
                    }
                });
            });
            
            if (!responseUrl) {
                logger.info('Auth', 'Auth flow returned no URL - user likely cancelled');
                return null;
            }
            
            // Extract the access token from the response URL
            const urlParams = new URLSearchParams(responseUrl.split('#')[1]);
            const accessToken = urlParams.get('access_token');
            
            if (!accessToken) {
                throw new Error('No access token found in response');
            }
            
            logger.info('Auth', 'Successfully obtained access token');
            return accessToken;
        } catch (error) {
            const errorMessage = error.message || 'Unknown error';
            
            // Check if the error is due to user cancellation
            if (errorMessage.includes('canceled') || 
                errorMessage.includes('cancelled') || 
                errorMessage.includes('user closed')) {
                logger.info('Auth', 'User cancelled the login flow');
                return null;
            }
            
            // Throw other errors
            logger.error('Auth', 'Error in tab auth flow', error);
            throw error;
        }
    }

    /**
     * Get an authentication token (used for non-interactive checks)
     * @param {boolean} interactive - Whether to show interactive login
     * @returns {Promise<string|null>} - The auth token or null if cancelled
     */
    async getAuthToken(interactive = false) {
        return new Promise((resolve, reject) => {
            logger.info('Auth', `Getting auth token, interactive: ${interactive}`);
            
            // Only use the supported parameter
            chrome.identity.getAuthToken({ 
                interactive: interactive
            }, (token) => {
                if (chrome.runtime.lastError) {
                    const error = chrome.runtime.lastError;
                    
                    // Format the error nicely for logging - ensure it's a string
                    const errorMessage = error.message || 'Unknown error';
                    
                    // Only log detailed errors for interactive requests
                    if (interactive) {
                        logger.error('Auth', 'getAuthToken error', errorMessage);
                    }
                    
                    // Handle user cancellation
                    if (errorMessage.includes('canceled') || 
                        errorMessage.includes('cancelled') || 
                        errorMessage.includes('user closed') ||
                        errorMessage.includes('did not approve') ||
                        errorMessage.includes('not granted')) {
                        logger.info('Auth', 'User cancelled the login: ' + errorMessage);
                        resolve(null); // User cancelled, not a failure
                        return;
                    } 
                    // Handle token not being available after logout
                    else if (errorMessage.includes('not signed in') || 
                             errorMessage.includes('account not found') ||
                             errorMessage.includes('OAuth2 not granted') ||
                             errorMessage.includes('revoked')) {
                        if (interactive) {
                            logger.info('Auth', 'OAuth token not available or revoked: ' + errorMessage);
                        }
                        // We'll handle this as if the user wasn't authenticated
                        resolve(null);
                        return;
                    }
                    // Handle other errors
                    else {
                        const formattedError = new Error(`Authentication error: ${errorMessage}`);
                        logger.error('Auth', 'getAuthToken failure', formattedError);
                        reject(formattedError);
                        return;
                    }
                } 
                
                if (!token) {
                    if (interactive) {
                        logger.warn('Auth', 'Got null token from Chrome identity API');
                    }
                    resolve(null);
                    return;
                }
                
                logger.info('Auth', 'Token obtained successfully');
                resolve(token);
            });
        });
    }

    /**
     * Get user info from Google
     * @param {string} token - The OAuth token
     * @returns {Promise<Object>} - User information
     */
    async getUserInfo(token) {
        logger.info('Auth', 'Fetching user info from Google');
        try {
            // Use the standard userinfo endpoint which is more reliable
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const userInfo = await response.json();
            logger.info('Auth', 'User info fetched successfully');
            return userInfo;
        } catch (error) {
            logger.error('Auth', 'getUserInfo error', error);
            throw error;
        }
    }

    /**
     * Show login error in the UI
     * @param {string} message - Error message
     */
    showLoginError(message) {
        const container = document.querySelector('.login-container');
        if (container) {
            uiUtils.showError(`Login failed: ${message}`, container);
        } else {
            logger.error('Auth', 'Could not find login-container to show error');
        }
    }

    /**
     * Log out the current user with complete Google OAuth revocation
     * @returns {Promise<boolean>} - Whether logout was successful
     */
    static async logout() {
        logger.info('Auth', 'Starting comprehensive logout process');
        try {
            // 1. First get the current token before we clear anything
            let token = null;
            try {
                const auth = new Auth();
                token = await auth.getAuthToken(false);
            } catch (error) {
                logger.warn('Auth', 'Could not get current token', error);
            }
            
            // 2. Clear all Chrome extension tokens
            await new Promise((resolve) => {
                chrome.identity.clearAllCachedAuthTokens(() => {
                    logger.info('Auth', 'Cleared all extension tokens');
                    resolve();
                });
            });
            
            // 3. Revoke OAuth access with Google to prevent silent re-auth
            if (token) {
                try {
                    // Perform a proper OAuth revocation with Google's server
                    const revokeResponse = await fetch(
                        `https://accounts.google.com/o/oauth2/revoke?token=${token}`, 
                        { 
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        }
                    );
                    
                    if (!revokeResponse.ok) {
                        logger.warn('Auth', `Google revocation failed: ${revokeResponse.status}`);
                    } else {
                        logger.info('Auth', 'Successfully revoked OAuth access with Google');
                    }
                } catch (error) {
                    logger.warn('Auth', 'Error revoking with Google', error);
                }
            }
            
            // 4. Remove Chrome's OAuth2 approval record
            if (token && chrome.identity.removeCachedAuthToken) {
                await new Promise((resolve) => {
                    chrome.identity.removeCachedAuthToken({ token }, () => {
                        resolve();
                    });
                });
            }
            
            // 5. Clear local storage completely
            await storageService.clearAuthData();
            
            // 6. Force Chrome to forget sign-in preferences by redirecting to 
            // the login page with a special clear parameter that our login page will handle
            const loginUrl = chrome.runtime.getURL('pages/Login/login.html?clearAuth=true');
            window.location.href = loginUrl;
            
            return true;
        } catch (error) {
            logger.error('Auth', 'Logout failed', error);
            
            // Even if the above fails, try to redirect to login page
            try {
                const loginUrl = chrome.runtime.getURL('pages/Login/login.html?clearAuth=true');
                window.location.href = loginUrl;
            } catch (e) {
                logger.error('Auth', 'Failed to redirect after error', e);
                alert('Logout failed. Please try again.');
            }
            
            return false;
        }
    }

    /**
     * Check if the user is authenticated
     * @returns {Promise<boolean>} - Authentication status
     */
    static async isAuthenticated() {
        try {
            // Get user info from storage first
            const userInfo = await storageService.getUserInfo();
            
            // Try to get a token silently - this will verify if we're still authenticated
            const auth = new Auth();
            const token = await auth.getAuthToken(false);
            
            if (token) {
                logger.info('Auth', 'User is authenticated with valid token');
                
                // If we have a token but no user info, fetch it
                if (!userInfo) {
                    try {
                        logger.info('Auth', 'Getting fresh user profile');
                        const freshUserInfo = await auth.getUserInfo(token);
                        await storageService.saveUserInfo(freshUserInfo);
                    } catch (e) {
                        logger.warn('Auth', 'Could not get user profile despite having token', e);
                    }
                }
                return true;
            }
            
            // We don't have a valid token
            if (userInfo) {
                // We have stored user info but no valid token - clear it
                logger.info('Auth', 'Found user info but no valid token, clearing stored data');
                await storageService.clearAuthData();
            }
            
            return false;
        } catch (error) {
            logger.error('Auth', 'Error checking authentication status', error);
            return false;
        }
    }

    /**
     * Clear a cached token from Chrome's identity API
     * @param {string} token - The token to clear
     * @returns {Promise<void>}
     */
    static async clearCachedToken(token) {
        return new Promise((resolve) => {
            logger.info('Auth', 'Clearing specific cached token');
            chrome.identity.removeCachedAuthToken({ token }, () => {
                logger.info('Auth', 'Specific token cleared');
                resolve();
            });
        });
    }
}

// Global error handler
window.addEventListener('error', (event) => {
    logger.error('Auth', 'Global error', event.error);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    logger.error('Auth', 'Unhandled rejection', event.reason);
}); 