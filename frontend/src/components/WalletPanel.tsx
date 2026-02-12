'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Copy, Check, ExternalLink, RefreshCw, Activity, ChevronDown, ChevronUp, LogIn, LogOut, User, Loader2 } from 'lucide-react';
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
  WETH: { icon: 'Ξ', color: 'from-[#627EEA] to-[#EC4899]', decimals: 4 },
  DAI: { icon: '◈', color: 'from-[#F5AC37] to-[#F5AC37]', decimals: 2 },
};

export function WalletPanel({ className = '' }: WalletPanelProps) {
  // OnchainKit / wagmi connected wallet
  const { address: onchainAddress, isConnected: isOnchainConnected } = useAccount();
  const { data: ethBalance, refetch: refetchEth } = useBalance({
    address: onchainAddress,
    chainId: baseSepolia.id,
    query: { enabled: isOnchainConnected },
  });
  const { data: usdcBalance, refetch: refetchUsdc } = useBalance({
    address: onchainAddress,
    token: USDC_ADDRESS,
    chainId: baseSepolia.id,
    query: { enabled: isOnchainConnected },
  });

  const [tokens, setTokens] = useState<TokenBalance[]>([
    { symbol: 'ETH', amount: 0, icon: 'Ξ', color: 'from-[#627EEA] to-[#627EEA]' },
    { symbol: 'USDC', amount: 0, icon: '$', color: 'from-[#2775CA] to-[#2775CA]' },
  ]);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showAllTokens, setShowAllTokens] = useState(false);

  // Prefer OnchainKit wallet, fall back to legacy AgentWallet, then treasury
  const displayAddress = isOnchainConnected ? (onchainAddress || '') : (onchainAddress || TREASURY_ADDRESS);
  const displayUsername = isOnchainConnected ? '' : ('');
  const isUserConnected = isOnchainConnected;

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = async () => {
    await navigator.clipboard.writeText(displayAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Update tokens when OnchainKit balances change
  useEffect(() => {
    if (isOnchainConnected) {
      const newTokens: TokenBalance[] = [
        {
          symbol: 'ETH',
          amount: ethBalance ? parseFloat(ethBalance.formatted) : 0,
          icon: TOKEN_CONFIG.ETH.icon,
          color: TOKEN_CONFIG.ETH.color,
        },
        {
          symbol: 'USDC',
          amount: usdcBalance ? parseFloat(usdcBalance.formatted) : 0,
          icon: TOKEN_CONFIG.USDC.icon,
          color: TOKEN_CONFIG.USDC.color,
        },
      ];
      setTokens(newTokens);
      setLastUpdated(new Date());
    }
  }, [isOnchainConnected, ethBalance, usdcBalance]);

  const fetchBalance = useCallback(async () => {
    setIsRefreshing(true);
    
    // If OnchainKit wallet is connected, refetch on-chain balances
    if (isOnchainConnected) {
      await Promise.all([refetchEth(), refetchUsdc()]);
      setLastUpdated(new Date());
      setIsRefreshing(false);
      return;
    }

    // Legacy: fetch from backend API
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/wallet/balances`);
      if (response.ok) {
        const data = await response.json();
        const newTokens: TokenBalance[] = [];
        const base = data.base || {};
        
        newTokens.push({
          symbol: 'ETH', amount: base.eth || 0,
          icon: TOKEN_CONFIG.ETH.icon, color: TOKEN_CONFIG.ETH.color,
        });
        newTokens.push({
          symbol: 'USDC', amount: base.usdc || 0,
          icon: TOKEN_CONFIG.USDC.icon, color: TOKEN_CONFIG.USDC.color,
        });
        
        Object.entries(base).forEach(([key, value]) => {
          const symbol = key.toUpperCase();
          if (symbol !== 'ETH' && symbol !== 'USDC' && (value as number) > 0) {
            const config = TOKEN_CONFIG[symbol] || { icon: '🪙', color: 'from-gray-500 to-gray-600', decimals: 4 };
            newTokens.push({ symbol, amount: value as number, icon: config.icon, color: config.color });
          }
        });
        
        setTokens(newTokens);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
    setIsRefreshing(false);
  }, [isOnchainConnected, refetchEth, refetchUsdc]);

  const openBasescan = () => {
    window.open(`https://sepolia.basescan.org/address/${displayAddress}`, '_blank');
  };

  const openAgentWallet = () => {
    window.open(`https://agentwallet.mcpay.tech/u/${displayUsername}`, '_blank');
  };

  const formatBalance = (symbol: string, amount: number): string => {
    const config = TOKEN_CONFIG[symbol] || { decimals: 4 };
    if (amount >= 1000000) return (amount / 1000000).toFixed(2) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(1) + 'K';
    return amount.toFixed(config.decimals);
  };

  // Legacy AgentWallet connect removed — use OnchainKit ConnectWallet instead

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const primaryTokens = tokens.slice(0, 2);
  const additionalTokens = tokens.slice(2);
  const hasAdditionalTokens = additionalTokens.length > 0;

  return (
    <div className={`glass-panel overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2">
          <Wallet size={16} className={isUserConnected ? 'text-[var(--accent-green)]' : 'text-[var(--accent-orange)]'} />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {isUserConnected ? 'Your Wallet' : 'Protocol Treasury'}
          </span>
          {isUserConnected && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
              Connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isUserConnected ? (
            <motion.button
              onClick={() => {}}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors"
              title="Disconnect wallet"
            >
              <LogOut size={14} />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1 text-[var(--accent-cyan)] hover:text-[var(--accent-cyan-bright)] transition-colors"
              title="Connect your AgentWallet"
            >
              <LogIn size={14} />
            </motion.button>
          )}
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
      </div>

      {/* Connect Wallet Form — use OnchainKit ConnectWallet instead */}

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Address */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">
            {isOnchainConnected ? (
              <span className="flex items-center gap-1">
                <User size={10} />
                Smart Wallet
              </span>
            ) : isUserConnected ? (
              <span className="flex items-center gap-1">
                <User size={10} />
                {displayUsername}
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

        {/* Primary Balances */}
        <div className="grid grid-cols-2 gap-3">
          {primaryTokens.map((token) => (
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

        {/* Additional Tokens */}
        {hasAdditionalTokens && (
          <>
            <motion.button
              onClick={() => setShowAllTokens(!showAllTokens)}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-[var(--accent-cyan)] hover:text-[var(--accent-cyan-bright)] transition-colors"
            >
              <span>{showAllTokens ? 'Hide' : 'Show'} {additionalTokens.length} more token{additionalTokens.length > 1 ? 's' : ''}</span>
              {showAllTokens ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </motion.button>
            
            <AnimatePresence>
              {showAllTokens && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-3">
                    {additionalTokens.map((token) => (
                      <motion.div
                        key={token.symbol}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-panel-subtle p-3 rounded-lg"
                        whileHover={{ scale: 1.02 }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${token.color} flex items-center justify-center`}>
                            <span className="text-[10px]">{token.icon}</span>
                          </div>
                          <span className="text-xs text-[var(--text-muted)]">{token.symbol}</span>
                        </div>
                        <motion.span key={token.amount} className="text-lg font-semibold text-[var(--text-primary)]">
                          {formatBalance(token.symbol, token.amount)}
                        </motion.span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Footer Links */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--glass-border)]">
          <motion.button
            onClick={openBasescan}
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors"
          >
            <ExternalLink size={10} />
            <span>Basescan</span>
          </motion.button>
          
          <motion.button
            onClick={openAgentWallet}
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-1 text-xs text-[var(--accent-purple)] hover:text-[var(--accent-purple-bright)] transition-colors"
          >
            <Activity size={10} />
            <span>View Activity</span>
          </motion.button>
        </div>

        {/* Last Updated */}
        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Base Sepolia</span>
          </div>
          {lastUpdated && (
            <span>Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
