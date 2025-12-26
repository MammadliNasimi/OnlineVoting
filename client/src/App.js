import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('vote');
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
    setCandidate('');
    fetchVotes();
  };

  const renderVotePage = () => (
    <div>
      <h2>Cast Your Vote</h2>
      <div>
        <input
          type="text"
          placeholder="Enter candidate name"
          value={candidate}
          onChange={(e) => setCandidate(e.target.value)}
        />
        <button onClick={submitVote}>Submit Vote</button>
      </div>
      <button onClick={() => setCurrentPage('results')}>View Results</button>
    </div>
  );

  const renderResultsPage = () => (
    <div>
      <h2>Voting Results</h2>
      <ul>
        {votes.map((vote, index) => (
          <li key={index}>{vote.candidate} - {new Date(vote.timestamp).toLocaleString()}</li>
        ))}
      </ul>
      <button onClick={() => setCurrentPage('vote')}>Back to Voting</button>
    </div>
  );

  return (
    <div className="App">
      <h1>Online Voting System</h1>
      {currentPage === 'vote' ? renderVotePage() : renderResultsPage()}
    </div>
  );
}

export default App;