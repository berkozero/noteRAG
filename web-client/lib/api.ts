// web-client/lib/api.ts
import { Note } from '@/types/note'; // Assuming Note type is defined here

// Read the API base URL from environment variable, fallback for local dev
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://localhost:3443';

console.log(`[api.ts] Using API_BASE: ${API_BASE}`); // Debug log

// Helper function to get the auth token from localStorage
const getAuthToken = (): string | null => {
  try {
      // Check if running in browser environment before accessing localStorage
      if (typeof window !== 'undefined') {
          return localStorage.getItem('noterag_auth_token');
      }
      return null;
  } catch (error) { 
      // Handle localStorage potentially not being available
      console.warn("localStorage not available for token retrieval.");
      return null;
  } 
};

// Helper function for making API calls
const apiCall = async <T>(endpoint: string, method: string = 'GET', body: any = null, requiresAuth: boolean = true): Promise<T> => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  const options: RequestInit = {
    method,
    headers,
  };

  if (requiresAuth) {
    const token = getAuthToken(); // Use the helper defined above
    if (!token) {
      console.error('API call requires auth, but no token found.');
      // Handle redirect to login or throw specific error
      throw new Error('Authentication required.'); 
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
      // If body is FormData, don't set Content-Type header (browser sets it with boundary)
      if (body instanceof FormData) {
         delete headers['Content-Type']; 
         options.body = body;
      } else {
         options.body = JSON.stringify(body);
      }
  }

  // Construct the full URL
  const url = `${API_BASE}${endpoint}`;
  console.debug(`[apiCall] ${method} ${url}`); // Log the request

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      let errorData: any = { detail: `HTTP error! status: ${response.status}` };
      try {
        // Try to parse JSON error detail from backend
        errorData = await response.json();
        console.error(`API Error ${response.status} (${endpoint}):`, errorData);
      } catch (e) {
        // If response is not JSON, use status text
        errorData = { detail: response.statusText || `HTTP error! status: ${response.status}` };
        console.error(`API Error ${response.status} (${endpoint}):`, response.statusText);
      }
      // Throw an error with the detail message from backend or status text
      throw new Error(errorData?.detail || `HTTP error! status: ${response.status}`);
    }

    // Handle cases with no content
    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
        return {} as T; // Or null, depending on expected behavior
    }

    // Assuming successful responses are JSON
    return await response.json() as T;
  } catch (error) {
    console.error(`Network or other error during API call to ${endpoint}:`, error);
    // Re-throw the error to be caught by the calling function
    throw error;
  }
};

// --- Specific API Functions --- 

// Login (doesn't require auth)
export const login = async (email: string, password: string): Promise<{ access_token: string; token_type: string; user_email: string }> => {
  // Login endpoint expects form data, not JSON
  const formData = new FormData();
  formData.append('username', email); // FastAPI OAuth2PasswordRequestForm expects 'username'
  formData.append('password', password);
  
  return apiCall<{ access_token: string; token_type: string; user_email: string }>( 
      '/token', // Endpoint for FastAPI token route
      'POST',
      formData,
      false // Login doesn't require prior auth
  );
};

// Register
export const register = async (email: string, password: string): Promise<{ access_token: string; token_type: string; user_email: string }> => {
  return apiCall<{ access_token: string; token_type: string; user_email: string }>( 
      '/api/register',
      'POST',
      { email, password }, 
      false // Registration doesn't require auth
  );
};

export const getUserInfo = async (): Promise<{ email: string }> => {
  return apiCall<{ email: string }>('/api/users/me', 'GET', null, true);
};

// Notes
export const getNotes = async (): Promise<any[]> => { // Replace any with Note type if defined
  return apiCall<any[]>('/api/notes', 'GET', null, true);
};

export const addNote = async (noteData: { title?: string; text: string }): Promise<any> => {
  return apiCall<any>('/api/notes', 'POST', noteData, true);
};

export const deleteNote = async (noteId: string): Promise<void> => {
  await apiCall<void>(`/api/notes/${noteId}`, 'DELETE', null, true);
};

// Query
export const queryNotes = async (query: string): Promise<{ response: string; source_nodes: any[] }> => {
  return apiCall<{ response: string; source_nodes: any[] }>('/api/query', 'POST', { query }, true);
};

// Change Password
export const changePassword = async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
  return apiCall<{ message: string }>(
    '/api/users/me/password',
    'PUT',
    { current_password: currentPassword, new_password: newPassword },
    true
  );
}; 