/**
 * Unit tests for Auth service
 * 
 * Tests cover the authentication flow including login, logout, token management,
 * and error handling.
 */

// Mock the chrome API
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../src/services/storage/storage', () => ({
  storageService: {
    saveUserInfo: jest.fn().mockResolvedValue(undefined),
    getUserInfo: jest.fn(),
    clearAuthData: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('../src/utils/ui', () => ({
  uiUtils: {
    showError: jest.fn()
  }
}));

// Import the Auth class
import { Auth } from '../src/services/auth/auth';
import { storageService } from '../src/services/storage/storage';
import { uiUtils } from '../src/utils/ui';

describe('Auth Service', () => {
  // Setup chrome identity mock
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock chrome identity API
    global.chrome = {
      identity: {
        getAuthToken: jest.fn(),
        clearAllCachedAuthTokens: jest.fn(callback => callback()),
        removeCachedAuthToken: jest.fn((details, callback) => callback()),
        getRedirectURL: jest.fn().mockReturnValue('https://example.com/redirect')
      },
      runtime: {
        lastError: null,
        getURL: jest.fn().mockImplementation(path => `chrome-extension://abcdef/${path}`),
        getManifest: jest.fn().mockReturnValue({
          oauth2: {
            client_id: 'fake-client-id'
          }
        })
      }
    };
    
    // Mock window.location
    delete window.location;
    window.location = { href: '' };
    
    // Mock fetch
    global.fetch = jest.fn();
    
    // Mock document.querySelector for the login container
    document.querySelector = jest.fn().mockReturnValue({
      classList: { add: jest.fn(), remove: jest.fn() },
      appendChild: jest.fn()
    });
  });
  
  describe('login', () => {
    it('should successfully log in when auth and user info succeed', async () => {
      // Mock successful token retrieval
      global.chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback('fake-token');
      });
      
      // Mock successful user info fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: '12345',
          email: 'test@example.com',
          name: 'Test User'
        })
      });
      
      const auth = new Auth();
      const result = await auth.login();
      
      // Verify token was requested with interaction
      expect(global.chrome.identity.getAuthToken).toHaveBeenCalledWith(
        { interactive: true },
        expect.any(Function)
      );
      
      // Verify user info was fetched with the token
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { 'Authorization': 'Bearer fake-token' } }
      );
      
      // Verify user info was saved
      expect(storageService.saveUserInfo).toHaveBeenCalledWith({
        id: '12345',
        email: 'test@example.com',
        name: 'Test User'
      });
      
      // Verify redirect to popup
      expect(window.location.href).toBe('chrome-extension://abcdef/pages/Popup/popup.html');
      expect(result).toBe(true);
    });
    
    it('should handle user cancellation during login', async () => {
      // Mock user cancellation
      global.chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        global.chrome.runtime.lastError = { message: 'The user canceled the sign-in flow.' };
        callback(null);
        global.chrome.runtime.lastError = null;
      });
      
      const auth = new Auth();
      const result = await auth.login();
      
      // Verify error is shown
      expect(document.querySelector).toHaveBeenCalledWith('.login-container');
      expect(uiUtils.showError).toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    it('should handle API errors during user info fetch', async () => {
      // Mock successful token retrieval but failed user info
      global.chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback('fake-token');
      });
      
      // Mock failed user info fetch
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      });
      
      const auth = new Auth();
      const result = await auth.login();
      
      // Verify token was removed
      expect(global.chrome.identity.removeCachedAuthToken).toHaveBeenCalledWith(
        { token: 'fake-token' },
        expect.any(Function)
      );
      
      // Verify error is shown
      expect(document.querySelector).toHaveBeenCalledWith('.login-container');
      expect(uiUtils.showError).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
  
  describe('isAuthenticated', () => {
    it('should return true when token and user info exist', async () => {
      // Mock existing user info
      storageService.getUserInfo.mockResolvedValueOnce({
        id: '12345',
        email: 'test@example.com'
      });
      
      // Mock valid token
      global.chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback('fake-token');
      });
      
      const result = await Auth.isAuthenticated();
      
      expect(result).toBe(true);
    });
    
    it('should return false when token cannot be obtained', async () => {
      // Mock no user info
      storageService.getUserInfo.mockResolvedValueOnce(null);
      
      // Mock no token
      global.chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback(null);
      });
      
      const result = await Auth.isAuthenticated();
      
      expect(result).toBe(false);
    });
    
    it('should clear user info when token is invalid but user info exists', async () => {
      // Mock existing user info
      storageService.getUserInfo.mockResolvedValueOnce({
        id: '12345',
        email: 'test@example.com'
      });
      
      // Mock invalid token
      global.chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        global.chrome.runtime.lastError = { message: 'OAuth2 not granted or revoked.' };
        callback(null);
        global.chrome.runtime.lastError = null;
      });
      
      const result = await Auth.isAuthenticated();
      
      expect(storageService.clearAuthData).toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    it('should fetch fresh user info when token exists but user info is missing', async () => {
      // Mock no existing user info
      storageService.getUserInfo.mockResolvedValueOnce(null);
      
      // Mock valid token
      global.chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback('fake-token');
      });
      
      // Mock successful user info fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: '12345',
          email: 'test@example.com'
        })
      });
      
      const result = await Auth.isAuthenticated();
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { 'Authorization': 'Bearer fake-token' } }
      );
      
      expect(storageService.saveUserInfo).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
  
  describe('logout', () => {
    it('should perform a complete logout process', async () => {
      // Mock successful token retrieval 
      global.chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback('fake-token');
      });
      
      // Mock successful token revocation with Google
      global.fetch.mockResolvedValueOnce({
        ok: true
      });
      
      const result = await Auth.logout();
      
      // Verify all steps were executed
      expect(global.chrome.identity.clearAllCachedAuthTokens).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://accounts.google.com/o/oauth2/revoke?token=fake-token',
        { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      expect(global.chrome.identity.removeCachedAuthToken).toHaveBeenCalledWith(
        { token: 'fake-token' },
        expect.any(Function)
      );
      expect(storageService.clearAuthData).toHaveBeenCalled();
      
      // Verify redirect to login page with clear param
      expect(window.location.href).toBe('chrome-extension://abcdef/pages/Login/login.html?clearAuth=true');
      expect(result).toBe(true);
    });
    
    it('should handle errors during logout gracefully', async () => {
      // Mock failed token retrieval
      global.chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        global.chrome.runtime.lastError = { message: 'Error getting token' };
        callback(null);
        global.chrome.runtime.lastError = null;
      });
      
      // Mock failure in clearAuthData
      storageService.clearAuthData.mockRejectedValueOnce(new Error('Storage error'));
      
      const result = await Auth.logout();
      
      // Verify redirect to login page happened anyway
      expect(window.location.href).toBe('chrome-extension://abcdef/pages/Login/login.html?clearAuth=true');
      expect(result).toBe(false);
    });
  });
}); 