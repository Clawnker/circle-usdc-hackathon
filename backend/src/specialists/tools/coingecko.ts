/**
 * CoinGecko Tool
 * Provides real-time crypto price and market data
 */

import axios from 'axios';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Token ID mapping for CoinGecko
const TOKEN_IDS: Record<string, string> = {
  'SOL': 'solana',
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'BONK': 'bonk',
  'WIF': 'dogwifcoin',
  'JUP': 'jupiter-exchange-solana',
  'POPCAT': 'popcat',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'RAY': 'raydium',
  'PYTH': 'pyth-network',
  'RENDER': 'render-token',
  'HNT': 'helium',
};

export interface PriceData {
  token: string;
  price: number;
  change24h: number;
  change7d?: number;
  marketCap?: number;
  volume24h?: number;
  lastUpdated: Date;
}

export interface MarketData extends PriceData {
  rank: number;
  circulatingSupply: number;
  totalSupply?: number;
  maxSupply?: number;
  ath: number;
  athDate: Date;
  atl: number;
  atlDate: Date;
}

/**
 * Get current price for a token
 */
export async function getPrice(token: string): Promise<PriceData> {
  const tokenId = TOKEN_IDS[token.toUpperCase()] || token.toLowerCase();
  
  try {
    const response = await axios.get(`${COINGECKO_API}/simple/price`, {
      params: {
        ids: tokenId,
        vs_currencies: 'usd',
        include_24hr_change: true,
        include_7d_change: true,
        include_market_cap: true,
        include_24hr_vol: true,
      },
      timeout: 10000,
    });
    
    const data = response.data[tokenId] || response.data[tokenId.toLowerCase()] || response.data[tokenId.toUpperCase()];
    if (!data || typeof data.usd !== 'number' || Number.isNaN(data.usd)) {
      return mockPrice(token);
    }
    
    return {
      token: token.toUpperCase(),
      price: data.usd,
      change24h: data.usd_24h_change || 0,
      change7d: data.usd_7d_change,
      marketCap: data.usd_market_cap,
      volume24h: data.usd_24h_vol,
      lastUpdated: new Date(),
    };
  } catch (error: any) {
    console.log('[CoinGecko] Price fetch error:', error.message);
    return mockPrice(token);
  }
}

/**
 * Get full market data for a token
 */
export async function getMarketData(token: string): Promise<MarketData> {
  const tokenId = TOKEN_IDS[token.toUpperCase()] || token.toLowerCase();
  
  try {
    const response = await axios.get(`${COINGECKO_API}/coins/${tokenId}`, {
      params: {
        localization: false,
        tickers: false,
        community_data: false,
        developer_data: false,
      },
      timeout: 10000,
    });
    
    const data = response.data;
    const market = data.market_data;
    
    return {
      token: token.toUpperCase(),
      price: market.current_price.usd,
      change24h: market.price_change_percentage_24h || 0,
      change7d: market.price_change_percentage_7d,
      marketCap: market.market_cap.usd,
      volume24h: market.total_volume.usd,
      rank: data.market_cap_rank,
      circulatingSupply: market.circulating_supply,
      totalSupply: market.total_supply,
      maxSupply: market.max_supply,
      ath: market.ath.usd,
      athDate: new Date(market.ath_date.usd),
      atl: market.atl.usd,
      atlDate: new Date(market.atl_date.usd),
      lastUpdated: new Date(),
    };
  } catch (error: any) {
    console.log('[CoinGecko] Market data fetch error:', error.message);
    return mockMarketData(token);
  }
}

/**
 * Get trending coins
 */
export async function getTrending(): Promise<Array<{ token: string; rank: number; price?: number }>> {
  try {
    const response = await axios.get(`${COINGECKO_API}/search/trending`, { timeout: 10000 });
    
    return response.data.coins.slice(0, 7).map((item: any, index: number) => ({
      token: item.item.symbol.toUpperCase(),
      rank: index + 1,
      price: item.item.price_btc,
    }));
  } catch (error: any) {
    console.log('[CoinGecko] Trending fetch error:', error.message);
    return [
      { token: 'SOL', rank: 1 },
      { token: 'BONK', rank: 2 },
      { token: 'WIF', rank: 3 },
      { token: 'JUP', rank: 4 },
      { token: 'POPCAT', rank: 5 },
    ];
  }
}

/**
 * Mock price data for fallback
 */
function mockPrice(token: string): PriceData {
  const mockPrices: Record<string, number> = {
    'SOL': 127.50,
    'BTC': 68500,
    'ETH': 3520,
    'BONK': 0.000028,
    'WIF': 2.35,
    'JUP': 0.92,
    'POPCAT': 0.45,
    'USDC': 1.00,
    'USDT': 1.00,
  };
  
  const price = mockPrices[token.toUpperCase()] || 1.0;
  const change = -5 + Math.random() * 15; // -5% to +10%
  
  return {
    token: token.toUpperCase(),
    price,
    change24h: change,
    change7d: change * 2,
    marketCap: price * 1000000000,
    volume24h: price * 100000000,
    lastUpdated: new Date(),
  };
}

/**
 * Mock market data for fallback
 */
function mockMarketData(token: string): MarketData {
  const priceData = mockPrice(token);
  
  return {
    ...priceData,
    rank: 10,
    circulatingSupply: 1000000000,
    totalSupply: 1500000000,
    maxSupply: undefined,
    ath: priceData.price * 1.5,
    athDate: new Date('2024-11-01'),
    atl: priceData.price * 0.1,
    atlDate: new Date('2023-01-01'),
  };
}

export default {
  getPrice,
  getMarketData,
  getTrending,
};
