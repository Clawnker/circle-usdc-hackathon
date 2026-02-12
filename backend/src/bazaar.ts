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

// Cache for leaderboard results (TTL: 5 minutes)
let agentCache: { agents: DiscoveredAgent[]; total: number; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export interface DiscoveredAgent {
  id: string;          // 8004scan UUID
  agentId: string;     // On-chain ID (e.g., "8453:0x8004...a432:1348")
  tokenId: string;
  chainId: number;
  name: string;
  description: string;
  wallet: string;
  ownerAddress: string;
  x402Supported: boolean;
  score: number;       // 8004scan total_score (0-100)
  healthStatus: string; // 'healthy' | 'unknown' | 'unhealthy'
  healthScore: number;
  imageUrl?: string;
  services: {
    mcp?: { endpoint: string; version: string };
    a2a?: { endpoint: string; version: string; skills?: string[] };
    oasf?: { endpoint: string; version: string; skills?: string[]; domains?: string[] };
    web?: { endpoint: string };
  };
  protocols: string[];  // e.g., ['MCP', 'A2A', 'OASF', 'x402']
  feedbackCount: number;
  starCount: number;
  createdAt: string;
}

/**
 * Discover external agents from 8004scan's ERC-8004 registry.
 * Uses the leaderboard endpoint for quality-ranked results.
 * Falls back to search endpoint when a search query is provided.
 */
export async function discoverAgents(options?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<{ agents: DiscoveredAgent[]; total: number }> {
  const limit = Math.min(options?.limit || 50, 100);
  const offset = options?.offset || 0;
  const search = options?.search || '';

  // Check cache for default queries (no search, first page)
  if (!search && offset === 0 && agentCache && Date.now() - agentCache.timestamp < CACHE_TTL) {
    console.log(`[Discovery] Serving ${agentCache.agents.length} agents from cache`);
    return { agents: agentCache.agents.slice(0, limit), total: agentCache.total };
  }

  try {
    let items: any[] = [];
    let total = 0;

    if (search) {
      // Search mode: use the agents search endpoint
      const params = new URLSearchParams({
        search,
        limit: String(limit),
        offset: String(offset),
      });
      const response = await fetch(`${SCAN_8004_API}/agents?${params}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        items = data.items || [];
        total = data.total || 0;
      }
    } else {
      // Default mode: use the leaderboard endpoint (pre-sorted by score)
      const response = await fetch(`${SCAN_8004_API}/agents/leaderboard?limit=100`, {
        headers: { 'Accept': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        items = data.items || [];
        total = data.total || items.length;
      }
    }

    // Filter to x402-supported agents
    const agents: DiscoveredAgent[] = items
      .filter((a: any) => {
        if (!a.x402_supported) return false;
        // Skip testnet agents in default view
        if (!search && (a.chain_id === 11155111 || a.chain_id === 84532)) return false;
        // Must have a real name
        if (!a.name || /^Agent #\d+$/.test(a.name)) return false;
        return true;
      })
      .map((a: any) => mapAgent(a))
      .slice(offset, offset + limit);

    const x402Total = items.filter((a: any) => a.x402_supported).length;
    console.log(`[Discovery] ${agents.length} x402 agents from ${items.length} leaderboard entries (${x402Total} x402 total)`);

    // Cache first-page default results
    if (!search && offset === 0) {
      agentCache = { agents, total: x402Total, timestamp: Date.now() };
    }

    return { agents, total: x402Total };
  } catch (error: any) {
    console.error('[Discovery] 8004scan query failed:', error.message);
    if (agentCache) {
      console.log('[Discovery] Falling back to stale cache');
      return { agents: agentCache.agents, total: agentCache.total };
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

  // Build protocols list
  const protocols: string[] = [];
  if (svc?.mcp?.endpoint) protocols.push('MCP');
  if (svc?.a2a?.endpoint) protocols.push('A2A');
  if (svc?.oasf?.endpoint) protocols.push('OASF');
  if (a.x402_supported) protocols.push('x402');

  // Derive overall health
  let overallHealth = 'unknown';
  let healthScore = healthStatus?.health_score ?? 0;
  if (healthStatus?.overall_status === 'healthy') overallHealth = 'healthy';
  else if (healthStatus?.overall_status === 'unhealthy') overallHealth = 'unhealthy';
  else if (healthStatus?.services) {
    const statuses = Object.values(healthStatus.services) as any[];
    const healthyCount = statuses.filter((s: any) => s?.status === 'healthy').length;
    if (healthyCount > 0) overallHealth = 'healthy';
  }

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
