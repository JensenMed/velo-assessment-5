import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const provider = typeof window !== 'undefined' && window.ethereum
    ? new ethers.providers.Web3Provider(window.ethereum, 'any')
    : null;

  const connect = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError('No Ethereum wallet found. Please install MetaMask.');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    try {
      setConnecting(true);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0] || null);
      const cid = await window.ethereum.request({ method: 'eth_chainId' });
      setChainId(cid);
    } catch (err) {
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setChainId(null);
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      setAccount(accounts[0] || null);
    };
    const handleChainChanged = (cid) => {
      setChainId(cid);
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts) => { if (accounts[0]) setAccount(accounts[0]); })
      .catch(() => {});

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  const value = { account, chainId, provider, connecting, error, connect, disconnect };
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}

export function shortAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}