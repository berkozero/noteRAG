import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const NotFoundPage = () => {
  const { isAuthenticated } = useAuth();
  const redirectPath = isAuthenticated ? '/notes' : '/login';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        textAlign: 'center',
        padding: 3,
      }}
    >
      <Typography variant="h1" component="h1" gutterBottom>
        404
      </Typography>
      
      <Typography variant="h4" component="h2" gutterBottom>
        Page Not Found
      </Typography>
      
      <Typography variant="body1" color="textSecondary" paragraph>
        The page you are looking for doesn't exist or has been moved.
      </Typography>
      
      <Button
        variant="contained"
        color="primary"
        component={Link}
        to={redirectPath}
        sx={{ mt: 2 }}
      >
        Go to {isAuthenticated ? 'Notes' : 'Login'}
      </Button>
    </Box>
  );
};

export default NotFoundPage; 