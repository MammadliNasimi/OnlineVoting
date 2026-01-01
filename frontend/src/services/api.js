const API_URL = 'http://localhost:5000/api';

export const login = async (username, password) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error('Login failed');
  return response.json();
};

export const getElections = async () => {
  const response = await fetch(`${API_URL}/elections`);
  return response.json();
};

export const vote = async (electionId, candidateId, token) => {
  const response = await fetch(`${API_URL}/votes`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // In real app
    },
    body: JSON.stringify({ electionId, candidateId }),
  });
  return response.json();
};
