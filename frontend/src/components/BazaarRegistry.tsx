'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, 
  Search, 
  Filter, 
  Cpu, 
  Download,
  Info,
  DollarSign,
  Activity,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface BazaarService {
  resourceUrl: string;
  name: string;
  description: string;
  schemes: string[];
  accepts: {
    scheme: string;
    network: string;
    payTo: string;
    price: number;
    maxTimeoutSeconds: number;
  }[];
  inputSchema?: any;
  outputSchema?: any;
  healthUrl?: string;
  icon?: string;
  capabilities?: string[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface BazaarRegistryProps {
  onAddToSwarm: (agent: any) => Promise<void>;
  hiredAgents: string[];
}

export function BazaarRegistry({ onAddToSwarm, hiredAgents }: BazaarRegistryProps) {
  const [services, setServices] = useState<BazaarService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'cheap'>('all');
  const [addingService, setAddingService] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/bazaar/discovery`);
      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      } else {
        throw new Error('Failed to fetch Bazaar services');
      }
    } catch (err: any) {
      console.error('Bazaar fetch error:', err);
      setError('Could not load Bazaar services. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleAdd = async (service: BazaarService) => {
    setAddingService(service.resourceUrl);
    try {
      // Map Bazaar service to Agent Registration format
      const agentPayload = {
        name: service.name,
        description: service.description,
        endpoint: service.resourceUrl,
        wallet: service.accepts[0]?.payTo || '0x0000000000000000000000000000000000000000',
        capabilities: service.capabilities || ['general-task'],
        pricing: {
          model: 'per-request',
          cost: service.accepts[0]?.price || 0,
          currency: 'USDC'
        },
        chain: service.accepts[0]?.network || 'eip155:84532'
      };

      await onAddToSwarm(agentPayload);
    } catch (err: any) {
      console.error('Failed to add agent:', err);
      // Parent component handles the actual alert/toast
    } finally {
      setAddingService(null);
    }
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          service.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'verified') return matchesSearch && service.name.includes('Verified'); // Placeholder logic
    if (filter === 'cheap') return matchesSearch && (service.accepts[0]?.price || 0) < 0.5;
    return matchesSearch;
  });

  const isAlreadyAdded = (url: string) => {
    // Check if agent is already in the swarm (by URL match ideally, but we only have IDs in hiredAgents)
    // For now, we rely on the parent or just visual feedback.
    // Ideally, we'd check if the backend already has this agent registered.
    // Since hiredAgents is just IDs, we can't easily check URL.
    // We'll just allow adding, and backend will handle duplicates or return existing ID.
    return false;
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Globe className="text-[var(--accent-cyan)]" />
            x402 Bazaar
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Discover and hire autonomous agents from the global network.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--accent-cyan)] transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/20 border border-[var(--glass-border)] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-cyan)] w-64 text-white"
            />
          </div>
          
          <button 
            onClick={fetchServices}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors"
            title="Refresh Bazaar"
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
          <p className="text-[var(--text-muted)] animate-pulse">Scanning x402 network...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <AlertCircle size={40} className="text-red-500" />
          <p className="text-[var(--text-muted)]">{error}</p>
          <button 
            onClick={fetchServices}
            className="px-4 py-2 rounded-lg bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/20 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="text-center py-20 glass-panel">
          <Globe size={48} className="mx-auto text-[var(--text-muted)] mb-4" />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">No services found</h3>
          <p className="text-[var(--text-muted)]">The Bazaar seems quiet today.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredServices.map((service, idx) => (
              <motion.div
                key={service.resourceUrl + idx}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="glass-panel hover:border-[var(--accent-cyan)]/30 transition-all flex flex-col group relative overflow-hidden"
              >
                <div className="p-5 flex-1 relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 rounded-xl bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]">
                      {service.icon ? <img src={service.icon} alt="" className="w-6 h-6" /> : <Cpu size={24} />}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1 text-[var(--accent-gold)] bg-[var(--accent-gold)]/10 px-2 py-0.5 rounded-full border border-[var(--accent-gold)]/20">
                        <DollarSign size={10} strokeWidth={3} />
                        <span className="text-xs font-bold">${service.accepts[0]?.price.toFixed(3) || '0.000'}</span>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-cyan)] transition-colors truncate" title={service.name}>
                    {service.name}
                  </h3>
                  <code className="text-[10px] text-[var(--text-muted)] block mb-3 font-mono truncate" title={service.resourceUrl}>
                    {service.resourceUrl}
                  </code>
                  
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-3 mb-4 h-[60px]">
                    {service.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {(service.capabilities || ['x402-service']).slice(0, 3).map(cap => (
                      <span key={cap} className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-[var(--text-muted)] border border-white/5">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-[var(--glass-border)] bg-white/[0.02] flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Online</span>
                  </div>
                  
                  <button
                    onClick={() => handleAdd(service)}
                    disabled={addingService === service.resourceUrl}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-cyan)]/10 hover:bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] transition-all text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingService === service.resourceUrl ? (
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
