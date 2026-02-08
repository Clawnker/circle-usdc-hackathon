'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Sparkles, LineChart, Wallet, Settings, Save, FileText, Search } from 'lucide-react';
import type { SpecialistType } from '@/types';
import { AgentBadge } from './AgentBadge';

interface AgentDetailModalProps {
  specialist: SpecialistType | null;
  onClose: () => void;
  isHired?: boolean;
  isProcessing?: boolean;
  isCoreAgent?: boolean;  // Core agents cannot be removed
  customInstructions?: string;
  onUpdateInstructions?: (instructions: string) => void;
  onRemove?: () => void;
  fee?: number;
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
    defaultPrompt: 'You are the Hivemind Dispatcher. Analyze user prompts and route to appropriate specialists from the marketplace based on capabilities and pricing.',
  },
  aura: {
    name: 'Social Analyst',
    description: 'Social Sentiment Analyst',
    fullDescription: 'Monitors social media platforms to detect trending topics, analyze sentiment, and identify market-moving narratives. Specializes in X/Twitter and crypto communities.',
    icon: Sparkles,
    color: '#a855f7',
    capabilities: [
      'Real-time sentiment analysis',
      'Trending topic detection',
      'Influencer monitoring',
      'Narrative tracking',
    ],
    defaultPrompt: 'You are a social sentiment specialist. Analyze social media for crypto trends, sentiment, and alpha. Return sentiment scores from -1 (bearish) to 1 (bullish).',
  },
  magos: {
    name: 'Market Oracle',
    description: 'Market Prediction Oracle',
    fullDescription: 'Combines technical analysis, on-chain data, and sentiment signals to generate price predictions and risk assessments for crypto assets.',
    icon: LineChart,
    color: '#ec4899',
    capabilities: [
      'Price prediction (4h, 24h, 7d)',
      'Risk assessment scoring',
      'Technical pattern recognition',
      'On-chain metrics analysis',
    ],
    defaultPrompt: 'You are a market prediction specialist. Analyze tokens and provide price predictions with confidence intervals and risk scores (1-10).',
  },
  bankr: {
    name: 'bankr',
    description: 'DeFi Execution Engine',
    fullDescription: 'bankr executes on-chain transactions on Base. Handles swaps, transfers, and complex DeFi operations with Circle USDC integration.',
    icon: Wallet,
    color: '#22c55e',
    capabilities: [
      'Token swaps on Base',
      'USDC transfers',
      'Portfolio management',
      'Transaction monitoring',
    ],
    defaultPrompt: 'You are bankr, a Base execution specialist. Execute trades and transfers on Base Sepolia. Use USDC for payments. Always confirm before large transactions.',
  },
  general: {
    name: 'General Assistant',
    description: 'Utility & Support',
    fullDescription: 'Handles general queries, information retrieval, and provides support for common tasks within the Hivemind Protocol.',
    icon: Sparkles,
    color: '#F7B32B',
    capabilities: [
      'General knowledge queries',
      'Protocol information',
      'User support',
      'System status checks',
    ],
    defaultPrompt: 'You are a General Assistant for Hivemind Protocol. Help users with general queries about the protocol and its specialists.',
  },
  alphahunter: {
    name: 'AlphaHunter',
    description: 'DeFi Opportunity Finder',
    fullDescription: 'Scans the market for new token launches, liquidity pools, and yield opportunities. Identifies patterns associated with high-growth potential assets.',
    icon: Sparkles,
    color: '#f97316',
    capabilities: [
      'New token discovery',
      'Liquidity pool analysis',
      'Yield farming detection',
      'Volume anomaly tracking',
    ],
    defaultPrompt: 'You are AlphaHunter. Your goal is to find high-potential opportunities in the DeFi space.',
  },
  riskbot: {
    name: 'RiskBot',
    description: 'Security & Risk Auditor',
    fullDescription: 'Analyzes smart contracts, tokenomics, and market conditions to identify potential risks, rugs, or security vulnerabilities.',
    icon: Brain,
    color: '#ef4444',
    capabilities: [
      'Contract auditing',
      'Tokenomics analysis',
      'Honeypot detection',
      'Market volatility assessment',
    ],
    defaultPrompt: 'You are RiskBot. Analyze the risk profile of specified tokens or protocols.',
  },
  newsdigest: {
    name: 'NewsDigest',
    description: 'Market News Aggregator',
    fullDescription: 'Summarizes key market news, regulatory updates, and project announcements from verified sources to keep you informed of the macro landscape.',
    icon: Sparkles,
    color: '#3b82f6',
    capabilities: [
      'News summarization',
      'Regulatory tracking',
      'Project update monitoring',
      'Event impact analysis',
    ],
    defaultPrompt: 'You are NewsDigest. Provide concise summaries of the latest market news.',
  },
  whalespy: {
    name: 'WhaleSpy',
    description: 'Large Transaction Tracker',
    fullDescription: 'Monitors large wallet movements and institutional flows to detect potential accumulation or distribution phases by major market participants.',
    icon: LineChart,
    color: '#06b6d4',
    capabilities: [
      'Whale wallet tracking',
      'Exchange inflow/outflow analysis',
      'Institutional move detection',
      'Unusual volume alerts',
    ],
    defaultPrompt: 'You are WhaleSpy. Monitor and report on large transaction activities.',
  },
  scribe: {
    name: 'Scribe',
    description: 'Documentation & Knowledge',
    fullDescription: 'Specializes in summarizing long conversations, drafting documentation, and providing clear explanations for complex technical concepts.',
    icon: FileText,
    color: '#9CA3AF',
    capabilities: [
      'Document summarization',
      'Code documentation',
      'Q&A assistant',
      'Knowledge base management',
    ],
    defaultPrompt: 'You are Scribe, a documentation and knowledge assistant. Provide clear, concise summaries and helpful answers to user queries.',
  },
  seeker: {
    name: 'Seeker',
    description: 'Web Research specialist',
    fullDescription: 'Performs deep web research and information retrieval to find factual data, news, and market intelligence outside the immediate on-chain environment.',
    icon: Search,
    color: '#00F5FF',
    capabilities: [
      'Web search',
      'Fact lookup',
      'Market research',
      'News aggregation',
    ],
    defaultPrompt: 'You are Seeker, a web research specialist. Use search results to provide accurate and detailed information to the user.',
  },
};

export function AgentDetailModal({ 
  specialist, 
  onClose, 
  isHired, 
  isProcessing,
  isCoreAgent = false,
  customInstructions = '',
  onUpdateInstructions,
  onRemove,
  fee
}: AgentDetailModalProps) {
  const [tempInstructions, setTempInstructions] = useState(customInstructions);
  const [isHoveredRemove, setIsHoveredRemove] = useState(false);

  if (!specialist) return null;

  const info = SPECIALIST_INFO[specialist];
  const Icon = info.icon;

  const handleSaveInstructions = () => {
    if (onUpdateInstructions) {
      onUpdateInstructions(tempInstructions);
    }
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
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold" style={{ color: info.color }}>
                    {info.name}
                  </h2>
                  <AgentBadge tier={['bankr', 'scribe', 'seeker', 'dispatcher'].includes(specialist) ? 'core' : 'marketplace'} />
                </div>
                {fee !== undefined && fee > 0 && (
                  <div className="text-amber-400 text-sm font-medium mb-1">
                    {fee.toFixed(4)} USDC per task
                  </div>
                )}
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

          {/* Custom Instructions (Replaces System Prompt) */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Custom Instructions
              </h3>
              {customInstructions && !onUpdateInstructions && (
                <span className="text-xs text-[var(--accent-gold)]">Saved</span>
              )}
            </div>
            
            <div className="space-y-3">
              <textarea
                value={tempInstructions}
                onChange={(e) => setTempInstructions(e.target.value)}
                className="w-full h-24 p-3 rounded-lg bg-black/30 border border-[var(--accent-gold)]/20 
                  text-sm text-[var(--text-primary)] resize-none focus:outline-none 
                  focus:border-[var(--accent-gold)] transition-colors"
                placeholder="Add instructions like 'Focus on Base ecosystem' or 'Be concise'"
              />
              <button
                onClick={handleSaveInstructions}
                disabled={tempInstructions === customInstructions}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${tempInstructions !== customInstructions 
                    ? 'bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/30' 
                    : 'bg-white/5 text-white/30 cursor-not-allowed'}`}
              >
                <Save size={14} />
                Save Instructions
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {isHired && !isProcessing && !isCoreAgent && (
              <button
                onClick={onRemove}
                onMouseEnter={() => setIsHoveredRemove(true)}
                onMouseLeave={() => setIsHoveredRemove(false)}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 border
                  ${isHoveredRemove 
                    ? 'bg-red-500/10 border-red-500/50 text-red-500' 
                    : 'bg-transparent border-red-500/20 text-red-500/70 hover:border-red-500/50'
                  }`}
              >
                {isHoveredRemove ? 'Confirm Remove from Swarm' : 'Remove from Swarm'}
              </button>
            )}
            {isCoreAgent && isHired && (
              <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm text-gray-500 border border-gray-700/30 bg-gray-800/20">
                <span>🔒 Core Agent (cannot be removed)</span>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
