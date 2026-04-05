# Smart Contracts

This directory contains Solidity smart contracts for the blockchain-based voting system.

## Files

- **Voting.sol** - Main voting smart contract
- **deploy.js** - Deployment script for testnet
- **Voting.json** - Contract ABI and address (generated after deployment)

## Features

### Voting.sol Contract

- ✅ Create elections with start/end times
- ✅ Add multiple candidates
- ✅ Cast votes with duplicate prevention
- ✅ Anonymous voting (address-based)
- ✅ Transparent vote counting
- ✅ Immutable vote records
- ✅ Event logging for all actions

## Setup & Deployment

### Prerequisites

```bash
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers
```

### Initialize Hardhat

```bash
npx hardhat
# Select: Create a JavaScript project
```

### Configure Network

Edit `hardhat.config.js`:

```javascript
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.0",
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/YOUR_INFURA_KEY`,
      accounts: [`0x${YOUR_PRIVATE_KEY}`]
    }
  }
};
```

### Compile Contract

```bash
npx hardhat compile
```

### Deploy to Testnet

```bash
npx hardhat run smart-contracts/deploy.js --network sepolia
```

### Get Testnet ETH

- Sepolia Faucet: https://sepoliafaucet.com/
- Goerli Faucet: https://goerlifaucet.com/

## Testing

Create test file `test/Voting.test.js`:

```javascript
const { expect } = require("chai");

describe("Voting", function () {
  it("Should create an election", async function () {
    const Voting = await ethers.getContractFactory("Voting");
    const voting = await Voting.deploy();
    
    await voting.createElection(
      "Test Election",
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000) + 86400,
      ["Candidate 1", "Candidate 2"]
    );
    
    expect(await voting.electionCount()).to.equal(1);
  });
});
```

Run tests:
```bash
npx hardhat test
```

## Contract Functions

### Admin Functions

- `createElection(title, startTime, endTime, candidateNames)` - Create new election
- `endElection(electionId)` - End an election

### Voter Functions

- `castVote(electionId, candidateId)` - Cast a vote
- `hasVotedInElection(electionId, voter)` - Check if voted
- `getResults(electionId)` - Get vote counts
- `getTotalVotes(electionId)` - Get total votes

### View Functions

- `getElection(electionId)` - Get election details
- `elections(id)` - Get election by ID
- `electionCandidates(electionId, index)` - Get candidate info

## Security Considerations

- ✅ Duplicate vote prevention
- ✅ Time-based election control
- ✅ Owner-only admin functions
- ✅ Input validation
- ⚠️ Consider adding signature verification
- ⚠️ Consider adding zkSNARKs for full anonymity

## Future Enhancements

- [ ] Delegate voting
- [ ] Ranked-choice voting
- [ ] Vote weight based on tokens
- [ ] Multi-signature admin control
- [ ] Upgrade to proxy pattern
- [ ] IPFS integration for metadata
- [ ] Zero-knowledge proofs

## Resources

- [Solidity Documentation](https://docs.soliditylang.org/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.io/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

## Status

⚠️ **NOT YET DEPLOYED** - This is a skeleton implementation ready for deployment.
