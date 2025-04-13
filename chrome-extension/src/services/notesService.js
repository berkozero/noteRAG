import axios from 'axios';

// TODO: Use a better way to configure this for the extension
const API_URL = 'https://localhost:3443'; 

class NotesService {
    // IMPORTANT: This class now expects the TOKEN to be PASSED IN
    // We need to adapt the calling code (in popup.js) to get the token 
    // from background.js first, then pass it to these methods.

    async getNotes(token) {
        if (!token) {
            throw new Error('Authentication token is required');
        }
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            const response = await axios.get(`${API_URL}/api/notes`, { headers });
            return response.data;
        } catch (error) {
            console.error('Error fetching notes:', error);
            throw error; // Re-throw for components to handle
        }
    }

    async addNote(token, title, text) {
        console.log("[notesService] addNote called (using fetch)"); // Add log
        if (!token) {
            throw new Error('Authentication token is required');
        }
        try {
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' // Important for fetch POST
            };
            const payload = { title: title || 'Untitled Note', text: text || '' }; 
            
            console.log(`[notesService] Fetching ${API_URL}/api/notes with payload:`, payload); // Add log
            
            const response = await fetch(`${API_URL}/api/notes`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });
            
            console.log(`[notesService] Fetch response status: ${response.status}`); // Add log

            if (!response.ok) {
                // Attempt to parse error response from server
                let errorData;
                try {
                    errorData = await response.json();
                    console.log("[notesService] Fetch error data:", errorData); // Add log
                } catch (parseError) {
                     console.log("[notesService] Failed to parse error response as JSON.");
                    // If response isn't JSON, throw generic error
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                // Throw a more informative error
                const error = new Error(errorData?.detail || `HTTP error! status: ${response.status}`);
                error.response = { status: response.status, data: errorData }; // Mimic axios error structure slightly
                throw error;
            }
            
            const responseData = await response.json(); // Returns the created note with ID
            console.log("[notesService] Fetch success data:", responseData); // Add log
            return responseData; 
            
        } catch (error) {
            // Log errors from fetch itself (e.g., network issues) or thrown above
            console.error('[notesService] Error adding note (fetch):', error);
            throw error;
        }
    }

    async deleteNote(token, noteId) {
        if (!token) {
            throw new Error('Authentication token is required');
        }
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            await axios.delete(`${API_URL}/api/notes/${noteId}`, { headers });
            return true; // Indicate success
        } catch (error) {
            console.error('Error deleting note:', error);
            throw error;
        }
    }

    async searchNotes(token, query, limit = 10) {
        if (!token) {
            throw new Error('Authentication token is required');
        }
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            const response = await axios.get(`${API_URL}/api/search`, {
                headers,
                params: { q: query, limit }
            });
            return response.data; // Expecting a list of notes
        } catch (error) {
            console.error('Error searching notes:', error);
            throw error;
        }
    }

    async queryNotes(token, question, top_k = 3) {
        if (!token) {
            throw new Error('Authentication token is required');
        }
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            const response = await axios.get(`${API_URL}/api/query`, {
                headers,
                params: { q: question, top_k }
            });
            return response.data; // Expecting { answer: "...", sources: [...] }
        } catch (error) {
            console.error('Error querying notes:', error);
            throw error;
        }
    }

    // --- Authentication Methods (Token retrieval logic removed) ---
    // These now need the token passed to them.
    // We also need login/register functions that DON'T require a token initially.

    async login(username, password) {
        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await axios.post(`${API_URL}/token`, formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            // Returns { access_token: "...", token_type: "bearer" }
            return response.data; 
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }
    
    async register(email, password) {
        try {
            const payload = { email, password };
            const response = await axios.post(`${API_URL}/api/register`, payload);
            // Returns { access_token: "...", token_type: "bearer" } on success
            return response.data;
        } catch (error) {
             console.error('Registration failed:', error);
            // Consider parsing error response for specific messages (e.g., user exists)
            throw error;
        }
    }
}

export const notesService = new NotesService();
export default notesService; 