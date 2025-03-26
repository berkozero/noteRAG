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
            // Request auth token with interaction
            const token = await this.getAuthToken(true);
            
            if (!token) {
                logger.info('Auth', 'Login cancelled by user');
                return false;
            }
            
            logger.info('Auth', 'Token received successfully');
            
            // Get user info
            const userInfo = await this.getUserInfo(token);
            logger.info('Auth', 'User info received');
            
            // Save to storage
            await storageService.saveUserInfo(userInfo);
            logger.info('Auth', 'User info saved successfully');
            
            // Notify background to refresh popup
            try {
                await messagingService.sendToBackground({ action: 'refreshPopup' });
                logger.info('Auth', 'Refresh message sent successfully');
                
                // Redirect to main popup
                const popupUrl = chrome.runtime.getURL('pages/Popup/popup.html');
                window.location.href = popupUrl;
                return true;
            } catch (error) {
                logger.error('Auth', 'Error during refresh', error);
                // If refresh fails, still try to redirect
                const popupUrl = chrome.runtime.getURL('pages/Popup/popup.html');
                window.location.href = popupUrl;
                return true;
            }
        } catch (error) {
            logger.error('Auth', 'Login failed', error);
            this.showLoginError(error.message);
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
            const scopes = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'];
            
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
            
            chrome.identity.getAuthToken({ 
                interactive: interactive
            }, (token) => {
                if (chrome.runtime.lastError) {
                    const error = chrome.runtime.lastError;
                    
                    // Format the error nicely for logging
                    const errorMessage = error.message || 'Unknown error';
                    
                    // Only log detailed errors for interactive requests
                    // Non-interactive requests should fail silently to avoid console spam
                    if (interactive) {
                        logger.error('Auth', 'getAuthToken error', { message: errorMessage });
                    }
                    
                    // Handle user cancellation
                    if (errorMessage.includes('canceled') || 
                        errorMessage.includes('cancelled') || 
                        errorMessage.includes('user closed')) {
                        logger.info('Auth', 'User cancelled the login');
                        resolve(null);
                    } 
                    // Handle token not being available after logout
                    else if (errorMessage.includes('not signed in') || 
                             errorMessage.includes('account not found') ||
                             errorMessage.includes('OAuth2 not granted') ||
                             errorMessage.includes('revoked')) {
                        if (interactive) {
                            logger.info('Auth', 'OAuth token not available or revoked');
                        }
                        // We'll handle this as if the user wasn't authenticated
                        resolve(null);
                    }
                    // Handle other errors
                    else {
                        reject(new Error(errorMessage));
                    }
                } else {
                    logger.info('Auth', 'Token obtained successfully');
                    resolve(token);
                }
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
     * Log out the current user
     * @returns {Promise<boolean>} - Whether logout was successful
     */
    static async logout() {
        logger.info('Auth', 'Starting logout process');
        try {
            // Try to get current token (non-interactive)
            let token = null;
            try {
                token = await new Auth().getAuthToken(false);
            } catch (error) {
                // If we can't get the token, just log and continue
                logger.warn('Auth', 'Could not get token for revocation', error);
                // We'll continue with logout even without the token
            }

            // If we have a token, revoke it
            if (token) {
                try {
                    await Auth.revokeToken(token);
                } catch (error) {
                    // If token revocation fails, still continue with logout
                    logger.warn('Auth', 'Token revocation failed', error);
                }
            }

            // Remove auth data from storage
            await storageService.clearAuthData();
            
            // Notify background script
            try {
                await messagingService.sendToBackground({ action: 'userLoggedOut' });
            } catch (error) {
                logger.warn('Auth', 'Failed to notify background script', error);
                // Continue with logout even if notification fails
            }
            
            logger.info('Auth', 'Logout successful');
            
            // Close window after a short delay
            setTimeout(() => {
                window.close();
            }, 100);
            
            return true;
        } catch (error) {
            logger.error('Auth', 'Logout failed', error);
            // Try to redirect to login even on error
            try {
                const loginUrl = chrome.runtime.getURL('pages/Login/login.html');
                window.location.href = loginUrl;
            } catch (e) {
                logger.error('Auth', 'Failed to redirect after error', e);
                alert('Logout failed. Please try again.');
            }
            return false;
        }
    }

    /**
     * Revoke an OAuth token
     * @param {string} token - The token to revoke
     * @returns {Promise<void>}
     */
    static async revokeToken(token) {
        try {
            logger.info('Auth', 'Revoking auth token');
            // Revoke with Google
            await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
                method: 'GET'
            });

            // Remove from Chrome's cache
            await new Promise((resolve) => {
                chrome.identity.removeCachedAuthToken({ token }, () => {
                    resolve();
                });
            });
            
            logger.info('Auth', 'Token revoked successfully');
        } catch (error) {
            logger.error('Auth', 'Error revoking token', error);
            // Continue with logout process even if token revocation fails
        }
    }

    /**
     * Check if the user is authenticated
     * @returns {Promise<boolean>} - Authentication status
     */
    static async isAuthenticated() {
        try {
            // First check if we have user info stored
            const userInfo = await storageService.getUserInfo();
            if (userInfo) {
                // We have user info, but let's verify the token is still valid
                try {
                    const auth = new Auth();
                    const token = await auth.getAuthToken(false);
                    
                    if (token) {
                        // Token is valid, update user info if needed
                        try {
                            const freshUserInfo = await auth.getUserInfo(token);
                            await storageService.saveUserInfo(freshUserInfo);
                        } catch (e) {
                            // If we can't get user info but have a token, still consider authenticated
                            logger.warn('Auth', 'Could not refresh user info, using cached info', e);
                        }
                        return true;
                    } else {
                        // Token is not available - could be revoked or expired
                        logger.info('Auth', 'No valid token available, clearing auth data');
                        await storageService.clearAuthData();
                        return false;
                    }
                } catch (error) {
                    logger.warn('Auth', 'Error checking token validity', error);
                    // If there's an error checking the token but we have user info,
                    // we'll still consider the user authenticated for better UX
                    return true;
                }
            }

            // No stored user info, try silent token refresh
            try {
                const auth = new Auth();
                const token = await auth.getAuthToken(false);
                
                if (token) {
                    // If we got a token, get and save user info
                    const userInfo = await auth.getUserInfo(token);
                    await storageService.saveUserInfo(userInfo);
                    return true;
                }
            } catch (error) {
                logger.info('Auth', 'Silent token refresh failed', error);
            }

            // No user info and couldn't get a token - not authenticated
            return false;
        } catch (error) {
            logger.error('Auth', 'Auth check failed', error);
            return false;
        }
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