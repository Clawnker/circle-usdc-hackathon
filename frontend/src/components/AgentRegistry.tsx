'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  ShieldCheck, 
  ExternalLink, 
  Search, 
  Filter, 
  Globe, 
  Cpu, 
  BadgeCheck,
  Star,
  Info
} from 'lucide-react';

interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  owner: string;
  reputation: number;
  tags: string[];
  registrationUrl: string;
  verifiableProof?: string;
  chain: string;
  trustLayer: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function AgentRegistry() {
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'high-rep'>('all');

  const fetchAgents = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/agents`);
      if (response.ok) {
        const data = await response.json();
        setAgents(data);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          agent.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'verified') return matchesSearch && agent.trustLayer === 'ERC-8004';
    if (filter === 'high-rep') return matchesSearch && agent.reputation > 80;
    return matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldCheck className="text-[var(--accent-cyan)]" />
            ERC-8004 Agent Registry
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Discover verified autonomous agents on Base chain.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--accent-cyan)] transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/20 border border-[var(--glass-border)] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-cyan)] w-64"
            />
          </div>
          
          <div className="flex items-center gap-1 p-1 glass-panel-subtle rounded-xl">
            {(['all', 'verified', 'high-rep'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === f 
                    ? 'bg-[var(--accent-cyan)] text-black' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
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
          <p className="text-[var(--text-muted)] animate-pulse">Fetching registry data...</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="text-center py-20 glass-panel">
          <Users size={48} className="mx-auto text-[var(--text-muted)] mb-4" />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">No agents found</h3>
          <p className="text-[var(--text-muted)]">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredAgents.map((agent) => (
              <motion.div
                key={agent.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="glass-panel hover:border-[var(--accent-cyan)]/30 transition-all flex flex-col group"
              >
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 rounded-xl bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]">
                      <Cpu size={24} />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/20">
                        <span className="text-[10px] font-bold text-[var(--accent-cyan)]">{agent.trustLayer}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[var(--accent-gold)]">
                        <Star size={12} fill="currentColor" />
                        <span className="text-xs font-bold">{agent.reputation}</span>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-cyan)] transition-colors">
                    {agent.name}
                  </h3>
                  <code className="text-[10px] text-[var(--text-muted)] block mb-3 font-mono">
                    {agent.id}
                  </code>
                  
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-3 mb-4">
                    {agent.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {agent.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-[var(--text-muted)]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-[var(--glass-border)] bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Base Mainnet</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <a 
                      href={agent.registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors"
                      title="View Registration"
                    >
                      <Info size={16} />
                    </a>
                    {agent.verifiableProof && (
                      <a 
                        href={agent.verifiableProof}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors"
                        title="View Proof on Basescan"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
