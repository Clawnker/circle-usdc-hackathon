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
  Cpu,
  Plus,
  X,
  ExternalLink,
  Loader2
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
  },
  'Sentinel': {
    id: 'sentinel',
    tagline: 'Security Auditor',
    icon: Shield,
    price: 2.50,
    successRate: 97,
    responseTime: '5.0s',
    tasksCompleted: 340,
    color: 'red',
    capabilities: ['security-audit', 'compliance-check', 'vulnerability-scan'],
    tier: 'marketplace',
    erc8004Id: 'agent:base:0x78e...332',
    external: true,
    endpoint: 'https://sentinel-agent-957204176231.us-central1.run.app'
  }
};

interface MarketplaceProps {
  hiredAgents: string[];
  onHire: (agentId: string) => void;
}

interface RegisterFormData {
  name: string;
  description: string;
  endpoint: string;
  wallet: string;
  capabilities: string;
  pricing: string;
}

export function Marketplace({ hiredAgents, onHire }: MarketplaceProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'popularity' | 'price' | 'reputation'>('popularity');
  const [filterType, setFilterType] = useState<string>('all');
  const [reputationData, setReputationData] = useState<Record<string, { successRate: number; upvotes: number; downvotes: number }>>({});
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<{ success: boolean; message: string } | null>(null);
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    description: '',
    endpoint: '',
    wallet: '',
    capabilities: '',
    pricing: '',
  });

  // Fetch registered agents and reputation
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    const fetchData = async () => {
      try {
        const [repRes, agentsRes, externalRes] = await Promise.all([
          fetch(`${apiUrl}/api/reputation`),
          fetch(`${apiUrl}/api/agents`),
          fetch(`${apiUrl}/api/agents/external`).catch(() => null),
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
              capabilities: meta.capabilities || a.capabilities || ['general'],
              external: a.external || false,
              endpoint: a.services?.[0]?.endpoint,
            };
          });

        // Also add external agents that may not be in registrations.json yet
        if (externalRes && externalRes.ok) {
          const externalData = await externalRes.json();
          for (const ext of (externalData.agents || [])) {
            // Skip if already in the mapped list
            if (mappedAgents.some((a: any) => a.id === ext.id)) continue;
            
            const meta = AGENT_METADATA[ext.name] || {
              id: ext.id,
              tagline: ext.capabilities?.[0] || 'External Agent',
              icon: Shield,
              price: Object.values(ext.pricing || {})[0] || 0,
              successRate: 0,
              responseTime: '?',
              tasksCompleted: 0,
              color: 'red',
              capabilities: ext.capabilities || ['general'],
              tier: 'marketplace',
              erc8004Id: `agent:base:${ext.wallet?.slice(0, 6)}...${ext.wallet?.slice(-3)}`
            };
            
            mappedAgents.push({
              ...meta,
              name: ext.name,
              description: ext.description,
              isVerified: ext.erc8004?.registered || false,
              external: true,
              endpoint: ext.endpoint,
              healthy: ext.healthy,
            });
          }
        }

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

  const handleRegister = async () => {
    setIsRegistering(true);
    setRegisterResult(null);
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    try {
      // Parse capabilities and pricing
      const capabilities = formData.capabilities.split(',').map(c => c.trim()).filter(Boolean);
      let pricing: Record<string, number> = {};
      if (formData.pricing) {
        formData.pricing.split(',').forEach(p => {
          const [cap, fee] = p.split(':').map(s => s.trim());
          if (cap && fee) pricing[cap] = parseFloat(fee);
        });
      }
      
      const res = await fetch(`${apiUrl}/api/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          endpoint: formData.endpoint,
          wallet: formData.wallet,
          capabilities,
          pricing,
          chain: 'base-sepolia',
        }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setRegisterResult({ success: true, message: data.message });
        // Refresh agent list
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setRegisterResult({ success: false, message: data.error || 'Registration failed' });
      }
    } catch (err: any) {
      setRegisterResult({ success: false, message: err.message });
    } finally {
      setIsRegistering(false);
    }
  };

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
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/Clawnker/circle-usdc-hackathon/blob/main/REGISTER_AGENT.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--accent-cyan)] hover:underline flex items-center gap-1"
          >
            <FileText size={14} />
            Registration Guide
            <ExternalLink size={12} />
          </a>
          <button 
            onClick={() => setShowRegisterForm(true)}
            data-register-button
            className="text-sm font-bold text-[var(--accent-gold)] hover:underline flex items-center gap-1"
          >
            <Plus size={14} />
            List your agent &rarr;
          </button>
        </div>
      </div>

      {/* Registration Modal */}
      <AnimatePresence>
        {showRegisterForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRegisterForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel gradient-border max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Shield className="text-[var(--accent-gold)]" size={20} />
                  Register External Agent
                </h3>
                <button onClick={() => setShowRegisterForm(false)} className="text-[var(--text-muted)] hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <p className="text-sm text-[var(--text-secondary)] mb-6">
                Register your autonomous agent on the Hivemind marketplace. Your agent will receive queries via HTTP and earn USDC through x402 payments.
                {' '}
                <a
                  href="https://github.com/Clawnker/circle-usdc-hackathon/blob/main/REGISTER_AGENT.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-cyan)] hover:underline inline-flex items-center gap-1"
                >
                  Full registration guide <ExternalLink size={12} />
                </a>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Agent Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Sentinel"
                    className="w-full glass-panel-subtle px-3 py-2 mt-1 text-sm focus:outline-none focus:border-[var(--accent-cyan)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                    placeholder="Security audit agent powered by Gemini"
                    className="w-full glass-panel-subtle px-3 py-2 mt-1 text-sm focus:outline-none focus:border-[var(--accent-cyan)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Endpoint URL
                    <ExternalLink size={12} className="inline ml-1" />
                  </label>
                  <input
                    type="url"
                    value={formData.endpoint}
                    onChange={(e) => setFormData(f => ({ ...f, endpoint: e.target.value }))}
                    placeholder="https://your-agent.run.app"
                    className="w-full glass-panel-subtle px-3 py-2 mt-1 text-sm font-mono focus:outline-none focus:border-[var(--accent-cyan)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Payment Wallet</label>
                  <input
                    type="text"
                    value={formData.wallet}
                    onChange={(e) => setFormData(f => ({ ...f, wallet: e.target.value }))}
                    placeholder="0x..."
                    className="w-full glass-panel-subtle px-3 py-2 mt-1 text-sm font-mono focus:outline-none focus:border-[var(--accent-cyan)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Capabilities (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.capabilities}
                    onChange={(e) => setFormData(f => ({ ...f, capabilities: e.target.value }))}
                    placeholder="security-audit, compliance-check"
                    className="w-full glass-panel-subtle px-3 py-2 mt-1 text-sm focus:outline-none focus:border-[var(--accent-cyan)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Pricing (capability:fee, comma-separated)</label>
                  <input
                    type="text"
                    value={formData.pricing}
                    onChange={(e) => setFormData(f => ({ ...f, pricing: e.target.value }))}
                    placeholder="security-audit:2.50, compliance-check:1.00"
                    className="w-full glass-panel-subtle px-3 py-2 mt-1 text-sm focus:outline-none focus:border-[var(--accent-cyan)]"
                  />
                </div>
              </div>

              {registerResult && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${registerResult.success ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                  {registerResult.message}
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowRegisterForm(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-[var(--text-secondary)] hover:bg-white/5 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegister}
                  disabled={isRegistering || !formData.name || !formData.endpoint || !formData.wallet}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {isRegistering ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <Shield size={16} />
                      Register on Marketplace
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
