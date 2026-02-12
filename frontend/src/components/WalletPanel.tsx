'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Copy, Check, ExternalLink, RefreshCw, ChevronDown, ChevronUp, User } from 'lucide-react';
import { useAccount, useBalance } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

interface WalletPanelProps {
  className?: string;
}

interface TokenBalance {
  symbol: string;
  amount: number;
  icon: string;
  color: string;
}

const TREASURY_ADDRESS = '0x676fF3d546932dE6558a267887E58e39f405B135';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;

const TOKEN_CONFIG: Record<string, { icon: string; color: string; decimals: number }> = {
  ETH: { icon: 'Ξ', color: 'from-[#627EEA] to-[#627EEA]', decimals: 4 },
  USDC: { icon: '$', color: 'from-[#2775CA] to-[#2775CA]', decimals: 4 },
};

export function WalletPanel({ className = '' }: WalletPanelProps) {
  const { address, isConnected } = useAccount();
  const { data: ethBalance, refetch: refetchEth } = useBalance({
    address,
    chainId: baseSepolia.id,
    query: { enabled: isConnected },
  });
  const { data: usdcBalance, refetch: refetchUsdc } = useBalance({
    address,
    token: USDC_ADDRESS,
    chainId: baseSepolia.id,
    query: { enabled: isConnected },
  });

  const [tokens, setTokens] = useState<TokenBalance[]>([
    { symbol: 'ETH', amount: 0, icon: 'Ξ', color: TOKEN_CONFIG.ETH.color },
    { symbol: 'USDC', amount: 0, icon: '$', color: TOKEN_CONFIG.USDC.color },
  ]);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const displayAddress = isConnected ? (address || '') : TREASURY_ADDRESS;

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const copyAddress = async () => {
    await navigator.clipboard.writeText(displayAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openBasescan = () => {
    window.open(`https://sepolia.basescan.org/address/${displayAddress}`, '_blank');
  };

  const formatBalance = (symbol: string, amount: number): string => {
    const cfg = TOKEN_CONFIG[symbol] || { decimals: 4 };
    if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + 'M';
    if (amount >= 1_000) return (amount / 1_000).toFixed(1) + 'K';
    return amount.toFixed(cfg.decimals);
  };

  // Sync on-chain balances when wallet is connected
  useEffect(() => {
    if (isConnected) {
      setTokens([
        { symbol: 'ETH', amount: ethBalance ? parseFloat(ethBalance.formatted) : 0, icon: TOKEN_CONFIG.ETH.icon, color: TOKEN_CONFIG.ETH.color },
        { symbol: 'USDC', amount: usdcBalance ? parseFloat(usdcBalance.formatted) : 0, icon: TOKEN_CONFIG.USDC.icon, color: TOKEN_CONFIG.USDC.color },
      ]);
      setLastUpdated(new Date());
    }
  }, [isConnected, ethBalance, usdcBalance]);

  const fetchBalance = useCallback(async () => {
    setIsRefreshing(true);

    if (isConnected) {
      await Promise.all([refetchEth(), refetchUsdc()]);
      setLastUpdated(new Date());
      setIsRefreshing(false);
      return;
    }

    // Fallback: fetch treasury balance from backend API
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/wallet/balances`);
      if (res.ok) {
        const data = await res.json();
        const base = data.base || data.balances || {};
        setTokens([
          { symbol: 'ETH', amount: base.eth || 0, icon: TOKEN_CONFIG.ETH.icon, color: TOKEN_CONFIG.ETH.color },
          { symbol: 'USDC', amount: base.usdc || 0, icon: TOKEN_CONFIG.USDC.icon, color: TOKEN_CONFIG.USDC.color },
        ]);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
    setIsRefreshing(false);
  }, [isConnected, refetchEth, refetchUsdc]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  return (
    <div className={`glass-panel overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2">
          <Wallet size={16} className={isConnected ? 'text-[var(--accent-green)]' : 'text-[var(--accent-orange)]'} />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {isConnected ? 'Your Wallet' : 'Protocol Treasury'}
          </span>
          {isConnected && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
              Connected
            </span>
          )}
        </div>
        <motion.button
          onClick={fetchBalance}
          disabled={isRefreshing}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
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
          <span className="text-xs text-[var(--text-muted)]">
            {isConnected ? (
              <span className="flex items-center gap-1">
                <User size={10} />
                Smart Wallet
              </span>
            ) : 'Treasury'}
          </span>
          <div className="flex items-center gap-2">
            <code className="text-xs text-[var(--text-secondary)] font-mono">
              {truncateAddress(displayAddress)}
            </code>
            <motion.button
              onClick={copyAddress}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Check size={12} className="text-[var(--accent-green)]" />
                  </motion.div>
                ) : (
                  <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Copy size={12} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
            <motion.button
              onClick={openBasescan}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors"
              title="View on Basescan"
            >
              <ExternalLink size={12} />
            </motion.button>
          </div>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-3">
          {tokens.map((token) => (
            <motion.div
              key={token.symbol}
              className="glass-panel-subtle p-3 rounded-lg"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${token.color} flex items-center justify-center`}>
                  <span className="text-[8px] font-bold text-white">{token.icon}</span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{token.symbol}</span>
              </div>
              <motion.span
                key={token.amount}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xl font-semibold text-[var(--text-primary)]"
              >
                {token.symbol === 'USDC' ? '$' : ''}{formatBalance(token.symbol, token.amount)}
              </motion.span>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--glass-border)]">
          <motion.button
            onClick={openBasescan}
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors"
          >
            <ExternalLink size={10} />
            <span>Basescan</span>
          </motion.button>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Base Sepolia</span>
          </div>
        </div>

        {/* Last Updated */}
        {lastUpdated && (
          <div className="text-[10px] text-[var(--text-muted)] text-right">
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
