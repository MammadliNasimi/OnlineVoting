import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import SimpleVoting from './components/SimpleVoting';
import AdminDashboard from './components/AdminDashboard';
import Login from './pages/Login';
import { Box, CircularProgress } from '@mui/material';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await axios.get('/api/me');
        setUser(data.user);
        setSessionId(data.sessionId);
      } catch (err) {
        setUser(null);
        setSessionId('');
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout');
    } catch (e) {}

    setUser(null);
    setSessionId('');
    navigate('/login');
  };

  const handleLoginComplete = (loggedUser, loggedSessionId) => {
    setUser(loggedUser);
    setSessionId(loggedSessionId);

    if (loggedUser?.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/vote');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user?.role === 'admin' ? '/admin' : user ? '/vote' : '/login'} replace />} />

      <Route path="/login" element={<Login onLoginComplete={handleLoginComplete} />} />

      <Route path="/vote" element={
        user && user.role !== 'admin' ? (
          <Box sx={{ minHeight: '100vh' }}>
            <SimpleVoting user={user} sessionId={sessionId} onLogout={handleLogout} />
          </Box>
        ) : (
          <Navigate to="/login" replace />
        )
      } />

      <Route path="/admin/*" element={
        user?.role === 'admin' ? (
          <AdminDashboard user={user} sessionId={sessionId} onLogout={handleLogout} />
        ) : (
          <Navigate to="/login" replace />
        )
      } />
    </Routes>
  );
}

export default App;
