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
        if (!token) {
            throw new Error('Authentication token is required');
        }
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            // Ensure text is provided, default title if empty
            const payload = { title: title || 'Untitled Note', text: text || '' }; 
            const response = await axios.post(`${API_URL}/api/notes`, payload, { headers });
            return response.data; // Returns the created note with ID
        } catch (error) {
            console.error('Error adding note:', error);
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