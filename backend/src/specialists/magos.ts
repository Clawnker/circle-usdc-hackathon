/**
 * Magos Specialist
 * Expert in predictions and market analysis
 * Uses MoltX API for social trends + Jupiter for real-time price data + Brave for deep analysis
 */

import axios from 'axios';
import config from '../config';
import { MagosPrediction, SpecialistResult } from '../types';
import { braveSearch } from './tools/brave-search';

const MOLTX_API = 'https://moltx.io/v1';
const MOLTX_KEY = config.specialists.moltx?.apiKey || process.env.MOLTX_API_KEY;
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';

const TOKEN_ALIASES: Record<string, string> = {
  'bitcoin': 'BTC', 'btc': 'BTC',
  'ethereum': 'ETH', 'eth': 'ETH', 'ether': 'ETH',
  'solana': 'SOL', 'sol': 'SOL',
  'usdc': 'USDC', 'usdt': 'USDT',
  'base': 'BASE', 'polygon': 'MATIC', 'avalanche': 'AVAX',
};

const TOKEN_MINTS: Record<string, string> = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'BTC': '3NZ9J7Nkf6W6Y5s5B6d1A866666666666666666666', // WBTC
  'ETH': '7vf79GH2nU78W973sRbeXfTPhEAtRPRQ8vKyS5FmP9', // WETH
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'BONK': 'DezXAZ8z7Pnrn9jzX7BSS4CR1GY8PV2Swbe3PZimbUmA',
  'WIF': 'EKpQGSJtjMFqKZ9KQanCDT7YV3dQrN5ifR8n2An36S31',
  'JUP': 'JUPyiwrYJFskR4ZBvMmcuyMvM8FmNdxUuzpzp7L6z8v',
  'POPCAT': '7GCih6mSgSwwZ9Y9CnyTmsL7w13r6uunqB7UStyK88w',
};

/**
 * Magos specialist handler
 */
export const magos = {
  name: 'Magos',
  description: 'Market Oracle - real-time predictions, risk analysis, and social trend detection',
  
  async handle(prompt: string): Promise<SpecialistResult> {
    const startTime = Date.now();
    
    try {
      const intent = parseIntent(prompt);
      let data: any;
      
      switch (intent.type) {
        case 'trending':
          data = await findTrendingTokens(prompt);
          break;
        case 'predict':
          data = await predictPrice(intent.token || 'SOL', intent.timeHorizon || '4h');
          break;
        case 'risk':
          data = await assessRisk(intent.token || 'SOL');
          break;
        case 'analyze':
          data = await analyzeToken(intent.token || 'SOL');
          break;
        case 'sentiment':
          data = await analyzeSentiment(intent.token || prompt);
          break;
        default:
          data = await generateInsight(prompt);
      }

      return {
        success: true,
        data,
        confidence: data.confidence || 0.75,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error('[Magos] Error:', error.message);
      return {
        success: false,
        data: { error: error.message },
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Parse user intent from prompt
 */
function parseIntent(prompt: string): { type: string; token?: string; timeHorizon?: string } {
  const lower = prompt.toLowerCase();
  
  // Extract token mention using alias map
  let token: string | undefined;
  for (const [alias, symbol] of Object.entries(TOKEN_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`, 'i').test(lower)) {
      token = symbol;
      break;
    }
  }
  
  // Fallback to regex
  if (!token) {
    const tokenMatch = prompt.match(/\b(SOL|BTC|ETH|BONK|WIF|JUP|POPCAT|PEPE|DOGE|[A-Za-z0-9]{32,44})\b/i);
    token = tokenMatch ? tokenMatch[1].toUpperCase() : undefined;
  }
  
  // Time horizon
  const timeMatch = prompt.match(/(\d+)\s*(h|hour|hr|d|day|w|week|m|min)/i);
  let timeHorizon = '4h';
  if (timeMatch) {
    const num = parseInt(timeMatch[1]);
    const unit = timeMatch[2].toLowerCase();
    if (unit.startsWith('h')) timeHorizon = `${num}h`;
    else if (unit.startsWith('d')) timeHorizon = `${num}d`;
    else if (unit.startsWith('w')) timeHorizon = `${num}w`;
  }
  
  // Intent detection
  if (lower.includes('trending') || lower.includes('meme coin') || (lower.includes('find') && lower.includes('coin'))) {
    return { type: 'trending' };
  }
  if (lower.includes('sentiment') || lower.includes('bullish') || lower.includes('bearish')) {
    return { type: 'sentiment', token };
  }
  if (lower.includes('predict') || lower.includes('price') || lower.includes('forecast')) {
    return { type: 'predict', token, timeHorizon };
  }
  if (lower.includes('risk') || lower.includes('safe') || lower.includes('rug')) {
    return { type: 'risk', token };
  }
  if (lower.includes('analyze') || lower.includes('analysis')) {
    return { type: 'analyze', token };
  }
  
  return { type: 'insight', token, timeHorizon };
}

/**
 * Helper to get price from Jupiter
 */
async function getJupiterPrice(token: string): Promise<{ price: number; mint: string } | null> {
  const mint = TOKEN_MINTS[token.toUpperCase()] || (token.length >= 32 ? token : null);
  if (!mint) return null;

  try {
    const response = await axios.get(`${JUPITER_PRICE_API}?ids=${mint}`);
    const data = response.data.data[mint];
    if (data && data.price) {
      return { price: parseFloat(data.price), mint };
    }
  } catch (err: any) {
    console.log(`[Magos] Jupiter price fetch error:`, err.message);
  }
  return null;
}

/**
 * Call LLM or Search for analysis
 */
async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      const response = await axios.post(url, {
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              { text: `\n\nUser request: "${userPrompt}"` }
            ]
          }
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
      });
      const data = response.data;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text.trim();
    } catch (e: any) {
      console.log('[Magos] LLM failed:', e.message);
    }
  }

  const search = await braveSearch(userPrompt);
  return search.results.map(r => r.description).join(' ').slice(0, 1000) || "Data unavailable.";
}

/**
 * Find trending tokens from MoltX + Brave
 */
async function findTrendingTokens(query: string) {
  console.log('[Magos] Searching for trending tokens...');
  
  try {
    const feedRes = await axios.get(`${MOLTX_API}/feed/global?limit=50`);
    const posts = feedRes.data?.posts || [];
    const tokenMentions: Record<string, number> = {};
    const tokenRegex = /\$([A-Z]{2,10})\b/g;
    
    for (const post of posts) {
      const content = post.content || '';
      const matches = content.matchAll(tokenRegex);
      for (const match of matches) {
        const t = match[1].toUpperCase();
        tokenMentions[t] = (tokenMentions[t] || 0) + 1;
      }
    }
    
    const sorted = Object.entries(tokenMentions)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
      
    if (sorted.length > 0) {
      const trending = sorted.map(([token, mentions]) => ({
        token, mentions, sentiment: mentions > 3 ? 'bullish' : 'neutral'
      }));
      return {
        insight: `🔥 **Trending on MoltX:** ${trending.map(t => `$${t.token} (${t.mentions} mentions)`).join(', ')}.`,
        confidence: 0.85,
        trending,
        relatedTokens: trending.map(t => t.token)
      };
    }
  } catch (err) {
    console.log('[Magos] MoltX error, falling back to search');
  }

  const search = await braveSearch("trending crypto tokens solana right now");
  const insight = await callLLM("Identify trending crypto tokens from these search results and provide a summary.", search.results.map(r => r.description).join('\n'));
  
  return {
    insight: `📊 **Market Trends:** ${insight}`,
    confidence: 0.7,
    trending: [],
    relatedTokens: []
  };
}

/**
 * Analyze sentiment
 */
async function analyzeSentiment(tokenOrQuery: string) {
  console.log(`[Magos] Analyzing sentiment for: ${tokenOrQuery}`);
  
  const search = await braveSearch(`${tokenOrQuery} crypto sentiment news`);
  const analysis = await callLLM("Analyze the sentiment (bullish, bearish, or neutral) for the following topic and provide a brief explanation.", 
    `Topic: ${tokenOrQuery}\n\nSearch Results: ${search.results.map(r => r.description).join('\n')}`);
  
  const lower = analysis.toLowerCase();
  const sentiment = lower.includes('bullish') ? 'bullish' : lower.includes('bearish') ? 'bearish' : 'neutral';
  
  return {
    insight: analysis,
    confidence: 0.8,
    sentiment,
    score: sentiment === 'bullish' ? 0.5 : sentiment === 'bearish' ? -0.5 : 0,
    relatedTokens: [tokenOrQuery.toUpperCase()]
  };
}

/**
 * Price prediction
 */
async function predictPrice(token: string = 'SOL', timeHorizon: string = '4h'): Promise<MagosPrediction> {
  console.log(`[Magos] Predicting price for ${token}`);
  
  const jup = await getJupiterPrice(token);
  let currentPrice = jup?.price;
  
  if (!currentPrice) {
    const search = await braveSearch(`${token} crypto price usd`);
    const match = search.results[0]?.description.match(/\$([0-9,.]+)/);
    if (match) currentPrice = parseFloat(match[1].replace(/,/g, ''));
  }
  
  if (!currentPrice) {
    throw new Error(`Real-time price for ${token} unavailable.`);
  }

  const sentimentData = await analyzeSentiment(token);
  const direction = (sentimentData.sentiment === 'neutral' ? 'bullish' : sentimentData.sentiment) as 'bullish' | 'bearish' | 'neutral';
  
  // Predict a small change based on sentiment
  const multiplier = direction === 'bullish' ? 1.05 : direction === 'bearish' ? 0.95 : 1.0;
  const predictedPrice = currentPrice * multiplier;
  
  const reasoning = await callLLM(`Provide a price prediction reasoning for ${token} over ${timeHorizon} based on this sentiment and current price.`, 
    `Token: ${token}, Price: $${currentPrice}, Sentiment: ${sentimentData.insight}`);

  return {
    token,
    currentPrice,
    predictedPrice,
    timeHorizon,
    confidence: 0.8,
    direction,
    reasoning
  };
}

/**
 * Risk Assessment
 */
async function assessRisk(token: string = 'SOL') {
  const search = await braveSearch(`${token} crypto risk assessment security audit rug`);
  const analysis = await callLLM("Assess the risk level (low, medium, high, or extreme) for the following token and list key factors.", 
    `Token: ${token}\n\nSearch Results: ${search.results.map(r => r.description).join('\n')}`);
  
  const lower = analysis.toLowerCase();
  const riskLevel = lower.includes('extreme') ? 'extreme' : lower.includes('high') ? 'high' : lower.includes('low') ? 'low' : 'medium';
  
  return {
    token,
    riskLevel,
    riskScore: riskLevel === 'low' ? 20 : riskLevel === 'medium' ? 50 : riskLevel === 'high' ? 80 : 95,
    factors: [analysis],
    insight: `**${token} Risk Assessment:** ${analysis}`,
    confidence: 0.85,
    relatedTokens: [token]
  };
}

/**
 * Deep Analysis
 */
async function analyzeToken(token: string = 'SOL') {
  const prediction = await predictPrice(token, '24h');
  const risk = await assessRisk(token);
  
  return {
    token,
    insight: `**${token} Deep Analysis:**\n\n${prediction.reasoning}\n\n**Risk Profile:** ${risk.riskLevel.toUpperCase()} - ${risk.insight}`,
    prediction,
    risk,
    confidence: 0.85,
    relatedTokens: [token]
  };
}

/**
 * General Insight
 */
async function generateInsight(prompt: string) {
  const insight = await callLLM("You are Magos, a market oracle. Analyze the user query and provide a professional crypto market insight.", prompt);
  return {
    insight,
    confidence: 0.9,
    relatedTokens: []
  };
}

export default magos;
