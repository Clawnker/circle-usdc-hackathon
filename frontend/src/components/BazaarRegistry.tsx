'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, 
  Search, 
  Cpu, 
  Download,
  DollarSign,
  Activity,
  CheckCircle,
  AlertCircle,
  Star,
  Shield,
  ExternalLink
} from 'lucide-react';

interface DiscoveredAgent {
  id: string;
  agentId: string;
  tokenId: string;
  chainId: number;
  name: string;
  description: string;
  wallet: string;
  ownerAddress: string;
  x402Supported: boolean;
  score: number;
  healthStatus: string;
  healthScore: number;
  imageUrl?: string;
  services: {
    mcp?: { endpoint: string; version: string };
    a2a?: { endpoint: string; version: string; skills?: string[] };
    oasf?: { endpoint: string; version: string; skills?: string[]; domains?: string[] };
    web?: { endpoint: string };
  };
  protocols: string[];
  feedbackCount: number;
  starCount: number;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
  84532: 'Base Sepolia',
  11155111: 'Sepolia',
  56: 'BNB',
  43114: 'Avalanche',
  5000: 'Mantle',
};

const CHAIN_COLORS: Record<number, string> = {
  1: 'var(--accent-purple, #8b5cf6)',
  8453: 'var(--accent-cyan, #06b6d4)',
  84532: 'var(--accent-cyan, #06b6d4)',
  56: '#F0B90B',
  43114: '#E84142',
};

interface BazaarRegistryProps {
  onAddToSwarm: (agent: any) => Promise<void>;
  hiredAgents: string[];
}

export function BazaarRegistry({ onAddToSwarm, hiredAgents }: BazaarRegistryProps) {
  const [agents, setAgents] = useState<DiscoveredAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [addingAgent, setAddingAgent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchAgents = async (search?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      
      const response = await fetch(`${API_URL}/api/bazaar/discovery?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
        setTotal(data.total || 0);
      } else {
        throw new Error('Failed to fetch agents');
      }
    } catch (err: any) {
      console.error('Registry fetch error:', err);
      setError('Could not load agent registry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleSearch = () => {
    setSearchQuery(searchInput);
    fetchAgents(searchInput || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleAdd = async (agent: DiscoveredAgent) => {
    setAddingAgent(agent.id);
    try {
      const endpoint = agent.services.a2a?.endpoint || 
                       agent.services.web?.endpoint || 
                       agent.services.mcp?.endpoint || '';
      
      const agentPayload = {
        name: agent.name,
        description: agent.description,
        endpoint,
        wallet: agent.wallet,
        capabilities: agent.protocols.map(p => p.toLowerCase()),
        pricing: {
          model: 'per-request',
          cost: 0, // Discovered at call time via x402
          currency: 'USDC'
        },
        chain: `eip155:${agent.chainId}`,
        erc8004Id: agent.agentId,
      };

      await onAddToSwarm(agentPayload);
    } catch (err: any) {
      console.error('Failed to add agent:', err);
    } finally {
      setAddingAgent(null);
    }
  };

  const getHealthColor = (status: string) => {
    if (status === 'healthy') return 'bg-green-500';
    if (status === 'unhealthy') return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Shield className="text-[var(--accent-cyan)]" />
            Agent Registry
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Discover ERC-8004 agents with x402 payments — {total.toLocaleString()} registered
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--accent-cyan)] transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Search agents..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-black/20 border border-[var(--glass-border)] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-cyan)] w-64 text-white"
            />
          </div>
          
          <button 
            onClick={() => fetchAgents(searchInput || undefined)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors"
            title="Refresh"
          >
            <Activity size={18} />
          </button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="text-[var(--accent-cyan)]"
          >
            <Cpu size={40} />
          </motion.div>
          <p className="text-[var(--text-muted)] animate-pulse">Scanning ERC-8004 registry...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <AlertCircle size={40} className="text-red-500" />
          <p className="text-[var(--text-muted)]">{error}</p>
          <button 
            onClick={() => fetchAgents()}
            className="px-4 py-2 rounded-lg bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/20 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-20 glass-panel">
          <Globe size={48} className="mx-auto text-[var(--text-muted)] mb-4" />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">No agents found</h3>
          <p className="text-[var(--text-muted)]">
            {searchQuery ? `No results for "${searchQuery}"` : 'No x402 agents with active endpoints found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {agents.map((agent, idx) => (
              <motion.div
                key={agent.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="glass-panel hover:border-[var(--accent-cyan)]/30 transition-all flex flex-col group relative overflow-hidden"
              >
                <div className="p-5 flex-1 relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 rounded-xl bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]">
                      {agent.imageUrl ? (
                        <img src={agent.imageUrl} alt="" className="w-6 h-6 rounded" />
                      ) : (
                        <Cpu size={24} />
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {/* Score */}
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${getScoreColor(agent.score)}`}>
                        <Star size={10} strokeWidth={3} />
                        <span className="text-xs font-bold">{agent.score.toFixed(1)}</span>
                      </div>
                      {/* Chain */}
                      <span 
                        className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                        style={{ 
                          color: CHAIN_COLORS[agent.chainId] || '#888',
                          borderColor: `${CHAIN_COLORS[agent.chainId] || '#888'}40`,
                          backgroundColor: `${CHAIN_COLORS[agent.chainId] || '#888'}10`,
                        }}
                      >
                        {CHAIN_NAMES[agent.chainId] || `Chain ${agent.chainId}`}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-cyan)] transition-colors truncate" title={agent.name}>
                    {agent.name}
                  </h3>
                  <code className="text-[10px] text-[var(--text-muted)] block mb-3 font-mono truncate" title={agent.agentId}>
                    {agent.agentId}
                  </code>
                  
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-3 mb-4 h-[60px]">
                    {agent.description || 'No description provided.'}
                  </p>

                  {/* Protocol badges */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {agent.protocols.map(proto => (
                      <span key={proto} className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-[var(--text-muted)] border border-white/5 font-mono">
                        {proto}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-[var(--glass-border)] bg-white/[0.02] flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${getHealthColor(agent.healthStatus)} ${agent.healthStatus === 'healthy' ? 'animate-pulse' : ''}`} />
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                        {agent.healthStatus}
                      </span>
                    </div>
                    {agent.feedbackCount > 0 && (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {agent.feedbackCount} reviews
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleAdd(agent)}
                    disabled={addingAgent === agent.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-cyan)]/10 hover:bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] transition-all text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingAgent === agent.id ? (
                      <>
                        <Activity size={14} className="animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        Add to Swarm
                      </>
                    )}
                  </button>
                </div>
                
                {/* Background glow effect */}
                <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-[var(--accent-cyan)]/5 rounded-full blur-3xl group-hover:bg-[var(--accent-cyan)]/10 transition-all duration-500" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
