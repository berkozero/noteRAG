/**
 * NoteRAG Admin Panel JavaScript
 * 
 * This file contains all functionality for the admin panel:
 * - Loading and displaying notes
 * - Searching notes 
 * - Deleting notes
 * - Updating stats
 */

// Main admin panel controller
const AdminPanel = {
    // State
    notes: [],
    
    // Initialize the admin panel
    init: async function() {
        console.log('Initializing admin panel...');
        document.getElementById('searchButton').addEventListener('click', this.searchNotes);
        document.getElementById('showAllButton').addEventListener('click', this.loadAllNotes);
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchNotes();
        });
        
        // Question answering event listeners
        document.getElementById('askButton').addEventListener('click', this.askQuestion);
        document.getElementById('questionInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.askQuestion();
        });
        
        // Initial load of all notes
        await this.loadAllNotes();
    },
    
    // Load all notes from the API
    loadAllNotes: async function() {
        try {
            const response = await fetch('/api/notes');
            if (!response.ok) throw new Error('Failed to fetch notes');
            
            AdminPanel.notes = await response.json();
            AdminPanel.displayNotes(AdminPanel.notes);
            AdminPanel.updateStats();
            document.getElementById('searchInput').value = '';
        } catch (error) {
            console.error('Error loading notes:', error);
            AdminPanel.showError('Failed to load notes. Please try again later.');
        }
    },
    
    // Search notes using the API
    searchNotes: async function() {
        const query = document.getElementById('searchInput').value;
        if (!query) return AdminPanel.loadAllNotes();
        
        try {
            const response = await fetch(`/api/notes/search?query=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Search failed');
            
            const results = await response.json();
            AdminPanel.displayNotes(results);
        } catch (error) {
            console.error('Error searching notes:', error);
            AdminPanel.showError('Search failed. Please try again.');
        }
    },
    
    // Delete a note via the API
    deleteNote: async function(noteId) {
        if (!confirm('Are you sure you want to delete this note?')) return;
        
        try {
            const response = await fetch(`/api/notes/${noteId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Failed to delete note');
            
            // Remove from DOM
            document.getElementById(`note_${noteId}`).remove();
            
            // Remove from local state
            AdminPanel.notes = AdminPanel.notes.filter(note => note.id !== noteId);
            
            // Update stats
            AdminPanel.updateStats();
            
            AdminPanel.showSuccess('Note deleted successfully');
        } catch (error) {
            console.error('Error deleting note:', error);
            AdminPanel.showError('Failed to delete note. Please try again.');
        }
    },
    
    // Display notes in the UI
    displayNotes: function(notes) {
        const notesDiv = document.getElementById('notes');
        
        if (notes.length === 0) {
            notesDiv.innerHTML = '<p class="no-notes">No notes found</p>';
            return;
        }
        
        notesDiv.innerHTML = notes.map(note => `
            <div class="note" id="note_${note.id}">
                <span class="delete" onclick="AdminPanel.deleteNote('${note.id}')">[Delete]</span>
                <h4>${note.title || 'Untitled'}</h4>
                <p>${note.text}</p>
                <small>
                    ID: ${note.id} | 
                    Timestamp: ${new Date(note.timestamp).toLocaleString()} 
                    ${note.score ? `| Relevance: ${(note.score * 100).toFixed(1)}%` : ''}
                </small>
            </div>
        `).join('');
    },
    
    // Ask a question about notes
    askQuestion: async function() {
        const question = document.getElementById('questionInput').value;
        if (!question) {
            AdminPanel.showError('Please enter a question');
            return;
        }
        
        const topK = document.getElementById('topKSelect').value;
        const answerContainer = document.getElementById('answerContainer');
        const answerDiv = document.getElementById('answer');
        const sourcesContainer = document.getElementById('sourcesContainer');
        
        // Clear previous results
        answerDiv.textContent = 'Thinking...';
        sourcesContainer.innerHTML = '';
        answerContainer.classList.remove('hidden');
        
        try {
            const response = await fetch(`/api/query?q=${encodeURIComponent(question)}&top_k=${topK}`);
            if (!response.ok) throw new Error('Query failed');
            
            const result = await response.json();
            
            // Display the answer
            answerDiv.textContent = result.answer;
            
            // Display source notes
            if (result.sources && result.sources.length > 0) {
                sourcesContainer.innerHTML = result.sources.map(source => `
                    <div class="source-note">
                        <h5>${source.title || 'Untitled'}</h5>
                        <p>${source.text}</p>
                        <small>
                            ID: ${source.id} | 
                            Relevance: ${(source.score * 100).toFixed(1)}%
                        </small>
                    </div>
                `).join('');
            } else {
                sourcesContainer.innerHTML = '<p>No source notes found</p>';
            }
        } catch (error) {
            console.error('Error asking question:', error);
            answerDiv.textContent = 'Failed to get an answer. Please try again.';
            AdminPanel.showError('Question answering failed. Please try again.');
        }
    },
    
    // Update statistics
    updateStats: function() {
        document.getElementById('noteCount').textContent = AdminPanel.notes.length;
    },
    
    // Show error message
    showError: function(message) {
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => notification.remove(), 3000);
    },
    
    // Show success message
    showSuccess: function(message) {
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => notification.remove(), 3000);
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => AdminPanel.init()); 