'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Zap, 
  Shield, 
  Coins, 
  Eye, 
  Compass,
  Sparkles,
  TrendingUp,
  Newspaper,
  FileText
} from 'lucide-react';
import { AgentCard } from './AgentCard';

const CORE_AGENTS = [
  {
    id: 'bankr',
    name: 'Bankr',
    tagline: 'Execution Engine',
    description: 'High-speed trade execution and wallet management on Base. Securely handles complex DeFi interactions.',
    icon: Coins,
    price: 0.0001,
    successRate: 99,
    responseTime: '0.8s',
    tasksCompleted: 89000,
    isVerified: true,
    color: 'cyan',
    capabilities: ['trading', 'execution', 'wallet'],
    tier: 'core' as const,
    erc8004Id: 'agent:base:0x62c...a2d',
    reputation: 100
  },
  {
    id: 'scribe',
    name: 'Scribe',
    tagline: 'General Assistant',
    description: 'General purpose assistant for summarization, Q&A, and documentation tasks.',
    icon: FileText,
    price: 0.0001,
    successRate: 95,
    responseTime: '1.5s',
    tasksCompleted: 12500,
    isVerified: true,
    color: 'gray',
    capabilities: ['summary', 'qa', 'writing'],
    tier: 'core' as const,
    erc8004Id: 'agent:base:0x88b...e11',
    reputation: 97
  },
  {
    id: 'seeker',
    name: 'Seeker',
    tagline: 'Web Research',
    description: 'Web search and information retrieval specialist for deep fact lookup.',
    icon: Search,
    price: 0.0001,
    successRate: 92,
    responseTime: '2.5s',
    tasksCompleted: 8400,
    isVerified: true,
    color: 'cyan',
    capabilities: ['search', 'research', 'lookup'],
    tier: 'core' as const,
    erc8004Id: 'agent:base:0x99a...c55',
    reputation: 94
  }
];

const MARKETPLACE_AGENTS = [
  {
    id: 'magos',
    name: 'Market Oracle',
    tagline: 'Predictive Oracle',
    description: 'Expert in technical analysis and market prediction. Uses advanced heuristics to forecast price action.',
    icon: Compass,
    price: 0.001,
    successRate: 94,
    responseTime: '2.4s',
    tasksCompleted: 15420,
    isVerified: true,
    color: 'gold',
    capabilities: ['analysis', 'prediction', 'trading'],
    tier: 'marketplace' as const,
    erc8004Id: 'agent:base:0x72a...f42',
    reputation: 96
  },
  {
    id: 'aura',
    name: 'Social Analyst',
    tagline: 'Social Sentinel',
    description: 'Specializes in real-time sentiment analysis across X, Telegram, and news feeds.',
    icon: Eye,
    price: 0.0005,
    successRate: 89,
    responseTime: '1.2s',
    tasksCompleted: 42100,
    isVerified: true,
    color: 'purple',
    capabilities: ['sentiment', 'social', 'monitoring'],
    tier: 'marketplace' as const,
    erc8004Id: 'agent:base:0x31b...a12',
    reputation: 91
  },
  {
    id: 'alphahunter',
    name: 'AlphaHunter',
    tagline: 'Early Gem Finder',
    description: 'Scans new pool creations and dev activity to find the next 100x early tokens.',
    icon: Sparkles,
    price: 0.005,
    successRate: 72,
    responseTime: '3.5s',
    tasksCompleted: 850,
    isVerified: false,
    color: 'green',
    capabilities: ['discovery', 'trading', 'alpha'],
    tier: 'marketplace' as const,
    erc8004Id: 'agent:base:0x91e...c88',
    reputation: 75
  },
  {
    id: 'riskbot',
    name: 'RiskBot',
    tagline: 'Safety First',
    description: 'Deep contract analysis and portfolio risk assessment to prevent rugs.',
    icon: Shield,
    price: 0.002,
    successRate: 98,
    responseTime: '5.0s',
    tasksCompleted: 3200,
    isVerified: true,
    color: 'orange',
    capabilities: ['security', 'audit', 'risk'],
    tier: 'marketplace' as const,
    erc8004Id: 'agent:base:0x11d...b22',
    reputation: 99
  },
  {
    id: 'newsdigest',
    name: 'NewsDigest',
    tagline: 'Instant Information',
    description: 'Summarizes critical crypto news and governance proposals into actionable insights.',
    icon: Newspaper,
    price: 0.001,
    successRate: 95,
    responseTime: '2.1s',
    tasksCompleted: 12400,
    isVerified: false,
    color: 'cyan',
    capabilities: ['news', 'summary', 'info'],
    tier: 'marketplace' as const,
    erc8004Id: 'agent:base:0x22f...d33',
    reputation: 93
  },
  {
    id: 'whalespy',
    name: 'WhaleSpy',
    tagline: 'Follow the Money',
    description: 'Tracks institutional and whale wallet movements in real-time.',
    icon: TrendingUp,
    price: 0.003,
    successRate: 92,
    responseTime: '1.5s',
    tasksCompleted: 5600,
    isVerified: false,
    color: 'purple',
    capabilities: ['tracking', 'whale', 'onchain'],
    tier: 'marketplace' as const,
    erc8004Id: 'agent:base:0x55a...e99',
    reputation: 90
  }
];

const ALL_AGENTS = [...CORE_AGENTS, ...MARKETPLACE_AGENTS];

interface MarketplaceProps {
  hiredAgents: string[];
  onHire: (agentId: string) => void;
}

export function Marketplace({ hiredAgents, onHire }: MarketplaceProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'popularity' | 'price' | 'reputation'>('popularity');
  const [filterType, setFilterType] = useState<string>('all');
  const [reputationData, setReputationData] = useState<Record<string, { successRate: number; upvotes: number; downvotes: number }>>({});

  // Fetch live reputation data
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    fetch(`${apiUrl}/api/reputation`)
      .then(res => res.json())
      .then(data => setReputationData(data))
      .catch(() => {});
  }, []);

  // Merge reputation data with static agent data
  const agentsWithReputation = useMemo(() => {
    return MARKETPLACE_AGENTS.map(agent => ({
      ...agent,
      successRate: reputationData[agent.id]?.successRate ?? agent.successRate,
      upvotes: reputationData[agent.id]?.upvotes ?? 0,
      downvotes: reputationData[agent.id]?.downvotes ?? 0,
    }));
  }, [reputationData]);

  const filteredAndSortedAgents = useMemo(() => {
    let result = agentsWithReputation.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(search.toLowerCase()) || 
                            agent.description.toLowerCase().includes(search.toLowerCase()) ||
                            agent.capabilities.some(c => c.includes(search.toLowerCase()));
      
      const matchesFilter = filterType === 'all' || agent.capabilities.includes(filterType);
      
      return matchesSearch && matchesFilter;
    });

    result.sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price;
      if (sortBy === 'reputation') return b.successRate - a.successRate;
      return b.tasksCompleted - a.tasksCompleted;
    });

    return result;
  }, [search, sortBy, filterType, agentsWithReputation]);

  const allCapabilities = Array.from(new Set(MARKETPLACE_AGENTS.flatMap(a => a.capabilities)));

  return (
    <div className="flex flex-col h-full">
      {/* Marketplace Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 flex items-center gap-3">
            <Zap className="text-[var(--accent-gold)]" />
            Agent Marketplace
          </h2>
          <p className="text-[var(--text-secondary)]">
            Discover and add specialized autonomous agents to your Hivemind swarm.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
            <input 
              type="text"
              placeholder="Search capabilities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-panel-subtle pl-10 pr-4 py-2 text-sm w-full md:w-64 focus:outline-none focus:border-[var(--accent-cyan)] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 glass-panel-subtle px-3 py-2">
            <Filter size={14} className="text-[var(--text-muted)]" />
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-sm text-[var(--text-secondary)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Specs</option>
              {allCapabilities.map(cap => (
                <option key={cap} value={cap}>{cap.charAt(0).toUpperCase() + cap.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 glass-panel-subtle px-3 py-2">
            <ArrowUpDown size={14} className="text-[var(--text-muted)]" />
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-sm text-[var(--text-secondary)] focus:outline-none cursor-pointer"
            >
              <option value="popularity">Popularity</option>
              <option value="price">Price: Low to High</option>
              <option value="reputation">Reputation</option>
            </select>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
          <AnimatePresence mode="popLayout">
            {filteredAndSortedAgents.map((agent) => (
              <motion.div
                key={agent.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <AgentCard 
                  {...agent} 
                  isHired={hiredAgents.includes(agent.id)}
                  onHire={() => onHire(agent.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredAndSortedAgents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Search className="text-[var(--text-muted)]" size={32} />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">No agents found</h3>
            <p className="text-[var(--text-secondary)]">Try adjusting your search or filter settings.</p>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-[var(--bg-primary)] bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] font-bold">
                A{i}
              </div>
            ))}
          </div>
          <span className="text-sm text-[var(--text-muted)]">Join 150+ agents in the open marketplace</span>
        </div>
        <button className="text-sm font-bold text-[var(--accent-gold)] hover:underline">
          List your agent &rarr;
        </button>
      </div>
    </div>
  );
}
