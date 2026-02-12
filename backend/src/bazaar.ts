/**
 * Agent Discovery via 8004scan (ERC-8004 Registry)
 * 
 * Single source of truth for external agent discovery.
 * Uses the 8004scan leaderboard API for quality-ranked agents with x402 support.
 * 
 * Pricing is discovered at call time via x402 protocol (402 responses),
 * not pre-indexed — keeps things simple and always fresh.
 * 
 * Reference: https://www.8004scan.io
 */

// 8004scan public API
const SCAN_8004_API = 'https://www.8004scan.io/api/v1';

// Cache (TTL: 5 minutes)
const CACHE_TTL = 5 * 60 * 1000;
let cacheMainnet: { agents: DiscoveredAgent[]; total: number; timestamp: number } | null = null;
let cacheTestnet: { agents: DiscoveredAgent[]; total: number; timestamp: number } | null = null;

// Chain IDs
const MAINNET_CHAINS = [1, 8453, 42220, 56, 143]; // Ethereum, Base, Celo, BSC, etc.
const TESTNET_CHAINS = [84532, 11155111]; // Base Sepolia, Sepolia

export interface DiscoveredAgent {
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
  isTestnet: boolean;
}

/**
 * Discover external agents from 8004scan's ERC-8004 registry.
 * Uses the leaderboard endpoint for quality-ranked results.
 */
export async function discoverAgents(options?: {
  limit?: number;
  offset?: number;
  search?: string;
  network?: 'mainnet' | 'testnet' | 'all';
}): Promise<{ agents: DiscoveredAgent[]; total: number }> {
  const limit = Math.min(options?.limit || 50, 100);
  const offset = options?.offset || 0;
  const search = options?.search || '';
  const network = options?.network || 'all';

  // Check cache
  const cache = network === 'testnet' ? cacheTestnet : cacheMainnet;
  if (!search && offset === 0 && cache && Date.now() - cache.timestamp < CACHE_TTL) {
    const filtered = network === 'all' 
      ? [...(cacheMainnet?.agents || []), ...(cacheTestnet?.agents || [])].sort((a, b) => b.score - a.score)
      : cache.agents;
    console.log(`[Discovery] Serving ${filtered.length} agents from cache (${network})`);
    return { agents: filtered.slice(0, limit), total: filtered.length };
  }

  try {
    if (search) {
      // Search mode
      const params = new URLSearchParams({ search, limit: String(limit), offset: String(offset) });
      const response = await fetch(`${SCAN_8004_API}/agents?${params}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) return { agents: [], total: 0 };
      const data = await response.json();
      const agents = (data.items || [])
        .filter((a: any) => a.x402_supported && a.name && !/^Agent #\d+$/.test(a.name))
        .map((a: any) => mapAgent(a));
      return { agents, total: data.total || agents.length };
    }

    // Leaderboard mode — fetch mainnet and/or testnet
    const fetchLeaderboard = async (chainId?: number): Promise<any[]> => {
      const params = new URLSearchParams({ limit: '100' });
      if (chainId) params.set('chain_id', String(chainId));
      try {
        const res = await fetch(`${SCAN_8004_API}/agents/leaderboard?${params}`, {
          headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.items || [];
      } catch { return []; }
    };

    let allItems: any[] = [];

    if (network === 'testnet') {
      // Testnet only — fetch Base Sepolia leaderboard
      allItems = await fetchLeaderboard(84532);
    } else if (network === 'mainnet') {
      // Mainnet only — fetch default leaderboard (excludes testnet by default)
      allItems = await fetchLeaderboard();
    } else {
      // All — fetch both
      const [mainnet, testnet] = await Promise.all([
        fetchLeaderboard(),
        fetchLeaderboard(84532),
      ]);
      allItems = [...mainnet, ...testnet];
    }

    // Filter to x402 agents with real names
    const agents = allItems
      .filter((a: any) => {
        if (!a.x402_supported) return false;
        if (!a.name || /^Agent #\d+$/.test(a.name)) return false;
        return true;
      })
      .map((a: any) => mapAgent(a))
      // Deduplicate by name (same agent may appear on multiple chains)
      .filter((agent, index, self) => 
        self.findIndex(a => a.name === agent.name) === index
      )
      .sort((a, b) => b.score - a.score);

    const total = agents.length;
    console.log(`[Discovery] ${total} x402 agents from leaderboard (${network})`);

    // Update caches
    if (network !== 'testnet') {
      cacheMainnet = { 
        agents: agents.filter(a => !a.isTestnet), 
        total: agents.filter(a => !a.isTestnet).length, 
        timestamp: Date.now() 
      };
    }
    if (network !== 'mainnet') {
      cacheTestnet = { 
        agents: agents.filter(a => a.isTestnet), 
        total: agents.filter(a => a.isTestnet).length, 
        timestamp: Date.now() 
      };
    }

    return { agents: agents.slice(offset, offset + limit), total };
  } catch (error: any) {
    console.error('[Discovery] 8004scan query failed:', error.message);
    const fallback = network === 'testnet' ? cacheTestnet : cacheMainnet;
    if (fallback) {
      console.log('[Discovery] Falling back to stale cache');
      return { agents: fallback.agents, total: fallback.total };
    }
    return { agents: [], total: 0 };
  }
}

/**
 * Map raw 8004scan API response to our DiscoveredAgent format.
 */
function mapAgent(a: any): DiscoveredAgent {
  const svc = a.services || {};
  const healthStatus = a.health_status || {};

  const protocols: string[] = [];
  if (svc?.mcp?.endpoint) protocols.push('MCP');
  if (svc?.a2a?.endpoint) protocols.push('A2A');
  if (svc?.oasf?.endpoint) protocols.push('OASF');
  if (a.x402_supported) protocols.push('x402');

  let overallHealth = 'unknown';
  const healthScore = healthStatus?.health_score ?? 0;
  if (healthStatus?.overall_status === 'healthy') overallHealth = 'healthy';
  else if (healthStatus?.overall_status === 'unhealthy') overallHealth = 'unhealthy';
  else if (healthStatus?.services) {
    const statuses = Object.values(healthStatus.services) as any[];
    if (statuses.some((s: any) => s?.status === 'healthy')) overallHealth = 'healthy';
  }

  const isTestnet = TESTNET_CHAINS.includes(a.chain_id);

  return {
    id: a.id,
    agentId: a.agent_id || '',
    tokenId: a.token_id || '',
    chainId: a.chain_id || 0,
    name: a.name || `Agent #${a.token_id}`,
    description: a.description || '',
    wallet: a.agent_wallet || a.owner_address || '',
    ownerAddress: a.owner_address || '',
    x402Supported: !!a.x402_supported,
    score: a.total_score || 0,
    healthStatus: overallHealth,
    healthScore,
    imageUrl: a.image_url || undefined,
    services: {
      mcp: svc?.mcp?.endpoint ? { endpoint: svc.mcp.endpoint, version: svc.mcp.version || '' } : undefined,
      a2a: svc?.a2a?.endpoint ? { endpoint: svc.a2a.endpoint, version: svc.a2a.version || '', skills: svc.a2a.skills } : undefined,
      oasf: svc?.oasf?.endpoint ? { endpoint: svc.oasf.endpoint, version: svc.oasf.version || '', skills: svc.oasf.skills, domains: svc.oasf.domains } : undefined,
      web: svc?.web?.endpoint ? { endpoint: svc.web.endpoint } : undefined,
    },
    protocols,
    feedbackCount: a.total_feedbacks || 0,
    starCount: a.star_count || 0,
    createdAt: a.created_at || '',
    isTestnet,
  };
}

/**
 * Get a single agent's details by searching 8004scan.
 */
export async function getAgentDetails(agentName: string): Promise<DiscoveredAgent | null> {
  try {
    const result = await discoverAgents({ search: agentName, limit: 1 });
    return result.agents[0] || null;
  } catch {
    return null;
  }
}
