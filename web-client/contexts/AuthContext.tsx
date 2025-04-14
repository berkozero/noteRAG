'use client'; // Mark as a Client Component

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import * as api from '@/lib/api'; // Assuming api service is in lib

const TOKEN_STORAGE_KEY = 'noterag_auth_token'; // Consistent key

// Define the shape of the context data
interface AuthContextType {
  isAuthenticated: boolean;
  userEmail: string | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  // getToken: () => string | null; // Might not be needed if token is exposed
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define the props for the provider component
interface AuthProviderProps {
  children: ReactNode;
}

// Create the provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start loading initially

  // Function to set auth state consistently
  const setAuthState = useCallback((newToken: string | null, email: string | null) => {
    setToken(newToken);
    setUserEmail(email);
    try {
        if (newToken) {
            localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
            // TODO: Maybe store email too, or fetch on load?
        } else {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
    } catch (error) {
        console.warn("localStorage not available for token storage.");
    }
  }, []);

  // Initial check for token on component mount
  useEffect(() => {
    console.log('AuthProvider mounted, checking for token...');
    try {
        const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (storedToken) {
            console.log('Token found in localStorage, attempting to fetch user info...');
            // TODO: Verify token by fetching user info? Or decode locally?
            // For now, assume token is valid if present and fetch user info
            // Ideally, you'd verify token expiry / call a validation endpoint
            const fetchUserInfo = async () => {
                try {
                    // Temporarily set token to allow apiCall
                    setToken(storedToken); // Need to set this temporarily for apiCall
                    const userInfo = await api.getUserInfo(); // Requires token
                    console.log('User info fetched successfully:', userInfo);
                    // Set final state only if token is valid
                    setAuthState(storedToken, userInfo.email); 
                } catch (error) {
                    console.error('Token verification failed (getUserInfo): ', error);
                    setAuthState(null, null); // Clear invalid token
                } finally {
                     setIsLoading(false);
                }
            };
            fetchUserInfo();
        } else {
            console.log('No token found in localStorage.');
            setAuthState(null, null); // Ensure state is clear if no token
            setIsLoading(false);
        }
    } catch (error) {
         console.warn("localStorage not available during initial check.");
         setAuthState(null, null); // Ensure state is clear
         setIsLoading(false);
    }
  }, [setAuthState]); // Add setAuthState dependency

  const login = useCallback(async (email: string, password: string) => {
    console.log('AuthContext login called for:', email);
    try {
      const data = await api.login(email, password);
      console.log('Login API success:', data);
      if (data.access_token) {
        setAuthState(data.access_token, data.user_email); // Update state and store token
      } else {
          // Should not happen if api.login throws error, but belt-and-suspenders
          throw new Error('Login successful but no token received.');
      }
    } catch (error) {
      console.error('AuthContext login error:', error);
      setAuthState(null, null); // Clear any potentially stale state on error
      // Re-throw error so the login page can display it
      throw error; 
    }
  }, [setAuthState]);

  const logout = useCallback(() => {
    console.log('AuthContext logout called');
    setAuthState(null, null); // Clear state and remove token
    // Optionally, redirect or notify other parts of the app
  }, [setAuthState]);

  const value = {
    isAuthenticated: !!token,
    userEmail,
    token,
    isLoading,
    login,
    logout,
  };

  // Don't render children until loading is complete to prevent flashes
  // or components trying to use auth state too early
  return (
    <AuthContext.Provider value={value}>
      {!isLoading ? children : null} 
    </AuthContext.Provider>
  );
};

// Create a custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 