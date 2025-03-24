import { Auth } from '../../services/auth/auth.js';

async function checkAuth() {
    const result = await chrome.storage.local.get(['userInfo']);
    if (!result.userInfo) {
        window.location.href = '../Login/Login.html';
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const result = await chrome.storage.local.get(['userInfo', 'notes']);
    if (!result.userInfo) {
        window.location.href = '../Login/Login.html';
        return;
    }

    // Display user info
    const userInfo = result.userInfo;
    document.getElementById('userAvatar').src = userInfo.picture || 'default-avatar.png';
    document.getElementById('userName').textContent = userInfo.name || 'User';
    document.getElementById('userEmail').textContent = userInfo.email || '';

    // Setup logout button with confirmation
    document.getElementById('logoutButton').addEventListener('click', async () => {
        if (confirm('Are you sure you want to logout?')) {
            await Auth.logout();
            window.location.href = '../Login/Login.html';
        }
    });

    const notesContainer = document.getElementById('notesContainer');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');

    // Display notes
    function displayNotes(notes = []) {
        if (notes.length === 0) {
            emptyState.style.display = 'block';
            notesContainer.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        notesContainer.style.display = 'block';
        notesContainer.innerHTML = notes.map(note => `
            <div class="note-card">
                <div class="note-content">
                    <p class="note-text">${note.text}</p>
                    <div class="note-meta">
                        <a href="${note.url}" target="_blank" class="note-source">${note.title}</a>
                        <span class="note-date">${new Date(note.timestamp).toLocaleDateString()}</span>
                    </div>
                </div>
                <button class="delete-note" data-id="${note.id}">×</button>
            </div>
        `).join('');

        // Add delete handlers
        document.querySelectorAll('.delete-note').forEach(button => {
            button.addEventListener('click', async (e) => {
                const noteId = parseInt(e.target.dataset.id);
                if (confirm('Delete this note?')) {
                    const result = await chrome.storage.local.get(['notes']);
                    const notes = result.notes.filter(note => note.id !== noteId);
                    await chrome.storage.local.set({ notes });
                    displayNotes(notes);
                }
            });
        });
    }

    // Initialize notes display
    displayNotes(result.notes || []);

    // Setup search
    searchInput.addEventListener('input', async (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const result = await chrome.storage.local.get(['notes']);
        const filteredNotes = result.notes?.filter(note => 
            note.text.toLowerCase().includes(searchTerm) ||
            note.title.toLowerCase().includes(searchTerm)
        ) || [];
        displayNotes(filteredNotes);
    });
});
  