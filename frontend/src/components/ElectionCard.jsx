import React from 'react';
import { useNavigate } from 'react-router-dom';

const ElectionCard = ({ election }) => {
  const navigate = useNavigate();

  const handleVoteClick = () => {
    navigate('/vote', { state: { election } });
  };

  return (
    <div className="election-card" style={{ border: '1px solid #ccc', padding: '1rem', margin: '1rem' }}>
      <h3>{election.title}</h3>
      <p>Status: {election.isActive ? 'Active' : 'Closed'}</p>
      {election.isActive && <button onClick={handleVoteClick}>Vote Now</button>}
    </div>
  );
};

export default ElectionCard;
