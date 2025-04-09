import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  TextField, 
  Grid, 
  Card, 
  CardContent, 
  CardActions, 
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import { notesService } from '../../services/notes';

const NotesPage = () => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newNote, setNewNote] = useState({ title: '', text: '', sourceUrl: '' });
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState(null);

  // Load notes on component mount
  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedNotes = await notesService.getAllNotes();
      setNotes(fetchedNotes);
    } catch (err) {
      console.error('Error loading notes:', err);
      setError('Failed to load notes. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewNote(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    
    if (!newNote.title.trim() || !newNote.text.trim()) {
      setError('Title and note text are required.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const timestamp = Date.now();
      const noteToCreate = {
        ...newNote,
        timestamp
      };
      
      const createdNote = await notesService.createNote(noteToCreate);
      
      // Add the new note to the list
      setNotes(prev => [createdNote, ...prev]);
      
      // Reset the form
      setNewNote({ title: '', text: '', sourceUrl: '' });
    } catch (err) {
      console.error('Error creating note:', err);
      setError('Failed to create note. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (noteId) => {
    setSelectedNoteId(noteId);
    setOpenDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedNoteId) return;
    
    try {
      setLoading(true);
      await notesService.deleteNote(selectedNoteId);
      
      // Remove the deleted note from the list
      setNotes(prev => prev.filter(note => note.id !== selectedNoteId));
      
      setOpenDialog(false);
      setSelectedNoteId(null);
    } catch (err) {
      console.error('Error deleting note:', err);
      setError('Failed to delete note. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    setSelectedNoteId(null);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    return new Date(timestamp).toLocaleString();
  };

  const renderSourceUrl = (url) => {
    if (!url) return null;
    
    // Extract domain for display
    let domain;
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = url;
    }
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, fontSize: '0.8rem', color: 'text.secondary' }}>
        <LinkIcon fontSize="small" sx={{ mr: 0.5 }} />
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
          {domain}
        </a>
      </Box>
    );
  };

  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        My Notes
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* Create note form */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Create New Note
        </Typography>
        
        <Box component="form" onSubmit={handleCreateNote}>
          <TextField
            fullWidth
            margin="normal"
            label="Title"
            name="title"
            value={newNote.title}
            onChange={handleInputChange}
            required
          />
          
          <TextField
            fullWidth
            margin="normal"
            label="Note Text"
            name="text"
            value={newNote.text}
            onChange={handleInputChange}
            multiline
            rows={4}
            required
          />
          
          <TextField
            fullWidth
            margin="normal"
            label="Source URL (Optional)"
            name="sourceUrl"
            value={newNote.sourceUrl}
            onChange={handleInputChange}
            placeholder="https://example.com"
          />
          
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? 'Creating...' : 'Create Note'}
          </Button>
        </Box>
      </Paper>
      
      {/* Notes list */}
      {loading && notes.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : notes.length === 0 ? (
        <Box sx={{ textAlign: 'center', my: 4 }}>
          <Typography variant="body1" color="textSecondary">
            No notes yet. Create your first note above!
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {notes.map(note => (
            <Grid item xs={12} sm={6} md={4} key={note.id}>
              <Card className="note-card">
                <CardContent>
                  <Typography variant="h6" component="h2" gutterBottom>
                    {note.title}
                  </Typography>
                  
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {note.text}
                  </Typography>
                  
                  {renderSourceUrl(note.sourceUrl)}
                  
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 2 }}>
                    {formatDate(note.timestamp)}
                  </Typography>
                </CardContent>
                
                <CardActions>
                  <IconButton 
                    size="small" 
                    color="error" 
                    onClick={() => handleDeleteClick(note.id)}
                    title="Delete Note"
                  >
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      {/* Delete confirmation dialog */}
      <Dialog
        open={openDialog}
        onClose={handleDialogClose}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this note? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NotesPage; 