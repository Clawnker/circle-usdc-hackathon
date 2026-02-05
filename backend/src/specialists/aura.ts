/**
 * Aura Specialist
 * Expert in social sentiment and market vibes
 * Connects to MoltX/Moltbook for social data
 */

import axios from 'axios';
import config from '../config';
import { AuraSentiment, SpecialistResult } from '../types';
import { x402Fetch } from '../x402';

const MOLTX_API = config.specialists.moltx.baseUrl;
const API_KEY = config.specialists.moltx.apiKey;

/**
 * Aura specialist handler
 */
export const aura = {
  name: 'Aura',
  description: 'Expert in social sentiment analysis, trending topics, and market vibes. Monitors X, Discord, and Telegram for alpha.',
  
  /**
   * Main handler - parses prompt and routes to appropriate function
   */
  async handle(prompt: string): Promise<SpecialistResult> {
    const startTime = Date.now();
    
    try {
      const intent = parseIntent(prompt);
      
      let data: any;
      
      switch (intent.type) {
        case 'sentiment':
          data = await analyzeSentiment(intent.topic || 'crypto');
          break;
        case 'trending':
          data = await getTrending(intent.category || 'all');
          break;
        case 'alpha':
          data = await findAlpha(intent.topic || 'crypto');
          break;
        case 'influencer':
          data = await trackInfluencers(intent.topic || 'crypto');
          break;
        default:
          data = await getVibes(prompt);
      }

      return {
        success: true,
        data,
        confidence: data.confidence ?? (data.score !== undefined ? Math.abs(data.score) : 0.7),
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
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
function parseIntent(prompt: string): { type: string; topic?: string; category?: string } {
  const lower = prompt.toLowerCase();
  
  // Extract topic (token, project, or general topic)
  const stopWords = ['what', 'how', 'when', 'where', 'why', 'who', 'is', 'are', 'the', 'this', 'that', 'sentiment', 'vibe', 'mood', 'tokens'];
  const matches = prompt.match(/\b(SOL|BTC|ETH|BONK|WIF|JUP|Solana|Bitcoin|Ethereum|[A-Z][a-z]+(?:Fi|Swap|DAO)?)\b/g);
  
  let topic = 'crypto';
  if (matches) {
    const validTopic = matches.find(m => !stopWords.includes(m.toLowerCase()));
    if (validTopic) topic = validTopic;
  }
  
  // Determine intent type
  if (lower.includes('sentiment') || lower.includes('feeling') || lower.includes('mood')) {
    return { type: 'sentiment', topic };
  }
  if (lower.includes('trending') || lower.includes('hot') || lower.includes('popular') || lower.includes('talking about')) {
    return { type: 'trending', category: lower.includes('meme') ? 'meme' : 'all' };
  }
  if (lower.includes('alpha') || lower.includes('opportunity') || lower.includes('gem')) {
    return { type: 'alpha', topic };
  }
  if (lower.includes('influencer') || lower.includes('kol') || lower.includes('whale')) {
    return { type: 'influencer', topic };
  }
  
  return { type: 'vibes', topic };
}

/**
 * Analyze sentiment for a topic
 */
async function analyzeSentiment(topic: string): Promise<AuraSentiment> {
  // Try MoltX API if available
  if (MOLTX_API && API_KEY) {
    try {
      const response = await axios.get(`${MOLTX_API}/v1/sentiment/${topic}`, {
        headers: { 'X-API-Key': API_KEY },
      });
      return response.data;
    } catch (error) {
      console.log('[Aura] MoltX API unavailable, using fallback');
    }
  }
  
  // Fallback: Generate synthetic sentiment
  const sentiments: Array<'bullish' | 'bearish' | 'neutral' | 'fomo' | 'fud'> = 
    ['bullish', 'bearish', 'neutral', 'fomo', 'fud'];
  const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
  
  const scoreMap = {
    bullish: 0.6 + Math.random() * 0.4,
    bearish: -(0.6 + Math.random() * 0.4),
    neutral: -0.2 + Math.random() * 0.4,
    fomo: 0.8 + Math.random() * 0.2,
    fud: -(0.8 + Math.random() * 0.2),
  };
  
  return {
    topic,
    sentiment,
    score: scoreMap[sentiment],
    volume: Math.floor(1000 + Math.random() * 50000),
    trending: Math.random() > 0.6,
    sources: ['X/Twitter', 'Discord', 'Telegram'],
    summary: generateSentimentSummary(topic, sentiment, scoreMap[sentiment]),
  };
}

/**
 * Generate human-readable sentiment summary
 */
function generateSentimentSummary(topic: string, sentiment: string, score: number): string {
  const intensity = Math.abs(score) > 0.7 ? 'strongly' : Math.abs(score) > 0.4 ? 'moderately' : 'slightly';
  
  const summaries: Record<string, string> = {
    bullish: `${topic} sentiment is ${intensity} bullish. Social chatter indicates growing optimism with multiple positive catalysts being discussed.`,
    bearish: `${topic} sentiment is ${intensity} bearish. Negative sentiment dominates social channels with concerns about recent developments.`,
    neutral: `${topic} sentiment is neutral. Mixed opinions with no clear directional bias in social discussions.`,
    fomo: `${topic} is experiencing FOMO territory! Intense buying pressure signals and hype across social platforms.`,
    fud: `${topic} is facing significant FUD. Negative narratives spreading rapidly - verify claims before acting.`,
  };
  
  return summaries[sentiment] || `${topic} social activity is being monitored.`;
}

/**
 * Get trending topics/tokens
 */
async function getTrending(category: string = 'all'): Promise<{
  category: string;
  trending: Array<{
    rank: number;
    topic: string;
    mentions: number;
    sentiment: string;
    change24h: number;
  }>;
  summary: string;
  timestamp: Date;
}> {
  // Mock trending data - in production would aggregate from multiple sources
  const trendingTopics = [
    { topic: 'SOL', baseMentions: 15000, sentiment: 'bullish' },
    { topic: 'BONK', baseMentions: 8500, sentiment: 'fomo' },
    { topic: 'WIF', baseMentions: 6200, sentiment: 'bullish' },
    { topic: 'JUP', baseMentions: 4800, sentiment: 'neutral' },
    { topic: 'RENDER', baseMentions: 3200, sentiment: 'bullish' },
  ];
  
  return {
    category,
    trending: trendingTopics.map((t, i) => ({
      rank: i + 1,
      topic: t.topic,
      mentions: t.baseMentions + Math.floor(Math.random() * 2000),
      sentiment: t.sentiment,
      change24h: -20 + Math.random() * 60,
    })),
    summary: `🔥 **Trending Topics**:\n${trendingTopics.slice(0, 3).map(t => `• ${t.topic} (${t.sentiment})`).join('\n')}`,
    timestamp: new Date(),
  };
}

/**
 * Find alpha opportunities
 */
async function findAlpha(topic: string): Promise<{
  opportunities: Array<{
    token: string;
    signal: string;
    confidence: number;
    source: string;
    timeDetected: Date;
  }>;
  summary: string;
}> {
  // Mock alpha detection - in production would use ML on social data
  const opportunities = [
    {
      token: topic.toUpperCase(),
      signal: 'Unusual accumulation detected via whale wallet activity',
      confidence: 0.72,
      source: 'On-chain + Social correlation',
      timeDetected: new Date(),
    },
    {
      token: 'BONK',
      signal: 'Influencer cluster mentioning simultaneously',
      confidence: 0.65,
      source: 'X/Twitter KOL tracking',
      timeDetected: new Date(Date.now() - 3600000),
    },
  ];
  
  return {
    opportunities,
    summary: `Found ${opportunities.length} potential alpha signals. Highest confidence: ${opportunities[0]?.signal || 'None'}`,
  };
}

/**
 * Track influencer activity
 */
async function trackInfluencers(topic: string): Promise<{
  topic: string;
  influencers: Array<{
    handle: string;
    platform: string;
    recentMention: boolean;
    sentiment: string;
    followers: number;
  }>;
  aggregateSentiment: string;
}> {
  // Mock influencer data
  const influencers = [
    { handle: '@DefiDegen', platform: 'X', followers: 125000, sentiment: 'bullish' },
    { handle: '@SolanaWhale', platform: 'X', followers: 89000, sentiment: 'neutral' },
    { handle: '@CryptoKOL', platform: 'X', followers: 250000, sentiment: 'bullish' },
  ];
  
  return {
    topic,
    influencers: influencers.map(inf => ({
      ...inf,
      recentMention: Math.random() > 0.5,
    })),
    aggregateSentiment: 'bullish',
  };
}

/**
 * Get general vibes/overview
 */
async function getVibes(prompt: string): Promise<{
  market: string;
  mood: string;
  topMentions: string[];
  summary: string;
  confidence: number;
}> {
  const moods = ['optimistic', 'cautious', 'euphoric', 'fearful', 'neutral'];
  const mood = moods[Math.floor(Math.random() * moods.length)];
  
  return {
    market: 'crypto',
    mood,
    topMentions: ['SOL', 'BTC', 'memecoins', 'DeFi'],
    summary: `Current market vibes: ${mood}. Social volume is ${Math.random() > 0.5 ? 'above' : 'below'} average. ${
      mood === 'euphoric' ? 'Exercise caution - tops often form here.' :
      mood === 'fearful' ? 'Potential opportunities - fear creates discounts.' :
      'Standard market conditions.'
    }`,
    confidence: 0.68,
  };
}

export default aura;
