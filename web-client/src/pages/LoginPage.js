import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  CircularProgress, 
  Alert,
  Paper,
  TextField,
  Divider,
  Link as MuiLink // Rename Link to avoid conflict with React Router Link if used
} from '@mui/material';
import { Google as GoogleIcon, Login as LoginIcon, PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false); // State to toggle form mode

  const handleGoogleLogin = async () => {
    await loginWithGoogle(); // Use the renamed function
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    
    // Explicit check before calling the backend
    if (!email.trim() || !password.trim()) {
      console.error("Attempted to submit with empty email or password.");
      // Optionally set an error state here to inform the user more clearly
      return; // Prevent the API call
    }

    if (isRegistering) {
      await registerWithEmail(email, password);
    } else {
      await loginWithEmail(email, password);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setEmail('');
    setPassword('');
    // Clear potential errors from the previous mode (optional, context already does this)
    // setError(null); 
  };

  return (
    <Box className="auth-container" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 2 }}>
      <Paper elevation={4} sx={{ maxWidth: 400, width: '100%', borderRadius: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
              NoteRAG
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {isRegistering ? 'Create your account' : 'Sign in to your account'}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, width: '100%' }}>
              {typeof error === 'string' ? error : 'An unexpected error occurred.'}
            </Alert>
          )}

          {/* Email/Password Form */}
          <Box component="form" onSubmit={handleEmailSubmit} noValidate sx={{ width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus={!isRegistering} // Autofocus on login
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete={isRegistering ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="secondary"
              disabled={loading || !email.trim() || !password.trim()}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : (isRegistering ? <PersonAddIcon /> : <LoginIcon />)}
              sx={{ mt: 3, mb: 2, py: 1.5, textTransform: 'none', fontSize: '1rem' }}
            >
              {loading ? 'Processing...' : (isRegistering ? 'Register' : 'Login')}
            </Button>
            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <MuiLink component="button" variant="body2" onClick={toggleMode} disabled={loading} sx={{ cursor: 'pointer' }}>
                {isRegistering ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
              </MuiLink>
            </Box>
          </Box>

          {/* Divider */}
          <Divider sx={{ my: 3 }}>OR</Divider>

          {/* Google Login Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
              onClick={handleGoogleLogin}
              disabled={loading}
              size="large"
              fullWidth
              sx={{ py: 1.5, textTransform: 'none', fontSize: '1rem' }}
            >
              {loading ? 'Processing...' : 'Continue with Google'}
            </Button>
          </Box>

        </CardContent>
      </Paper>
    </Box>
  );
};

export default LoginPage; 