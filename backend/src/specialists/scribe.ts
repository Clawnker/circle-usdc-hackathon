/**
 * Scribe Specialist
 * Knowledge synthesis, summarization, and explanation
 * Upgraded to use Gemini Flash + Brave Search for dynamic, data-driven responses
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { SpecialistResult } from '../types';
import { braveSearch } from './tools/brave-search';

// Load system prompt
const PROMPT_PATH = path.join(__dirname, 'prompts', 'scribe.md');
let systemPrompt = '';
try {
  systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8');
} catch (e) {
  console.log('[Scribe] Could not load system prompt');
  systemPrompt = "You are Scribe, a knowledge synthesis expert. Your goal is to provide accurate, well-structured summaries, explanations, and documentation.";
}

export const scribe = {
  name: 'Scribe',
  description: 'Knowledge synthesizer for summaries, explanations, and documentation (Powered by Gemini)',
  systemPrompt,
  
  async handle(prompt: string): Promise<SpecialistResult> {
    const startTime = Date.now();
    
    try {
      const intent = parseIntent(prompt);
      let data: any;
      
      switch (intent.type) {
        case 'summarize':
          data = await summarize(intent.content || intent.topic);
          break;
        case 'explain':
          data = await explain(intent.topic, intent.audience);
          break;
        case 'document':
          data = await document(intent.topic);
          break;
        case 'draft':
          data = await draft(intent.topic, intent.format);
          break;
        default:
          data = await generalAssist(prompt);
      }
      
      return {
        success: true,
        data,
        confidence: data.confidence || 0.9,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error('[Scribe] Error:', error.message);
      return {
        success: false,
        data: { error: `An error occurred during knowledge synthesis: ${error.message}` },
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Call Gemini LLM with security wrapping
 */
async function callLLM(task: string, userContent: string, context: string = ''): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    throw new Error('LLM API key (GEMINI_API_KEY or GOOGLE_API_KEY) is missing');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
  
  const fullPrompt = `
${systemPrompt}

Current Task: ${task}

${context ? `### Context/Sources:\n${context}\n` : ''}

### User Input:
<user_input>
${userContent}
</user_input>

Please provide a detailed, well-structured response based on the above information. 
If sources were provided, please include citations.
Use Markdown for formatting.
`;

  try {
    const response = await axios.post(url, {
      contents: [{
        role: 'user',
        parts: [{ text: fullPrompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    });

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response from LLM');
    }
    return text.trim();
  } catch (error: any) {
    console.error('[Scribe] LLM API Error:', error.response?.data || error.message);
    throw new Error(`LLM generation failed: ${error.message}`);
  }
}

/**
 * Parse user intent from prompt
 */
function parseIntent(prompt: string): { 
  type: string; 
  topic: string; 
  content?: string;
  audience?: string;
  format?: string;
} {
  const lower = prompt.toLowerCase();
  
  // Extract the main topic/content
  let topic = prompt;
  
  if (lower.includes('summarize') || lower.includes('summary') || lower.includes('tldr')) {
    // Extract content to summarize (everything after the keyword)
    const content = prompt.replace(/^.*?(summarize|summary|tldr)[:\s]*/i, '').trim();
    return { type: 'summarize', topic, content: content || topic };
  }
  
  if (lower.includes('explain') || lower.includes('what is') || lower.includes('how does')) {
    const audience = lower.includes('eli5') || lower.includes('simple') ? 'beginner' : 
                     lower.includes('technical') || lower.includes('developer') ? 'technical' : 'general';
    topic = prompt.replace(/^.*?(explain|what is|how does)\s*/i, '').replace(/\?$/, '').trim();
    return { type: 'explain', topic, audience };
  }
  
  if (lower.includes('document') || lower.includes('docs') || lower.includes('write docs')) {
    topic = prompt.replace(/^.*?(document|docs|write docs)\s*/i, '').trim();
    return { type: 'document', topic };
  }
  
  if (lower.includes('draft') || lower.includes('write') || lower.includes('compose')) {
    const format = lower.includes('email') ? 'email' : 
                   lower.includes('tweet') || lower.includes('post') ? 'social' :
                   lower.includes('message') ? 'message' : 'general';
    topic = prompt.replace(/^.*?(draft|write|compose)\s*/i, '').trim();
    return { type: 'draft', topic, format };
  }
  
  return { type: 'general', topic };
}

/**
 * Summarize content
 */
async function summarize(content: string): Promise<any> {
  console.log(`[Scribe] Dynamically summarizing content (${content.length} chars)`);
  
  // Use LLM to generate summary
  const summaryText = await callLLM('Summarize the provided content. Extract key insights and maintain a concise but informative tone.', content);
  
  // Simple extraction for compatibility with existing structure
  const insight = summaryText.split('\n')[0].replace(/[*#]/g, '').trim();
  
  return {
    summary: summaryText,
    insight: insight,
    keyPoints: summaryText.match(/^[*-] (.*)/gm)?.map(p => p.replace(/^[*-] /, '')) || [],
    wordCount: {
      original: content.split(/\s+/).length,
      summary: summaryText.split(/\s+/).length,
    },
    confidence: 0.95,
    details: {
      type: 'summary',
      response: summaryText,
    },
  };
}

/**
 * Explain a concept with live research
 */
async function explain(topic: string, audience: string = 'general'): Promise<any> {
  console.log(`[Scribe] Researching and explaining "${topic}" for ${audience} audience`);
  
  // Fetch recent info via Brave Search
  const search = await braveSearch(`${topic} explanation ${audience === 'technical' ? 'technical details architecture' : 'simple terms beginners'}`);
  const context = search.results.map(r => `Source: ${r.title} (${r.url})\nSnippet: ${r.description}`).join('\n\n');
  
  const explanation = await callLLM(
    `Explain the following topic for a ${audience} audience. Use the provided search results as context and cite sources.`,
    topic,
    context
  );
  
  return {
    summary: explanation,
    insight: explanation.split('\n')[0].replace(/[*#]/g, '').trim(),
    explanation,
    examples: explanation.match(/Example: (.*)/g) || [],
    sources: search.results.map(r => ({ title: r.title, url: r.url })),
    confidence: 0.92,
    details: {
      type: 'explanation',
      response: explanation,
    },
  };
}

/**
 * Generate documentation
 */
async function document(topic: string): Promise<any> {
  console.log(`[Scribe] Generating dynamic docs for "${topic}"`);
  
  const search = await braveSearch(`${topic} technical documentation api reference guide`);
  const context = search.results.map(r => `Reference: ${r.title} (${r.url})\nInfo: ${r.description}`).join('\n\n');
  
  const documentation = await callLLM(
    `Generate comprehensive, professional documentation for the following topic. Include sections for Overview, Usage, and Examples.`,
    topic,
    context
  );
  
  return {
    summary: `📄 **Documentation Generated**: ${topic}`,
    insight: `Created dynamic documentation for ${topic} using recent sources`,
    documentation,
    sources: search.results.map(r => ({ title: r.title, url: r.url })),
    confidence: 0.88,
    details: {
      type: 'documentation',
      response: documentation,
    },
  };
}

/**
 * Draft content
 */
async function draft(topic: string, format: string = 'general'): Promise<any> {
  console.log(`[Scribe] Drafting ${format} about "${topic}"`);
  
  const search = await braveSearch(`${topic} recent news updates context`);
  const context = search.results.map(r => `News: ${r.title}\nContext: ${r.description}`).join('\n\n');
  
  const draft = await callLLM(
    `Draft a ${format} based on the topic. The tone should be professional and engaging. Incorporate relevant details from the provided context.`,
    topic,
    context
  );
  
  return {
    summary: `✍️ **Draft Created**: ${format} about ${topic}`,
    insight: `Created dynamic ${format} draft for ${topic}`,
    draft,
    confidence: 0.9,
    details: {
      type: 'draft',
      response: draft,
    },
  };
}

/**
 * General assistance
 */
async function generalAssist(prompt: string): Promise<any> {
  console.log(`[Scribe] Dynamic general assist: "${prompt}"`);
  
  // For general queries, we still check if search helps
  const search = await braveSearch(prompt);
  const context = search.results.map(r => `Source: ${r.title}\nSnippet: ${r.description}`).join('\n\n');
  
  const response = await callLLM(
    'You are Scribe, an expert knowledge assistant. Answer the user request accurately and helpfully.',
    prompt,
    context
  );
  
  return {
    summary: response,
    insight: 'Synthesized dynamic response for general query',
    confidence: 0.95,
    details: {
      type: 'general',
      response,
    },
  };
}

export default scribe;
