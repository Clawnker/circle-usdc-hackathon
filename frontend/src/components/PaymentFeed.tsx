'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, ExternalLink, ArrowRight, Coins } from 'lucide-react';
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
  user: { name: 'You', color: 'var(--accent-cyan)' },
};

function getAgentDisplay(id: string) {
  // Check if it's a known agent
  const lowerid = id.toLowerCase();
  if (AGENT_NAMES[lowerid]) {
    return AGENT_NAMES[lowerid];
  }
  // Truncate wallet address
  if (id.length > 10) {
    return { name: `${id.slice(0, 4)}...${id.slice(-4)}`, color: 'var(--text-secondary)' };
  }
  return { name: id, color: 'var(--text-secondary)' };
}

function PaymentCard({ payment, index }: { payment: Payment; index: number }) {
  const from = getAgentDisplay(payment.from || payment.specialist || 'unknown');
  const to = getAgentDisplay(payment.to || 'agent');
  
  const openExplorer = () => {
    window.open(
      `https://agentwallet.mcpay.tech/u/claw`,
      '_blank'
    );
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });
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
        <motion.button
          onClick={openExplorer}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1 hover:text-[var(--accent-cyan)] transition-colors"
        >
          <code className="font-mono">
            {payment.txSignature?.slice(0, 8)}...
          </code>
          <ExternalLink size={10} />
        </motion.button>
      </div>
    </motion.div>
  );
}

export function PaymentFeed({ payments, className = '' }: PaymentFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [payments.length]);

  // Calculate total spent
  const totalSpent = payments.reduce((sum, p) => {
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
        {payments.length > 0 && (
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
        <AnimatePresence mode="popLayout">
          {payments.length === 0 ? (
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
            [...payments].reverse().map((payment, index) => (
              <PaymentCard 
                key={payment.id} 
                payment={payment} 
                index={index}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
