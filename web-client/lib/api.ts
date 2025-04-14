// web-client/lib/api.ts
import { Note } from '@/types/note'; // Assuming Note type is defined here

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Helper function to get the auth token (implement retrieval logic)
const getAuthToken = (): string | null => {
  // TODO: Implement actual token retrieval, e.g., from localStorage or AuthContext
  // For now, returning null or a placeholder if needed for testing
  try {
      return localStorage.getItem('noterag_auth_token');
  } catch (error) { 
      // Handle localStorage not being available (e.g., SSR)
      console.warn("localStorage not available for token retrieval.");
      return null;
  } 
};

// Base API call utility
const apiCall = async <T>(endpoint: string, method: string = 'GET', body: any = null, requiresAuth: boolean = true): Promise<T> => {
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };
  const options: RequestInit = {
    method,
    headers,
  };

  if (requiresAuth) {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token is missing.');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`API Call: ${method} ${url}`); // Debug log

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      let errorData;
      try {
          errorData = await response.json(); // Try to parse backend error details
          console.error(`API Error ${response.status}:`, errorData);
      } catch (e) {
          // If parsing JSON fails, use status text
          errorData = { detail: response.statusText || `HTTP error! status: ${response.status}` };
          console.error(`API Error ${response.status}:`, response.statusText);
      }
      throw new Error(errorData?.detail || `HTTP error! status: ${response.status}`);
    }

    // Handle cases with no content (e.g., 204 No Content for DELETE)
    if (response.status === 204) {
        return null as T; // Or appropriate type
    }

    return await response.json() as T;
  } catch (error) {
    console.error(`Network or API call error for ${method} ${url}:`, error);
    // Re-throw the error to be handled by the caller
    throw error;
  }
};

// --- Service Functions ---

// Auth
export const login = async (email: string, password: string): Promise<{ access_token: string; token_type: string; user_email: string }> => {
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const body = new URLSearchParams({
    username: email, // FastAPI's OAuth2PasswordRequestForm uses 'username'
    password: password,
  });

  const url = `${API_BASE_URL}/token`;
  console.log(`API Call: POST ${url} (Form Data)`); // Debug log

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: body,
    });

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
            console.error(`Login API Error ${response.status}:`, errorData);
        } catch (e) { 
            errorData = { detail: response.statusText || `HTTP error! status: ${response.status}` };
            console.error(`Login API Error ${response.status}:`, response.statusText);
        }
        throw new Error(errorData?.detail || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Network or API call error for POST ${url}:`, error);
    throw error;
  }
};

// Register
export const register = async (email: string, password: string): Promise<{ access_token: string; token_type: string; user_email: string }> => {
  // Registration expects JSON body
  return apiCall<{ access_token: string; token_type: string; user_email: string }>( 
      '/api/register',
      'POST',
      { email, password }, 
      false // Registration doesn't require auth
  );
};

export const getUserInfo = async (): Promise<{ email: string }> => {
  return apiCall<{ email: string }>('/api/user/me');
};

// Notes
export const getNotes = async (): Promise<Note[]> => {
  return apiCall<Note[]>('/api/notes');
};

export const addNote = async (noteData: { title?: string; text: string }): Promise<Note> => {
  return apiCall<Note>('/api/notes', 'POST', noteData);
};

export const deleteNote = async (noteId: string): Promise<void> => {
  // Expecting 204 No Content, apiCall handles this
  await apiCall<null>(`/api/notes/${noteId}`, 'DELETE');
};

// Query
export const queryNotes = async (query: string, top_k: number = 3): Promise<{ response: string; source_nodes: any[] }> => {
  const params = new URLSearchParams({
    q: query,
    top_k: top_k.toString(),
  });
  return apiCall<{ response: string; source_nodes: any[] }>(`/api/query?${params.toString()}`, 'GET');
};

// Search (Optional - if endpoint is kept)
// export const searchNotes = async (query: string, limit: number = 10): Promise<Note[]> => {
//   const params = new URLSearchParams({
//     q: query,
//     limit: limit.toString(),
//   });
//   return apiCall<Note[]>(`/api/search?${params.toString()}`, 'GET');
// };

// Change Password
export const changePassword = async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
  // This endpoint requires authentication
  return apiCall<{ message: string }>(
    '/api/users/me/password',
    'PUT',
    { current_password: currentPassword, new_password: newPassword },
    true // Requires auth
  );
}; 