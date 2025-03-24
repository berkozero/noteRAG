class Auth {
    constructor() {
        this.init();
    }

    init() {
        this.checkAuthState();
        document.getElementById('loginButton')?.addEventListener('click', () => this.login());
    }

    async checkAuthState() {
        try {
            const token = await this.getAuthToken();
            if (token) {
                const userInfo = await this.getUserInfo(token);
                await this.saveUserInfo(userInfo);
                window.location.href = 'popup.html';
            }
        } catch (error) {
            console.error('Auth check failed:', error);
        }
    }

    async login() {
        try {
            const token = await this.getAuthToken(true);
            if (token) {
                const userInfo = await this.getUserInfo(token);
                await this.saveUserInfo(userInfo);
                window.location.href = 'popup.html';
            }
        } catch (error) {
            console.error('Login failed:', error);
        }
    }

    async getAuthToken(interactive = false) {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive }, (token) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(token);
                }
            });
        });
    }

    async getUserInfo(token) {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return response.json();
    }

    async saveUserInfo(userInfo) {
        await chrome.storage.local.set({ userInfo });
    }

    static async logout() {
        try {
            const token = await new Auth().getAuthToken();
            if (token) {
                await new Promise((resolve, reject) => {
                    chrome.identity.removeCachedAuthToken({ token }, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve();
                        }
                    });
                });
            }
            await chrome.storage.local.remove(['userInfo']);
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }
}

new Auth(); 