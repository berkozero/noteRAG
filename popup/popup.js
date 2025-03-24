async function checkAuth() {
    const result = await chrome.storage.local.get(['userInfo']);
    if (!result.userInfo) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!await checkAuth()) return;
    
    const notesContainer = document.getElementById('notesContainer');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');

    function createNoteElement(note) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note';
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.textContent = '×';
        deleteButton.onclick = async () => {
            const result = await chrome.storage.local.get(['notes']);
            const notes = result.notes.filter(n => n.date !== note.date);
            await chrome.storage.local.set({ notes });
            loadNotes(); // Refresh the notes list
        };

        noteDiv.innerHTML = `
            <div class="note-content">
                <p class="note-text">${escapeHtml(note.text)}</p>
                <div class="note-meta">
                    <a href="${escapeHtml(note.url)}" target="_blank" class="note-link">
                        ${escapeHtml(note.title)}
                    </a>
                    <span class="note-date">${new Date(note.date).toLocaleString()}</span>
                </div>
            </div>
        `;
        
        noteDiv.insertBefore(deleteButton, noteDiv.firstChild);
        return noteDiv;
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async function loadNotes(searchQuery = '') {
        try {
            const result = await chrome.storage.local.get(['notes']);
            let notes = result.notes || [];

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                notes = notes.filter(note => 
                    note.text.toLowerCase().includes(query) ||
                    note.title.toLowerCase().includes(query)
                );
            }

            if (notes.length === 0) {
                emptyState.style.display = 'block';
                notesContainer.innerHTML = '';
                return;
            }

            emptyState.style.display = 'none';
            notesContainer.innerHTML = '';

            // Sort notes by date (newest first)
            notes.sort((a, b) => new Date(b.date) - new Date(a.date));

            notes.forEach(note => {
                const noteElement = createNoteElement(note);
                notesContainer.appendChild(noteElement);
            });
        } catch (error) {
            console.error('Error loading notes:', error);
            notesContainer.innerHTML = '<p style="color: red; text-align: center;">Error loading notes</p>';
        }
    }

    // Set up search functionality
    searchInput.addEventListener('input', (e) => {
        loadNotes(e.target.value);
    });

    // Load notes when popup opens
    await loadNotes();

    // Add logout button to your HTML
    const logoutButton = document.createElement('button');
    logoutButton.textContent = 'Logout';
    logoutButton.className = 'logout-button';
    logoutButton.onclick = () => Auth.logout();
    document.querySelector('.container').appendChild(logoutButton);
});
  