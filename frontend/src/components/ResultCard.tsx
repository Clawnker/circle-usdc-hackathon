'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Coins, Sparkles } from 'lucide-react';

interface ResultCardProps {
  status: 'success' | 'failure';
  result: string;
  cost: number;
  specialist: string;
  onNewQuery: () => void;
  onViewDetails?: () => void;
}

export function ResultCard({
  status,
  result,
  cost,
  specialist,
  onNewQuery,
  onViewDetails
}: ResultCardProps) {
  const isSuccess = status === 'success';
  const summary = result.length > 200 ? result.substring(0, 200) + '...' : result;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="glass-panel gradient-border p-6 w-full max-w-2xl mx-auto overflow-hidden relative"
    >
      {/* Background Pulse Animation */}
      <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-20 ${isSuccess ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      
      <div className="flex items-start gap-4 mb-6">
        <div className={`p-3 rounded-full ${isSuccess ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {isSuccess ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className={`text-xl font-bold ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
              Task {isSuccess ? 'Completed' : 'Failed'}
            </h3>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <Sparkles size={14} className="text-[var(--accent-gold)]" />
              <span className="text-xs font-mono text-[var(--text-secondary)]">{specialist}</span>
            </div>
          </div>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            {summary}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="glass-panel-subtle p-4 flex flex-col gap-1 border-white/5">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">
            <Coins size={14} />
            Cost Incurred
          </div>
          <span className="text-xl font-mono font-bold text-[var(--accent-cyan)]">
            {cost.toFixed(4)} <span className="text-xs text-[var(--text-muted)]">USDC</span>
          </span>
        </div>
        
        <div className="glass-panel-subtle p-4 flex flex-col gap-1 border-white/5">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">
            <RotateCcw size={14} />
            Status
          </div>
          <span className={`text-xl font-bold ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
            {isSuccess ? 'Success' : 'Error'}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <motion.button
          onClick={onNewQuery}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-[var(--accent-gold)] to-[#FFD700] text-black font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,191,0,0.3)]"
        >
          <RotateCcw size={18} />
          <span>Ask Another</span>
        </motion.button>
        
        <motion.button
          onClick={onViewDetails}
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.98 }}
          className="w-full sm:w-auto py-3 px-8 rounded-xl bg-white/5 border border-white/10 text-[var(--text-primary)] font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <span>View Full Result</span>
          <ArrowRight size={18} />
        </motion.button>
      </div>
    </motion.div>
  );
}
