const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/onlinevoting', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('MongoDB connected');

  // Add sample data if database is empty
  const Vote = require('./models/Vote');
  const count = await Vote.countDocuments();
  if (count === 0) {
    const sampleVotes = [
      { voterId: 'user1', candidate: 'Candidate A' },
      { voterId: 'user2', candidate: 'Candidate B' },
      { voterId: 'user3', candidate: 'Candidate A' }
    ];
    await Vote.insertMany(sampleVotes);
    console.log('Sample votes added');
  }
})
  .catch(err => console.log(err));

app.get('/', (req, res) => {
  res.send('Online Voting System API');
});

app.use('/api/votes', require('./routes/votes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});