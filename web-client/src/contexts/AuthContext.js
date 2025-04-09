import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

// Create the Auth Context
const AuthContext = createContext(null);

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => authService.getUserInfo()); // Initialize from service cache
  const [token, setToken] = useState(() => authService.getToken());   // Initialize from service cache
  const [loading, setLoading] = useState(false); // Start as false, only true during operations
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  // Helper to update auth state
  const updateAuthState = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setError(null);
  };

  // Clear auth state
  const clearAuthState = () => {
    setUser(null);
    setToken(null);
    setError(null);
  };

  // Initialize auth state on component mount from stored data
  useEffect(() => {
    const checkStoredAuth = async () => {
        setLoading(true); // Briefly set loading while checking
        try {
            const loaded = await authService.loadStoredAuth(); // Service now handles loading on init, this is redundant but safe
            if (loaded && loaded.token && loaded.user) {
                // Optional: Could add token verification here if/when /api/verify exists
                // For now, trust the loaded token if it exists
                updateAuthState(loaded.user, loaded.token);
                console.log('Auth state initialized from storage.');
            } else {
                clearAuthState(); // Ensure clean state if nothing valid loaded
            }
        } catch (err) {
             console.error('Error checking stored auth:', err);
             await authService.clearAuth(); // Clear potentially corrupted storage
             clearAuthState();
        } finally {
            setLoading(false);
        }
    };
    // Only run check if user is not already set (avoids re-check after login/register)
    if (!user) {
        checkStoredAuth();
    }
  }, [user]); // Rerun if user logs out (user becomes null)

  // Login with Google
  const loginWithGoogle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.loginWithGoogle();
      if (result.success) {
        updateAuthState(result.user, result.token);
        navigate('/notes');
        return true;
      } else {
        setError(result.error || 'Google login failed');
        return false;
      }
    } catch (err) {
      console.error('Google Login error in context:', err);
      setError(err.message || 'An error occurred during Google login');
      return false;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Login with Email
  const loginWithEmail = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.loginWithEmail(email, password);
      if (result.success) {
        updateAuthState(result.user, result.token);
        navigate('/notes');
        return true;
      } else {
        setError(result.error || 'Email/Password login failed');
        return false;
      }
    } catch (err) {
      console.error('Email Login error in context:', err);
      setError(err.message || 'An error occurred during email login');
      return false;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Register with Email
  const registerWithEmail = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.registerWithEmail(email, password);
      if (result.success) {
        updateAuthState(result.user, result.token);
        navigate('/notes'); // Navigate to notes page after successful registration
        return true;
      } else {
        setError(result.error || 'Email/Password registration failed');
        return false;
      }
    } catch (err) {
      console.error('Email Registration error in context:', err);
      setError(err.message || 'An error occurred during email registration');
      return false;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Logout function
  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.logout();
      clearAuthState();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
      setError(err.message || 'An error occurred during logout');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Value to be provided to consumers
  const value = useMemo(() => ({
    user,
    token,
    loading,
    error,
    isAuthenticated: !!token,
    getToken: () => token,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout
  }), [user, token, loading, error, loginWithGoogle, loginWithEmail, registerWithEmail, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 