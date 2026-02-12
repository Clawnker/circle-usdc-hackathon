'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, CheckCircle2, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface PaymentReceiptProps {
  txHash: string;
  amount: number;
  specialist: string;
  timestamp: string;
  onDismiss: () => void;
}

export function PaymentReceipt({ txHash, amount, specialist, timestamp, onDismiss }: PaymentReceiptProps) {
  const [copied, setCopied] = useState(false);
  
  const copyTxHash = async () => {
    await navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const basescanUrl = `https://sepolia.basescan.org/tx/${txHash}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass-panel-subtle p-4 rounded-xl border border-green-500/20 mb-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-400" />
          <span className="text-sm font-medium text-green-400">Payment Confirmed</span>
        </div>
        <button onClick={onDismiss} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          Dismiss
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <span className="text-[var(--text-muted)]">Amount</span>
          <p className="font-mono font-bold text-[var(--text-primary)]">{amount.toFixed(2)} USDC</p>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Specialist</span>
          <p className="font-medium text-[var(--text-primary)]">{specialist}</p>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Time</span>
          <p className="text-[var(--text-secondary)]">{new Date(timestamp).toLocaleTimeString()}</p>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Network</span>
          <p className="text-[var(--text-secondary)]">Base Sepolia</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
        <span className="text-[10px] text-[var(--text-muted)]">Tx:</span>
        <code className="text-[10px] font-mono text-[var(--text-secondary)] flex-1 truncate">{txHash}</code>
        <button onClick={copyTxHash} className="p-1 hover:text-[var(--accent-cyan)] transition-colors">
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
        </button>
        <a href={basescanUrl} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-[var(--accent-cyan)] transition-colors">
          <ExternalLink size={12} />
        </a>
      </div>
    </motion.div>
  );
}