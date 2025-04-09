import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
    Container,
    CssBaseline,
    ThemeProvider,
    createTheme,
    Box,
    Paper,
    TextField,
    InputAdornment,
    IconButton,
    CircularProgress,
} from '@mui/material';
import {
    Send as SendIcon
} from '@mui/icons-material';

// Pages
import LoginPage from './pages/LoginPage';
import MainAppPage from './pages/MainAppPage';
import NotFoundPage from './pages/NotFound';

// Components
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';

// Contexts and hooks
import { useAuth } from './contexts/AuthContext';
import { notesService } from './services/notesService';

// Create a theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#f50057',
    },
  },
});

// Styles for the Ask Bar
const askBarStyles = {
    padding: '12px 24px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f9f9f9',
    position: 'sticky', // Make it sticky below header
    top: 64, // Assuming header height is 64px
    zIndex: 1000, // Ensure it stays above content
    maxWidth: '800px', // Match content width
    margin: '0 auto', // Center it
    width: '100%' // Take full width within constraints
};

const App = () => {
  const { isAuthenticated, loading: authLoading, getToken } = useAuth();
  
  // --- State lifted up for Input Bar and Main Content --- 
  const [notes, setNotes] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true); 
  const [isProcessingAction, setIsProcessingAction] = useState(false); 
  const [actionError, setActionError] = useState(null);
  const [askInputValue, setAskInputValue] = useState('');
  const inputRef = useRef(null); // Ref for the input field

  // --- Handlers lifted up --- 
  const loadNotes = useCallback(async () => {
        setIsLoadingNotes(true);
        setActionError(null);
        setSearchResults(null);
        try {
            const token = await getToken(); // Get token
            if (!token) {
                 setActionError('Authentication required to load notes.');
                 setIsLoadingNotes(false);
                 return; // Don't proceed without token
            }
            const fetchedNotes = await notesService.getNotes(token); // Pass token
            fetchedNotes.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            setNotes(fetchedNotes);
        } catch (err) {
            setActionError('Failed to load notes.');
            console.error(err);
        } finally {
            setIsLoadingNotes(false);
        }
    }, [getToken]);
    
  const handleAsk = useCallback(async () => {
        if (!askInputValue.trim()) return;
        const userQuestion = askInputValue.trim();
        setIsProcessingAction(true);
        setActionError(null);
        setSearchResults(null); 
        setConversation(prev => [...prev, { type: 'user', text: userQuestion }]);
        setAskInputValue(''); 

        try {
            const token = await getToken(); // Get token
            if (!token) {
                 setActionError('Authentication required to ask questions.');
                 setConversation(prev => [...prev, { type: 'ai', text: 'Sorry, I need to be logged in.' }]);
                 setIsProcessingAction(false);
                 return; // Don't proceed without token
            }
            const response = await notesService.queryNotes(token, userQuestion); // Pass token
            setConversation(prev => [...prev, { type: 'ai', text: response.answer, sources: response.sources }]);
        } catch (err) {
            setActionError('Failed to get answer.');
            console.error(err);
            setConversation(prev => [...prev, { type: 'ai', text: 'Sorry, I encountered an error.' }]);
        } finally {
            setIsProcessingAction(false);
        }
    }, [askInputValue, getToken]);
    
  const handleAskInputChange = (event) => {
        setAskInputValue(event.target.value);
    };
    
  const handleAskKeyPress = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { 
            event.preventDefault();
            handleAsk();
        }
    };
    
    // Add note, search notes etc will be passed down to MainAppPage
    // or potentially triggered via context/other means depending on final design

  // --- Initial Load for Notes when Authenticated --- 
  useEffect(() => {
      if (isAuthenticated) {
          loadNotes();
      }
  }, [isAuthenticated, loadNotes]);


  if (authLoading) {
    // Simplified global loading state
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Container>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isAuthenticated && <Header />} 
      
      {isAuthenticated && (
         <Paper sx={askBarStyles} elevation={1}>
              <TextField 
                    inputRef={inputRef} 
                    fullWidth
                    variant="outlined"
                    placeholder="Ask a question about your notes..." 
                    multiline
                    minRows={1}
                    maxRows={5}
                    value={askInputValue}
                    onChange={handleAskInputChange}
                    onKeyPress={handleAskKeyPress}
                    disabled={isProcessingAction}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton 
                                    onClick={handleAsk} 
                                    disabled={isProcessingAction || !askInputValue.trim()}
                                    edge="end"
                                    color="primary"
                                >
                                    {isProcessingAction ? <CircularProgress size={24} /> : <SendIcon />}
                                </IconButton>
                            </InputAdornment>
                        )
                    }}
                 />
         </Paper>
      )}
      
      <Container className="container" maxWidth={false} disableGutters sx={{ pt: isAuthenticated ? `calc(64px + 74px)` : '0' }}> {/* Adjust top padding based on header+askbar height */} 
        <Routes>
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/notes" replace /> : <LoginPage />}
          />
          <Route 
            path="/notes" 
            element={
              <ProtectedRoute>
                 <MainAppPage 
                    notes={notes}
                    searchResults={searchResults}
                    setSearchResults={setSearchResults} 
                    conversation={conversation}
                    isLoadingNotes={isLoadingNotes}
                    isProcessingAction={isProcessingAction} 
                    setIsProcessingAction={setIsProcessingAction} 
                    actionError={actionError}
                    loadNotes={loadNotes} 
                    getToken={getToken}
                 /> 
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to={isAuthenticated ? "/notes" : "/login"} replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Container>
    </ThemeProvider>
  );
};

export default App; 