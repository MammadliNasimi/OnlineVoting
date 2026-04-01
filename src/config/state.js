const state = {
  io: null,
  authService: null,
  credentialIssuer: null,
  relayerService: null,
  useDatabase: false,
  votingPeriod: { start: null, end: null },
  isVotingOpen: function() {
    const now = new Date();
    if (this.votingPeriod.start && now < new Date(this.votingPeriod.start)) return false;
    if (this.votingPeriod.end && now > new Date(this.votingPeriod.end)) return false;
    return true;
  }
};
module.exports = state;
