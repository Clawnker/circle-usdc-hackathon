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
  Newspaper,
  FileText,
  Cpu
} from 'lucide-react';
import { AgentCard } from './AgentCard';

// Metadata for registered agents (visuals only)
const AGENT_METADATA: Record<string, any> = {
  'Bankr': {
    id: 'bankr',
    tagline: 'Execution Engine',
    icon: Coins,
    price: 0.0001,
    successRate: 99,
    responseTime: '0.8s',
    tasksCompleted: 89000,
    color: 'cyan',
    capabilities: ['trading', 'execution', 'wallet'],
    tier: 'core',
    erc8004Id: 'agent:base:0x62c...a2d'
  },
  'Scribe': {
    id: 'scribe',
    tagline: 'General Assistant',
    icon: FileText,
    price: 0.0001,
    successRate: 95,
    responseTime: '1.5s',
    tasksCompleted: 12500,
    color: 'gray',
    capabilities: ['summary', 'qa', 'writing'],
    tier: 'core',
    erc8004Id: 'agent:base:0x88b...e11'
  },
  'Seeker': {
    id: 'seeker',
    tagline: 'Web Research',
    icon: Search,
    price: 0.0001,
    successRate: 92,
    responseTime: '2.5s',
    tasksCompleted: 8400,
    color: 'cyan',
    capabilities: ['search', 'research', 'lookup'],
    tier: 'core',
    erc8004Id: 'agent:base:0x99a...c55'
  },
  'Market Oracle': { // Magos
    id: 'magos',
    tagline: 'Predictive Oracle',
    icon: Compass,
    price: 0.001,
    successRate: 94,
    responseTime: '2.4s',
    tasksCompleted: 15420,
    color: 'gold',
    capabilities: ['analysis', 'prediction', 'trading'],
    tier: 'marketplace',
    erc8004Id: 'agent:base:0x72a...f42'
  },
  'Magos': { // Magos alias
    id: 'magos',
    tagline: 'Predictive Oracle',
    icon: Compass,
    price: 0.001,
    successRate: 94,
    responseTime: '2.4s',
    tasksCompleted: 15420,
    color: 'gold',
    capabilities: ['analysis', 'prediction', 'trading'],
    tier: 'marketplace',
    erc8004Id: 'agent:base:0x72a...f42'
  },
  'Social Analyst': { // Aura
    id: 'aura',
    tagline: 'Social Sentinel',
    icon: Eye,
    price: 0.0005,
    successRate: 89,
    responseTime: '1.2s',
    tasksCompleted: 42100,
    color: 'purple',
    capabilities: ['sentiment', 'social', 'monitoring'],
    tier: 'marketplace',
    erc8004Id: 'agent:base:0x31b...a12'
  },
  'Aura': { // Aura alias
    id: 'aura',
    tagline: 'Social Sentinel',
    icon: Eye,
    price: 0.0005,
    successRate: 89,
    responseTime: '1.2s',
    tasksCompleted: 42100,
    color: 'purple',
    capabilities: ['sentiment', 'social', 'monitoring'],
    tier: 'marketplace',
    erc8004Id: 'agent:base:0x31b...a12'
  },
  'Hivemind Dispatcher': {
    id: 'dispatcher',
    tagline: 'System Core',
    icon: Cpu,
    price: 0,
    successRate: 100,
    responseTime: '0.1s',
    tasksCompleted: 1000000,
    color: 'blue',
    capabilities: ['orchestration', 'routing'],
    tier: 'system',
    erc8004Id: 'agent:base:0x000...000'
  }
};

interface MarketplaceProps {
  hiredAgents: string[];
  onHire: (agentId: string) => void;
}

export function Marketplace({ hiredAgents, onHire }: MarketplaceProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'popularity' | 'price' | 'reputation'>('popularity');
  const [filterType, setFilterType] = useState<string>('all');
  const [reputationData, setReputationData] = useState<Record<string, { successRate: number; upvotes: number; downvotes: number }>>({});
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch registered agents and reputation
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    const fetchData = async () => {
      try {
        const [repRes, agentsRes] = await Promise.all([
          fetch(`${apiUrl}/api/reputation`),
          fetch(`${apiUrl}/api/agents`)
        ]);

        const repData = await repRes.json();
        setReputationData(repData);

        const agentsData = await agentsRes.json();
        
        // Map API agents to card format using metadata
        const mappedAgents = agentsData.agents
          .filter((a: any) => a.name !== 'Hivemind Dispatcher') // Hide system agent
          .map((a: any) => {
            const meta = AGENT_METADATA[a.name] || {
              id: a.name.toLowerCase().replace(/\s+/g, ''),
              tagline: 'New Specialist',
              icon: Sparkles,
              price: 0.001,
              successRate: 0,
              responseTime: '?',
              tasksCompleted: 0,
              color: 'gray',
              capabilities: ['general'],
              tier: 'marketplace',
              erc8004Id: `agent:base:unknown`
            };

            return {
              ...meta,
              name: a.name,
              description: a.description,
              isVerified: true, // All API agents are registered
              capabilities: meta.capabilities || ['general'],
            };
          });

        setAgents(mappedAgents);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to fetch marketplace data:', err);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Merge reputation data with agent data
  const agentsWithReputation = useMemo(() => {
    return agents.map(agent => ({
      ...agent,
      successRate: reputationData[agent.id]?.successRate ?? agent.successRate,
      upvotes: reputationData[agent.id]?.upvotes ?? 0,
      downvotes: reputationData[agent.id]?.downvotes ?? 0,
    }));
  }, [reputationData, agents]);

  const filteredAndSortedAgents = useMemo(() => {
    let result = agentsWithReputation.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(search.toLowerCase()) || 
                            agent.description.toLowerCase().includes(search.toLowerCase()) ||
                            agent.capabilities.some((c: string) => c.includes(search.toLowerCase()));
      
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

  const allCapabilities = Array.from(new Set(agents.flatMap(a => a.capabilities)));

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent-gold)]"></div>
        <p className="mt-4 text-[var(--text-muted)]">Loading registry...</p>
      </div>
    );
  }

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
