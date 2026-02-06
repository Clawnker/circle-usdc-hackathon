/**
 * Tools Index
 * Unified access to all specialist tools (MCP-first, with fallbacks)
 */

import mcpClient from './mcp-client';
import braveSearchFallback, { SearchResult, SearchResponse } from './brave-search';
import coingecko, { PriceData, MarketData } from './coingecko';

/**
 * Web Search - MCP-first with fallback
 */
export async function webSearch(
  query: string, 
  options: { count?: number; freshness?: 'pd' | 'pw' | 'pm' | 'py' } = {}
): Promise<SearchResponse> {
  const count = options.count || 5;
  const startTime = Date.now();
  
  // Try MCP Brave Search first
  if (!options.freshness) {
    try {
      const mcpResult = await mcpClient.braveSearch(query, count);
      if (mcpResult && mcpResult.web && mcpResult.web.results) {
        console.log('[Tools] Used MCP Brave Search');
        return {
          query,
          results: mcpResult.web.results.map((r: any) => ({
            title: r.title,
            url: r.url,
            description: r.description,
            age: r.age,
          })),
          totalResults: mcpResult.web.results.length,
          searchTimeMs: Date.now() - startTime,
        };
      }
    } catch (error) {
      // Fall through to fallback
    }
  }
  
  // Fallback to direct API
  console.log('[Tools] Using Brave Search fallback');
  return braveSearchFallback.search(query, options);
}

/**
 * Fetch URL content - MCP-first with basic fallback
 */
export async function fetchUrl(url: string, maxLength?: number): Promise<string | null> {
  // Try MCP fetch first
  try {
    const content = await mcpClient.fetchUrl(url, maxLength);
    if (content) {
      console.log('[Tools] Used MCP fetch');
      return content;
    }
  } catch (error) {
    // Fall through to basic fetch
  }
  
  // Basic fallback (just fetch text)
  console.log('[Tools] Using basic fetch fallback');
  try {
    const response = await fetch(url);
    const text = await response.text();
    return maxLength ? text.slice(0, maxLength) : text;
  } catch (error: any) {
    console.error('[Tools] Fetch failed:', error.message);
    return null;
  }
}

/**
 * Get token price - CoinGecko (no MCP equivalent yet)
 */
export async function getTokenPrice(token: string): Promise<PriceData> {
  return coingecko.getPrice(token);
}

/**
 * Get full market data - CoinGecko
 */
export async function getMarketData(token: string): Promise<MarketData> {
  return coingecko.getMarketData(token);
}

/**
 * Get trending tokens - CoinGecko
 */
export async function getTrendingTokens(): Promise<Array<{ token: string; rank: number }>> {
  return coingecko.getTrending();
}

/**
 * Cleanup - close MCP connections
 */
export async function cleanup(): Promise<void> {
  await mcpClient.closeAll();
}

export default {
  webSearch,
  fetchUrl,
  getTokenPrice,
  getMarketData,
  getTrendingTokens,
  cleanup,
};
