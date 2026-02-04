'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Sparkles, LineChart, Wallet, Settings, Save } from 'lucide-react';
import type { SpecialistType } from '@/types';

interface AgentDetailModalProps {
  specialist: SpecialistType | null;
  onClose: () => void;
  onSavePrompt?: (specialist: SpecialistType, prompt: string) => void;
}

const SPECIALIST_INFO: Record<SpecialistType, {
  name: string;
  description: string;
  fullDescription: string;
  icon: typeof Brain;
  color: string;
  capabilities: string[];
  defaultPrompt: string;
}> = {
  dispatcher: {
    name: 'Dispatcher',
    description: 'Central Orchestrator',
    fullDescription: 'The Dispatcher analyzes incoming prompts, creates execution plans, and coordinates the specialist network. It determines which agents to involve and in what order.',
    icon: Brain,
    color: '#00f5ff',
    capabilities: [
      'Natural language prompt analysis',
      'Multi-agent workflow planning',
      'Dependency resolution',
      'Result aggregation',
    ],
    defaultPrompt: 'You are the Hivemind Dispatcher. Analyze user prompts and route to appropriate specialists: Aura (sentiment/social), Magos (predictions/analysis), bankr (trading/execution).',
  },
  aura: {
    name: 'Aura',
    description: 'Social Sentiment Analyst',
    fullDescription: 'Aura monitors social media platforms to detect trending topics, analyze sentiment, and identify market-moving narratives. Specializes in X/Twitter and crypto communities.',
    icon: Sparkles,
    color: '#a855f7',
    capabilities: [
      'Real-time sentiment analysis',
      'Trending topic detection',
      'Influencer monitoring',
      'Narrative tracking',
    ],
    defaultPrompt: 'You are Aura, a social sentiment specialist. Analyze social media for crypto trends, sentiment, and alpha. Return sentiment scores from -1 (bearish) to 1 (bullish).',
  },
  magos: {
    name: 'Magos',
    description: 'Market Prediction Oracle',
    fullDescription: 'Magos combines technical analysis, on-chain data, and sentiment signals to generate price predictions and risk assessments for crypto assets.',
    icon: LineChart,
    color: '#ec4899',
    capabilities: [
      'Price prediction (4h, 24h, 7d)',
      'Risk assessment scoring',
      'Technical pattern recognition',
      'On-chain metrics analysis',
    ],
    defaultPrompt: 'You are Magos, a market prediction specialist. Analyze tokens and provide price predictions with confidence intervals and risk scores (1-10).',
  },
  bankr: {
    name: 'bankr',
    description: 'DeFi Execution Engine',
    fullDescription: 'bankr executes on-chain transactions on Solana. Handles swaps, transfers, and complex DeFi operations through Jupiter aggregator for best execution.',
    icon: Wallet,
    color: '#22c55e',
    capabilities: [
      'Token swaps via Jupiter',
      'SOL/SPL transfers',
      'Portfolio management',
      'Transaction monitoring',
    ],
    defaultPrompt: 'You are bankr, a Solana execution specialist. Execute trades and transfers on devnet. Use Jupiter for best swap rates. Always confirm before large transactions.',
  },
};

export function AgentDetailModal({ specialist, onClose, onSavePrompt }: AgentDetailModalProps) {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  if (!specialist) return null;

  const info = SPECIALIST_INFO[specialist];
  const Icon = info.icon;

  const handleSavePrompt = () => {
    if (onSavePrompt && customPrompt.trim()) {
      onSavePrompt(specialist, customPrompt.trim());
    }
    setIsEditingPrompt(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg glass-panel p-6 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          style={{ borderColor: info.color, borderWidth: 1 }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div 
                className="p-3 rounded-xl"
                style={{ backgroundColor: `${info.color}20` }}
              >
                <Icon size={32} style={{ color: info.color }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: info.color }}>
                  {info.name}
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {info.description}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={20} className="text-[var(--text-muted)]" />
            </button>
          </div>

          {/* Description */}
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            {info.fullDescription}
          </p>

          {/* Capabilities */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Capabilities
            </h3>
            <ul className="space-y-2">
              {info.capabilities.map((cap, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <div 
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: info.color }}
                  />
                  {cap}
                </li>
              ))}
            </ul>
          </div>

          {/* System Prompt */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                System Prompt
              </h3>
              <button
                onClick={() => {
                  setCustomPrompt(info.defaultPrompt);
                  setIsEditingPrompt(!isEditingPrompt);
                }}
                className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Settings size={14} />
                {isEditingPrompt ? 'Cancel' : 'Edit'}
              </button>
            </div>
            
            {isEditingPrompt ? (
              <div className="space-y-3">
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full h-32 p-3 rounded-lg bg-black/30 border border-white/10 
                    text-sm text-[var(--text-primary)] resize-none focus:outline-none 
                    focus:border-[var(--accent-cyan)]"
                  placeholder="Enter custom system prompt..."
                />
                <button
                  onClick={handleSavePrompt}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-cyan)]/20 
                    text-[var(--accent-cyan)] text-sm font-medium hover:bg-[var(--accent-cyan)]/30 
                    transition-colors"
                >
                  <Save size={14} />
                  Save Prompt
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-black/30 border border-white/10">
                <p className="text-xs text-[var(--text-muted)] font-mono leading-relaxed">
                  {info.defaultPrompt}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
