/**
 * Brave Search Tool
 * Provides web search capabilities via Brave Search API
 */

import axios from 'axios';

// Use environment variable or hardcoded key for demo
const BRAVE_API_KEY = process.env.BRAVE_API_KEY || '';
const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchTimeMs: number;
}

/**
 * Search the web using Brave Search API
 */
export async function braveSearch(
  query: string,
  options: {
    count?: number;
    freshness?: 'pd' | 'pw' | 'pm' | 'py'; // past day/week/month/year
    country?: string;
  } = {}
): Promise<SearchResponse> {
  const startTime = Date.now();
  const count = options.count || 5;
  
  // If no API key, return mock results
  if (!BRAVE_API_KEY) {
    console.log('[Brave] No API key, using mock search');
    return mockSearch(query, count, startTime);
  }
  
  try {
    const response = await axios.get(BRAVE_API_URL, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY,
      },
      params: {
        q: query,
        count,
        freshness: options.freshness,
        country: options.country || 'us',
      },
    });
    
    const webResults = response.data.web?.results || [];
    
    return {
      query,
      results: webResults.map((r: any) => ({
        title: r.title,
        url: r.url,
        description: r.description,
        age: r.age,
      })),
      totalResults: response.data.web?.count || webResults.length,
      searchTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('[Brave] Search error:', error.message);
    return mockSearch(query, count, startTime);
  }
}

/**
 * Mock search for demo/fallback
 */
function mockSearch(query: string, count: number, startTime: number): SearchResponse {
  const lowerQuery = query.toLowerCase();
  
  // Generate contextual mock results based on query
  let results: SearchResult[] = [];
  
  if (lowerQuery.includes('solana') || lowerQuery.includes('sol')) {
    results = [
      {
        title: 'Solana: Web3 Infrastructure for Everyone',
        url: 'https://solana.com',
        description: 'Solana is a high-performance blockchain supporting builders around the world creating crypto apps.',
        age: '1 day ago',
      },
      {
        title: 'Solana Price, SOL Chart, and Market Cap | CoinGecko',
        url: 'https://coingecko.com/en/coins/solana',
        description: 'Get Solana price, SOL chart, trading volume, market cap, and more.',
        age: '2 hours ago',
      },
      {
        title: 'Solana Ecosystem - DeFi, NFTs, and More',
        url: 'https://solana.com/ecosystem',
        description: 'Explore the Solana ecosystem of decentralized apps, DeFi protocols, and NFT marketplaces.',
        age: '3 days ago',
      },
    ];
  } else if (lowerQuery.includes('firedancer')) {
    results = [
      {
        title: 'Firedancer: A New Solana Validator Client by Jump Crypto',
        url: 'https://jumpcrypto.com/firedancer',
        description: 'Firedancer is a new, independent Solana validator client being built by Jump Crypto to increase network resilience.',
        age: '1 week ago',
      },
      {
        title: 'Firedancer Testnet Achieves 1M+ TPS',
        url: 'https://theblock.co/post/firedancer-testnet',
        description: 'Jump Crypto\'s Firedancer validator client demonstrates unprecedented transaction throughput on testnet.',
        age: '3 days ago',
      },
    ];
  } else if (lowerQuery.includes('mountain') || lowerQuery.includes('everest')) {
    results = [
      {
        title: 'Mount Everest - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Mount_Everest',
        description: 'Mount Everest is Earth\'s highest mountain above sea level, located in the Mahalangur Himal sub-range of the Himalayas.',
        age: '1 month ago',
      },
      {
        title: 'Mount Everest | Height, Location, Map, & Facts | Britannica',
        url: 'https://britannica.com/place/Mount-Everest',
        description: 'Mount Everest, mountain on the crest of the Great Himalayas of southern Asia. Height: 29,032 feet (8,849 meters).',
        age: '2 weeks ago',
      },
    ];
  } else {
    // Generic results
    results = [
      {
        title: `Search results for: ${query}`,
        url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        description: `Information about ${query}. This is a mock result for demonstration purposes.`,
        age: '1 day ago',
      },
      {
        title: `${query} - Latest News and Updates`,
        url: `https://news.example.com/${query.replace(/\s+/g, '-').toLowerCase()}`,
        description: `Stay updated with the latest news about ${query}.`,
        age: '6 hours ago',
      },
    ];
  }
  
  return {
    query,
    results: results.slice(0, count),
    totalResults: results.length,
    searchTimeMs: Date.now() - startTime,
  };
}

export default {
  search: braveSearch,
};
