/**
 * Seeker Specialist
 * Web research and information lookup using Brave Search
 */

import * as fs from 'fs';
import * as path from 'path';
import { SpecialistResult } from '../types';
import braveSearchFallback, { SearchResult, braveAISearch } from './tools/brave-search';
import mcpClient from './tools/mcp-client';

// Load system prompt
const PROMPT_PATH = path.join(__dirname, 'prompts', 'seeker.md');
let systemPrompt = '';
try {
  systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8');
} catch (e) {
  console.log('[Seeker] Could not load system prompt');
}

export const seeker = {
  name: 'Seeker',
  description: 'Web research specialist with real-time search capabilities',
  systemPrompt,
  
  async handle(prompt: string): Promise<SpecialistResult> {
    const startTime = Date.now();
    
    try {
      const intent = parseIntent(prompt);
      let data: any;
      
      switch (intent.type) {
        case 'search':
          data = await performSearch(intent.query, intent.originalPrompt);
          break;
        case 'news':
          data = await searchNews(intent.query);
          break;
        case 'factcheck':
          data = await factCheck(intent.query);
          break;
        default:
          data = await performSearch(prompt, prompt);
      }
      
      return {
        success: true,
        data,
        confidence: data.confidence || 0.85,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error('[Seeker] Error:', error.message);
      return {
        success: false,
        data: { error: 'An error occurred during web research.' },
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Parse user intent from prompt
 */
function parseIntent(prompt: string): { type: string; query: string; originalPrompt: string } {
  const lower = prompt.toLowerCase();
  
  // Clean up the query for search
  let query = prompt
    .replace(/^(search|find|look up|google)\s+/i, '') // Only strip search prefixes, not question words
    .replace(/\?$/, '')
    .trim();
  
  if (lower.includes('news') || lower.includes('latest') || lower.includes('recent')) {
    return { type: 'news', query, originalPrompt: prompt };
  }
  
  if (lower.includes('true') || lower.includes('fact') || lower.includes('verify') || lower.includes('is it')) {
    return { type: 'factcheck', query, originalPrompt: prompt };
  }
  
  return { type: 'search', query, originalPrompt: prompt };
}

/**
 * Perform search using Brave AI (best), MCP, or fallback
 */
async function braveSearch(query: string, count: number = 5): Promise<{ results: SearchResult[]; summary?: string }> {
  // Try Brave AI Search first (best for agents - includes summary)
  try {
    const aiResult = await braveAISearch(query, { count });
    if (aiResult.results.length > 0) {
      console.log('[Seeker] Using Brave AI Search');
      return { results: aiResult.results, summary: aiResult.summary };
    }
  } catch (error) {
    console.log('[Seeker] Brave AI not available, trying MCP');
  }
  
  // Try MCP second
  try {
    const mcpResult = await mcpClient.braveSearch(query, count);
    if (mcpResult && mcpResult.web && mcpResult.web.results) {
      console.log('[Seeker] Using MCP Brave Search');
      return {
        results: mcpResult.web.results.map((r: any) => ({
          title: r.title,
          url: r.url,
          description: r.description,
          age: r.age,
        })),
      };
    }
  } catch (error) {
    console.log('[Seeker] MCP not available, using fallback');
  }
  
  // Fallback to direct web search
  const fallbackResult = await braveSearchFallback.search(query, { count });
  return { results: fallbackResult.results };
}

/**
 * Check if query is a simple factual question
 */
function isSimpleFactualQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return /^(who|what|where|when|how tall|how old|how many|how much|which|whose)\s+(is|are|was|were|did|does|do)\b/.test(lower);
}

/**
 * Synthesize a direct answer from search results for simple questions
 */
function synthesizeAnswer(query: string, results: SearchResult[]): string {
  if (results.length === 0) return '';
  
  // Take the first result's description as the primary answer
  // It's usually the most relevant snippet
  const primaryAnswer = results[0].description;
  
  // Get additional context from other results if they add info
  const additionalInfo = results.slice(1, 3)
    .map(r => r.description)
    .filter(d => !primaryAnswer.includes(d.substring(0, 50))) // Avoid duplicates
    .join(' ');
  
  // Combine into a coherent answer
  let answer = primaryAnswer;
  if (additionalInfo && additionalInfo.length > 50) {
    answer += '\n\n' + additionalInfo;
  }
  
  return answer;
}

/**
 * Perform a general web search
 */
async function performSearch(query: string, originalPrompt?: string): Promise<{
  summary: string;
  insight: string;
  results: SearchResult[];
  confidence: number;
  details: { type: string; query: string; count: number };
}> {
  console.log(`[Seeker] Searching: "${query}"`);
  
  const searchResult = await braveSearch(query, 5);
  const results = searchResult.results;
  
  // Check if original prompt is a simple factual question
  const promptToCheck = originalPrompt || query;
  const isSimple = isSimpleFactualQuery(promptToCheck);
  console.log(`[Seeker] Simple factual query: ${isSimple} (checked: "${promptToCheck}")`);
  
  // Generate summary from results
  let summary = '';
  let insight = '';
  
  if (results.length > 0) {
    if (isSimple) {
      // For simple questions, synthesize a direct answer
      const answer = synthesizeAnswer(query, results);
      
      summary = `**${promptToCheck}**\n\n${answer}\n\n`;
      summary += `**Sources:**\n`;
      results.slice(0, 3).forEach((r, i) => {
        summary += `• [${r.title}](${r.url})\n`;
      });
      
      insight = answer;
    } else {
      // For complex queries, show detailed findings
      summary = `🔍 **Research: ${query}**\n\n`;
      summary += `**Key Findings:**\n`;
      
      results.slice(0, 5).forEach((r, i) => {
        summary += `${i + 1}. **${r.title}**${r.age ? ` _(${r.age})_` : ''}\n`;
        summary += `   ${r.description}\n\n`;
      });
      
      summary += `**Sources:**\n`;
      results.forEach((r, i) => {
        // Make links clickable
        summary += `[${i + 1}. ${r.title}](${r.url})\n`;
      });
      
      // Build insight from top descriptions
      insight = results.slice(0, 3).map(r => r.description).join(' ');
    }
  } else {
    summary = `No results found for "${query}". Try rephrasing your search.`;
    insight = 'No relevant information found.';
  }
  
  return {
    summary,
    insight,
    results,
    confidence: results.length > 0 ? 0.85 : 0.3,
    details: {
      type: 'search',
      query,
      count: results.length,
    },
  };
}

/**
 * Search for recent news
 */
async function searchNews(query: string): Promise<{
  summary: string;
  insight: string;
  results: SearchResult[];
  confidence: number;
  details: { type: string; query: string; count: number };
}> {
  console.log(`[Seeker] Searching news: "${query}"`);
  
  // Use freshness filter for recent results via fallback
  // (MCP doesn't support freshness filter yet)
  const fallbackResult = await braveSearchFallback.search(query, { 
    count: 5,
    freshness: 'pw', // Past week
  });
  
  const results = fallbackResult.results;
  
  let summary = `📰 **Latest News: ${query}**\n\n`;
  
  if (results.length > 0) {
    results.forEach((r, i) => {
      summary += `${i + 1}. **${r.title}**\n`;
      summary += `   ${r.description}\n`;
      if (r.age) summary += `   _${r.age}_\n`;
      summary += `\n`;
    });
    
    // Add clickable sources section
    summary += `**Sources:**\n`;
    results.forEach((r, i) => {
      summary += `[${i + 1}. ${r.title}](${r.url})\n`;
    });
  } else {
    summary += 'No recent news found for this topic.\n';
  }
  
  return {
    summary,
    insight: results[0]?.description || 'No recent news available.',
    results,
    confidence: results.length > 0 ? 0.8 : 0.3,
    details: {
      type: 'news',
      query,
      count: results.length,
    },
  };
}

/**
 * Fact check a claim
 */
async function factCheck(query: string): Promise<{
  summary: string;
  insight: string;
  results: SearchResult[];
  confidence: number;
  verdict?: 'true' | 'false' | 'mixed' | 'unverified';
  details: { type: string; query: string; count: number };
}> {
  console.log(`[Seeker] Fact checking: "${query}"`);
  
  // Search for the claim + fact check keywords
  const searchResult = await braveSearch(`${query} fact check`, 5);
  const results = searchResult.results;
  
  // Simple heuristic for verdict (in production, use proper fact-checking APIs)
  let verdict: 'true' | 'false' | 'mixed' | 'unverified' = 'unverified';
  
  const allText = results.map(r => r.description.toLowerCase()).join(' ');
  if (allText.includes('true') && !allText.includes('false')) verdict = 'true';
  else if (allText.includes('false') && !allText.includes('true')) verdict = 'false';
  else if (allText.includes('true') && allText.includes('false')) verdict = 'mixed';
  
  let summary = `✅ **Fact Check: ${query}**\n\n`;
  summary += `**Verdict**: ${verdict.toUpperCase()}\n\n`;
  
  if (results.length > 0) {
    summary += `**Evidence**:\n`;
    results.slice(0, 3).forEach((r, i) => {
      summary += `${i + 1}. ${r.description}\n`;
    });
    summary += `\n**Sources**: ${results.map(r => r.url).join(', ')}\n`;
  }
  
  summary += `\n⚠️ *This is an automated check. Verify with primary sources.*`;
  
  return {
    summary,
    insight: `Verdict: ${verdict}`,
    results,
    confidence: verdict !== 'unverified' ? 0.7 : 0.4,
    verdict,
    details: {
      type: 'factcheck',
      query,
      count: results.length,
    },
  };
}

export default seeker;
