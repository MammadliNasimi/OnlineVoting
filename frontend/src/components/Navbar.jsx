import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = ({ user }) => {
  return (
    <nav style={{ padding: '1rem', background: '#eee', display: 'flex', justifyContent: 'space-between' }}>
      <div className="logo">Online Voting</div>
      <div className="links">
        {user ? (
            <>
                <span>Welcome, {user.username}</span>
                <button onClick={() => window.location.reload()}>Logout</button>
            </>
        ) : (
            <Link to="/login">Login</Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
