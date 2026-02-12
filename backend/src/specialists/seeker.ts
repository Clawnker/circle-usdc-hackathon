/**
 * Seeker Specialist
 * Web research and information lookup using Brave Search
 */

import * as fs from 'fs';
import * as path from 'path';
import { SpecialistResult } from '../types';
import braveSearchFallback, { SearchResult, braveAISearch } from './tools/brave-search';
import mcpClient from './tools/mcp-client';
import { chatText, chatJSON, MODELS } from '../llm-client';

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
      const deepSearchResult = await deepSearch(intent.query, intent.originalPrompt, intent.type);
      
      return {
        success: true,
        data: deepSearchResult,
        confidence: deepSearchResult.confidence || 0.85,
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
 * Multi-query expansion
 */
async function expandQueries(prompt: string): Promise<string[]> {
  const queryExpansionPrompt = `Given the following user research query, generate 2-3 additional, related search queries that could help gather more comprehensive information.
  
  Return the queries as a JSON array of strings. Do not include any other text.
  
  Example:
  User Query: "Is Solana a good investment?"
  Output: ["Solana price prediction 2026", "Solana ecosystem growth analysis", "Solana vs Ethereum comparison"]
  
  User Query: "${prompt}"
  Output:`;

  try {
    const { data: expandedQueries } = await chatJSON<string[]>(
      'You are a search query expansion assistant. Return ONLY a JSON array of strings.',
      queryExpansionPrompt,
      {
        model: MODELS.fast,
        temperature: 0.2,
        caller: 'seeker',
      }
    );
    
    // Ensure the original prompt is always included and limit to max 3 total
    const allQueries = [...new Set([prompt, ...expandedQueries])].slice(0, 3);
    console.log('[Seeker] Expanded queries:', allQueries);
    return allQueries;
  } catch (error) {
    console.error('[Seeker] Error expanding queries:', error);
    return [prompt]; // Fallback to original prompt if expansion fails
  }
}

/**
 * Main search with multi-query and LLM synthesis
 */
async function deepSearch(
  prompt: string,
  originalPrompt: string,
  intentType: string,
): Promise<{
  summary: string;
  insight: string;
  results: SearchResult[];
  confidence: number;
  verdict?: 'true' | 'false' | 'mixed' | 'unverified';
  details: { type: string; query: string; count: number };
}> {
  console.log(`[Seeker] Deep searching for: "${prompt}" (Intent: ${intentType})`);

  let queriesToRun: string[] = [prompt];
  let freshnessFilter: 'pw' | undefined = undefined;

  // Detect time-sensitive queries for freshness filtering
  const lowerOriginalPrompt = originalPrompt.toLowerCase();
  if (
    lowerOriginalPrompt.includes('today') ||
    lowerOriginalPrompt.includes('latest') ||
    lowerOriginalPrompt.includes('current') ||
    /\b20(2[6-9]|[3-9][0-9])\b/.test(lowerOriginalPrompt) // Matches 2026 and beyond
  ) {
    freshnessFilter = 'pw'; // Past week
    console.log('[Seeker] Detected time-sensitive query, applying freshness filter: pw');
  }

  if (intentType === 'search') {
    queriesToRun = await expandQueries(prompt);
  } else if (intentType === 'news') {
    // For news intent, focus on recent results for the original query
    queriesToRun = [originalPrompt]; 
    freshnessFilter = 'pw';
  } else if (intentType === 'factcheck') {
    // For factcheck, add "fact check" to queries
    queriesToRun = await expandQueries(`${prompt} fact check`);
  }

  // Run all queries in parallel
  const searchPromises = queriesToRun.map(q => braveSearch(q, 5, freshnessFilter));
  const allResultsNested = await Promise.all(searchPromises);

  // Flatten and deduplicate results
  const uniqueUrls = new Set<string>();
  const combinedResults: SearchResult[] = [];
  allResultsNested.forEach(searchResult => {
    searchResult.results.forEach(res => {
      if (!uniqueUrls.has(res.url)) {
        uniqueUrls.add(res.url);
        combinedResults.push(res);
      }
    });
  });

  console.log(`[Seeker] Found ${combinedResults.length} unique results from ${queriesToRun.length} queries.`);

  // LLM Synthesis
  let summary = '';
  let insight = '';
  let verdict: 'true' | 'false' | 'mixed' | 'unverified' | undefined;
  
  if (combinedResults.length > 0) {
    const synthesisPrompt = `You are a research assistant. Synthesize the following search results into a comprehensive summary, directly answering the query "${originalPrompt}".
    
    For fact-checking queries, also provide a verdict (true, false, mixed, or unverified) based on the evidence.
    
    Cite your sources using bracketed numbers like [1], [2], etc., corresponding to the numbered list of URLs provided at the end.
    
    Search Results:
    ${combinedResults.map((r, i) => `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.description}\n`).join('\n')}
    
    Query: "${originalPrompt}"
    
    Your comprehensive summary and (if applicable) verdict:`;

    const llmResponse = await chatText(
      'You are a research assistant. Synthesize search results into a comprehensive summary with citations.',
      synthesisPrompt,
      {
        model: MODELS.fast,
        temperature: 0.3,
        caller: 'seeker',
      }
    );

    // Extract verdict if present (simple heuristic for now)
    const verdictMatch = llmResponse.match(/Verdict:\s*(true|false|mixed|unverified)/i);
    if (verdictMatch && intentType === 'factcheck') {
      verdict = verdictMatch[1].toLowerCase() as any;
    }

    // Format summary and citations
    summary = llmResponse + '\n\n**Sources:**\n';
    combinedResults.forEach((r, i) => {
      summary += `[${i + 1}] ${r.title} (${r.url})\n`;
    });
    
    // For insight, just take the first part of the summary
    insight = llmResponse.split('\n')[0];

  } else {
    summary = `No results found for "${originalPrompt}". Try rephrasing your search.`;
    insight = 'No relevant information found.';
  }

  return {
    summary,
    insight,
    results: combinedResults,
    confidence: combinedResults.length > 0 ? 0.9 : 0.3,
    verdict,
    details: {
      type: intentType,
      query: originalPrompt,
      count: combinedResults.length,
    },
  };
}


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
async function braveSearch(query: string, count: number = 5, freshness?: 'pd' | 'pw' | 'pm' | 'py' | string): Promise<{ results: SearchResult[]; summary?: string }> {
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
  
  // Fallback to direct web search with freshness filter
  const fallbackResult = await braveSearchFallback.search(query, { count, freshness: freshness as any });
  return { results: fallbackResult.results };
}

// /**
//  * Check if query is a simple factual question
//  */
// function isSimpleFactualQuery(query: string): boolean {
//   const lower = query.toLowerCase();
//   return /^(who|what|where|when|how tall|how old|how many|how much|which|whose)\\s+(is|are|was|were|did|does|do)\\b/.test(lower);
// }

// /**
//  * Synthesize a direct answer from search results for simple questions
//  */
// function synthesizeAnswer(query: string, results: SearchResult[]): string {
//   if (results.length === 0) return '';
  
//   // Take the first result's description as the primary answer
//   // It's usually the most relevant snippet
//   const primaryAnswer = results[0].description;
  
//   // Get additional context from other results if they add info
//   const additionalInfo = results.slice(1, 3)
//     .map(r => r.description)
//     .filter(d => !primaryAnswer.includes(d.substring(0, 50))) // Avoid duplicates
//     .join(' ');
  
//   // Combine into a coherent answer
//   let answer = primaryAnswer;
//   if (additionalInfo && additionalInfo.length > 50) {
//     answer += '\\n\\n' + additionalInfo;
//   }
  
//   return answer;
// }

// /**
//  * Perform a general web search
//  */
// async function performSearch(query: string, originalPrompt?: string): Promise<{
//   summary: string;
//   insight: string;
//   results: SearchResult[];
//   confidence: number;
//   details: { type: string; query: string; count: number };
// }> {
//   console.log(`[Seeker] Searching: "${query}"`);
  
//   const searchResult = await braveSearch(query, 5);
//   const results = searchResult.results;
  
//   // Check if original prompt is a simple factual question
//   const promptToCheck = originalPrompt || query;
//   const isSimple = isSimpleFactualQuery(promptToCheck);
//   console.log(`[Seeker] Simple factual query: ${isSimple} (checked: "${promptToCheck}")`);
  
//   // Generate summary from results
//   let summary = '';
//   let insight = '';
  
//   if (results.length > 0) {
//     if (isSimple) {
//       // For simple questions, synthesize a direct answer
//       const answer = synthesizeAnswer(query, results);
      
//       summary = `**${promptToCheck}**\\n\\n${answer}\\n\\n`;
//       summary += `**Sources:**\\n`;
//       results.slice(0, 3).forEach((r, i) => {
//         summary += `• [${r.title}](${r.url})\\n`;
//       });
      
//       insight = answer;
//     } else {
//       // For complex queries, show detailed findings
//       summary = `🔍 **Research: ${query}**\\n\\n`;
//       summary += `**Key Findings:**\\n`;
      
//       results.slice(0, 5).forEach((r, i) => {
//         summary += `${i + 1}. **${r.title}**${r.age ? ` _(${r.age})_` : ''}\\n`;
//         summary += `   ${r.description}\\n\\n`;
//       });
      
//       summary += `**Sources:**\\n`;
//       results.forEach((r, i) => {
//         // Make links clickable
//         summary += `[${i + 1}. ${r.title}](${r.url})\\n`;
//       });
      
//       // Build insight from top descriptions
//       insight = results.slice(0, 3).map(r => r.description).join(' ');
//     }
//   } else {
//     summary = `No results found for "${query}". Try rephrasing your search.`;
//     insight = 'No relevant information found.';
//   }
  
//   return {
//     summary,
//     insight,
//     results,
//     confidence: results.length > 0 ? 0.85 : 0.3,
//     details: {
//       type: 'search',
//       query,
//       count: results.length,
//     },
//   };
// }

// /**
//  * Search for recent news
//  */
// async function searchNews(query: string): Promise<{
//   summary: string;
//   insight: string;
//   results: SearchResult[];
//   confidence: number;
//   details: { type: string; query: string; count: number };
// }> {
//   console.log(`[Seeker] Searching news: "${query}"`);
  
//   // Use freshness filter for recent results via fallback
//   // (MCP doesn't support freshness filter yet)
//   const fallbackResult = await braveSearchFallback.search(query, { 
//     count: 5,
//     freshness: 'pw', // Past week
//   });
  
//   const results = fallbackResult.results;
  
//   let summary = `📰 **Latest News: ${query}**\\n\\n`;
  
//   if (results.length > 0) {
//     results.forEach((r, i) => {
//       summary += `${i + 1}. **${r.title}**\\n`;
//       summary += `   ${r.description}\\n`;
//       if (r.age) summary += `   _${r.age}_\\n`;
//       summary += `\\n`;
//     });
    
//     // Add clickable sources section
//     summary += `**Sources:**\\n`;
//     results.forEach((r, i) => {
//       summary += `[${i + 1}. ${r.title}](${r.url})\\n`;
//     });
//   } else {
//     summary += 'No recent news found for this topic.\\n';
//   }
  
//   return {
//     summary,
//     insight: results[0]?.description || 'No recent news available.',
//     results,
//     confidence: results.length > 0 ? 0.8 : 0.3,
//     details: {
//       type: 'news',
//       query,
//       count: results.length,
//     },
//   };
// }

// /**
//  * Fact check a claim
//  */
// async function factCheck(query: string): Promise<{
//   summary: string;
//   insight: string;
//   results: SearchResult[];
//   confidence: number;
//   verdict?: 'true' | 'false' | 'mixed' | 'unverified';
//   details: { type: string; query: string; count: number };
// }> {
//   console.log(`[Seeker] Fact checking: "${query}"`);
  
//   // Search for the claim + fact check keywords
//   const searchResult = await braveSearch(`${query} fact check`, 5);
//   const results = searchResult.results;
  
//   // Simple heuristic for verdict (in production, use proper fact-checking APIs)
//   let verdict: 'true' | 'false' | 'mixed' | 'unverified' = 'unverified';
  
//   const allText = results.map(r => r.description.toLowerCase()).join(' ');
//   if (allText.includes('true') && !allText.includes('false')) verdict = 'true';
//   else if (allText.includes('false') && !allText.includes('true')) verdict = 'false';
//   else if (allText.includes('true') && allText.includes('false')) verdict = 'mixed';
  
//   let summary = `✅ **Fact Check: ${query}**\\n\\n`;
//   summary += `**Verdict**: ${verdict.toUpperCase()}\\n\\n`;
  
//   if (results.length > 0) {
//     summary += `**Evidence**:\\n`;
//     results.slice(0, 3).forEach((r, i) => {
//       summary += `${i + 1}. ${r.description}\\n`;
//     });
//     summary += `\\n**Sources**: ${results.map(r => r.url).join(', ')}\\n`;
//   }
  
//   summary += `\\n⚠️ *This is an automated check. Verify with primary sources.*`;
  
//   return {
//     summary,
//     insight: `Verdict: ${verdict}`,
//     results,
//     confidence: verdict !== 'unverified' ? 0.7 : 0.4,
//     verdict,
//     details: {
//       type: 'factcheck',
//       query,
//       count: results.length,
//     },
//   };
// }

export default seeker;
