import React from 'react';

/**
 * Note Component
 * 
 * Displays a single note with title, text, URL, and delete button
 */
const Note = ({ note, onDelete }) => {
  // Format timestamp to a readable date
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Handle click on note URL
  const handleUrlClick = (e) => {
    e.stopPropagation(); // Prevent note click
    // Open the URL in a new tab
    chrome.tabs.create({ url: note.url });
  };
  
  return (
    <div className="note">
      <div className="note-header">
        <h3 className="note-title">{note.title}</h3>
        <button 
          className="delete-button" 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
        >
          &times;
        </button>
      </div>
      
      <div className="note-content">
        <p className="note-text">{note.text}</p>
      </div>
      
      <div className="note-footer">
        <a 
          href="#" 
          className="note-url" 
          onClick={handleUrlClick}
          title={note.url}
        >
          {note.url}
        </a>
        <div className="note-timestamp">{formatDate(note.timestamp)}</div>
      </div>
    </div>
  );
};

export default Note; 