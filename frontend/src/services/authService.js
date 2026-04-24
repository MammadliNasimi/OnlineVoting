import axios from 'axios';

const API_BASE = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '') + '/auth';

const login = async (credentials) => {
    const response = await axios.post(`${API_BASE}/login`, credentials);
    return response.data;
};

const register = async (userData) => {
    const response = await axios.post(`${API_BASE}/register`, userData);
    return response.data;
};

const verifyOTP = async (data) => {
    const response = await axios.post(`${API_BASE}/verify-otp`, data);
    return response.data;
};

const sendResetEmail = async (email) => {
    const response = await axios.post(`${API_BASE}/forgot-password`, { email });
    return response.data;
};

const resetPassword = async (data) => {
    const response = await axios.post(`${API_BASE}/reset-password`, data);
    return response.data;
};

const checkSession = async (sessionId) => {
   const response = await axios.get(`${API_BASE}/me`, {
        headers: { 'x-session-id': sessionId }
    });
   return response.data;
};

export const authService = {
    login,
    register,
    verifyOTP,
    sendResetEmail,
    resetPassword,
    checkSession
};

export default authService;