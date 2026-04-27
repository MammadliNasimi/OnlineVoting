import { ethers } from 'ethers';

const STORAGE_KEY = 'voting_burner_wallet';

export const getBurnerWallet = () => {
  let privateKey = localStorage.getItem(STORAGE_KEY);
  if (!privateKey) {
    const wallet = ethers.Wallet.createRandom();
    privateKey = wallet.privateKey;
    localStorage.setItem(STORAGE_KEY, privateKey);
  }
  return new ethers.Wallet(privateKey);
};

export const signVoteClientSide = async (candidateID, electionID) => {
  const wallet = getBurnerWallet();
  const timestamp = Math.floor(Date.now() / 1000);
  
  const domain = {
    name: 'VotingSSI',
    version: '1.0',
    chainId: parseInt(process.env.REACT_APP_CHAIN_ID || '31337', 10),
    verifyingContract: process.env.REACT_APP_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3'
  };

  const types = {
    Vote: [
      { name: 'candidateID', type: 'uint256' },
      { name: 'electionID', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' }
    ]
  };

  const message = {
    candidateID: candidateID,
    electionID: electionID,
    timestamp: timestamp
  };

  const signature = await wallet.signTypedData(domain, types, message);

  return {
    burnerAddress: wallet.address,
    burnerSignature: signature,
    timestamp: timestamp
  };
};
