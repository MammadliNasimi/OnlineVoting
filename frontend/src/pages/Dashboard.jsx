import React, { useEffect, useState } from 'react';
import { getElections } from '../services/api';
import ElectionCard from '../components/ElectionCard';

const Dashboard = () => {
  const [elections, setElections] = useState([]);

  useEffect(() => {
    getElections().then(setElections).catch(console.error);
  }, []);

  return (
    <div className="dashboard">
      <h1>Active Elections</h1>
      <div className="election-list">
        {elections.map(election => (
          <ElectionCard key={election.id} election={election} />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
