import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import SimpleVoting from './components/SimpleVoting';
import AdminDashboard from './components/AdminDashboard';
import Login from './pages/Login';
import { Box, CircularProgress } from '@mui/material';
import './App.css';

function App() {
  const SESSION_STORAGE_KEY = 'ov_session_id';
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const storedSessionId = sessionStorage.getItem(SESSION_STORAGE_KEY) || '';
      try {
        const requestConfig = storedSessionId
          ? { headers: { 'x-session-id': storedSessionId }, withCredentials: true }
          : { withCredentials: true };
        const { data } = await axios.get('/api/me', requestConfig);
        setUser(data.user);
        setSessionId(data.sessionId || storedSessionId);
        if (data.sessionId || storedSessionId) {
          sessionStorage.setItem(SESSION_STORAGE_KEY, data.sessionId || storedSessionId);
        }
      } catch (err) {
        setUser(null);
        setSessionId('');
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const storedSessionId = sessionStorage.getItem(SESSION_STORAGE_KEY) || sessionId;
      await axios.post(
        '/api/logout',
        {},
        storedSessionId
          ? { headers: { 'x-session-id': storedSessionId }, withCredentials: true }
          : { withCredentials: true }
      );
    } catch (e) {}

    setUser(null);
    setSessionId('');
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    navigate('/login');
  };

  const handleLoginComplete = (loggedUser, loggedSessionId) => {
    setUser(loggedUser);
    setSessionId(loggedSessionId);
    if (loggedSessionId) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, loggedSessionId);
    }

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
