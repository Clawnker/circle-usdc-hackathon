/**
 * x402 Bazaar Integration
 * 
 * Connects to the x402.org facilitator discovery layer to:
 * 1. Browse external agent services available in the Bazaar
 * 2. Register our own specialists as discoverable x402 services
 * 
 * Reference: https://docs.cdp.coinbase.com/x402/bazaar
 */

import config from './config';

const BASE_URL = process.env.BASE_URL || 'https://circle-usdc-hackathon.onrender.com';
const FACILITATOR_URL = 'https://x402.org/facilitator';
// CDP facilitator is the one that actually has the discovery/Bazaar endpoint
const CDP_FACILITATOR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';
const DISCOVERY_ENDPOINT = `${CDP_FACILITATOR_URL}/discovery/resources`;

// Treasury and network constants
const TREASURY_ADDRESS = '0x676fF3d546932dE6558a267887E58e39f405B135';
const BASE_SEPOLIA_NETWORK = 'eip155:84532';

export interface BazaarService {
  resourceUrl: string;
  name: string;
  description: string;
  schemes: string[];
  accepts: {
    scheme: string;
    network: string;
    payTo: string;
    price: number; // in dollars (derived from maxAmountRequired)
    maxTimeoutSeconds: number;
  }[];
  inputSchema?: object;
  outputSchema?: object;
  healthUrl?: string;
  icon?: string;
  x402Version?: number;
  lastUpdated?: string;
}

/**
 * Query the x402 Bazaar (CDP facilitator) for available services.
 * Returns external agents that accept x402 payments.
 * 
 * CDP endpoint: GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources
 * Returns { items: [...], pagination: { limit, offset, total }, x402Version }
 */
export async function discoverBazaarServices(options?: { limit?: number; offset?: number }): Promise<{ services: BazaarService[]; total: number }> {
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;
  
  try {
    const url = `${DISCOVERY_ENDPOINT}?type=http&limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[Bazaar] CDP discovery endpoint returned:', response.status);
      return { services: [], total: 0 };
    }

    const data = await response.json();
    const items = data.items || [];
    const total = data.pagination?.total || items.length;
    
    // Map CDP discovery format to our BazaarService format
    const services: BazaarService[] = items.map((item: any) => {
      const firstAccept = item.accepts?.[0] || {};
      const description = firstAccept.description || item.metadata?.description || 'x402 service';
      // maxAmountRequired is in micro-units (e.g., 1000 = $0.001 for 6-decimal USDC)
      const priceRaw = parseInt(firstAccept.maxAmountRequired || '0', 10);
      const price = priceRaw / 1_000_000; // Convert from USDC base units to dollars
      
      return {
        resourceUrl: item.resource,
        name: extractServiceName(item.resource, description),
        description,
        schemes: [...new Set(item.accepts?.map((a: any) => a.scheme) || ['exact'])],
        accepts: (item.accepts || []).map((a: any) => ({
          scheme: a.scheme || 'exact',
          network: a.network || '',
          payTo: a.payTo || '',
          price: parseInt(a.maxAmountRequired || '0', 10) / 1_000_000,
          maxTimeoutSeconds: a.maxTimeoutSeconds || 300,
        })),
        inputSchema: firstAccept.outputSchema?.input || undefined,
        outputSchema: firstAccept.outputSchema?.output || undefined,
        x402Version: item.x402Version,
        lastUpdated: item.lastUpdated,
      };
    });
    
    console.log(`[Bazaar] Discovered ${services.length} external services (total: ${total})`);
    return { services, total };
  } catch (error: any) {
    console.error('[Bazaar] Failed to discover services:', error.message);
    return { services: [], total: 0 };
  }
}

/**
 * Extract a readable service name from the resource URL and description.
 */
function extractServiceName(resourceUrl: string, description: string): string {
  try {
    const url = new URL(resourceUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1] || '';
    const host = url.hostname.replace('www.', '');
    // Use last path segment as name, falling back to hostname
    const name = lastPart 
      ? lastPart.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())
      : host;
    return name;
  } catch {
    return description.slice(0, 40);
  }
}

/**
 * Our internal specialists as x402 services.
 * These are what external agents would see when browsing the Bazaar.
 */
export function getInternalBazaarServices(): BazaarService[] {
  const specialists = [
    {
      id: 'magos',
      name: 'Magos',
      description: 'Market analysis and price data specialist. Provides real-time cryptocurrency prices, market trends, and financial analysis via CoinGecko API.',
      fee: config.fees.magos || 0.1,
      capabilities: ['market-analysis', 'price-data', 'finance'],
    },
    {
      id: 'aura',
      name: 'Aura',
      description: 'Social sentiment and web monitoring specialist. Analyzes social media trends, news sentiment, and online discussions via Brave Search.',
      fee: config.fees.aura || 0.1,
      capabilities: ['sentiment-analysis', 'social-monitoring', 'trends'],
    },
    {
      id: 'seeker',
      name: 'Seeker',
      description: 'Web research and information retrieval specialist. Deep web search capabilities with citation extraction and source verification.',
      fee: config.fees.seeker || 0.1,
      capabilities: ['web-research', 'search', 'information-retrieval'],
    },
    {
      id: 'scribe',
      name: 'Scribe',
      description: 'Synthesis and content creation specialist. Synthesizes multi-source information into coherent summaries, reports, and structured content.',
      fee: config.fees.scribe || 0.1,
      capabilities: ['synthesis', 'summarization', 'content-creation'],
    },
    {
      id: 'bankr',
      name: 'Bankr',
      description: 'DeFi operations specialist. Token swaps, transfers, and on-chain transactions via Jupiter and other DEX aggregators.',
      fee: config.fees.bankr || 0.1,
      capabilities: ['defi', 'token-swaps', 'transactions'],
    },
    {
      id: 'sentinel',
      name: 'Sentinel',
      description: 'Smart contract security audit specialist. External service for automated contract analysis and vulnerability detection.',
      fee: config.fees.sentinel || 2.5,
      capabilities: ['security-audit', 'smart-contracts', 'vulnerability-detection'],
    },
  ];

  return specialists.map((spec) => ({
    resourceUrl: `${BASE_URL}/api/specialist/${spec.id}`,
    name: spec.name,
    description: spec.description,
    schemes: ['exact'],
    accepts: [{
      scheme: 'exact',
      network: BASE_SEPOLIA_NETWORK,
      payTo: TREASURY_ADDRESS,
      price: spec.fee,
      maxTimeoutSeconds: 300,
    }],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The query to process' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'string', description: 'The processed result' },
        sources: { type: 'array', items: { type: 'string' } },
        cost: { type: 'number' },
      },
    },
    healthUrl: `${BASE_URL}/health`,
  }));
}

/**
 * Combined discovery: internal + external Bazaar services.
 * External discovery failure is non-fatal — we always return internals.
 */
export async function getAllDiscoverableServices(options?: { limit?: number; offset?: number }): Promise<{ services: BazaarService[]; externalTotal: number }> {
  const internal = getInternalBazaarServices();
  
  let external: BazaarService[] = [];
  let externalTotal = 0;
  try {
    const result = await discoverBazaarServices(options);
    external = result.services;
    externalTotal = result.total;
  } catch (err: any) {
    console.warn('[Bazaar] External discovery failed (non-fatal):', err.message);
  }
  
  return { services: [...internal, ...external], externalTotal };
}

/**
 * Get service details for a specific Bazaar endpoint
 */
export async function getBazaarServiceDetails(resourceUrl: string): Promise<BazaarService | null> {
  try {
    const response = await fetch(resourceUrl, {
      method: 'OPTIONS',
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      resourceUrl,
      ...data,
    };
  } catch (error: any) {
    console.error('[Bazaar] Failed to get service details:', error.message);
    return null;
  }
}
