import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://localhost:3443';

class NotesService {
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
            const payload = { title: title || 'Untitled Note', text };
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
}

export const notesService = new NotesService();
export default notesService; 