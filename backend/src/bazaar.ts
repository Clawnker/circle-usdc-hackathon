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

// Pricing cache (TTL: 30 minutes — pricing changes rarely)
const PRICING_CACHE_TTL = 30 * 60 * 1000;
const pricingCache = new Map<string, { amount: number; network: string; payTo: string; asset: string; timestamp: number }>();

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
  pricing?: {
    amount: number;   // USDC (human-readable)
    network: string;  // e.g. "eip155:84532"
    payTo: string;
  };
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
  const network = options?.network || 'testnet'; // Default to testnet until mainnet routing is verified

  // Check cache
  const cache = network === 'testnet' ? cacheTestnet : cacheMainnet;
  if (!search && offset === 0 && cache && Date.now() - cache.timestamp < CACHE_TTL) {
    const filtered = network === 'all' 
      ? [...(cacheMainnet?.agents || []), ...(cacheTestnet?.agents || [])].sort((a, b) => b.score - a.score)
      : cache.agents;
    console.log(`[Discovery] Serving ${filtered.length} agents from cache (${network})`);
    return { agents: filtered.slice(0, limit).map(a => enrichWithPricing(a)), total: filtered.length };
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

    // Enrich with cached pricing (non-blocking)
    const enriched = agents.map(a => enrichWithPricing(a));

    // Kick off background pricing probes for agents without cached pricing
    backgroundProbeAll(agents).catch(() => {});

    return { agents: enriched.slice(offset, offset + limit), total };
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
 * Enrich an agent with cached pricing data.
 */
function enrichWithPricing(agent: DiscoveredAgent): DiscoveredAgent {
  const endpoint = getAgentEndpoint(agent);
  if (!endpoint) return agent;

  const cached = pricingCache.get(endpoint);
  if (cached && Date.now() - cached.timestamp < PRICING_CACHE_TTL) {
    return { ...agent, pricing: { amount: cached.amount, network: cached.network, payTo: cached.payTo } };
  }
  return agent;
}

/**
 * Get the primary endpoint URL for an agent.
 */
function getAgentEndpoint(agent: DiscoveredAgent): string | null {
  return agent.services.a2a?.endpoint ||
         agent.services.web?.endpoint ||
         agent.services.mcp?.endpoint ||
         agent.services.oasf?.endpoint ||
         null;
}

/**
 * Background probe all agents for pricing (non-blocking).
 * Only probes agents not already in cache.
 */
async function backgroundProbeAll(agents: DiscoveredAgent[]): Promise<void> {
  const toProbe = agents.filter(a => {
    const ep = getAgentEndpoint(a);
    if (!ep) return false;
    const cached = pricingCache.get(ep);
    return !cached || Date.now() - cached.timestamp >= PRICING_CACHE_TTL;
  });

  if (toProbe.length === 0) return;
  console.log(`[Discovery] Background probing ${toProbe.length} agents for pricing...`);

  // Probe in batches of 5 to avoid hammering
  const BATCH = 5;
  for (let i = 0; i < toProbe.length; i += BATCH) {
    const batch = toProbe.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (agent) => {
        const ep = getAgentEndpoint(agent);
        if (!ep) return;
        const pricing = await probeAgentPricing(ep);
        if (pricing) {
          pricingCache.set(ep, { ...pricing, timestamp: Date.now() });
          console.log(`[Discovery] Pricing: ${agent.name} = $${pricing.amount} USDC`);
        }
      })
    );
  }
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

/**
 * Probe an agent's x402 endpoint to discover pricing.
 * Makes a request without payment → gets 402 with pricing in headers.
 * Returns null if endpoint is unreachable or doesn't support x402.
 */
export async function probeAgentPricing(endpoint: string): Promise<{
  amount: number;  // USDC (human-readable, e.g. 2.5)
  network: string;
  payTo: string;
  asset: string;
} | null> {
  try {
    // Try common x402-protected paths
    const paths = ['/execute', '/audit', '/run', '/api', '/'];
    
    for (const path of paths) {
      const url = endpoint.replace(/\/$/, '') + path;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'pricing-probe' }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.status !== 402) continue;

        // Parse x402 pricing from payment-required header
        const paymentHeader = res.headers.get('payment-required');
        if (!paymentHeader) continue;

        try {
          const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
          const amountMatch = decoded.match(/"amount":"(\d+)"/);
          const networkMatch = decoded.match(/"network":"([^"]+)"/);
          const payToMatch = decoded.match(/"payTo":"([^"]+)"/);
          const assetMatch = decoded.match(/"asset":"([^"]+)"/);

          if (amountMatch) {
            const amountRaw = parseInt(amountMatch[1]);
            return {
              amount: amountRaw / 1_000_000, // USDC has 6 decimals
              network: networkMatch?.[1] || 'unknown',
              payTo: payToMatch?.[1] || '',
              asset: assetMatch?.[1] || '',
            };
          }
        } catch { /* header parsing failed */ }
      } catch {
        clearTimeout(timeout);
      }
    }
    return null;
  } catch {
    return null;
  }
}
