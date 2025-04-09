// chrome-extension/src/Login.js
import React, { useState } from 'react';
import { notesService } from './notesService';

const loginStyles = {
  display: 'flex',
  flexDirection: 'column',
  padding: '20px',
  gap: '15px', // Spacing between elements
  border: '1px solid #ccc',
  borderRadius: '8px',
  margin: '20px',
  backgroundColor: '#f9f9f9',
};

const inputStyles = {
  padding: '10px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '1rem',
};

const buttonStyles = {
  padding: '10px 15px',
  border: 'none',
  borderRadius: '4px',
  backgroundColor: '#007bff',
  color: 'white',
  fontSize: '1rem',
  cursor: 'pointer',
};

const buttonDisabledStyles = {
  ...buttonStyles,
  backgroundColor: '#ccc',
  cursor: 'not-allowed',
};

const errorStyles = {
  color: 'red',
  fontSize: '0.9rem',
  marginTop: '5px',
  minHeight: '1.2rem', // Reserve space for error message
};

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent form submission reload
    setError('');
    setIsLoading(true);
    try {
      const token = await notesService.login(email, password);
      console.log("Login successful, token obtained."); // Log for debugging
      onLoginSuccess(token); // Pass the token up
    } catch (err) {
      console.error("Login component error:", err); // Log for debugging
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} style={loginStyles}>
      <h2>Login to NoteRAG</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={isLoading}
        style={inputStyles}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={isLoading}
        style={inputStyles}
      />
      <button type="submit" disabled={isLoading} style={isLoading ? buttonDisabledStyles : buttonStyles}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
      {error && <p style={errorStyles}>{error}</p>}
    </form>
  );
};

export default Login; 