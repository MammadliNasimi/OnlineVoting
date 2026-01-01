import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { vote } from '../services/api';

const Vote = () => {
  const { state } = useLocation();
  const { election } = state;
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const handleVote = async () => {
    if (selectedCandidate === null) return;
    try {
        const result = await vote(election.id, selectedCandidate, 'mock-token');
        if (result.txHash) {
            setTxHash(result.txHash);
        } else {
            alert('Vote failed');
        }
    } catch (e) {
        alert('Error voting');
    }
  };

  return (
    <div className="vote-page">
      <h2>{election.title}</h2>
      {txHash ? (
        <div className="success-message">
            <h3>Vote Submitted Successfully!</h3>
            <p>Transaction Hash: {txHash}</p>
        </div>
      ) : (
        <>
            <div className="candidates">
                {election.candidates.map((candidate, index) => (
                <div key={index} className="candidate-option">
                    <input
                        type="radio"
                        name="candidate"
                        value={index}
                        onChange={() => setSelectedCandidate(index)}
                    />
                    <label>{candidate}</label>
                </div>
                ))}
            </div>
            <button onClick={handleVote} disabled={selectedCandidate === null}>
                Submit Vote
            </button>
        </>
      )}
    </div>
  );
};

export default Vote;
