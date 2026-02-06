/**
 * Scribe Specialist
 * Knowledge synthesis, summarization, and explanation
 */

import * as fs from 'fs';
import * as path from 'path';
import { SpecialistResult } from '../types';

// Load system prompt
const PROMPT_PATH = path.join(__dirname, 'prompts', 'scribe.md');
let systemPrompt = '';
try {
  systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8');
} catch (e) {
  console.log('[Scribe] Could not load system prompt');
}

export const scribe = {
  name: 'Scribe',
  description: 'Knowledge synthesizer for summaries, explanations, and documentation',
  systemPrompt,
  
  async handle(prompt: string): Promise<SpecialistResult> {
    const startTime = Date.now();
    
    try {
      const intent = parseIntent(prompt);
      let data: any;
      
      switch (intent.type) {
        case 'summarize':
          data = await summarize(intent.content);
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
async function summarize(content: string): Promise<{
  summary: string;
  insight: string;
  keyPoints: string[];
  wordCount: { original: number; summary: number };
  confidence: number;
  details: { type: string; response: string };
}> {
  console.log(`[Scribe] Summarizing content (${content.length} chars)`);
  
  // Simple extractive summary (in production, use LLM)
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const keyPoints = sentences.slice(0, 3).map(s => s.trim());
  
  // Generate summary
  const tldr = keyPoints.length > 0 
    ? keyPoints[0] + (keyPoints.length > 1 ? ' Additionally, ' + keyPoints[1].toLowerCase() : '')
    : 'Content summarized successfully.';
  
  const summary = `📝 **Summary**\n\n**TL;DR**: ${tldr}\n\n**Key Points**:\n${keyPoints.map((p, i) => `• ${p}`).join('\n')}`;
  
  return {
    summary,
    insight: tldr,
    keyPoints,
    wordCount: {
      original: content.split(/\s+/).length,
      summary: tldr.split(/\s+/).length,
    },
    confidence: 0.85,
    details: {
      type: 'summary',
      response: summary,
    },
  };
}

/**
 * Explain a concept
 */
async function explain(topic: string, audience: string = 'general'): Promise<{
  summary: string;
  insight: string;
  explanation: string;
  examples: string[];
  confidence: number;
  details: { type: string; response: string };
}> {
  console.log(`[Scribe] Explaining "${topic}" for ${audience} audience`);
  
  // Knowledge base for common topics (in production, use LLM or knowledge graph)
  const explanations: Record<string, { simple: string; technical: string; examples: string[] }> = {
    'staking': {
      simple: 'Staking is like putting money in a savings account that helps run a blockchain network. You lock up your crypto, it helps verify transactions, and you earn interest as a reward.',
      technical: 'Staking is the process of locking cryptocurrency in a Proof-of-Stake (PoS) network to participate in block validation. Validators are selected proportionally to their stake to propose and attest to blocks, earning rewards minus any slashing penalties for misbehavior.',
      examples: ['Staking 100 SOL at 7% APY earns ~7 SOL per year', 'Ethereum requires 32 ETH to run a validator'],
    },
    'defi': {
      simple: 'DeFi (Decentralized Finance) is like having a bank that runs on code instead of people. You can lend, borrow, and trade without traditional banks.',
      technical: 'DeFi encompasses financial protocols built on smart contracts that enable permissionless, non-custodial financial services including lending pools, automated market makers, and derivatives without centralized intermediaries.',
      examples: ['Uniswap lets you trade tokens without an exchange', 'Aave lets you borrow crypto using other crypto as collateral'],
    },
    'nft': {
      simple: 'NFTs (Non-Fungible Tokens) are like digital certificates of authenticity. They prove you own a unique digital item, like art or a collectible.',
      technical: 'NFTs are cryptographic tokens on a blockchain that represent unique assets. Unlike fungible tokens, each NFT has distinct metadata and token ID, enabling provable ownership and scarcity of digital assets.',
      examples: ['CryptoPunks are one of the first NFT collections', 'NBA Top Shot sells video clip NFTs'],
    },
    'default': {
      simple: `${topic} is an interesting concept in the crypto/tech space. It refers to a specific technology or methodology used in blockchain systems.`,
      technical: `${topic} is a technical concept that involves specific protocols and mechanisms within distributed systems architecture.`,
      examples: ['See documentation for specific examples'],
    },
  };
  
  const topicLower = topic.toLowerCase();
  const info = Object.entries(explanations).find(([key]) => topicLower.includes(key))?.[1] || explanations['default'];
  
  const explanation = audience === 'technical' ? info.technical : info.simple;
  
  const summary = `📚 **Explaining: ${topic}**\n\n**Simple Version**: ${info.simple}\n\n**How It Works**: ${info.technical}\n\n**Examples**:\n${info.examples.map(e => `• ${e}`).join('\n')}\n\n💡 *Related: blockchain, cryptography, smart contracts*`;
  
  return {
    summary,
    insight: explanation,
    explanation,
    examples: info.examples,
    confidence: 0.9,
    details: {
      type: 'explanation',
      response: summary,
    },
  };
}

/**
 * Generate documentation
 */
async function document(topic: string): Promise<{
  summary: string;
  insight: string;
  documentation: string;
  confidence: number;
  details: { type: string; response: string };
}> {
  console.log(`[Scribe] Generating docs for "${topic}"`);
  
  const documentation = `# ${topic}\n\n## Overview\n\nDocumentation for ${topic}.\n\n## Usage\n\n\`\`\`\n// Example usage\n\`\`\`\n\n## API Reference\n\n| Method | Description |\n|--------|-------------|\n| init() | Initialize ${topic} |\n| run()  | Execute main function |\n\n## Examples\n\nSee the examples directory for practical implementations.\n\n## Notes\n\n- This is auto-generated documentation\n- Review and expand based on actual implementation`;
  
  return {
    summary: `📄 **Documentation Generated**: ${topic}`,
    insight: `Created structured documentation template for ${topic}`,
    documentation,
    confidence: 0.8,
    details: {
      type: 'documentation',
      response: documentation,
    },
  };
}

/**
 * Draft content
 */
async function draft(topic: string, format: string = 'general'): Promise<{
  summary: string;
  insight: string;
  draft: string;
  confidence: number;
  details: { type: string; response: string };
}> {
  console.log(`[Scribe] Drafting ${format} about "${topic}"`);
  
  let draft = '';
  
  switch (format) {
    case 'email':
      draft = `Subject: Re: ${topic}\n\nHi,\n\nThank you for reaching out about ${topic}.\n\n[Your message here]\n\nBest regards,\n[Your name]`;
      break;
    case 'social':
      draft = `🚀 ${topic}\n\n[Key point or insight]\n\n#crypto #blockchain`;
      break;
    case 'message':
      draft = `Hey! About ${topic} - [your message here]`;
      break;
    default:
      draft = `# ${topic}\n\n[Your content here]\n\n## Key Points\n\n- Point 1\n- Point 2\n- Point 3`;
  }
  
  return {
    summary: `✍️ **Draft Created**: ${format} about ${topic}`,
    insight: `Created ${format} draft template`,
    draft,
    confidence: 0.85,
    details: {
      type: 'draft',
      response: draft,
    },
  };
}

/**
 * General assistance
 */
async function generalAssist(prompt: string): Promise<{
  summary: string;
  insight: string;
  confidence: number;
  details: { type: string; response: string };
}> {
  console.log(`[Scribe] General assist: "${prompt}"`);
  
  const response = `I'm Scribe, your knowledge assistant. I can help you with:\n\n• **Summarize**: "Summarize this article..."\n• **Explain**: "Explain staking in simple terms"\n• **Document**: "Write docs for this API"\n• **Draft**: "Draft an email about..."\n\nHow can I assist you?`;
  
  return {
    summary: response,
    insight: 'Scribe is ready to assist with knowledge tasks.',
    confidence: 0.95,
    details: {
      type: 'general',
      response,
    },
  };
}

export default scribe;
