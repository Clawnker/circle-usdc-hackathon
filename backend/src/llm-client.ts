/**
 * Unified LLM Client for Hivemind Protocol
 * Routes all inference through ClawRouter/BlockRun (OpenAI-compatible)
 * Tracks real token usage and cost for dynamic pricing
 */

import axios from 'axios';

// --- Configuration ---
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://127.0.0.1:8402/v1';
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.CLAWROUTER_API_KEY || 'clawrouter';
const DEFAULT_MODEL = process.env.LLM_DEFAULT_MODEL || 'google/gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const VERTEX_PROJECT_ID = process.env.VERTEX_PROJECT_ID || process.env.GCP_PROJECT_ID || '';
const VERTEX_LOCATION = process.env.VERTEX_LOCATION || 'us-central1';

// Vertex AI global endpoint for Gemini 3.x models
const VERTEX_BASE_URL = VERTEX_PROJECT_ID 
  ? `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${VERTEX_PROJECT_ID}/locations/${VERTEX_LOCATION}/endpoints/openapi`
  : '';
const GEMINI_FALLBACK_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

// Cost markup for specialist pricing (e.g., 1.5 = 50% markup)
const COST_MARKUP = parseFloat(process.env.LLM_COST_MARKUP || '1.5');

// Priority: Explicit LLM_BASE_URL > Vertex AI (3.x support) > AI Studio fallback
const useVertex = !process.env.LLM_BASE_URL && !!VERTEX_PROJECT_ID && !!GEMINI_API_KEY;
const useGeminiFallback = !process.env.LLM_BASE_URL && !!GEMINI_API_KEY && !useVertex;
const ACTIVE_BASE_URL = process.env.LLM_BASE_URL || (useVertex ? VERTEX_BASE_URL : GEMINI_FALLBACK_URL);
const ACTIVE_API_KEY = LLM_API_KEY || GEMINI_API_KEY;

// Model mapping - Vertex supports Gemini 3.x models
const GEMINI_MODEL_MAP: Record<string, string> = {
  'google/gemini-2.5-flash': 'gemini-2.5-flash',
  'google/gemini-2.5-pro': 'gemini-2.5-pro',
  'google/gemini-3-pro-preview': 'gemini-3-pro-preview-001',
  'google/gemini-3-flash-preview': 'gemini-3-flash-preview-001',
  'nvidia/gpt-oss-120b': 'gemini-2.0-flash',
  'auto': 'gemini-2.5-flash',
};

if (useVertex) {
  console.log(`[LLM] Using Vertex AI (${VERTEX_LOCATION}) — Gemini 3.x models enabled`);
} else if (useGeminiFallback) {
  console.log('[LLM] ClawRouter not configured — using Gemini AI Studio fallback');
} else {
  console.log(`[LLM] Using ${ACTIVE_BASE_URL}`);
}

// --- Types ---
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  jsonMode?: boolean;
  /** Caller identifier for cost tracking */
  caller?: string;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMCost {
  /** Raw cost from provider (USD) */
  rawCost: number;
  /** Cost with markup applied (USD) */
  markedUpCost: number;
  /** Markup multiplier used */
  markup: number;
}

export interface LLMResult {
  text: string;
  model: string;
  usage: LLMUsage;
  cost: LLMCost;
  latencyMs: number;
  /** The caller that made this request */
  caller: string;
}

// --- Cost Tracking ---
interface CostRecord {
  caller: string;
  model: string;
  usage: LLMUsage;
  cost: LLMCost;
  timestamp: Date;
}

class CostTracker {
  private records: CostRecord[] = [];
  private maxRecords = 1000;

  record(entry: CostRecord) {
    this.records.push(entry);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  /** Get total cost for a specific caller (specialist) */
  getCallerCost(caller: string): { raw: number; markedUp: number; requests: number } {
    const callerRecords = this.records.filter(r => r.caller === caller);
    return {
      raw: callerRecords.reduce((sum, r) => sum + r.cost.rawCost, 0),
      markedUp: callerRecords.reduce((sum, r) => sum + r.cost.markedUpCost, 0),
      requests: callerRecords.length,
    };
  }

  /** Get cost summary across all callers */
  getSummary(): Record<string, { raw: number; markedUp: number; requests: number; tokens: number }> {
    const summary: Record<string, { raw: number; markedUp: number; requests: number; tokens: number }> = {};
    for (const r of this.records) {
      if (!summary[r.caller]) {
        summary[r.caller] = { raw: 0, markedUp: 0, requests: 0, tokens: 0 };
      }
      summary[r.caller].raw += r.cost.rawCost;
      summary[r.caller].markedUp += r.cost.markedUpCost;
      summary[r.caller].requests += 1;
      summary[r.caller].tokens += r.usage.totalTokens;
    }
    return summary;
  }

  /** Get the last N records */
  getRecent(n: number = 10): CostRecord[] {
    return this.records.slice(-n);
  }

  /** Reset all records */
  reset() {
    this.records = [];
  }
}

export const costTracker = new CostTracker();

// --- Known model pricing (per million tokens, USD) ---
// Used to estimate cost when the API doesn't return it
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'google/gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'google/gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'google/gemini-3-pro-preview': { input: 2.0, output: 12.0 },
  'anthropic/claude-sonnet-4': { input: 3.0, output: 15.0 },
  'anthropic/claude-haiku-4.5': { input: 1.0, output: 5.0 },
  'anthropic/claude-opus-4': { input: 15.0, output: 75.0 },
  'openai/gpt-4o': { input: 2.5, output: 10.0 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'deepseek/deepseek-chat': { input: 0.28, output: 0.42 },
  'xai/grok-4-fast-reasoning': { input: 0.20, output: 0.50 },
  // Aliases
  'flash': { input: 0.15, output: 0.60 },
  'gemini': { input: 1.25, output: 10.0 },
  'sonnet': { input: 3.0, output: 15.0 },
  'haiku': { input: 1.0, output: 5.0 },
  'auto': { input: 0.50, output: 2.0 }, // estimate for smart router
};

function estimateCost(model: string, usage: LLMUsage): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['auto'];
  const inputCost = (usage.promptTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

// --- Main LLM Call ---
export async function callLLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResult> {
  const model = options.model || DEFAULT_MODEL;
  const caller = options.caller || 'unknown';
  const startTime = Date.now();

  // Map model names for Gemini fallback
  const resolvedModel = useGeminiFallback
    ? (GEMINI_MODEL_MAP[model] || 'gemini-2.5-flash')
    : model;

  const requestBody: any = {
    model: resolvedModel,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: useGeminiFallback
      ? Math.max(options.maxTokens ?? 2048, 500)  // Gemini needs headroom for thinking tokens
      : (options.maxTokens ?? 2048),
    top_p: options.topP ?? 0.95,
  };

  if (options.jsonMode) {
    requestBody.response_format = { type: 'json_object' };
  }

  try {
    const response = await axios.post(
      `${ACTIVE_BASE_URL}/chat/completions`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${ACTIVE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const data = response.data;
    const text = data.choices?.[0]?.message?.content || '';
    const usage: LLMUsage = {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    };

    const rawCost = estimateCost(model, usage);
    const cost: LLMCost = {
      rawCost,
      markedUpCost: rawCost * COST_MARKUP,
      markup: COST_MARKUP,
    };

    const latencyMs = Date.now() - startTime;
    const resolvedModel = data.model || model;

    // Track cost
    costTracker.record({
      caller,
      model: resolvedModel,
      usage,
      cost,
      timestamp: new Date(),
    });

    console.log(
      `[LLM] ${caller} → ${resolvedModel} | ${usage.totalTokens} tokens | $${rawCost.toFixed(6)} raw | $${cost.markedUpCost.toFixed(6)} marked up | ${latencyMs}ms`
    );

    return { text, model: resolvedModel, usage, cost, latencyMs, caller };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error(`[LLM] ${caller} → ${model} FAILED after ${latencyMs}ms:`, error.message);
    
    if (error.response) {
      console.error(`[LLM] Status: ${error.response.status}, Body:`, 
        JSON.stringify(error.response.data).slice(0, 500));
    }

    throw new Error(`LLM call failed (${model}): ${error.message}`);
  }
}

// --- Convenience Helpers ---

/** Simple prompt → text (system + user message pattern) */
export async function chat(
  systemPrompt: string,
  userPrompt: string,
  options: LLMOptions = {}
): Promise<LLMResult> {
  return callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    options
  );
}

/** Simple prompt → text string only */
export async function chatText(
  systemPrompt: string,
  userPrompt: string,
  options: LLMOptions = {}
): Promise<string> {
  const result = await chat(systemPrompt, userPrompt, options);
  return result.text;
}

/** JSON mode — returns parsed JSON */
export async function chatJSON<T = any>(
  systemPrompt: string,
  userPrompt: string,
  options: LLMOptions = {}
): Promise<{ data: T; result: LLMResult }> {
  // Append JSON instruction to system prompt for models that don't support response_format
  const jsonSystemPrompt = systemPrompt + '\n\nIMPORTANT: You MUST respond with ONLY a valid JSON object. No markdown, no explanation, just JSON.';
  
  const result = await chat(jsonSystemPrompt, userPrompt, {
    ...options,
    temperature: options.temperature ?? 0.1,
  });

  // Extract JSON from response (handles markdown code blocks, extra text)
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not parse JSON from LLM response: ${result.text.slice(0, 200)}`);
  }

  const data = JSON.parse(jsonMatch[0]) as T;
  return { data, result };
}

// --- Model Presets for Specialists ---
export const MODELS = {
  /** Cheapest, fastest — routing decisions, simple classification */
  fast: 'google/gemini-2.5-flash',
  /** Mid-tier — most specialist work */
  standard: 'google/gemini-2.5-pro', 
  /** Premium — complex analysis, multi-step reasoning */
  premium: 'anthropic/claude-sonnet-4',
  /** Free tier — NVIDIA GPT-OSS (no cost) */
  free: 'nvidia/gpt-oss-120b',
} as const;

export default { callLLM, chat, chatText, chatJSON, costTracker, MODELS };
