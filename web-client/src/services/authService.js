import axios from 'axios';

// API URL configuration
const API_URL = process.env.REACT_APP_API_URL || 'https://localhost:3443'; // Use REACT_APP prefix for Create React App
const STORAGE_KEY = 'noterag_auth';

class AuthService {
  constructor() {
    this.googleAuth = null;
    this.authToken = null;
    this.userInfo = null;
    this.loadStoredAuth(); // Load auth data on initialization
  }

  /**
   * Initialize Google auth client
   */
  async initGoogleAuth() {
    return new Promise((resolve, reject) => {
      // Load the Google API script dynamically
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        // Initialize Google client
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: process.env.GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
            callback: (response) => {
              if (response.error) {
                reject(new Error(`Google auth error: ${response.error}`));
                return;
              }
              
              this.googleAuth = response;
              resolve(response);
            }
          });
          
          this.googleAuthClient = client;
          resolve(client);
        } catch (error) {
          console.error('Error initializing Google auth:', error);
          reject(error);
        }
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Google authentication script'));
      };
      
      document.body.appendChild(script);
    });
  }

  /**
   * Get Google token for authentication
   */
  async getGoogleToken() {
    try {
      if (!this.googleAuthClient) {
        await this.initGoogleAuth();
      }
      
      return new Promise((resolve, reject) => {
        try {
          this.googleAuthClient.requestAccessToken();
          
          // The callback will resolve this promise
          const handleTokenResponse = (event) => {
            if (event.type === 'message' && event.data?.type === 'oauth2-response') {
              window.removeEventListener('message', handleTokenResponse);
              
              if (event.data.response?.error) {
                reject(new Error(event.data.response.error));
              } else {
                resolve(event.data.response?.access_token);
              }
            }
          };
          
          window.addEventListener('message', handleTokenResponse);
          
          // Set a timeout in case the OAuth flow doesn't complete
          setTimeout(() => {
            window.removeEventListener('message', handleTokenResponse);
            reject(new Error('Google authentication timed out'));
          }, 60000); // 60 second timeout
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      console.error('Error getting Google token:', error);
      throw error;
    }
  }

  /**
   * Get user profile from Google using OAuth token
   */
  async getGoogleUserInfo(token) {
    try {
      const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting user info from Google:', error);
      throw error;
    }
  }

  /**
   * Authenticate with backend using Google User Info (Registers if needed)
   */
  async authenticateWithBackend(googleUserInfo) {
    try {
      // The backend /api/register handles both registration and login for Google OAuth
      const response = await axios.post(`${API_URL}/api/register`, {
        email: googleUserInfo.email
        // No password needed for Google OAuth registration/login
      });

      return {
        success: true,
        token: response.data.access_token,
        userEmail: response.data.user_email
      };
    } catch (error) {
      console.error('Backend authentication error (Google):', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to authenticate with backend using Google'
      };
    }
  }

  /**
   * Register a new user with email and password
   */
  async registerWithEmail(email, password) {
    try {
      const response = await axios.post(`${API_URL}/api/register`, {
        email: email,
        password: password
      });

      const authData = {
        token: response.data.access_token,
        user: { email: response.data.user_email }, // Store basic user info
        timestamp: Date.now()
      };

      await this.saveAuthData(authData);

      return {
        success: true,
        user: authData.user,
        token: authData.token
      };
    } catch (error) {
      console.error('Email registration error:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to register with email/password'
      };
    }
  }

  /**
   * Login user with email and password
   */
  async loginWithEmail(email, password) {
    try {
      // Backend expects form data for /token endpoint
      const params = new URLSearchParams();
      params.append('username', email); // FastAPI's OAuth2PasswordRequestForm uses 'username'
      params.append('password', password);

      const response = await axios.post(`${API_URL}/token`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const authData = {
        token: response.data.access_token,
        user: { email: response.data.user_email }, // Store basic user info
        timestamp: Date.now()
      };

      await this.saveAuthData(authData);

      return {
        success: true,
        user: authData.user,
        token: authData.token
      };
    } catch (error) {
      console.error('Email login error:', error);
      // Handle specific 401 Unauthorized error
      if (error.response && error.response.status === 401) {
        return { success: false, error: 'Incorrect email or password' };
      }
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to login with email/password'
      };
    }
  }

  /**
   * Complete login flow with Google
   */
  async loginWithGoogle() { // Renamed from login to be specific
    try {
      // 1. Get Google token
      const googleToken = await this.getGoogleToken();

      if (!googleToken) {
        return { success: false, error: 'Failed to get Google authentication token' };
      }

      // 2. Get user info from Google
      const googleUserInfo = await this.getGoogleUserInfo(googleToken);

      if (!googleUserInfo || !googleUserInfo.email) {
        return { success: false, error: 'Failed to get user info from Google' };
      }

      // 3. Authenticate with backend (uses /api/register for simplicity)
      const backendAuthResult = await this.authenticateWithBackend(googleUserInfo);

      if (!backendAuthResult.success) {
        return { success: false, error: backendAuthResult.error };
      }

      // 4. Save auth data (includes Google-specific info if needed, but primary is JWT)
      const authData = {
        // googleToken, // Optionally store google token if needed later
        token: backendAuthResult.token,
        user: { email: backendAuthResult.userEmail, name: googleUserInfo.name, picture: googleUserInfo.picture }, // Store more Google info
        timestamp: Date.now()
      };

      await this.saveAuthData(authData);

      return {
        success: true,
        user: authData.user,
        token: authData.token
      };
    } catch (error) {
      console.error('Google Login error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error during Google login'
      };
    }
  }

  /**
   * Log out the user
   */
  async logout() {
    try {
      // Clear auth data from storage
      await this.clearAuth(); // Use clearAuth method

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify if the token is still valid with the server
   */
  async verifyToken(token) {
    try {
      const response = await axios.post(`${API_URL}/api/verify`, null, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data?.valid === true;
    } catch (error) {
      console.error('Token verification error:', error);
      return false;
    }
  }

  /**
   * Get the JWT token for API requests
   */
  async getToken() {
    // Return cached token if available
    if (this.authToken) {
      return this.authToken;
    }
    // Otherwise load from storage (handled by constructor)
    return null;
  }
  
  /** 
   * Get the cached user info 
   */
  getUserInfo() {
      return this.userInfo;
  }

  /**
   * Save authentication data (JWT token and basic user info)
   */
  async saveAuthData(authData) {
    if (!authData || !authData.token || !authData.user) return;

    // Update memory cache
    this.authToken = authData.token;
    this.userInfo = authData.user; // Store user object { email, name?, picture? }

    // Save to storage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authData));
  }

  /**
   * Load authentication data from local storage
   */
  async loadStoredAuth() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;

      const authData = JSON.parse(data);

      // Basic validation
      if (!authData || !authData.token || !authData.user) {
          console.warn('Stored auth data is invalid. Clearing.');
          await this.clearAuth();
          return null;
      }
      
      // Update memory cache
      this.authToken = authData.token;
      this.userInfo = authData.user;

      console.log('Loaded auth data:', this.userInfo);

      return authData;
    } catch (error) {
      console.error('Error loading stored auth:', error);
      await this.clearAuth(); // Clear potentially corrupted data
      return null;
    }
  }

  /**
   * Clear authentication data
   */
  async clearAuth() {
    localStorage.removeItem(STORAGE_KEY);
    this.authToken = null;
    this.userInfo = null;
    this.googleAuth = null; // Also clear google auth state if any
    console.log('Cleared auth data.');
  }
}

export const authService = new AuthService();
export default authService; 