/**
 * Agent Discovery via 8004scan (ERC-8004 Registry)
 * 
 * Single source of truth for external agent discovery.
 * Queries the 8004scan API for ERC-8004 registered agents with x402 support.
 * 
 * Pricing is discovered at call time via x402 protocol (402 responses),
 * not pre-indexed — keeps things simple and always fresh.
 * 
 * Reference: https://www.8004scan.io
 */

// 8004scan public API
const SCAN_8004_API = 'https://www.8004scan.io/api/v1';

// Cache for 8004scan results (TTL: 5 minutes)
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
 * Filters to x402-supporting agents with real service endpoints.
 */
export async function discoverAgents(options?: {
  limit?: number;
  offset?: number;
  search?: string;
  chain?: 'base' | 'ethereum' | 'all';
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
    // Build query — 8004scan API supports search, limit, offset
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (search) {
      params.set('search', search);
    } else {
      // Without search, fetch multiple pages and filter/sort client-side
      // since the API returns newest-first (mostly empty registrations)
      const allItems: any[] = [];
      const pagesToFetch = 5; // 5 pages × 100 = scan 500 agents
      for (let page = 0; page < pagesToFetch; page++) {
        const pageParams = new URLSearchParams({
          limit: '100',
          offset: String(page * 100),
        });
        try {
          const pageRes = await fetch(`${SCAN_8004_API}/agents?${pageParams}`, {
            headers: { 'Accept': 'application/json' },
          });
          if (pageRes.ok) {
            const pageData = await pageRes.json();
            allItems.push(...(pageData.items || []));
          }
        } catch { /* skip failed pages */ }
      }

      // Filter, sort, and return
      const agents: DiscoveredAgent[] = allItems
        .filter((a: any) => {
          if (!a.x402_supported) return false;
          if (a.chain_id === 11155111 || a.chain_id === 84532) return false;
          if (!a.name || /^Agent #\d+$/.test(a.name)) return false;
          return true;
        })
        .map((a: any) => mapAgent(a))
        .sort((a, b) => b.score - a.score)
        .slice(offset, offset + limit);

      const total = allItems.length;
      console.log(`[Discovery] Found ${agents.length} x402 agents from ${allItems.length} scanned`);

      if (!search && offset === 0) {
        agentCache = { agents, total, timestamp: Date.now() };
      }

      return { agents, total };
    }

    const url = `${SCAN_8004_API}/agents?${params}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.warn(`[Discovery] 8004scan returned ${response.status}`);
      return { agents: [], total: 0 };
    }

    const data = await response.json();
    const items: any[] = data.items || [];
    const total = data.total || 0;

    // Filter and map to our format
    const agents: DiscoveredAgent[] = items
      .filter((a: any) => {
        // Must have x402 support
        if (!a.x402_supported) return false;
        // Must not be a testnet-only agent (unless searching)
        if (!search && (a.chain_id === 11155111 || a.chain_id === 84532)) return false;
        // Must have a name (not just "Agent #12345")
        if (!a.name || /^Agent #\d+$/.test(a.name)) return false;
        return true;
      })
      .map((a: any) => mapAgent(a))
      // Sort by score descending (8004scan API doesn't support sort)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`[Discovery] Found ${agents.length} agents with x402 + endpoints (of ${items.length} returned, ${total} total)`);

    // Cache first-page default results
    if (!search && offset === 0) {
      agentCache = { agents, total, timestamp: Date.now() };
    }

    return { agents, total };
  } catch (error: any) {
    console.error('[Discovery] 8004scan query failed:', error.message);
    // Return cached data if available
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
  // Fall back to checking individual services
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
