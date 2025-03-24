export class Auth {
    constructor() {
        this.init();
    }

    init() {
        console.log('Auth initialized');
        const loginButton = document.getElementById('loginButton');
        if (loginButton) {
            console.log('Login button found');
            loginButton.addEventListener('click', () => {
                console.log('Login button clicked');
                this.login();
            });
        } else {
            console.error('Login button not found');
        }
    }

    async login() {
        console.log('Starting login process');
        try {
            console.log('Requesting auth token...');
            const token = await this.getAuthToken(true);
            
            if (!token) {
                console.log('Login cancelled by user');
                return; // Don't show error for user cancellation
            }
            
            console.log('Token received:', token ? 'Yes' : 'No');
            
            console.log('Getting user info...');
            const userInfo = await this.getUserInfo(token);
            console.log('User info received:', userInfo);
            
            console.log('Saving user info...');
            await this.saveUserInfo(userInfo);
            
            console.log('Redirecting to popup.html');
            window.location.href = 'popup.html';
        } catch (error) {
            console.error('Login failed:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = `Login failed: ${error.message}`;
            document.querySelector('.login-container').appendChild(errorDiv);
        }
    }

    async getAuthToken(interactive = false) {
        return new Promise((resolve, reject) => {
            const manifest = chrome.runtime.getManifest();
            console.log('OAuth2 config:', manifest.oauth2);
            
            chrome.identity.getAuthToken({ 
                interactive: interactive
            }, (token) => {
                if (chrome.runtime.lastError) {
                    if (chrome.runtime.lastError.message.includes('canceled')) {
                        console.log('User cancelled the login');
                        resolve(null);
                    } else {
                        console.error('getAuthToken error:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                    }
                } else {
                    console.log('Token obtained successfully');
                    resolve(token);
                }
            });
        });
    }

    async getUserInfo(token) {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('getUserInfo error:', error);
            throw error;
        }
    }

    async saveUserInfo(userInfo) {
        try {
            await chrome.storage.local.set({ userInfo });
        } catch (error) {
            console.error('saveUserInfo error:', error);
            throw error;
        }
    }

    static async logout() {
        try {
            // Get current token
            const token = await new Auth().getAuthToken();
            if (token) {
                // Remove token from Chrome's cache
                await new Promise((resolve, reject) => {
                    chrome.identity.removeCachedAuthToken({ token }, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve();
                        }
                    });
                });

                // Only remove user info, keep notes
                await chrome.storage.local.remove(['userInfo']);
                
                console.log('Logout successful');
                
                // Redirect to login page
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Logout failed:', error);
            alert('Logout failed. Please try again.');
        }
    }
}

// Initialize Auth only for the login page
if (document.getElementById('loginButton')) {
    console.log('Page loaded - Login page detected');
    new Auth();
}

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
}); 