import { Auth } from '../../services/auth/auth.js';
import { logger } from '../../utils/logger.js';
import { uiUtils } from '../../utils/ui.js';
import { messagingService } from '../../services/messaging/messaging.js';
import { storageService } from '../../services/storage/storage.js';

// Track if we're in the middle of logging in
let loginInProgress = false;

/**
 * Check if the user is authenticated and redirect if they are
 */
async function checkAndRedirectIfAuthenticated() {
    try {
        // Check for user info in storage first
        // This is safer and doesn't trigger OAuth errors
        const userInfo = await storageService.getUserInfo();
        
        if (userInfo) {
            logger.info('Login', 'User info found in storage, checking token validity');
            
            // Verify the token is still valid before redirecting
            try {
                const auth = new Auth();
                const token = await auth.getAuthToken(false); // Non-interactive check
                
                if (token) {
                    logger.info('Login', 'Valid token found, redirecting to popup');
                    window.location.href = chrome.runtime.getURL('pages/Popup/popup.html');
                    return true;
                } else {
                    // Token not valid but we have user info - clear the data
                    logger.info('Login', 'Token invalid but user info exists, clearing data');
                    await storageService.clearAuthData();
                    return false;
                }
            } catch (error) {
                // If there's an error checking token, clear user data
                logger.warn('Login', 'Error checking token, clearing user data', error);
                await storageService.clearAuthData();
                return false;
            }
        }

        // Only try to get a token if we're not actively logging in
        if (!loginInProgress) {
            try {
                const auth = new Auth();
                // We'll wrap this in another try/catch to silently handle OAuth errors
                const token = await auth.getAuthToken(false); // Non-interactive check
                
                if (token) {
                    logger.info('Login', 'Valid token found, completing login process');
                    // Complete the login process
                    loginInProgress = true;
                    
                    try {
                        // Get and store user info
                        const userInfo = await auth.getUserInfo(token);
                        await storageService.saveUserInfo(userInfo);
                        
                        // Redirect to popup
                        window.location.href = chrome.runtime.getURL('pages/Popup/popup.html');
                        return true;
                    } catch (error) {
                        logger.error('Login', 'Error completing auto-login', error);
                        loginInProgress = false;
                        
                        // If we couldn't get user info, the token may be invalid
                        // Remove it to prevent further issues
                        chrome.identity.removeCachedAuthToken({ token }, () => {
                            logger.info('Login', 'Removed invalid token');
                        });
                    }
                }
            } catch (error) {
                // Silently handle any OAuth errors - these are expected after logout
                // We specifically DON'T log this to avoid console errors
                return false;
            }
        }
        
        return false;
    } catch (error) {
        // Still log unexpected errors
        logger.error('Login', 'Error checking authentication', error);
        return false;
    }
}

/**
 * Initialize the login page
 */
document.addEventListener('DOMContentLoaded', async function() {
    logger.info('Login', 'Login page loaded');
    
    try {
        // Initialize UI utilities
        uiUtils.initDOMPurify();
        
        // Check for clearAuth parameter which indicates we need to wipe everything
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('clearAuth')) {
            logger.info('Login', 'Performing complete auth cleanup');
            
            // Clear all tokens from Chrome's cache
            await new Promise(resolve => {
                chrome.identity.clearAllCachedAuthTokens(() => {
                    logger.info('Login', 'Cleared all cached auth tokens during cleanup');
                    resolve();
                });
            });
            
            // Clear all auth data from storage
            await storageService.clearAuthData();
            
            // Clear additional auth-related items
            if (chrome.storage && chrome.storage.local) {
                await new Promise(resolve => {
                    chrome.storage.local.remove(['userInfo', 'authToken', 'login_state'], () => {
                        logger.info('Login', 'Removed all auth data from storage');
                        resolve();
                    });
                });
            }
            
            // Remove the clearAuth parameter from URL to avoid loop
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            
            // Show a message about successful logout
            const container = document.querySelector('.login-container');
            if (container) {
                const logoutMsg = document.createElement('div');
                logoutMsg.className = 'logout-message';
                logoutMsg.textContent = 'You have been successfully logged out.';
                logoutMsg.style.marginBottom = '20px';
                logoutMsg.style.color = '#4285f4';
                
                // Insert before the first child
                if (container.firstChild) {
                    container.insertBefore(logoutMsg, container.firstChild);
                } else {
                    container.appendChild(logoutMsg);
                }
                
                // Remove the message after a few seconds
                setTimeout(() => {
                    if (logoutMsg.parentNode) {
                        logoutMsg.parentNode.removeChild(logoutMsg);
                    }
                }, 5000);
            }
        }
        
        // Don't check authentication on login page - that's the purpose of this page!
        // Instead, just check for stored user info which doesn't trigger OAuth errors
        const isAuthenticated = await checkAndRedirectIfAuthenticated();
        
        if (!isAuthenticated) {
            // Setup login button
            setupLoginButton();
            
            // Listen for focus changes - the user might have authenticated in another window
            window.addEventListener('focus', async () => {
                logger.info('Login', 'Window gained focus, checking authentication');
                await checkAndRedirectIfAuthenticated();
            });
            
            // Also check again after a short delay
            // This helps catch cases where the auth completes but doesn't trigger our handlers
            setTimeout(async () => {
                await checkAndRedirectIfAuthenticated();
            }, 1000);
        }
    } catch (error) {
        logger.error('Login', 'Error initializing login page', error);
        showError('Failed to initialize login page. Please try again.');
    }
});

/**
 * Setup login button click handler
 */
function setupLoginButton() {
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        logger.info('Login', 'Login button found, setting up event listener');
        loginButton.addEventListener('click', handleLogin);
    } else {
        logger.error('Login', 'Login button not found');
        showError('Login button not found. Please reload the page.');
    }
}

/**
 * Handle login button click
 */
async function handleLogin() {
    logger.info('Login', 'Login button clicked');
    
    try {
        loginInProgress = true;
        
        const loginButton = document.getElementById('loginButton');
        if (loginButton) {
            // Disable button and show loading state
            loginButton.disabled = true;
            loginButton.textContent = 'Logging in...';
            loginButton.classList.add('loading');
        }
        
        // Initialize messaging if we'll need it for the login process
        try {
            await messagingService.initClient();
        } catch (e) {
            // Non-fatal if messaging fails
            logger.warn('Login', 'Could not initialize messaging', e);
        }
        
        // Perform login
        const auth = new Auth();
        const success = await auth.login();
        
        if (!success) {
            if (loginButton) {
                // Reset button state
                loginButton.disabled = false;
                loginButton.textContent = 'Login with Google';
                loginButton.classList.remove('loading');
            }
            
            logger.warn('Login', 'Login failed or was cancelled');
        }
        loginInProgress = false;
    } catch (error) {
        loginInProgress = false;
        logger.error('Login', 'Login error', error);
        showError(`Login failed: ${error.message}`);
        
        const loginButton = document.getElementById('loginButton');
        if (loginButton) {
            // Reset button state
            loginButton.disabled = false;
            loginButton.textContent = 'Login with Google';
            loginButton.classList.remove('loading');
        }
    }
}

/**
 * Show error message in the UI
 * @param {string} message - The error message to display
 */
function showError(message) {
    const container = document.querySelector('.login-container');
    uiUtils.showError(message, container);
}

// Global error handler
window.addEventListener('error', (event) => {
    logger.error('Login', 'Global error', event.error);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    logger.error('Login', 'Unhandled rejection', event.reason);
}); 