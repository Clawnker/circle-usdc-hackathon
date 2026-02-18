/**
 * Magos Specialist — V3
 * Market Oracle with multi-source data aggregation and structured output
 * Sources: CoinGecko + Jupiter + Brave Search + LLM analysis
 */

import axios from 'axios';
import config from '../config';
import { MagosPrediction, SpecialistResult } from '../types';
import { getPrice, getMarketData, getTrending as getCoinGeckoTrending } from './tools/coingecko';
import { braveSearch } from './tools/brave-search';
import { chatText, chatJSON, MODELS } from '../llm-client';

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
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'BONK': 'DezXAZ8z7Pnrn9jzX7BSS4CR1GY8PV2Swbe3PZimbUmA',
  'WIF': 'EKpQGSJtjMFqKZ9KQanCDT7YV3dQrN5ifR8n2An36S31',
  'JUP': 'JUPyiwrYJFskR4ZBvMmcuyMvM8FmNdxUuzpzp7L6z8v',
  'POPCAT': '7GCih6mSgSwwZ9Y9CnyTmsL7w13r6uunqB7UStyK88w',
};

const JUPITER_ELIGIBLE_TOKENS = new Set(Object.keys(TOKEN_MINTS));

// --- Structured output types ---
interface MagosStructuredData {
  token: string;
  price: { current: number; change24h: number; change7d?: number; formatted: string };
  market?: { cap?: number; volume24h?: number; rank?: number; ath?: number; atl?: number };
  sentiment: { label: string; score: number; confidence: number };
  prediction?: { direction: string; target: number; confidence: number; timeHorizon: string; reasoning: string };
  risk?: { level: string; score: number; factors: string[] };
  sources: string[];
  summary: string;
  insight?: string;
  trending?: { token: string; mentions: number; sentiment: string }[];
  relatedTokens: string[];
  confidence: number;
}

/**
 * Magos specialist handler
 */
export const magos = {
  name: 'Magos',
  description: 'Market Oracle - real-time predictions, risk analysis, and social trend detection',
  
  async handle(prompt: string): Promise<SpecialistResult> {
    const startTime = Date.now();
    const maxRetries = 2;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const intent = parseIntent(prompt);
        let data: any;
        
        switch (intent.type) {
          case 'trending':
            data = await findTrendingTokens(prompt);
            break;
          case 'price-check':
            data = await richPriceCheck(intent.token || 'BTC');
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

        if (!data.summary) {
          data.summary = buildMagosSummary(data, intent.type);
        }

        return {
          success: true,
          data,
          confidence: data.confidence || 0.75,
          timestamp: new Date(),
          executionTimeMs: Date.now() - startTime,
        };
      } catch (error: any) {
        console.error(`[Magos] Error (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
        if (attempt < maxRetries) {
          console.log(`[Magos] Retrying in 1s...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return {
          success: false,
          data: { error: 'An error occurred during market analysis.' },
          timestamp: new Date(),
          executionTimeMs: Date.now() - startTime,
        };
      }
    }
    return { success: false, data: { error: 'Unexpected error' }, timestamp: new Date(), executionTimeMs: Date.now() - startTime };
  },
};

// --- Intent Parsing ---

function parseIntent(prompt: string): { type: string; token?: string; timeHorizon?: string } {
  const lower = prompt.toLowerCase();
  
  let token: string | undefined;
  for (const [alias, symbol] of Object.entries(TOKEN_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`, 'i').test(lower)) {
      token = symbol;
      break;
    }
  }
  
  if (!token) {
    const tokenMatch = prompt.match(/\b(SOL|BTC|ETH|BONK|WIF|JUP|POPCAT|PEPE|DOGE|AVAX|MATIC|LINK|UNI|AAVE|ARB|OP|[A-Za-z0-9]{32,44})\b/i);
    token = tokenMatch ? tokenMatch[1].toUpperCase() : undefined;
  }
  
  const timeMatch = prompt.match(/(\d+)\s*(h|hour|hr|d|day|w|week|m|min)/i);
  let timeHorizon = '4h';
  if (timeMatch) {
    const num = parseInt(timeMatch[1]);
    const unit = timeMatch[2].toLowerCase();
    if (unit.startsWith('h')) timeHorizon = `${num}h`;
    else if (unit.startsWith('d')) timeHorizon = `${num}d`;
    else if (unit.startsWith('w')) timeHorizon = `${num}w`;
  }
  
  if (lower.includes('trending') || lower.includes('meme coin') || (lower.includes('find') && lower.includes('coin'))) {
    return { type: 'trending' };
  }
  if (lower.includes('sentiment') || lower.includes('bullish') || lower.includes('bearish')) {
    return { type: token ? 'sentiment' : 'insight', token };
  }
  if (lower.includes('predict') || lower.includes('forecast')) {
    return { type: token ? 'predict' : 'insight', token, timeHorizon };
  }
  if ((lower.includes('price') || lower.includes('how much') || lower.includes('worth') || lower.includes('cost')) && token && 
      !lower.includes('predict') && !lower.includes('forecast') && !lower.includes('will') && !lower.includes('target')) {
    return { type: 'price-check', token };
  }
  if (lower.includes('risk') || lower.includes('safe') || lower.includes('rug')) {
    return { type: token ? 'risk' : 'insight', token };
  }
  if (lower.includes('analyze') || lower.includes('analysis')) {
    return { type: token ? 'analyze' : 'insight', token };
  }
  
  return { type: 'insight', token, timeHorizon };
}

// --- Multi-Source Price Fetching ---

/**
 * Fetch comprehensive price data from multiple sources
 * Priority: CoinGecko tool → Jupiter → Brave Search extraction
 */
async function fetchPriceData(token: string): Promise<{
  price: number;
  change24h: number;
  change7d?: number;
  marketCap?: number;
  volume24h?: number;
  rank?: number;
  sources: string[];
}> {
  const sources: string[] = [];
  
  // Try CoinGecko tool first (has the richest data)
  try {
    const cgData = await getPrice(token);
    if (cgData.price > 0) {
      sources.push('CoinGecko');
      return {
        price: cgData.price,
        change24h: cgData.change24h || 0,
        change7d: cgData.change7d,
        marketCap: cgData.marketCap,
        volume24h: cgData.volume24h,
        sources,
      };
    }
  } catch (e: any) {
    console.log(`[Magos] CoinGecko tool failed for ${token}:`, e.message);
  }

  // Jupiter fallback for Solana-native tokens/mints only
  const normalizedToken = token.toUpperCase();
  const mint = TOKEN_MINTS[normalizedToken] || (token.length >= 32 ? token : null);
  const canUseJupiter = JUPITER_ELIGIBLE_TOKENS.has(normalizedToken) || token.length >= 32;
  if (mint && canUseJupiter) {
    try {
      const response = await axios.get(`${JUPITER_PRICE_API}?ids=${mint}`, { timeout: 5000 });
      const data = response.data?.data?.[mint];
      if (data?.price && parseFloat(data.price) > 0.001) {
        sources.push('Jupiter');
        return {
          price: parseFloat(data.price),
          change24h: 0, // Jupiter doesn't provide change
          sources,
        };
      }
    } catch (e: any) {
      console.log(`[Magos] Jupiter failed for ${token}:`, e.message);
    }
  }

  // Brave Search last resort
  try {
    const search = await braveSearch(`${token} crypto price usd today`);
    for (const result of search.results.slice(0, 5)) {
      const text = (result.description || '') + ' ' + (result.title || '');
      const match = text.match(/\$\s?([0-9]{1,3}(?:,\d{3})*(?:\.\d+)?)/);
      if (match) {
        const parsed = parseFloat(match[1].replace(/,/g, ''));
        if (parsed > 0.001) {
          sources.push('Brave Search');
          return { price: parsed, change24h: 0, sources };
        }
      }
    }
  } catch (e: any) {
    console.log(`[Magos] Brave price extraction failed for ${token}:`, e.message);
  }

  throw new Error(`Real-time price for ${token} unavailable from any source.`);
}

// --- Specialist Functions ---

/**
 * Rich price check — structured data with market context
 */
async function richPriceCheck(token: string): Promise<MagosStructuredData> {
  console.log(`[Magos] Rich price check for ${token}`);
  
  const priceData = await fetchPriceData(token);
  const price = priceData.price;
  const formatted = price >= 1 
    ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${price.toFixed(6)}`;
  
  const changeStr = priceData.change24h !== 0 
    ? ` (${priceData.change24h > 0 ? '+' : ''}${priceData.change24h.toFixed(1)}% 24h)` 
    : '';
  
  return {
    token,
    price: {
      current: price,
      change24h: priceData.change24h,
      change7d: priceData.change7d,
      formatted,
    },
    market: {
      cap: priceData.marketCap,
      volume24h: priceData.volume24h,
      rank: priceData.rank,
    },
    sentiment: { label: 'neutral', score: 0, confidence: 0 },
    sources: priceData.sources,
    summary: `💰 **${token}** is currently at **${formatted}**${changeStr}`,
    relatedTokens: [token],
    confidence: 0.95,
  };
}

/**
 * Analyze sentiment using LLM
 */
async function analyzeSentiment(tokenOrQuery: string): Promise<MagosStructuredData> {
  console.log(`[Magos] Analyzing sentiment for: ${tokenOrQuery}`);
  
  const sanitizedQuery = tokenOrQuery.replace(/[^a-zA-Z0-9$ ]/g, ' ').trim();
  const search = await braveSearch(`${sanitizedQuery} crypto sentiment news analysis`);
  const searchContext = search.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.description}`).join('\n\n');
  
  // Try to get price data too
  let priceData: any = null;
  try {
    priceData = await fetchPriceData(tokenOrQuery);
  } catch { /* price not required for sentiment */ }

  try {
    const { data: sentimentResult } = await chatJSON<{
      sentiment: 'bullish' | 'bearish' | 'neutral';
      score: number;
      confidence: number;
      keyFactors: string[];
      summary: string;
    }>(
      `You are a crypto market sentiment analyst. Analyze sentiment for "${sanitizedQuery}" based on these search results.
Return JSON: {"sentiment": "bullish|bearish|neutral", "score": <-1.0 to 1.0>, "confidence": <0.0 to 1.0>, "keyFactors": ["factor1", "factor2"], "summary": "<2-3 sentence analysis>"}
Be objective. If data is mixed or insufficient, reflect that in lower confidence.`,
      searchContext,
      { model: MODELS.fast, caller: 'magos', temperature: 0.2 }
    );

    return {
      token: tokenOrQuery.toUpperCase(),
      price: priceData ? {
        current: priceData.price,
        change24h: priceData.change24h,
        change7d: priceData.change7d,
        formatted: priceData.price >= 1 ? `$${priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${priceData.price.toFixed(6)}`,
      } : { current: 0, change24h: 0, formatted: 'N/A' },
      sentiment: {
        label: sentimentResult.sentiment,
        score: sentimentResult.score,
        confidence: sentimentResult.confidence,
      },
      sources: priceData?.sources || ['Brave Search'],
      summary: `📡 **${tokenOrQuery.toUpperCase()} Sentiment**: **${sentimentResult.sentiment.toUpperCase()}** (${(sentimentResult.confidence * 100).toFixed(0)}% confidence)\n\n${sentimentResult.summary}\n\n**Key Factors:**\n${sentimentResult.keyFactors.map(f => `• ${f}`).join('\n')}`,
      insight: sentimentResult.summary,
      relatedTokens: [tokenOrQuery.toUpperCase()],
      confidence: sentimentResult.confidence,
    };
  } catch (e: any) {
    console.log('[Magos] LLM sentiment failed:', e.message);
    // Fallback to basic search summary
    const fallbackSummary = search.results.map(r => r.description).join(' ').slice(0, 500);
    return {
      token: tokenOrQuery.toUpperCase(),
      price: priceData ? { current: priceData.price, change24h: priceData.change24h, formatted: `$${priceData.price}` } : { current: 0, change24h: 0, formatted: 'N/A' },
      sentiment: { label: 'neutral', score: 0, confidence: 0.3 },
      sources: ['Brave Search'],
      summary: `📡 **${tokenOrQuery.toUpperCase()} Sentiment**: Data available but LLM analysis unavailable.\n\n${fallbackSummary}`,
      relatedTokens: [tokenOrQuery.toUpperCase()],
      confidence: 0.5,
    };
  }
}

/**
 * Price prediction with structured data
 */
async function predictPrice(token: string = 'SOL', timeHorizon: string = '4h'): Promise<MagosStructuredData> {
  console.log(`[Magos] Predicting price for ${token} (${timeHorizon})`);
  
  const priceData = await fetchPriceData(token);
  const sentimentData = await analyzeSentiment(token);
  
  // Build rich context for the LLM
  const priceContext = [
    `Token: ${token}`,
    `Current Price: $${priceData.price}`,
    `24h Change: ${priceData.change24h.toFixed(2)}%`,
    priceData.change7d ? `7d Change: ${priceData.change7d.toFixed(2)}%` : '',
    priceData.volume24h ? `24h Volume: $${(priceData.volume24h / 1e6).toFixed(1)}M` : '',
    priceData.marketCap ? `Market Cap: $${(priceData.marketCap / 1e9).toFixed(2)}B` : '',
    `Sentiment: ${sentimentData.sentiment.label} (score: ${sentimentData.sentiment.score.toFixed(2)})`,
    `Time Horizon: ${timeHorizon}`,
  ].filter(Boolean).join('\n');

  try {
    const { data: prediction } = await chatJSON<{
      direction: 'bullish' | 'bearish' | 'neutral';
      targetPrice: number;
      confidence: number;
      reasoning: string;
      keyLevels: { support: number; resistance: number };
      riskFactors: string[];
    }>(
      `You are Magos, a crypto market oracle. Based on the following data, provide a price prediction.
Return JSON: {"direction": "bullish|bearish|neutral", "targetPrice": <number>, "confidence": <0.0-1.0>, "reasoning": "<3-4 sentence analysis>", "keyLevels": {"support": <number>, "resistance": <number>}, "riskFactors": ["risk1", "risk2"]}

Rules:
- targetPrice should be realistic (within ±15% for short timeframes)
- confidence should reflect data quality — lower if mixed signals
- Include specific data points in reasoning
- This is analysis, not financial advice`,
      priceContext,
      { model: MODELS.fast, caller: 'magos', temperature: 0.3 }
    );

    const changePercent = ((prediction.targetPrice - priceData.price) / priceData.price * 100).toFixed(1);
    const formatted = priceData.price >= 1
      ? `$${priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${priceData.price.toFixed(6)}`;
    const targetFormatted = prediction.targetPrice >= 1
      ? `$${prediction.targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${prediction.targetPrice.toFixed(6)}`;

    return {
      token,
      price: {
        current: priceData.price,
        change24h: priceData.change24h,
        change7d: priceData.change7d,
        formatted,
      },
      market: {
        cap: priceData.marketCap,
        volume24h: priceData.volume24h,
      },
      sentiment: sentimentData.sentiment,
      prediction: {
        direction: prediction.direction,
        target: prediction.targetPrice,
        confidence: prediction.confidence,
        timeHorizon,
        reasoning: prediction.reasoning,
      },
      sources: [...new Set([...priceData.sources, 'Brave Search', 'Gemini Flash'])],
      summary: buildPredictionSummary(token, formatted, targetFormatted, changePercent, prediction, timeHorizon),
      relatedTokens: [token],
      confidence: prediction.confidence,
    };
  } catch (e: any) {
    console.log('[Magos] LLM prediction failed:', e.message);
    // Fallback: simple sentiment-based prediction
    const direction = sentimentData.sentiment.score > 0.2 ? 'bullish' : sentimentData.sentiment.score < -0.2 ? 'bearish' : 'neutral';
    const multiplier = direction === 'bullish' ? 1.03 : direction === 'bearish' ? 0.97 : 1.0;
    const target = priceData.price * multiplier;
    const formatted = priceData.price >= 1 ? `$${priceData.price.toFixed(2)}` : `$${priceData.price.toFixed(6)}`;
    const targetFormatted = target >= 1 ? `$${target.toFixed(2)}` : `$${target.toFixed(6)}`;
    
    return {
      token,
      price: { current: priceData.price, change24h: priceData.change24h, formatted },
      sentiment: sentimentData.sentiment,
      prediction: { direction, target, confidence: 0.5, timeHorizon, reasoning: 'LLM analysis unavailable. Basic sentiment-driven estimate.' },
      sources: priceData.sources,
      summary: `📊 **${token}** at **${formatted}** | ${timeHorizon} outlook: **${direction.toUpperCase()}** → ${targetFormatted} (low confidence — LLM unavailable)`,
      relatedTokens: [token],
      confidence: 0.5,
    };
  }
}

/**
 * Risk Assessment with structured factors
 */
async function assessRisk(token: string = 'SOL'): Promise<MagosStructuredData> {
  console.log(`[Magos] Assessing risk for ${token}`);
  
  const [search, priceData] = await Promise.all([
    braveSearch(`${token} crypto risk assessment security audit vulnerability`),
    fetchPriceData(token).catch(() => null),
  ]);

  const searchContext = search.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.description}`).join('\n\n');

  try {
    const { data: riskResult } = await chatJSON<{
      riskLevel: 'low' | 'medium' | 'high' | 'extreme';
      riskScore: number;
      positiveFactors: string[];
      concerns: string[];
      verdict: string;
    }>(
      `Assess the risk level for crypto token "${token}" based on these search results.
Return JSON: {"riskLevel": "low|medium|high|extreme", "riskScore": <0-100>, "positiveFactors": ["factor1"], "concerns": ["concern1"], "verdict": "<one sentence verdict>"}
Be specific — reference data from sources. Don't default to medium.`,
      searchContext,
      { model: MODELS.fast, caller: 'magos', temperature: 0.2 }
    );

    const positives = riskResult.positiveFactors.map(f => `✅ ${f}`).join('\n');
    const concerns = riskResult.concerns.map(c => `⚠️ ${c}`).join('\n');

    return {
      token,
      price: priceData ? {
        current: priceData.price,
        change24h: priceData.change24h,
        formatted: priceData.price >= 1 ? `$${priceData.price.toFixed(2)}` : `$${priceData.price.toFixed(6)}`,
      } : { current: 0, change24h: 0, formatted: 'N/A' },
      sentiment: { label: 'neutral', score: 0, confidence: 0 },
      risk: {
        level: riskResult.riskLevel,
        score: riskResult.riskScore,
        factors: [...riskResult.positiveFactors, ...riskResult.concerns],
      },
      sources: priceData?.sources ? [...priceData.sources, 'Brave Search'] : ['Brave Search'],
      summary: `🔍 **${token} Risk Assessment**\n\n**Risk Level:** ${riskResult.riskLevel.toUpperCase()} (${riskResult.riskScore}/100)\n\n**Positive Factors:**\n${positives}\n\n**Concerns:**\n${concerns}\n\n**Verdict:** ${riskResult.verdict}`,
      relatedTokens: [token],
      confidence: 0.85,
    };
  } catch (e: any) {
    console.log('[Magos] LLM risk assessment failed:', e.message);
    const fallbackAnalysis = search.results.map(r => r.description).join(' ').slice(0, 500);
    return {
      token,
      price: { current: 0, change24h: 0, formatted: 'N/A' },
      sentiment: { label: 'neutral', score: 0, confidence: 0 },
      risk: { level: 'medium', score: 50, factors: ['Insufficient data for detailed analysis'] },
      sources: ['Brave Search'],
      summary: `🔍 **${token} Risk Assessment**: MEDIUM (50/100) — Limited analysis available.\n\n${fallbackAnalysis}`,
      relatedTokens: [token],
      confidence: 0.5,
    };
  }
}

/**
 * Deep Analysis — combines price, sentiment, risk, and market data
 */
async function analyzeToken(token: string = 'SOL'): Promise<MagosStructuredData> {
  console.log(`[Magos] Deep analysis for ${token}`);
  
  // Fetch all data in parallel
  const [priceData, marketData, sentimentData, riskData] = await Promise.all([
    fetchPriceData(token),
    getMarketData(token).catch(() => null),
    analyzeSentiment(token),
    assessRisk(token),
  ]);

  const formatted = priceData.price >= 1
    ? `$${priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${priceData.price.toFixed(6)}`;

  // Build comprehensive analysis context
  const analysisContext = [
    `Token: ${token}`,
    `Price: ${formatted} (24h: ${priceData.change24h.toFixed(2)}%)`,
    priceData.change7d ? `7d Change: ${priceData.change7d.toFixed(2)}%` : '',
    priceData.marketCap ? `Market Cap: $${(priceData.marketCap / 1e9).toFixed(2)}B` : '',
    priceData.volume24h ? `Volume 24h: $${(priceData.volume24h / 1e6).toFixed(1)}M` : '',
    marketData ? `Rank: #${marketData.rank}` : '',
    marketData ? `ATH: $${marketData.ath} (${((priceData.price / marketData.ath) * 100).toFixed(1)}% of ATH)` : '',
    marketData ? `Circulating Supply: ${(marketData.circulatingSupply / 1e6).toFixed(0)}M` : '',
    `Sentiment: ${sentimentData.sentiment.label} (${sentimentData.sentiment.score.toFixed(2)})`,
    `Risk: ${riskData.risk?.level || 'N/A'} (${riskData.risk?.score || '?'}/100)`,
  ].filter(Boolean).join('\n');

  try {
    const analysis = await chatText(
      'You are Magos, a crypto market oracle. Provide a comprehensive but concise deep analysis based on the data below. Include price outlook, key risks, and an actionable recommendation. Use bullet points. Keep it under 250 words.',
      analysisContext,
      { model: MODELS.fast, caller: 'magos', temperature: 0.3, maxTokens: 800 }
    );

    const allSources = [...new Set([...priceData.sources, ...sentimentData.sources, ...(riskData.sources || [])])];

    return {
      token,
      price: {
        current: priceData.price,
        change24h: priceData.change24h,
        change7d: priceData.change7d,
        formatted,
      },
      market: {
        cap: priceData.marketCap || marketData?.marketCap,
        volume24h: priceData.volume24h || marketData?.volume24h,
        rank: marketData?.rank,
        ath: marketData?.ath,
        atl: marketData?.atl,
      },
      sentiment: sentimentData.sentiment,
      risk: riskData.risk,
      sources: allSources,
      summary: `📊 **${token} Deep Analysis**\n\n**Price:** ${formatted} (${priceData.change24h > 0 ? '+' : ''}${priceData.change24h.toFixed(1)}% 24h)${marketData ? ` | Rank #${marketData.rank}` : ''}\n**Sentiment:** ${sentimentData.sentiment.label.toUpperCase()} | **Risk:** ${riskData.risk?.level?.toUpperCase() || 'N/A'}\n\n${analysis}`,
      relatedTokens: [token],
      confidence: 0.85,
    };
  } catch (e: any) {
    console.log('[Magos] Deep analysis LLM failed:', e.message);
    return {
      token,
      price: { current: priceData.price, change24h: priceData.change24h, formatted },
      market: { cap: priceData.marketCap, volume24h: priceData.volume24h },
      sentiment: sentimentData.sentiment,
      risk: riskData.risk,
      sources: priceData.sources,
      summary: `📊 **${token}** at **${formatted}** (${priceData.change24h.toFixed(1)}% 24h) | Sentiment: ${sentimentData.sentiment.label} | Risk: ${riskData.risk?.level || 'N/A'}`,
      relatedTokens: [token],
      confidence: 0.7,
    };
  }
}

/**
 * Find trending tokens from MoltX + CoinGecko + Brave
 */
async function findTrendingTokens(query: string): Promise<MagosStructuredData> {
  console.log('[Magos] Finding trending tokens...');
  
  // Try MoltX social feed
  try {
    const feedRes = await axios.get(`${MOLTX_API}/feed/global?limit=50`, { timeout: 5000 });
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
    
    const sorted = Object.entries(tokenMentions).sort(([,a], [,b]) => b - a).slice(0, 5);
      
    if (sorted.length > 0) {
      const trending = sorted.map(([token, mentions]) => ({
        token, mentions, sentiment: mentions > 3 ? 'bullish' : 'neutral'
      }));
      return {
        token: 'TRENDING',
        price: { current: 0, change24h: 0, formatted: 'N/A' },
        sentiment: { label: 'neutral', score: 0, confidence: 0 },
        trending,
        sources: ['MoltX'],
        summary: `🔥 **Trending on MoltX:** ${trending.map(t => `$${t.token} (${t.mentions} mentions)`).join(', ')}`,
        relatedTokens: trending.map(t => t.token),
        confidence: 0.85,
      };
    }
  } catch (err) {
    console.log('[Magos] MoltX error, trying CoinGecko...');
  }

  // Try CoinGecko trending
  try {
    const cgTrending = await getCoinGeckoTrending();
    if (cgTrending.length > 0) {
      const trending = cgTrending.map(t => ({ token: t.token, mentions: 0, sentiment: 'neutral' }));
      return {
        token: 'TRENDING',
        price: { current: 0, change24h: 0, formatted: 'N/A' },
        sentiment: { label: 'neutral', score: 0, confidence: 0 },
        trending,
        sources: ['CoinGecko'],
        summary: `🔥 **Trending on CoinGecko:** ${cgTrending.map((t, i) => `#${i + 1} $${t.token}`).join(', ')}`,
        relatedTokens: cgTrending.map(t => t.token),
        confidence: 0.8,
      };
    }
  } catch (err) {
    console.log('[Magos] CoinGecko trending error, falling back to search');
  }

  // Final fallback: Brave Search
  const search = await braveSearch('trending crypto tokens solana right now');
  const insight = await chatText(
    'Identify the top 5 trending crypto tokens from these search results. List them with brief reasons.',
    search.results.map(r => r.description).join('\n'),
    { model: MODELS.fast, caller: 'magos', temperature: 0.3, maxTokens: 300 }
  );
  
  return {
    token: 'TRENDING',
    price: { current: 0, change24h: 0, formatted: 'N/A' },
    sentiment: { label: 'neutral', score: 0, confidence: 0 },
    sources: ['Brave Search'],
    summary: `📊 **Market Trends:** ${insight}`,
    relatedTokens: [],
    confidence: 0.7,
  };
}

/**
 * General Insight
 */
async function generateInsight(prompt: string): Promise<MagosStructuredData> {
  const search = await braveSearch(prompt);
  const searchContext = search.results.map(r => `${r.title}: ${r.description}`).join('\n');
  
  const insight = await chatText(
    'You are Magos, a market oracle. Provide a professional crypto market insight based on the query and search data. Be concise and data-driven.',
    `Query: ${prompt}\n\nSearch Results:\n${searchContext}`,
    { model: MODELS.fast, caller: 'magos', temperature: 0.3, maxTokens: 500 }
  );
  
  return {
    token: 'GENERAL',
    price: { current: 0, change24h: 0, formatted: 'N/A' },
    sentiment: { label: 'neutral', score: 0, confidence: 0 },
    sources: ['Brave Search', 'Gemini Flash'],
    summary: insight,
    insight,
    relatedTokens: [],
    confidence: 0.8,
  };
}

// --- Summary Builders ---

function buildPredictionSummary(
  token: string, formatted: string, targetFormatted: string, changePercent: string,
  prediction: any, timeHorizon: string
): string {
  const dir = prediction.direction === 'bullish' ? '📈' : prediction.direction === 'bearish' ? '📉' : '➡️';
  const confPct = (prediction.confidence * 100).toFixed(0);
  
  let summary = `${dir} **${token} Analysis** | ${timeHorizon}\n\n`;
  summary += `**Current:** ${formatted} | **Target:** ${targetFormatted} (${Number(changePercent) > 0 ? '+' : ''}${changePercent}%)\n`;
  summary += `**Direction:** ${prediction.direction.toUpperCase()} | **Confidence:** ${confPct}%\n\n`;
  summary += `${prediction.reasoning}\n\n`;
  
  if (prediction.keyLevels) {
    const supportFmt = prediction.keyLevels.support >= 1 ? `$${prediction.keyLevels.support.toFixed(2)}` : `$${prediction.keyLevels.support.toFixed(6)}`;
    const resistFmt = prediction.keyLevels.resistance >= 1 ? `$${prediction.keyLevels.resistance.toFixed(2)}` : `$${prediction.keyLevels.resistance.toFixed(6)}`;
    summary += `**Key Levels:** Support ${supportFmt} | Resistance ${resistFmt}\n\n`;
  }
  
  if (prediction.riskFactors?.length) {
    summary += `**Risks:** ${prediction.riskFactors.join(', ')}\n\n`;
  }
  
  summary += `⚠️ *Analysis, not financial advice. Always DYOR.*`;
  return summary;
}

function buildMagosSummary(data: any, intentType: string): string {
  if (data.summary) return data.summary;
  if (data.insight && intentType !== 'predict') return data.insight;
  
  switch (intentType) {
    case 'price-check':
      return data.price?.formatted ? `💰 **${data.token}** is at **${data.price.formatted}**` : 'Price data unavailable.';
    case 'trending':
      if (!data.trending?.length) return data.insight || 'No trending data available.';
      return `🔥 **Trending:** ${data.trending.map((t: any) => `$${t.token}`).join(', ')}`;
    case 'sentiment':
      return `📡 **${data.token} Sentiment**: ${data.sentiment?.label?.toUpperCase() || 'N/A'}`;
    default:
      return data.insight || data.summary || JSON.stringify(data);
  }
}

export default magos;
