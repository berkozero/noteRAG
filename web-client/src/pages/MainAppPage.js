import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box,
    Container,
    Typography,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    Paper,
    Divider,
    IconButton,
    TextField,
    InputAdornment,
    Chip,
    Avatar,
    Button,
    Alert
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Search as SearchIcon,
    QuestionAnswer as AskIcon,
    Add as AddIcon,
    Clear as ClearIcon,
    Computer as AiIcon,
    Person as UserIcon
} from '@mui/icons-material';
import { notesService } from '../services/notesService';
import { useAuth } from '../contexts/AuthContext';

// Basic styling inspired by Notion - minimal and clean
const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)', // Assuming 64px header height
        paddingTop: 0, // Remove top padding
        paddingBottom: 0, // Remove bottom padding
        maxWidth: '800px', // Max width for content area
        margin: '0 auto',
    },
    contentArea: { // Combined Notes/Search/Conversation Area
        flexGrow: 1,
        overflowY: 'auto',
        padding: '24px', 
    },
    inputArea: {
        padding: '12px 24px',
        borderTop: '1px solid #e0e0e0',
        backgroundColor: '#f9f9f9',
    },
    noteItem: {
        marginBottom: '12px',
        padding: '12px 16px',
        border: '1px solid #eee',
    },
    noteTitle: {
        fontWeight: 500,
        marginBottom: '4px',
        fontSize: '1rem',
    },
    noteText: {
        color: 'text.secondary',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: '0.9rem',
    },
    timestamp: {
        fontSize: '0.75rem',
        color: 'text.disabled',
        marginTop: '8px',
        display: 'block',
    },
    searchResultScore: {
        fontSize: '0.75rem',
        color: 'primary.main',
        marginLeft: '8px'
    },
    conversationItem: {
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'flex-start'
    },
    conversationText: {
        marginLeft: '12px',
        padding: '8px 12px',
        borderRadius: '12px',
        backgroundColor: '#f0f0f0', 
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
    userMessage: {
        backgroundColor: '#e3f2fd', // Light blue for user messages
    },
    sourceChip: {
        margin: '4px 4px 0 0',
    }
};

const topBarStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '1px solid #e0e0e0',
};

const NoteItem = ({ note, onDelete }) => (
    <Paper elevation={1} sx={styles.noteItem} variant="outlined">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <ListItemText
                primary={<Typography sx={styles.noteTitle}>{note.title || 'Untitled Note'}</Typography>}
                secondary={<Typography variant="body2" sx={styles.noteText}>{note.text}</Typography>}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', ml: 1 }}>
                <IconButton edge="end" aria-label="delete" onClick={() => onDelete(note.id)} size="small">
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Box>
        </Box>
        {note.timestamp && (
            <Typography variant="caption" sx={styles.timestamp}>
                {new Date(note.timestamp).toLocaleString()}
            </Typography>
        )}
    </Paper>
);

const ConversationItem = ({ item }) => (
    <Box key={item.id} sx={styles.conversationItem}>
        <Avatar sx={{ bgcolor: item.type === 'user' ? 'primary.main' : 'secondary.main' }}>
            {item.type === 'user' ? <UserIcon /> : <AiIcon />}
        </Avatar>
        <Paper sx={{...styles.conversationText, ...(item.type === 'user' && styles.userMessage)}} elevation={1}>
            <Typography variant="body2">{item.text}</Typography>
            {item.type === 'ai' && item.sources && item.sources.length > 0 && (
                <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">Sources:</Typography>
                    <Box>
                        {item.sources.map(source => (
                            <Chip 
                                key={source.id} 
                                label={source.metadata?.title || source.id}
                                size="small"
                                sx={styles.sourceChip}
                            />
                        ))}
                    </Box>
                </Box>
            )}
        </Paper>
    </Box>
);

const MainAppPage = ({ 
    notes, 
    searchResults, 
    setSearchResults, 
    conversation, 
    isLoadingNotes, 
    isProcessingAction, 
    setIsProcessingAction, 
    actionError, 
    loadNotes, 
    getToken // Accept getToken prop
}) => {
    const { user } = useAuth();
    const [inputValue, setInputValue] = useState('');
    const [inputMode, setInputMode] = useState('ask'); // Default to 'ask' for bottom bar
    const contentAreaRef = useRef(null); // Ref to scroll conversation
    const inputRef = useRef(null); // Ref for the input field
    const [inputPlaceholder, setInputPlaceholder] = useState('Ask a question about your notes...');
    const [isAddingNote, setIsAddingNote] = useState(false); 
    const [newNoteContent, setNewNoteContent] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const addNoteInputRef = useRef(null);
    const searchInputRef = useRef(null);

    const handleDeleteNote = useCallback(async (noteId) => {
        setIsProcessingAction(true); 
        try {
            const token = await getToken(); // Get token
            if (!token) throw new Error('Authentication required to delete note.');
            await notesService.deleteNote(token, noteId); // Pass token
            await loadNotes(); 
        } catch (err) {
            console.error('Failed to delete note:', err);
            // setActionError('Failed to delete note.'); 
        } finally {
            setIsProcessingAction(false); 
        }
    }, [loadNotes, setIsProcessingAction, getToken]);

    const handleAddNote = async () => {
        if (!inputValue.trim()) return;
        setIsProcessingAction(true);
        setError(null);
        try {
            const lines = inputValue.trim().split('\n');
            const title = lines[0];
            const text = lines.slice(1).join('\n').trim() || title;
            const newNote = await notesService.addNote(title, text);
            setNotes(prev => [newNote, ...prev].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))); // Keep sorted
            setInputValue('');
            setInputMode('ask'); // Revert mode after adding
            setInputPlaceholder('Ask a question about your notes...'); // Revert placeholder
        } catch (err) {
            setError('Failed to add note.');
            console.error(err);
        } finally {
            setIsProcessingAction(false);
        }
    };

    const handleSearch = async () => {
        if (!inputValue.trim()) return;
        setIsProcessingAction(true);
        setError(null);
        setConversation([]);
        try {
            const results = await notesService.searchNotes(inputValue.trim());
            setSearchResults(results);
            // Don't clear input value after search, user might want to refine
        } catch (err) {
            setError('Failed to search notes.');
            console.error(err);
            setSearchResults([]);
        } finally {
            setIsProcessingAction(false);
        }
    };

    const handleAsk = async () => {
        if (!inputValue.trim()) return;
        const userQuestion = inputValue.trim();
        setIsProcessingAction(true);
        setError(null);
        setSearchResults(null); 
        setConversation(prev => [...prev, { type: 'user', text: userQuestion }]);
        setInputValue(''); 
        setInputMode('ask'); // Ensure mode is ask
        setInputPlaceholder('Ask a question about your notes...'); // Ensure placeholder

        try {
            const response = await notesService.queryNotes(userQuestion);
            setConversation(prev => [...prev, { type: 'ai', text: response.answer, sources: response.sources }]);
        } catch (err) {
            setError('Failed to get answer.');
            console.error(err);
            setConversation(prev => [...prev, { type: 'ai', text: 'Sorry, I encountered an error.' }]);
        } finally {
            setIsProcessingAction(false);
        }
    };

    const handleInputChange = (event) => {
        setInputValue(event.target.value);
    };
    
    const handleKeyPress = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { 
            event.preventDefault();
            handleSubmit();
        }
    };
    
    const handleSubmit = () => {
        if (inputMode === 'add') handleAddNote();
        else if (inputMode === 'search') handleSearch();
        else if (inputMode === 'ask') handleAsk();
    };
    
    const clearSearch = () => {
        setSearchResults(null);
        setInputValue('');
        setInputMode('ask'); // Revert to ask mode
        setInputPlaceholder('Ask a question about your notes...');
        loadNotes(); // Reload all notes after clearing search
    };

    const activateAddMode = () => {
        setInputMode('add');
        setInputPlaceholder('Add a note (Title on first line)... Press Enter to Save.');
        setSearchResults(null); // Clear search if active
        setConversation([]); // Clear conversation if active
        setInputValue(''); // Clear input field
        inputRef.current?.focus(); // Focus the input field
    };

    const activateSearchMode = () => {
        setInputMode('search');
        setInputPlaceholder('Search notes... Press Enter to Search.');
        setConversation([]); // Clear conversation if active
        setInputValue(''); // Clear input field
        inputRef.current?.focus(); // Focus the input field
    };

    const handleStartAddNote = () => {
        setIsAddingNote(true);
        setNewNoteContent('');
        setIsSearching(false); // Close search if open
        setSearchQuery('');
        setSearchResults(null); // Clear search results when starting add
        setTimeout(() => addNoteInputRef.current?.focus(), 0);
    };

    const handleCancelAddNote = () => {
        setIsAddingNote(false);
        setNewNoteContent('');
    };

    const handleAddNoteSubmit = async () => {
        if (!newNoteContent.trim()) return;
        setIsProcessingAction(true);
        try {
            const token = await getToken(); // Get token
            if (!token) throw new Error('Authentication required to add note.');
            // Assuming addNote accepts (token, title, text)
            await notesService.addNote(token, null, newNoteContent.trim()); // Pass token, null title
            setNewNoteContent('');
            setIsAddingNote(false);
            await loadNotes(); 
        } catch (err) {
            console.error('Failed to add note:', err);
            // Handle error display
        } finally {
            setIsProcessingAction(false);
        }
    };
    
    const handleAddNoteKeyPress = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { 
            event.preventDefault();
            handleAddNoteSubmit();
        }
    };

    const handleStartSearch = () => {
        setIsSearching(true);
        setSearchQuery('');
        setIsAddingNote(false); // Close add if open
        setNewNoteContent('');
        // Clear conversation? Decide based on desired UX
        // setConversation([]); 
        setTimeout(() => searchInputRef.current?.focus(), 0);
    };
    
    const handleCancelSearch = () => {
        setIsSearching(false);
        setSearchQuery('');
        setSearchResults(null); // Clear results on cancel
    };

    const handleSearchSubmit = async () => {
        if (!searchQuery.trim()) {
            setSearchResults(null); 
            return;
        }
        setIsProcessingAction(true);
        try {
            const token = await getToken(); // Get token
            if (!token) throw new Error('Authentication required to search notes.');
            // Assuming searchNotes accepts (token, query, limit)
            const results = await notesService.searchNotes(token, searchQuery.trim()); // Pass token
            setSearchResults(results); 
        } catch (err) {
            console.error('Failed to search notes:', err);
            setSearchResults([]); 
        } finally {
            setIsProcessingAction(false);
        }
    };
    
    const handleSearchKeyPress = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { 
            event.preventDefault();
            handleSearchSubmit();
        }
    };

    const displayMode = conversation.length > 0 ? 'conversation' 
                      : searchResults !== null ? 'search' 
                      : 'notes';
                      
    const pageTitle = displayMode === 'conversation' ? 'Conversation' 
                    : displayMode === 'search' ? 'Search Results'
                    : 'My Notes';

    return (
        <Container sx={styles.container} maxWidth={false}>
             {/* Top Bar with Title and Actions */}
             <Box 
                sx={topBarStyles}
             >
                <Typography variant="h6">
                    {pageTitle}
                </Typography>
                <Box>
                    {/* Show search/add only when viewing notes */}
                    {displayMode !== 'conversation' && (
                        <>
                            {!isSearching && (
                                <Button 
                                    startIcon={<SearchIcon />} 
                                    onClick={handleStartSearch}
                                    disabled={isAddingNote || isProcessingAction}
                                    sx={{ mr: 1 }}
                                >
                                    Search
                                </Button>
                            )}
                            {!isAddingNote && (
                                <Button 
                                    variant="contained"
                                    startIcon={<AddIcon />} 
                                    onClick={handleStartAddNote}
                                    disabled={isSearching || isProcessingAction}
                                >
                                    Add Note
                                </Button>
                            )}
                        </>
                    )}
                    {/* Show clear button only for search results */}
                    {displayMode === 'search' && (
                        <Button startIcon={<ClearIcon />} onClick={clearSearch} size="small">Clear Search</Button>
                    )}
                     {/* Maybe add a clear conversation button here later? */}
                </Box>
            </Box>
            
            <Box sx={styles.contentArea} ref={contentAreaRef}>
                {/* Removed Top Action Buttons from here */}
                {displayMode === 'conversation' && conversation.map((item, index) => <ConversationItem key={index} item={item} />)}
                {displayMode === 'search' && (
                    isProcessingAction ? (
                        <CircularProgress sx={{ display: 'block', margin: 'auto' }} />
                    ) : searchResults.length === 0 ? (
                        <Typography color="text.secondary">No results found.</Typography>
                    ) : (
                        <List disablePadding>{searchResults.map(note => <NoteItem key={note.id} note={note} onDelete={handleDeleteNote} />)}</List>
                    )
                )}
                {displayMode === 'notes' && (
                    isLoadingNotes ? (
                        <CircularProgress sx={{ display: 'block', margin: 'auto' }} />
                    ) : actionError ? (
                        <Typography color="error">{actionError}</Typography>
                    ) : notes.length === 0 ? (
                        <Typography color="text.secondary">No notes yet. Add one below!</Typography>
                    ) : (
                        <List disablePadding>{notes.map(note => <NoteItem key={note.id} note={note} onDelete={handleDeleteNote} />)}</List>
                    )
                )}
            </Box>

            {/* Conditionally Render Add Note Input */} 
            {isAddingNote && (
                <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
                     <TextField 
                        inputRef={addNoteInputRef}
                        fullWidth
                        label="New Note Content"
                        variant="outlined"
                        multiline
                        rows={3}
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        onKeyPress={handleAddNoteKeyPress}
                        disabled={isProcessingAction}
                     />
                     <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                         <Button onClick={handleCancelAddNote} sx={{ mr: 1 }} disabled={isProcessingAction}>Cancel</Button>
                         <Button variant="contained" onClick={handleAddNoteSubmit} disabled={!newNoteContent.trim() || isProcessingAction}>
                            {isProcessingAction ? <CircularProgress size={24}/> : 'Save Note'}
                         </Button>
                     </Box>
                </Paper>
            )}
            
             {/* Conditionally Render Search Input */} 
            {isSearching && (
                <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
                     <TextField 
                        inputRef={searchInputRef}
                        fullWidth
                        label="Search Notes"
                        variant="outlined"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={handleSearchKeyPress}
                        disabled={isProcessingAction}
                        InputProps={{
                           endAdornment: (
                            <InputAdornment position="end">
                                <IconButton onClick={handleSearchSubmit} disabled={!searchQuery.trim() || isProcessingAction} edge="end">
                                    {isProcessingAction ? <CircularProgress size={24}/> : <SearchIcon />}
                                </IconButton>
                             </InputAdornment>
                           )
                        }}
                     />
                     <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                         <Button onClick={handleCancelSearch} disabled={isProcessingAction}>Cancel</Button>
                     </Box>
                </Paper>
            )}

            {/* Error Display */} 
            {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
            </Container>
    );
};

export default MainAppPage; 