/**
 * Scribe Specialist — V3
 * Knowledge synthesis, summarization, and explanation
 * Features: Report templates, tone control, improved multi-source synthesis
 */

import * as fs from 'fs';
import * as path from 'path';
import { SpecialistResult } from '../types';
import { braveSearch } from './tools/brave-search';
import { chatText, MODELS } from '../llm-client';

// Load system prompt
const PROMPT_PATH = path.join(__dirname, 'prompts', 'scribe.md');
let systemPrompt = '';
try {
  systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8');
} catch (e) {
  console.log('[Scribe] Could not load system prompt');
  systemPrompt = "You are Scribe, a knowledge synthesis expert in the Hivemind Protocol. Provide accurate, well-structured analysis.";
}

// --- Report Templates ---
type ReportTemplate = 'market' | 'comparison' | 'risk' | 'research' | 'general';
type Tone = 'professional' | 'casual' | 'technical' | 'executive';

const TEMPLATE_INSTRUCTIONS: Record<ReportTemplate, string> = {
  market: `Structure your response as a Market Report:
## Executive Summary
(2-3 sentence overview of findings)
## Price Analysis
(Current price data, trends, key levels)
## Sentiment Analysis
(Social/market sentiment, volume indicators)
## Risk Factors
(Key risks to consider)
## Outlook
(Short-term and medium-term outlook with confidence level)`,

  comparison: `Structure your response as a Comparison Report:
## Overview
(What is being compared and why)
## Side-by-Side Metrics
(Use a markdown table comparing key metrics)
## Strengths & Weaknesses
(For each item being compared)
## Recommendation
(Clear recommendation with reasoning)`,

  risk: `Structure your response as a Risk Assessment:
## Risk Summary
(Overall risk level: Low/Medium/High/Critical)
## Identified Risks
(Numbered list of specific risks)
## Severity Matrix
(Use a markdown table: Risk | Likelihood | Impact | Severity)
## Mitigation Steps
(Actionable steps to reduce each risk)`,

  research: `Structure your response as a Research Brief:
## Key Findings
(Top 3-5 findings, bulleted)
## Background
(Context and history)
## Analysis
(Deep dive into findings)
## Sources
(Numbered citations)
## Conclusion
(Summary and implications)`,

  general: `Use clear Markdown formatting with headers, bullet points, and tables where appropriate. Be concise and actionable.`,
};

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  professional: 'Use a formal, data-driven tone. Support claims with evidence. Avoid colloquialisms.',
  casual: 'Use a conversational, accessible tone. Explain jargon when used. Keep it engaging.',
  technical: 'Use precise technical language. Include code examples, specs, and implementation details where relevant.',
  executive: 'Lead with the bottom line. Use bullet points. Keep it under 300 words. Focus on decisions and actions.',
};

export const scribe = {
  name: 'Scribe',
  description: 'Knowledge synthesizer for summaries, explanations, reports, and documentation (Powered by Gemini)',
  systemPrompt,
  
  async handle(prompt: string): Promise<SpecialistResult> {
    const startTime = Date.now();
    
    try {
      const intent = parseIntent(prompt);
      let data: any;
      
      switch (intent.type) {
        case 'synthesize':
          data = await synthesize(prompt, intent.template, intent.tone);
          break;
        case 'summarize':
          data = await summarize(intent.content || intent.topic, intent.tone);
          break;
        case 'explain':
          data = await explain(intent.topic, intent.audience, intent.tone);
          break;
        case 'document':
          data = await document(intent.topic, intent.tone);
          break;
        case 'draft':
          data = await draft(intent.topic, intent.format, intent.tone);
          break;
        default:
          data = await generalAssist(prompt, intent.template, intent.tone);
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
 * Call LLM with template and tone awareness
 */
async function callLLM(
  task: string,
  userContent: string,
  options: { context?: string; template?: ReportTemplate; tone?: Tone } = {}
): Promise<string> {
  const { context = '', template = 'general', tone = 'professional' } = options;
  
  const templateBlock = TEMPLATE_INSTRUCTIONS[template] || TEMPLATE_INSTRUCTIONS.general;
  const toneBlock = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional;

  const fullPrompt = `
${systemPrompt}

## Task
${task}

## Output Format
${templateBlock}

## Tone
${toneBlock}

${context ? `## Context/Sources\n${context}\n` : ''}

## User Input
<user_input>
${userContent}
</user_input>

Write the actual content directly. Do NOT include meta-commentary like "Here is a draft" or "Created a report about...".
Start with the content itself. Use Markdown formatting throughout.
If sources were provided, include numbered citations [1], [2], etc. at the end.
`;

  return chatText('', fullPrompt, {
    model: MODELS.fast,
    caller: 'scribe',
    temperature: 0.3,
    maxTokens: 4096,
  });
}

/**
 * Detect report template from prompt content
 */
function detectTemplate(prompt: string): ReportTemplate {
  const lower = prompt.toLowerCase();
  
  // Market report: price + sentiment data, or explicit market keywords
  if ((lower.includes('price') && lower.includes('sentiment')) ||
      lower.includes('market report') || lower.includes('market analysis') ||
      lower.includes('trading') || lower.includes('outlook')) {
    return 'market';
  }
  
  // Comparison: explicit comparison words or "vs" / "versus"
  if (lower.includes('compare') || lower.includes('comparison') ||
      lower.includes(' vs ') || lower.includes('versus') ||
      lower.includes('difference between') || lower.includes('which is better')) {
    return 'comparison';
  }
  
  // Risk: security, audit, risk keywords
  if (lower.includes('risk') || lower.includes('audit') ||
      lower.includes('security') || lower.includes('vulnerability') ||
      lower.includes('threat') || lower.includes('assessment')) {
    return 'risk';
  }
  
  // Research: research keywords or general investigative queries
  if (lower.includes('research') || lower.includes('investigate') ||
      lower.includes('deep dive') || lower.includes('analysis of') ||
      lower.includes('report on') || lower.includes('brief on')) {
    return 'research';
  }
  
  return 'general';
}

/**
 * Detect desired tone from prompt
 */
function detectTone(prompt: string): Tone {
  const lower = prompt.toLowerCase();
  
  if (lower.includes('eli5') || lower.includes('simple') || lower.includes('casual') ||
      lower.includes('easy to understand') || lower.includes('for beginners')) {
    return 'casual';
  }
  if (lower.includes('technical') || lower.includes('developer') ||
      lower.includes('code') || lower.includes('implementation')) {
    return 'technical';
  }
  if (lower.includes('executive') || lower.includes('tldr') || lower.includes('brief') ||
      lower.includes('quick summary') || lower.includes('bottom line')) {
    return 'executive';
  }
  
  return 'professional';
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
  template: ReportTemplate;
  tone: Tone;
} {
  const lower = prompt.toLowerCase();
  const template = detectTemplate(prompt);
  const tone = detectTone(prompt);
  
  // Detect synthesis patterns for multi-hop DAG results
  const synthesisPatterns = [
    '{{step-',
    'based on the following data',
    'synthesize',
    'combine these results',
    'analyze the results from',
    '"data": {',
    '"results": [',
    '**Key Findings:**',
    '🔍 **Research',
    '**Sources:**',
    '[data from',
  ];
  
  // Long prompts with structured content are almost certainly synthesis requests
  const isLongStructured = prompt.length > 300 && (
    prompt.includes('**') || 
    prompt.includes('Source:') ||
    prompt.includes('http') ||
    prompt.includes('[data from') ||
    (prompt.includes('"') && prompt.includes('{'))
  );
  
  if (synthesisPatterns.some(p => lower.includes(p.toLowerCase())) || isLongStructured) {
    return { type: 'synthesize', topic: 'Data Synthesis', template, tone };
  }

  let topic = prompt;
  
  if (lower.includes('summarize') || lower.includes('summary') || lower.includes('tldr')) {
    const content = prompt.replace(/^.*?(summarize|summary|tldr)[:\s]*/i, '').trim();
    return { type: 'summarize', topic, content: content || topic, template, tone };
  }
  
  if (lower.includes('explain') || lower.includes('what is') || lower.includes('how does')) {
    const audience = lower.includes('eli5') || lower.includes('simple') ? 'beginner' : 
                     lower.includes('technical') || lower.includes('developer') ? 'technical' : 'general';
    topic = prompt.replace(/^.*?(explain|what is|how does)\s*/i, '').replace(/\?$/, '').trim();
    return { type: 'explain', topic, audience, template, tone };
  }
  
  if (lower.includes('document') || lower.includes('docs') || lower.includes('write docs')) {
    topic = prompt.replace(/^.*?(document|docs|write docs)\s*/i, '').trim();
    return { type: 'document', topic, template, tone };
  }
  
  if (lower.includes('draft') || lower.includes('write') || lower.includes('compose')) {
    const format = lower.includes('email') ? 'email' : 
                   lower.includes('tweet') || lower.includes('post') ? 'social' :
                   lower.includes('message') ? 'message' : 'general';
    topic = prompt.replace(/^.*?(draft|write|compose)\s*/i, '').trim();
    return { type: 'draft', topic, format, template, tone };
  }
  
  return { type: 'general', topic, template, tone };
}

/**
 * Synthesize pre-collected data from multiple specialist steps
 */
async function synthesize(data: string, template: ReportTemplate = 'research', tone: Tone = 'professional'): Promise<any> {
  console.log(`[Scribe] Synthesizing pre-collected data (${data.length} chars) [template=${template}, tone=${tone}]`);
  
  // Auto-detect template from data content if not explicitly set
  const effectiveTemplate = template !== 'general' ? template : detectTemplate(data);
  
  const synthesis = await callLLM(
    'You are Scribe, synthesizing data from multiple specialist agents in the Hivemind Protocol. ' +
    'Your job is to cross-reference the data, identify agreements and contradictions between sources, ' +
    'extract actionable insights, and present a unified analysis. ' +
    'Do NOT perform any external searches. Focus entirely on the provided data. ' +
    'If data from different specialists conflicts, note the discrepancy and explain which source is likely more reliable.',
    data,
    { template: effectiveTemplate, tone }
  );
  
  return {
    summary: synthesis,
    insight: synthesis.split('\n')[0].replace(/[*#]/g, '').trim().substring(0, 200),
    confidence: 0.98,
    template: effectiveTemplate,
    tone,
    details: {
      type: 'synthesis',
      dataLength: data.length,
      response: synthesis,
    },
  };
}

/**
 * Summarize content
 */
async function summarize(content: string, tone: Tone = 'professional'): Promise<any> {
  console.log(`[Scribe] Summarizing content (${content.length} chars) [tone=${tone}]`);
  
  const summaryText = await callLLM(
    'Summarize the provided content. Extract key insights and maintain accuracy. ' +
    'Lead with the most important finding. Use bullet points for key takeaways.',
    content,
    { tone }
  );
  
  const insight = summaryText.split('\n')[0].replace(/[*#]/g, '').trim();
  
  return {
    summary: summaryText,
    insight,
    keyPoints: summaryText.match(/^[*-] (.*)/gm)?.map(p => p.replace(/^[*-] /, '')) || [],
    wordCount: {
      original: content.split(/\s+/).length,
      summary: summaryText.split(/\s+/).length,
    },
    confidence: 0.95,
    tone,
    details: {
      type: 'summary',
      response: summaryText,
    },
  };
}

/**
 * Explain a concept with live research
 */
async function explain(topic: string, audience: string = 'general', tone: Tone = 'professional'): Promise<any> {
  console.log(`[Scribe] Explaining "${topic}" for ${audience} audience [tone=${tone}]`);
  
  const search = await braveSearch(`${topic} explanation ${audience === 'technical' ? 'technical details architecture' : 'simple terms beginners'}`);
  const context = search.results.map(r => `Source: ${r.title} (${r.url})\nSnippet: ${r.description}`).join('\n\n');
  
  const explanation = await callLLM(
    `Explain the following topic for a ${audience} audience. Use the provided search results as context. ` +
    'Include numbered citations [1], [2] referencing the sources. ' +
    'Start with the core concept, then build complexity.',
    topic,
    { context, tone: audience === 'beginner' ? 'casual' : tone }
  );
  
  return {
    summary: explanation,
    insight: explanation.split('\n')[0].replace(/[*#]/g, '').trim(),
    explanation,
    examples: explanation.match(/Example: (.*)/g) || [],
    sources: search.results.map(r => ({ title: r.title, url: r.url })),
    confidence: 0.92,
    tone,
    details: {
      type: 'explanation',
      response: explanation,
    },
  };
}

/**
 * Generate documentation
 */
async function document(topic: string, tone: Tone = 'technical'): Promise<any> {
  console.log(`[Scribe] Generating docs for "${topic}" [tone=${tone}]`);
  
  const search = await braveSearch(`${topic} technical documentation api reference guide`);
  const context = search.results.map(r => `Reference: ${r.title} (${r.url})\nInfo: ${r.description}`).join('\n\n');
  
  const documentation = await callLLM(
    'Generate comprehensive, professional documentation. Include sections for Overview, Usage, API Reference (if applicable), Examples, and Common Pitfalls.',
    topic,
    { context, tone: 'technical' }
  );
  
  return {
    summary: `📄 **Documentation Generated**: ${topic}`,
    insight: `Created dynamic documentation for ${topic} using recent sources`,
    documentation,
    sources: search.results.map(r => ({ title: r.title, url: r.url })),
    confidence: 0.88,
    tone,
    details: {
      type: 'documentation',
      response: documentation,
    },
  };
}

/**
 * Draft content
 */
async function draft(topic: string, format: string = 'general', tone: Tone = 'professional'): Promise<any> {
  console.log(`[Scribe] Drafting ${format} about "${topic}" [tone=${tone}]`);
  
  const search = await braveSearch(`${topic} recent news updates context`);
  const context = search.results.map(r => `News: ${r.title}\nContext: ${r.description}`).join('\n\n');
  
  const draftText = await callLLM(
    `Write a ${format} about the topic. Output ONLY the content — no preamble, no "here is your draft". ` +
    'Incorporate relevant details from context. Make it engaging and actionable.',
    topic,
    { context, tone }
  );
  
  return {
    summary: draftText,
    insight: draftText,
    confidence: 0.9,
    tone,
    details: {
      type: 'draft',
      format,
      topic,
    },
  };
}

/**
 * General assistance with template-awareness
 */
async function generalAssist(prompt: string, template: ReportTemplate = 'general', tone: Tone = 'professional'): Promise<any> {
  console.log(`[Scribe] General assist [template=${template}, tone=${tone}]: "${prompt.substring(0, 80)}..."`);
  
  const search = await braveSearch(prompt);
  const context = search.results.map(r => `Source: ${r.title}\nSnippet: ${r.description}`).join('\n\n');
  
  const response = await callLLM(
    'You are Scribe, an expert knowledge assistant in the Hivemind Protocol. ' +
    'Answer the user request accurately and helpfully. Cite sources where available.',
    prompt,
    { context, template, tone }
  );
  
  return {
    summary: response,
    insight: response,
    confidence: 0.95,
    template,
    tone,
    details: {
      type: 'general',
      response,
    },
  };
}

export default scribe;
