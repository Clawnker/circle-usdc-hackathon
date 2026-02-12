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
const DISCOVERY_ENDPOINT = `${FACILITATOR_URL}/discovery/resources`;

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
    price: number; // in dollars
    maxTimeoutSeconds: number;
  }[];
  inputSchema?: object;
  outputSchema?: object;
  healthUrl?: string;
  icon?: string;
}

/**
 * Query the x402 Bazaar for available services.
 * Returns external agents that accept x402 payments.
 */
export async function discoverBazaarServices(): Promise<BazaarService[]> {
  try {
    const response = await fetch(DISCOVERY_ENDPOINT, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[Bazaar] Discovery endpoint returned:', response.status);
      return [];
    }

    const data = await response.json();
    // Facilitator returns services in a specific format
    const services: BazaarService[] = data.resources || data.services || data || [];
    
    console.log(`[Bazaar] Discovered ${services.length} external services`);
    return services;
  } catch (error: any) {
    console.error('[Bazaar] Failed to discover services:', error.message);
    return [];
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
export async function getAllDiscoverableServices(): Promise<BazaarService[]> {
  const internal = getInternalBazaarServices();
  
  let external: BazaarService[] = [];
  try {
    external = await discoverBazaarServices();
  } catch (err: any) {
    console.warn('[Bazaar] External discovery failed (non-fatal):', err.message);
  }
  
  return [...internal, ...external];
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
