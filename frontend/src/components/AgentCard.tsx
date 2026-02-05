'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  LucideIcon, 
  CheckCircle2, 
  Clock, 
  BarChart3, 
  CircleDollarSign,
  ArrowUpRight
} from 'lucide-react';
import { AgentBadge } from './AgentBadge';

export interface AgentMarketplaceProps {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  price: number;
  successRate: number;
  responseTime: string;
  tasksCompleted: number;
  isVerified?: boolean;
  color: string;
  tier?: 'core' | 'marketplace';
  onHire: (id: string) => void;
}

export function AgentCard({
  id,
  name,
  tagline,
  description,
  icon: Icon,
  price,
  successRate,
  responseTime,
  tasksCompleted,
  isVerified = false,
  color,
  tier = 'marketplace',
  onHire
}: AgentMarketplaceProps) {
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      className="glass-panel gradient-border overflow-hidden flex flex-col h-full group"
    >
      {/* Card Header */}
      <div className="p-5 flex justify-between items-start">
        <div className={`p-3 rounded-xl bg-[rgba(13,13,13,0.5)] border border-white/5 group-hover:border-${color}/30 transition-colors`}>
          <Icon className={`w-8 h-8 text-${color}`} style={{ color: `var(--accent-${color})` }} />
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <AgentBadge tier={tier} />
          {isVerified && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <CheckCircle2 size={14} className="text-green-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">Verified</span>
            </div>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="px-5 pb-5 flex-1">
        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1">{name}</h3>
        <p className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-[var(--text-secondary)] to-[var(--text-muted)] mb-3">
          {tagline}
        </p>
        <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-6">
          {description}
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="glass-panel-subtle p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <BarChart3 size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Success</span>
            </div>
            <span className="text-lg font-mono font-bold text-[var(--text-primary)]">{successRate}%</span>
          </div>
          <div className="glass-panel-subtle p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <Clock size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Speed</span>
            </div>
            <span className="text-lg font-mono font-bold text-[var(--text-primary)]">{responseTime}</span>
          </div>
          <div className="glass-panel-subtle p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <ArrowUpRight size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Tasks</span>
            </div>
            <span className="text-lg font-mono font-bold text-[var(--text-primary)]">{tasksCompleted.toLocaleString()}</span>
          </div>
          <div className="glass-panel-subtle p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <CircleDollarSign size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Cost</span>
            </div>
            <span className="text-lg font-mono font-bold text-[var(--accent-cyan)]">{price} <span className="text-[10px] text-[var(--text-muted)]">USDC</span></span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="p-5 bg-white/[0.02] border-t border-white/5 mt-auto">
        <motion.button
          onClick={() => onHire(id)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full btn-primary flex items-center justify-center gap-2 group/btn"
        >
          <span>Hire Specialist</span>
          <ArrowUpRight size={18} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
        </motion.button>
      </div>
    </motion.div>
  );
}
