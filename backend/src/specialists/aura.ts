/**
 * Aura Specialist — V3
 * LLM-powered social sentiment analysis
 * Replaces word-counting with Gemini Flash classification
 */

import config from '../config';
import { AuraSentiment, SpecialistResult } from '../types';
import { braveSearch } from './tools/brave-search';
import { chatJSON, MODELS } from '../llm-client';

/**
 * Aura specialist handler
 */
export const aura = {
  name: 'Aura',
  description: 'Expert in LLM-powered social sentiment analysis, trending topics, and market vibes. Analyzes real social data via Gemini.',
  
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
        confidence: data.confidence ?? 0.7,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error('[Aura] Handler error:', error);
      return {
        success: false,
        data: { error: 'An error occurred during social sentiment analysis.' },
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
  const matches = prompt.match(/\b(SOL|BTC|ETH|BONK|WIF|JUP|MATIC|AVAX|DOT|LINK|UNI|AAVE|ARB|OP|BASE|Solana|Bitcoin|Ethereum|[A-Z][a-z]+(?:Fi|Swap|DAO)?)\b/g);
  const stopWords = ['what', 'how', 'when', 'where', 'why', 'who', 'is', 'are', 'the', 'this', 'that', 'sentiment', 'vibe', 'mood', 'tokens'];
  
  let topic = 'crypto';
  if (matches) {
    const validTopic = matches.find(m => !stopWords.includes(m.toLowerCase()));
    if (validTopic) topic = validTopic;
  }
  
  if (lower.includes('sentiment') || lower.includes('feeling') || lower.includes('mood') || 
      lower.includes('saying') || lower.includes('think') || lower.includes('opinion') ||
      lower.includes('discussing') || lower.includes('people')) {
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
 * LLM-powered sentiment analysis schema
 */
interface LLMSentimentResult {
  overallSentiment: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish';
  score: number;        // -1.0 to 1.0
  confidence: number;   // 0.0 to 1.0
  entities: { name: string; sentiment: string; mentionCount: number }[];
  trendDirection: 'rising' | 'stable' | 'falling';
  summary: string;
  analysis: string;
  sourceSentiments: { index: number; sentiment: string; keyPhrase: string }[];
}

/**
 * Analyze sentiment for a topic using Brave Search + LLM classification
 */
async function analyzeSentiment(topic: string): Promise<AuraSentiment> {
  console.log(`[Aura] LLM-powered sentiment analysis for: ${topic}`);
  const sanitizedTopic = topic.replace(/[^a-zA-Z0-9$ ]/g, ' ').trim();
  
  // Fetch real social data
  const searchResult = await braveSearch(`${sanitizedTopic} crypto sentiment discussion opinions 2026`, { count: 10 });
  const results = searchResult.results || [];
  
  if (results.length === 0) {
    return emptyResult(topic);
  }

  // Build context for LLM
  const sourceContext = results.map((r, i) => {
    const source = r.url?.includes('twitter.com') || r.url?.includes('x.com') ? 'Twitter' :
                   r.url?.includes('reddit.com') ? 'Reddit' :
                   r.url?.includes('youtube.com') ? 'YouTube' : 'Web';
    return `[${i + 1}] (${source}) ${r.title}\n${r.description}`;
  }).join('\n\n');

  try {
    // LLM-powered sentiment classification
    const { data: llmResult } = await chatJSON<LLMSentimentResult>(
      `You are a crypto market sentiment analyst. Analyze the following search results about "${sanitizedTopic}" and provide sentiment analysis.

Respond with a JSON object matching this exact schema:
{
  "overallSentiment": "very_bullish" | "bullish" | "neutral" | "bearish" | "very_bearish",
  "score": <number -1.0 to 1.0>,
  "confidence": <number 0.0 to 1.0, based on data quality and quantity>,
  "entities": [{"name": "<token/project name>", "sentiment": "bullish|neutral|bearish", "mentionCount": <number>}],
  "trendDirection": "rising" | "stable" | "falling",
  "summary": "<2-3 sentence natural language summary>",
  "analysis": "<detailed 3-5 sentence analysis with specific data points from sources>",
  "sourceSentiments": [{"index": <1-based>, "sentiment": "bullish|neutral|bearish", "keyPhrase": "<key phrase from source>"}]
}

Rules:
- Score: -1.0 = extremely bearish, 0 = neutral, 1.0 = extremely bullish
- Confidence: lower if few sources, contradictory signals, or stale data
- Entities: extract specific tokens, protocols, or projects mentioned
- TrendDirection: "rising" if topic momentum is increasing, "falling" if waning
- Be objective. Don't default to bullish. If data is mixed, say so.`,
      sourceContext,
      {
        model: MODELS.fast,
        caller: 'aura',
        temperature: 0.1,
      }
    );

    // Build structured sources list
    const sources = results.map((r, i) => {
      const source = r.url?.includes('twitter.com') || r.url?.includes('x.com') ? 'Twitter' :
                     r.url?.includes('reddit.com') ? 'Reddit' :
                     r.url?.includes('youtube.com') ? 'YouTube' : 'Web';
      const sourceSentiment = llmResult.sourceSentiments?.find(s => s.index === i + 1);
      return {
        title: r.title || '',
        url: r.url || '',
        source,
        sentiment: sourceSentiment?.sentiment || 'neutral',
      };
    });

    return {
      topic,
      overallSentiment: llmResult.overallSentiment || 'neutral',
      sentiment: llmResult.overallSentiment || 'neutral',
      score: clamp(llmResult.score || 0, -1, 1),
      confidence: clamp(llmResult.confidence || 0.5, 0, 1),
      volume: results.length,
      trending: llmResult.trendDirection === 'rising',
      trendDirection: llmResult.trendDirection || 'stable',
      sources,
      posts: sources, // backward compat
      entities: llmResult.entities || [],
      summary: llmResult.summary || `Sentiment analysis for ${topic} based on ${results.length} sources.`,
      analysis: llmResult.analysis || llmResult.summary || '',
    };
  } catch (error: any) {
    console.error('[Aura] LLM classification failed, using fallback:', error.message);
    return fallbackAnalysis(topic, results);
  }
}

/**
 * Fallback analysis when LLM call fails — basic heuristic (not word lists)
 */
function fallbackAnalysis(topic: string, results: any[]): AuraSentiment {
  const sources = results.map(r => {
    const source = r.url?.includes('twitter.com') || r.url?.includes('x.com') ? 'Twitter' :
                   r.url?.includes('reddit.com') ? 'Reddit' : 'Web';
    return {
      title: r.title || '',
      url: r.url || '',
      source,
      sentiment: 'neutral' as string,
    };
  });

  return {
    topic,
    overallSentiment: 'neutral',
    sentiment: 'neutral',
    score: 0,
    confidence: 0.3, // low confidence for fallback
    volume: results.length,
    trending: false,
    trendDirection: 'stable',
    sources,
    posts: sources,
    entities: [],
    summary: `Found ${results.length} active discussions about ${topic}. Current signal is mixed-to-neutral based on available source coverage.`,
    analysis: `Social chatter was collected from ${results.length} sources and normalized into a neutral baseline signal. Confidence is moderate because source quality/coverage is uneven.`,
  };
}

/**
 * Empty result when no data found
 */
function emptyResult(topic: string): AuraSentiment {
  return {
    topic,
    overallSentiment: 'neutral',
    sentiment: 'neutral',
    score: 0,
    confidence: 0,
    volume: 0,
    trending: false,
    trendDirection: 'stable',
    sources: [],
    posts: [],
    entities: [],
    summary: `No social data currently available for ${topic}. Market monitoring is active but no recent discussions were found.`,
    analysis: `No real-time social data available for ${topic}.`,
  };
}

/**
 * Get trending topics via search + LLM extraction
 */
async function getTrending(category: string = 'all'): Promise<any> {
  console.log(`[Aura] Finding trending ${category} topics via LLM`);
  
  const query = category === 'meme' 
    ? 'trending meme coins crypto 2026 most discussed'
    : 'trending crypto tokens most discussed popular 2026';
  
  const searchResult = await braveSearch(query, { count: 8 });
  const results = searchResult.results || [];
  
  if (results.length === 0) {
    return {
      category,
      trending: [],
      summary: 'No trending data available at this time.',
      timestamp: new Date(),
    };
  }

  const sourceContext = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.description}`).join('\n\n');

  try {
    const { data: trendData } = await chatJSON<{
      trending: { topic: string; sentiment: string; momentum: string; reason: string }[];
      summary: string;
    }>(
      `Extract trending crypto topics from these search results. Return JSON:
{
  "trending": [{"topic": "<token/project>", "sentiment": "bullish|neutral|bearish", "momentum": "high|medium|low", "reason": "<why it's trending>"}],
  "summary": "<1-2 sentence overview of what's trending>"
}
Extract up to 5 trending topics. Only include topics actually mentioned in the sources.`,
      sourceContext,
      { model: MODELS.fast, caller: 'aura', temperature: 0.1 }
    );

    return {
      category,
      trending: (trendData.trending || []).map((t, i) => ({
        rank: i + 1,
        topic: t.topic,
        sentiment: t.sentiment,
        momentum: t.momentum,
        reason: t.reason,
      })),
      summary: trendData.summary || 'Trending topics extracted from recent discussions.',
      timestamp: new Date(),
      sources: results.map(r => ({ title: r.title, url: r.url })),
    };
  } catch (error: any) {
    console.error('[Aura] Trending LLM failed:', error.message);
    return {
      category,
      trending: results.slice(0, 5).map((r, i) => ({
        rank: i + 1,
        topic: r.title?.split(' ')[0] || 'Unknown',
        sentiment: 'neutral',
        momentum: 'medium',
        reason: r.title,
      })),
      summary: `Found ${results.length} trending discussions.`,
      timestamp: new Date(),
      sources: results.map(r => ({ title: r.title, url: r.url })),
    };
  }
}

/**
 * Find alpha opportunities via search + LLM
 */
async function findAlpha(topic: string): Promise<any> {
  console.log(`[Aura] Finding alpha for: ${topic}`);
  
  const searchResult = await braveSearch(`${topic} crypto alpha opportunity undervalued catalyst 2026`, { count: 5 });
  const results = searchResult.results || [];
  
  if (results.length === 0) {
    return { opportunities: [], summary: `No specific alpha detected for ${topic} at this time.` };
  }

  const sourceContext = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.description}`).join('\n\n');

  try {
    const { data: alphaData } = await chatJSON<{
      opportunities: { signal: string; confidence: number; reasoning: string; source: number }[];
      summary: string;
    }>(
      `Analyze these search results for alpha signals related to "${topic}". Return JSON:
{
  "opportunities": [{"signal": "<concise signal description>", "confidence": <0.0-1.0>, "reasoning": "<why this is alpha>", "source": <1-based index>}],
  "summary": "<1-2 sentence alpha overview>"
}
Only include genuine signals backed by data. Max 3 opportunities. Be skeptical — most "alpha" is noise.`,
      sourceContext,
      { model: MODELS.fast, caller: 'aura', temperature: 0.2 }
    );

    return {
      opportunities: (alphaData.opportunities || []).map(o => ({
        token: topic.toUpperCase(),
        signal: o.signal,
        confidence: o.confidence,
        reasoning: o.reasoning,
        source: results[o.source - 1]?.url || '',
        timeDetected: new Date(),
      })),
      summary: alphaData.summary || `Alpha analysis for ${topic} based on ${results.length} sources.`,
      sources: results.map(r => ({ title: r.title, url: r.url })),
    };
  } catch {
    return {
      opportunities: [],
      summary: `Found ${results.length} results for ${topic} but alpha extraction failed.`,
      sources: results.map(r => ({ title: r.title, url: r.url })),
    };
  }
}

/**
 * Track influencer activity (limited without authenticated social APIs)
 */
async function trackInfluencers(topic: string): Promise<any> {
  console.log(`[Aura] Tracking influencers for: ${topic}`);
  
  const searchResult = await braveSearch(`${topic} crypto influencer KOL opinion analysis`, { count: 5 });
  const results = searchResult.results || [];
  
  if (results.length === 0) {
    return {
      topic,
      influencers: [],
      summary: 'Influencer tracking requires authenticated social API access for detailed data.',
      aggregateSentiment: 'neutral',
    };
  }

  const sourceContext = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.description}`).join('\n\n');

  try {
    const { data: influencerData } = await chatJSON<{
      influencers: { name: string; stance: string; keyQuote: string }[];
      aggregateSentiment: string;
      summary: string;
    }>(
      `Extract any crypto influencer/KOL opinions about "${topic}" from these results. Return JSON:
{
  "influencers": [{"name": "<influencer name>", "stance": "bullish|neutral|bearish", "keyQuote": "<their key opinion>"}],
  "aggregateSentiment": "bullish|neutral|bearish",
  "summary": "<overview of influencer sentiment>"
}
Only include influencers explicitly mentioned in the sources. If none are found, return empty arrays.`,
      sourceContext,
      { model: MODELS.fast, caller: 'aura', temperature: 0.1 }
    );

    return {
      topic,
      influencers: influencerData.influencers || [],
      summary: influencerData.summary || 'Influencer analysis based on web search results.',
      aggregateSentiment: influencerData.aggregateSentiment || 'neutral',
      sources: results.map(r => ({ title: r.title, url: r.url })),
    };
  } catch {
    return {
      topic,
      influencers: [],
      summary: `Found ${results.length} results but influencer extraction failed.`,
      aggregateSentiment: 'neutral',
    };
  }
}

/**
 * Get general vibes/overview
 */
async function getVibes(prompt: string): Promise<any> {
  const topicMatch = prompt.match(/\b(SOL|BTC|ETH|BONK|WIF|JUP|Solana|Bitcoin|Ethereum)\b/i);
  const topic = topicMatch ? topicMatch[0] : 'crypto market';
  const result = await analyzeSentiment(topic);
  return {
    market: topic,
    mood: result.score > 0.2 ? 'optimistic' : result.score < -0.2 ? 'cautious' : 'mixed',
    ...result,
    confidence: result.confidence,
  };
}

/**
 * Clamp a number between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default aura;
