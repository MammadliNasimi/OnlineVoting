import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [votes, setVotes] = useState([]);
  const [candidate, setCandidate] = useState('');

  useEffect(() => {
    fetchVotes();
  }, []);

  const fetchVotes = async () => {
    const res = await axios.get('/api/votes');
    setVotes(res.data);
  };

  const submitVote = async () => {
    await axios.post('/api/votes', { voterId: 'user1', candidate });
    fetchVotes();
  };

  return (
    <div className="App">
      <h1>Online Voting System</h1>
      <div>
        <input
          type="text"
          placeholder="Candidate name"
          value={candidate}
          onChange={(e) => setCandidate(e.target.value)}
        />
        <button onClick={submitVote}>Vote</button>
      </div>
      <h2>Votes</h2>
      <ul>
        {votes.map((vote, index) => (
          <li key={index}>{vote.candidate} - {new Date(vote.timestamp).toLocaleString()}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;