import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { notesService } from './services/notesService';

// Basic Styling (can be replaced with a UI library later)
const styles = {
  container: { padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' },
  input: { padding: '8px', width: 'calc(100% - 18px)' }, // Adjust width for padding/border
  button: { padding: '10px 15px', cursor: 'pointer' },
  error: { color: 'red', fontSize: '0.9em' },
  loading: { textAlign: 'center', padding: '20px' }, 
  loggedInArea: { display: 'flex', flexDirection: 'column', gap: '15px' }
};

// --- Login Component --- 
const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // 1. Call the login service
      const data = await notesService.login(email, password);
      
      if (data && data.access_token) {
        // 2. Send token to background script for storage
        chrome.runtime.sendMessage(
          { action: "setToken", token: data.access_token },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error setting token:', chrome.runtime.lastError);
              setError('Failed to store login session.');
              setIsLoading(false);
            } else if (response && response.success) {
              console.log('Token stored, calling onLoginSuccess');
              onLoginSuccess(data.access_token); // Notify parent component
            } else {
              setError('Failed to store login session.');
              setIsLoading(false);
            }
          }
        );
      } else {
        setError('Login failed: No token received.');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || 'Login failed. Please check credentials.');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} style={styles.container}>
      <h2>Login to NoteRAG</h2>
      <input 
        type="email" 
        placeholder="Email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
        required 
        style={styles.input}
      />
      <input 
        type="password" 
        placeholder="Password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
        required 
        style={styles.input}
      />
      {error && <p style={styles.error}>{error}</p>}
      <button type="submit" disabled={isLoading} style={styles.button}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
      {/* Add Register button/link later if needed */}
    </form>
  );
};

// --- Main Logged-In View --- 
const MainView = ({ token, onLogout }) => {
  const [notes, setNotes] = useState([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [errorNotes, setErrorNotes] = useState('');
  
  // State for adding a new note
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // State for Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null means search hasn't run yet
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // State for AI Ask
  const [askQuery, setAskQuery] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState('');

  // Combined input state
  const [combinedInput, setCombinedInput] = useState('');

  // Display mode ('notes', 'search', 'conversation')
  // Search results take priority over conversation, notes are default
  const displayMode = searchResults !== null ? 'search' : conversation.length > 0 ? 'conversation' : 'notes';

  // --- Fetching Notes --- 
  const fetchNotes = useCallback(async () => {
    if (!token) {
      setErrorNotes('Not authenticated.'); setIsLoadingNotes(false); setNotes([]); return;
    }
    setIsLoadingNotes(true); setErrorNotes('');
    try {
      const fetchedNotes = await notesService.getNotes(token);
      fetchedNotes.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); 
      setNotes(fetchedNotes);
    } catch (err) {
      console.error('Error fetching notes:', err); setErrorNotes('Failed to load notes.'); setNotes([]);
    } finally { setIsLoadingNotes(false); }
  }, [token]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // --- Logout --- 
  const handleLogout = () => {
     chrome.runtime.sendMessage({ action: "setToken", token: null }, (response) => {
        if (chrome.runtime.lastError) console.error('Error clearing token:', chrome.runtime.lastError);
        else if (response && response.success) onLogout(); 
        else console.error('Logout message passing failed');
     });
   };
   
  // --- Add Note --- 
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) { setAddError('Note text cannot be empty.'); return; }
    setIsAdding(true); setAddError('');
    try {
      await notesService.addNote(token, newNoteTitle, newNoteText);
      setNewNoteTitle(''); setNewNoteText('');
      await fetchNotes(); 
      // If currently showing search/conversation, maybe switch back to notes?
      // clearSearch(); clearConversation(); 
    } catch (err) { 
        console.error("Add note error:", err); setAddError(err.response?.data?.detail || 'Failed to add note.');
    } finally { setIsAdding(false); }
  };
  
  // --- Delete Note --- 
  const handleDeleteNote = async (noteId) => {
    try {
        await notesService.deleteNote(token, noteId);
        await fetchNotes(); 
        // If deleting a note shown in search results, refresh search?
        if (searchResults) { handleSearch(searchQuery); } // Re-run search
    } catch(err) {
        console.error("Delete note error:", err); setErrorNotes('Failed to delete note.');
    }
  };

  // --- Search Notes ---
  const handleSearch = async (query) => {
      if (!query.trim()) {
          setSearchResults(null); // Clear results if query is empty
          return;
      }
      setIsSearching(true); setSearchError(''); setConversation([]); // Clear conversation when searching
      setSearchQuery(query); // Store the query that was run
      try {
          const results = await notesService.searchNotes(token, query.trim());
          setSearchResults(results);
      } catch (err) {
          console.error('Search error:', err);
          setSearchError('Failed to search notes.');
          setSearchResults([]); // Show empty results on error maybe?
      } finally {
          setIsSearching(false);
      }
  };
  
  const handleSearchSubmit = (e) => {
      e.preventDefault();
      handleSearch(combinedInput);
  };

  const clearSearch = () => {
      setSearchResults(null);
      setSearchQuery('');
      setSearchError('');
      // setCombinedInput(''); // Optionally clear input
  };
  
  // --- Ask AI --- 
  const handleAsk = async (question) => {
       if (!question.trim()) return;
       
       setIsAsking(true); setAskError(''); setSearchResults(null); // Clear search results
       const userMessage = { type: 'user', text: question.trim() };
       setConversation(prev => [...prev, userMessage]);
       // setCombinedInput(''); // Clear input after asking
       
       try {
            const response = await notesService.queryNotes(token, question.trim());
            const aiMessage = { type: 'ai', text: response.answer, sources: response.sources };
            setConversation(prev => [...prev, aiMessage]);
        } catch (err) {
            console.error('Ask AI error:', err);
            setAskError('Failed to get answer.');
            const errorMessage = { type: 'ai', text: 'Sorry, I encountered an error.' };
            setConversation(prev => [...prev, errorMessage]);
        } finally {
            setIsAsking(false);
        }
  };
  
  const handleAskSubmit = (e) => {
      e.preventDefault();
      handleAsk(combinedInput);
  };

  const clearConversation = () => {
      setConversation([]);
      setAskError('');
      // setCombinedInput(''); // Optionally clear input
  };

   
   // --- Note Item Component --- 
   const NoteItem = ({ note, isSearchResult = false }) => (
     <div style={{ border: '1px solid #eee', padding: '5px 10px', marginBottom: '5px', fontSize: '0.9em', position: 'relative' }}>
        <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{note.title || 'Untitled Note'}</p>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.text}</p>
        {isSearchResult && note.score && (
             <span style={{ fontSize: '0.8em', color: '#555', marginLeft: '5px' }}>(Score: {(note.score * 100).toFixed(1)}%)</span>
        )}
        <button 
          onClick={() => handleDeleteNote(note.id)} 
          style={{ 
            position: 'absolute', top: '5px', right: '5px', background: '#fdd', border: '1px solid red',
            color: 'red', cursor: 'pointer', fontSize: '0.7em', padding: '1px 3px'
          }}
          title="Delete Note"
        >X</button>
     </div>
   );
   
   // --- Conversation Item Component --- 
   const ConversationItem = ({ item }) => (
      <div style={{
          marginBottom: '10px', 
          padding: '8px 12px', 
          borderRadius: '15px', 
          backgroundColor: item.type === 'user' ? '#e0f7fa' : '#f1f1f1', 
          alignSelf: item.type === 'user' ? 'flex-end' : 'flex-start',
          maxWidth: '80%',
          border: item.type === 'user' ? '1px solid #00bcd4' : '1px solid #ccc'
      }}>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.text}</p>
        {item.type === 'ai' && item.sources && item.sources.length > 0 && (
            <div style={{ marginTop: '5px', fontSize: '0.8em', borderTop: '1px dashed #ccc', paddingTop: '5px' }}>
                <strong>Sources:</strong>
                <ul style={{ margin: '2px 0 0 15px', padding: 0 }}>
                    {item.sources.map((source, index) => (
                        <li key={source.id || index} title={source.text}>{(source.title || `Note ${source.id?.substring(0,6)}...`)}</li>
                    ))}
                </ul>
            </div>
        )}
      </div>
   );

  // --- Main Render --- 
  return (
    <div style={{...styles.loggedInArea, overflowY: 'auto', flexGrow: 1, padding: '15px', display: 'flex', flexDirection: 'column' }}> 
      {/* Header */} 
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #eee', marginBottom: '15px', flexShrink: 0 }}>
        <h2 style={{ margin: 0 }}>NoteRAG</h2>
        <button onClick={handleLogout} style={{...styles.button, padding: '5px 10px' }}>Logout</button>
      </div>
      
       {/* Add Note Form */} 
      <form onSubmit={handleAddNote} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px dashed #ccc', flexShrink: 0 }}>
        <h3 style={{marginTop: 0, marginBottom: '5px'}}>Add New Note</h3>
         <input 
            type="text"
            placeholder="Title (optional)"
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            style={{...styles.input, marginBottom: '5px'}}
            disabled={isAdding}
        />
        <textarea
            placeholder="Note text..."
            rows={3}
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            required
            style={{...styles.input, width: 'calc(100% - 18px)', resize: 'vertical'}}
            disabled={isAdding}
        />
        {addError && <p style={styles.error}>{addError}</p>}
        <button type="submit" disabled={isAdding} style={{...styles.button, marginTop: '5px' }}>
           {isAdding ? 'Adding...' : 'Save Note'}
        </button>
      </form>
      
      {/* Main Display Area (Notes / Search / Conversation) */} 
      <div style={{ flexGrow: 1, overflowY: 'auto', marginBottom: '15px' }}> {/* Allow this area to scroll */} 
          {displayMode === 'search' && (
              <div>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                    <h3 style={{ marginTop: 0, marginBottom: 0 }}>Search Results for "{searchQuery}"</h3>
                    <button onClick={clearSearch} style={{...styles.button, padding: '3px 8px', fontSize: '0.8em'}}>Clear</button>
                  </div>
                  {isSearching ? (
                      <p>Searching...</p>
                   ) : searchError ? (
                      <p style={styles.error}>{searchError}</p>
                   ) : searchResults.length === 0 ? (
                      <p>No results found.</p>
                   ) : (
                      searchResults.map(note => <NoteItem key={note.id} note={note} isSearchResult={true} />)
                   )}
              </div>
          )}
          
          {displayMode === 'conversation' && (
             <div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                    <h3 style={{ marginTop: 0, marginBottom: 0 }}>Conversation</h3>
                    <button onClick={clearConversation} style={{...styles.button, padding: '3px 8px', fontSize: '0.8em'}}>Clear</button>
                 </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {conversation.map((item, index) => <ConversationItem key={index} item={item} />)}
                    {isAsking && <ConversationItem item={{ type: 'ai', text: 'Thinking...' }} />}
                    {askError && <p style={styles.error}>{askError}</p>}
                </div>
             </div>
          )}

          {displayMode === 'notes' && (
              <div>
                  <h3 style={{ marginTop: 0, marginBottom: '10px'}}>My Notes</h3>
                  {isLoadingNotes ? (
                      <p>Loading notes...</p>
                  ) : errorNotes ? (
                      <p style={styles.error}>{errorNotes}</p>
                  ) : notes.length === 0 ? (
                      <p>No notes found.</p>
                  ) : (
                      notes.map(note => <NoteItem key={note.id} note={note} />)
                  )}
               </div>
          )}
      </div>

      {/* Combined Search / Query Input Area */} 
      <div style={{ borderTop: '1px solid #ccc', paddingTop: '15px', flexShrink: 0 }}>
          <textarea
            placeholder="Search notes or ask a question..."
            rows={2}
            value={combinedInput}
            onChange={(e) => setCombinedInput(e.target.value)}
            style={{...styles.input, width: 'calc(100% - 18px)', resize: 'vertical', marginBottom: '5px'}}
            disabled={isSearching || isAsking}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
             <button onClick={handleSearchSubmit} disabled={isSearching || isAsking || !combinedInput.trim()} style={{...styles.button, flexGrow: 1 }}>
                {isSearching ? 'Searching...' : 'Search Notes'}
             </button>
             <button onClick={handleAskSubmit} disabled={isSearching || isAsking || !combinedInput.trim()} style={{...styles.button, flexGrow: 1 }}>
                 {isAsking ? 'Asking...' : 'Ask AI'}
             </button>
          </div>
      </div>
      
    </div>
  );
};

// --- Popup Main Component --- 
const Popup = () => {
  const [currentToken, setCurrentToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on load
  useEffect(() => {
    chrome.runtime.sendMessage({ action: "getToken" }, (response) => {
       if (chrome.runtime.lastError) {
         console.error("Error getting token:", chrome.runtime.lastError);
         // Handle error appropriately, maybe assume logged out
       } else if (response && response.token) {
         console.log("Token found:", response.token);
         setCurrentToken(response.token);
       } else {
         console.log("No token found.");
         setCurrentToken(null);
       }
       setIsLoading(false);
    });
  }, []);

  const handleLoginSuccess = (token) => {
    setCurrentToken(token);
  };

  const handleLogout = () => {
    setCurrentToken(null); 
  };

  if (isLoading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div style={{ height: '100%', width: '100%' }}>
      {currentToken ? (
        <MainView token={currentToken} onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
); 