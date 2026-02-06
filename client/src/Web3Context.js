import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import VotingContract from './contracts/VotingAnonymous.json';

const Web3Context = createContext();

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within Web3Provider');
  }
  return context;
};

export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Contract address from environment
  const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  const HARDHAT_CHAIN_ID = '0x7a69'; // 31337 in hex

  // Check if MetaMask is installed
  const isMetaMaskInstalled = () => {
    return typeof window.ethereum !== 'undefined';
  };

  // Connect to MetaMask
  const connectWallet = async () => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask yüklü değil! Lütfen yükleyin: https://metamask.io');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      // Setup provider and signer
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const web3Signer = await web3Provider.getSigner();
      const network = await web3Provider.getNetwork();

      // Check if on Hardhat network
      if (network.chainId !== 31337n) {
        setError('Lütfen Hardhat Local Network\'e (Chain ID: 31337) bağlanın');
        await switchToHardhatNetwork();
        return;
      }

      // Setup contract
      const votingContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        VotingContract.abi,
        web3Signer
      );

      setAccount(accounts[0]);
      setProvider(web3Provider);
      setSigner(web3Signer);
      setContract(votingContract);
      setChainId(Number(network.chainId));

      console.log('✅ Wallet connected:', accounts[0]);
      console.log('✅ Contract loaded:', CONTRACT_ADDRESS);
    } catch (err) {
      console.error('Wallet connection error:', err);
      setError(err.message || 'Wallet bağlantısı başarısız');
    } finally {
      setIsConnecting(false);
    }
  };

  // Switch to Hardhat network
  const switchToHardhatNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: HARDHAT_CHAIN_ID }]
      });
    } catch (switchError) {
      // Network doesn't exist, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: HARDHAT_CHAIN_ID,
              chainName: 'Hardhat Local',
              rpcUrls: ['http://127.0.0.1:8545'],
              nativeCurrency: {
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18
              }
            }]
          });
        } catch (addError) {
          setError('Hardhat network eklenemedi');
        }
      }
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setContract(null);
    setChainId(null);
    setError(null);
  };

  // Listen to account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== account) {
        setAccount(accounts[0]);
        console.log('Account changed:', accounts[0]);
      }
    };

    const handleChainChanged = (chainId) => {
      const newChainId = parseInt(chainId, 16);
      setChainId(newChainId);
      console.log('Chain changed:', newChainId);
      
      if (newChainId !== 31337) {
        setError('Lütfen Hardhat Local Network\'e bağlanın');
      } else {
        setError(null);
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [account]);

  // Auto-connect if previously connected
  useEffect(() => {
    const checkConnection = async () => {
      if (!isMetaMaskInstalled()) return;

      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          await connectWallet();
        }
      } catch (err) {
        console.error('Auto-connect failed:', err);
      }
    };

    checkConnection();
  }, []);

  const value = {
    account,
    provider,
    signer,
    contract,
    chainId,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    isMetaMaskInstalled: isMetaMaskInstalled(),
    CONTRACT_ADDRESS
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

export default Web3Context;
