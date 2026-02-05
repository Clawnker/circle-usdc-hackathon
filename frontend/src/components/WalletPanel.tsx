'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Copy, Check, ExternalLink, RefreshCw, Activity } from 'lucide-react';
import type { WalletBalance } from '@/types';

interface WalletPanelProps {
  className?: string;
}

const TREASURY_ADDRESS = '5xUugg8ysgqpcGneM6qpM2AZ8ZGuMaH5TnGNWdCQC1Z1';
const AGENTWALLET_USERNAME = 'claw';

export function WalletPanel({ className = '' }: WalletPanelProps) {
  const [wallet, setWallet] = useState<WalletBalance>({
    address: TREASURY_ADDRESS,
    SOL: 0,
    USDC: 0,
  });
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = async () => {
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchBalance = async () => {
    setIsRefreshing(true);
    try {
      // Fetch from backend which proxies to AgentWallet
      const response = await fetch('http://localhost:3000/api/wallet/balances');
      if (response.ok) {
        const data = await response.json();
        setWallet({
          address: TREASURY_ADDRESS,
          SOL: data.solana?.sol || 0,
          USDC: data.solana?.usdc || data.evm?.usdc || 0,
        });
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
    setIsRefreshing(false);
  };

  const openSolscan = () => {
    window.open(
      `https://solscan.io/account/${TREASURY_ADDRESS}?cluster=devnet`,
      '_blank'
    );
  };

  const openAgentWallet = () => {
    window.open(
      `https://agentwallet.mcpay.tech/u/${AGENTWALLET_USERNAME}`,
      '_blank'
    );
  };

  // Fetch on mount and every 15 seconds
  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`glass-panel overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-[var(--accent-green)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Agent Wallet</span>
        </div>
        <motion.button
          onClick={fetchBalance}
          disabled={isRefreshing}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] 
            transition-colors disabled:opacity-50"
        >
          <motion.div
            animate={{ rotate: isRefreshing ? 360 : 0 }}
            transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: 'linear' }}
          >
            <RefreshCw size={14} />
          </motion.div>
        </motion.button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Address */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">Treasury</span>
          <div className="flex items-center gap-2">
            <code className="text-xs text-[var(--text-secondary)] font-mono">
              {truncateAddress(wallet.address)}
            </code>
            <motion.button
              onClick={copyAddress}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Check size={12} className="text-[var(--accent-green)]" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Copy size={12} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
            <motion.button
              onClick={openSolscan}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors"
              title="View on Solscan"
            >
              <ExternalLink size={12} />
            </motion.button>
          </div>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-3">
          {/* SOL Balance */}
          <motion.div
            className="glass-panel-subtle p-3 rounded-lg"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">◎</span>
              </div>
              <span className="text-xs text-[var(--text-muted)]">SOL</span>
            </div>
            <motion.span
              key={wallet.SOL}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-semibold text-[var(--text-primary)]"
            >
              {wallet.SOL.toFixed(3)}
            </motion.span>
          </motion.div>

          {/* USDC Balance */}
          <motion.div
            className="glass-panel-subtle p-3 rounded-lg"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full bg-[#2775CA] flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">$</span>
              </div>
              <span className="text-xs text-[var(--text-muted)]">USDC</span>
            </div>
            <motion.span
              key={wallet.USDC}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-semibold text-[var(--text-primary)]"
            >
              ${wallet.USDC.toFixed(4)}
            </motion.span>
          </motion.div>
        </div>

        {/* Quick Links */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--glass-border)]">
          <motion.button
            onClick={openAgentWallet}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 text-xs text-[var(--accent-cyan)] hover:underline"
          >
            <Activity size={12} />
            <span>View Activity</span>
          </motion.button>
          
          <motion.button
            onClick={openSolscan}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 text-xs text-[var(--accent-purple)] hover:underline"
          >
            <ExternalLink size={12} />
            <span>Solscan</span>
          </motion.button>
        </div>

        {/* Network & status */}
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-purple)]" />
            <span>Solana Devnet</span>
          </div>
          {lastUpdated && (
            <span className="text-[10px]">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
