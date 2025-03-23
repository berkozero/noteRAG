document.addEventListener('DOMContentLoaded', () => {
    const notesDiv = document.getElementById('notes');
  
    chrome.storage.local.get({ notes: [] }, (result) => {
      const notes = result.notes;
  
      if (notes.length === 0) {
        notesDiv.innerText = "No saved notes yet.";
        return;
      }
  
      notes.forEach(note => {
        const noteEl = document.createElement('div');
        noteEl.className = 'note';
        noteEl.innerHTML = `
          <p>${note.text}</p>
          <a href="${note.url}" target="_blank">${note.url}</a>
          <small>${note.date}</small>
          <hr/>
        `;
        notesDiv.appendChild(noteEl);
      });
    });
  });
  