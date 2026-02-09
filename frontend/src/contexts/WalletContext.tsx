'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface WalletInfo {
  username: string;
  evmAddress: string;
  solanaAddress: string;
  displayName: string;
}

interface WalletContextType {
  wallet: WalletInfo | null;
  isConnecting: boolean;
  error: string | null;
  connect: (username: string) => Promise<boolean>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  wallet: null,
  isConnecting: false,
  error: null,
  connect: async () => false,
  disconnect: () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

const STORAGE_KEY = 'hivemind_wallet';
const AGENTWALLET_API = 'https://agentwallet.mcpay.tech/api';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load persisted wallet on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setWallet(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const connect = useCallback(async (username: string): Promise<boolean> => {
    setIsConnecting(true);
    setError(null);

    try {
      // Verify username exists via our backend proxy to avoid CORS issues
      const res = await fetch(`${API_URL}/api/wallet/lookup/${encodeURIComponent(username)}`);
      
      if (!res.ok) {
        setError(`Wallet "${username}" not found. Create one at agentwallet.mcpay.tech`);
        setIsConnecting(false);
        return false;
      }

      const data = await res.json();
      
      const walletInfo: WalletInfo = {
        username: data.username || username,
        evmAddress: data.evmAddress || data.wallets?.evm?.address || '',
        solanaAddress: data.solanaAddress || data.wallets?.solana?.address || '',
        displayName: data.displayName || username,
      };

      setWallet(walletInfo);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(walletInfo));
      setIsConnecting(false);
      return true;
    } catch (err: any) {
      setError('Failed to connect. Check your connection and try again.');
      setIsConnecting(false);
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <WalletContext.Provider value={{ wallet, isConnecting, error, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}
