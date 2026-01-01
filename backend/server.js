const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const electionRoutes = require('./routes/electionRoutes');
const voteRoutes = require('./routes/voteRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/elections', electionRoutes);
app.use('/api/votes', voteRoutes);

app.get('/', (req, res) => {
  res.send('Online Voting System API is running');
});

if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
