'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, ExternalLink, ArrowRight, Coins, RefreshCw } from 'lucide-react';
import type { Payment } from '@/types';

interface PaymentFeedProps {
  payments: Payment[];
  className?: string;
}

// Agent display names
const AGENT_NAMES: Record<string, { name: string; color: string }> = {
  dispatcher: { name: 'Dispatcher', color: 'var(--accent-cyan)' },
  aura: { name: 'Social Analyst', color: 'var(--accent-purple)' },
  magos: { name: 'Market Oracle', color: 'var(--accent-pink)' },
  bankr: { name: 'bankr', color: 'var(--accent-green)' },
  seeker: { name: 'Seeker', color: 'var(--accent-cyan)' },
  scribe: { name: 'Scribe', color: 'var(--accent-gold)' },
  user: { name: 'You', color: 'var(--accent-cyan)' },
  x402: { name: 'x402', color: '#2775CA' },
};

function getAgentDisplay(id: string) {
  const lowerid = id.toLowerCase();
  if (AGENT_NAMES[lowerid]) {
    return AGENT_NAMES[lowerid];
  }
  if (id.length > 10) {
    return { name: `${id.slice(0, 4)}...${id.slice(-4)}`, color: 'var(--text-secondary)' };
  }
  return { name: id, color: 'var(--text-secondary)' };
}

function PaymentCard({ payment, index }: { payment: Payment; index: number }) {
  const from = getAgentDisplay(payment.from || payment.specialist || 'unknown');
  const to = getAgentDisplay(payment.to || 'agent');
  
  const isX402 = payment.method === 'x402' || (payment.txSignature && !payment.txSignature.startsWith('0x'));

  const openExplorer = () => {
    // If txSignature looks like a hash, link to basescan; otherwise AgentWallet
    const sig = payment.txSignature || '';
    if (!isX402 && sig.startsWith('0x') && sig.length > 20) {
      window.open(`https://sepolia.basescan.org/tx/${sig}`, '_blank');
    } else {
      window.open(`https://agentwallet.mcpay.tech/u/claw`, '_blank');
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, height: 0 }}
      animate={{ opacity: 1, x: 0, height: 'auto' }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ 
        type: 'spring', 
        stiffness: 300, 
        damping: 30,
        delay: index * 0.05 
      }}
      className="glass-panel-subtle p-3 mb-2"
    >
      <div className="flex items-center justify-between">
        {/* From → To */}
        <div className="flex items-center gap-2 text-sm">
          <span style={{ color: from.color }} className="font-medium">
            {from.name}
          </span>
          <ArrowRight size={12} className="text-[var(--text-muted)]" />
          <span style={{ color: to.color }} className="font-medium">
            {to.name}
          </span>
        </div>
        
        {/* Amount */}
        <div className="flex items-center gap-2">
          {/* Payment method badge */}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            isX402 ? 'bg-[#00F0FF]/20 text-[#00F0FF]' : 'bg-orange-500/20 text-orange-400'
          }`}>
            {isX402 ? 'x402' : 'On-chain'}
          </span>
          <motion.span
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-sm font-semibold"
            style={{ 
              color: payment.token === 'ETH' ? '#627EEA' : '#2775CA' 
            }}
          >
            {payment.amount < 0.01 
              ? payment.amount.toFixed(4) 
              : payment.amount.toFixed(2)
            } {payment.token}
          </motion.span>
        </div>
      </div>
      
      {/* Transaction details */}
      <div className="flex items-center justify-between mt-2 text-xs text-[var(--text-muted)]">
        <span>{formatTime(payment.createdAt || payment.timestamp || new Date().toISOString())}</span>
        {payment.txSignature && (
          <motion.button
            onClick={openExplorer}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="flex items-center gap-1 hover:text-[var(--accent-cyan)] transition-colors"
          >
            <code className="font-mono">
              {payment.txSignature.slice(0, 8)}...
            </code>
            <ExternalLink size={10} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export function PaymentFeed({ payments: realtimePayments, className = '' }: PaymentFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [historicPayments, setHistoricPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch persisted payment history from backend
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const res = await fetch(`${apiUrl}/wallet/transactions`);
        if (res.ok) {
          const data = await res.json();
          if (data.transactions?.length > 0) {
            const mapped: Payment[] = data.transactions.map((tx: any, i: number) => ({
              id: tx.txHash || `hist-${i}`,
              from: tx.recipient ? 'dispatcher' : 'unknown',
              to: tx.recipient || 'unknown',
              amount: parseFloat(tx.amount) || 0,
              token: tx.currency || 'USDC',
              txSignature: tx.txHash || '',
              timestamp: tx.timestamp || new Date().toISOString(),
              specialist: tx.recipient,
              method: tx.method || (tx.txHash && !tx.txHash.startsWith('0x') ? 'x402' : 'on-chain'),
            }));
            setHistoricPayments(mapped);
          }
        }
      } catch (err) {
        console.error('Failed to fetch payment history:', err);
      }
      setIsLoading(false);
    };
    fetchHistory();
  }, []);

  // Merge historic + realtime, dedup by txSignature
  const allPayments = (() => {
    const seen = new Set<string>();
    const merged: Payment[] = [];
    
    // Realtime first (newer)
    for (const p of realtimePayments) {
      const key = p.txSignature || p.id || `rt-${merged.length}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(p);
      }
    }
    // Then historic
    for (const p of historicPayments) {
      const key = p.txSignature || p.id || `hist-${merged.length}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(p);
      }
    }
    
    // Sort by timestamp descending
    merged.sort((a, b) => {
      const ta = new Date(a.timestamp || a.createdAt || 0).getTime();
      const tb = new Date(b.timestamp || b.createdAt || 0).getTime();
      return tb - ta;
    });
    
    return merged;
  })();

  // Auto-scroll to newest
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [allPayments.length]);

  // Calculate total spent
  const totalSpent = allPayments.reduce((sum, p) => {
    if (p.token === 'USDC') return sum + p.amount;
    return sum;
  }, 0);

  return (
    <div className={`glass-panel overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-[var(--accent-purple)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">x402 Payments</span>
        </div>
        {allPayments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 px-2 py-1 rounded-full glass-panel-subtle"
          >
            <Coins size={12} className="text-[var(--accent-green)]" />
            <span className="text-xs text-[var(--text-secondary)]">
              ${totalSpent.toFixed(3)} spent
            </span>
          </motion.div>
        )}
      </div>

      {/* Payments List */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2"
        style={{ maxHeight: '250px' }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw size={24} className="text-[var(--text-muted)]" />
            </motion.div>
            <p className="text-xs text-[var(--text-muted)] mt-2">Loading payments...</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {allPayments.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full text-center py-8"
              >
                <CreditCard size={32} className="text-[var(--text-muted)] mb-2" />
                <p className="text-sm text-[var(--text-muted)]">
                  No payments yet
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Payments will appear here when agents transact
                </p>
              </motion.div>
            ) : (
              allPayments.map((payment, index) => (
                <PaymentCard 
                  key={payment.id} 
                  payment={payment} 
                  index={index}
                />
              ))
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
