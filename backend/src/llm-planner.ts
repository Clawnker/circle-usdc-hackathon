/**
 * LLM-based routing planner using Gemini Flash
 * Alternative to RegExp-based routing in dispatcher.ts
 */

import { SpecialistType, DAGPlan, PlanStep } from './types';
import { capabilityMatcher } from './capability-matcher';
import { chatJSON, chatText, MODELS } from './llm-client';

/**
 * Determine if a query is complex enough to require multi-step DAG planning.
 * Triggered if 2+ distinct capability domains are mentioned.
 */
export async function isComplexQuery(prompt: string): Promise<boolean> {
  const lower = prompt.toLowerCase();
  
  // 1. Fast Path: Regex-based multi-hop keyword detection
  const multiHopWords = [
    'compare', 'then', 'and then', 'after', 'followed by', 
    'while', 'relationship between', 'correlation', 'summarize both',
    'buy and', 'sell and', 'swap and'
  ];
  if (multiHopWords.some(word => lower.includes(word))) {
    console.log(`[Complexity Detector] Fast-path: multi-hop keywords detected`);
    return true;
  }

  // 2. Fast Path: Multiple domain detection via keyword groups
  const domains = [
    { name: 'market', regex: /price|market|predict|analysis|oracle/i },
    { name: 'social', regex: /sentiment|trending|popular|social|alpha|mention/i },
    { name: 'defi', regex: /swap|send|buy|sell|wallet|balance|transfer/i },
    { name: 'research', regex: /search|find|news|research|lookup/i },
    { name: 'security', regex: /audit|security|contract|vulnerability/i }
  ];
  
  const matchedDomains = domains.filter(d => d.regex.test(prompt));
  if (matchedDomains.length >= 2) {
    console.log(`[Complexity Detector] Fast-path: ${matchedDomains.length} domains detected: ${matchedDomains.map(d => d.name).join(', ')}`);
    return true;
  }

  // 3. Smart Path: Use intent extraction only if fast paths are ambiguous but query is long
  if (prompt.split(' ').length > 15) {
    try {
      const intent = await capabilityMatcher.extractIntent(prompt);
      const hasMultipleCaps = intent.requiredCapabilities && intent.requiredCapabilities.length >= 2;
      const hasMultipleEntities = (intent.entities?.tokens?.length || 0) + (intent.entities?.addresses?.length || 0) >= 2;

      if (hasMultipleCaps || hasMultipleEntities) {
        console.log(`[Complexity Detector] Smart-path: Complex query detected via LLM intent`);
        return true;
      }
    } catch (error) {
      console.error('[Complexity Detector] Smart-path error:', error);
    }
  }

  return false;
}

/**
 * Specialist pricing for cost estimation
 */
const SPECIALIST_PRICING: Record<string, number> = {
  magos: 0.001,
  aura: 0.0005,
  bankr: 0.0001,
  scribe: 0.0001,
  seeker: 0.0001,
  sentinel: 2.50,
  general: 0,
};

interface PlanningResult {
  specialist: SpecialistType;
  confidence: number;
  reasoning: string;
}

/**
 * Plan a multi-step DAG using Gemini Flash
 */
export async function planDAG(prompt: string): Promise<DAGPlan> {
  const systemPrompt = `You are the Hivemind Orchestrator. Your job is to decompose complex user queries into a Directed Acyclic Graph (DAG) of specialized agent tasks.

AVAILABLE SPECIALISTS:
- magos: Market analysis, price predictions, technical analysis, risk assessment.
- aura: Social sentiment analysis, trending topics, influencer tracking.
- bankr: Wallet operations (transfers, swaps, balances), Solana transactions.
- scribe: General assistant, summarization, explanations, formatting results.
- seeker: Web research, news lookup, search queries, current events.
- sentinel: Smart contract security audits (requires a contract address).

PRICING (USDC):
- magos: 0.001
- aura: 0.0005
- bankr: 0.0001
- scribe: 0.0001
- seeker: 0.0001
- sentinel: 2.50

OUTPUT FORMAT:
Return ONLY a valid JSON object:
{
  "planId": "unique-id",
  "steps": [
    {
      "id": "step-1",
      "specialist": "aura",
      "promptTemplate": "Find the top trending token on Solana right now.",
      "dependencies": [],
      "estimatedCost": 0.0005
    },
    {
      "id": "step-2",
      "specialist": "magos",
      "promptTemplate": "Analyze the price history and potential for {{step-1.output.trendingTokens[0].symbol}}",
      "dependencies": ["step-1"],
      "estimatedCost": 0.001
    }
  ],
  "reasoning": "Explain the plan strategy.",
  "totalEstimatedCost": 0.0015
}

RULES:
1. MANDATORY: Use {{step-id.output.path}} for dependency injection. EVERY time you refer to data from a previous step, you MUST use this syntax.
2. Parallelize: Steps with no common dependencies should run simultaneously.
3. Minimalist: Use the fewest agents possible to solve the query.
4. Sentinel: Only use for security audits of contract addresses.
5. If the query is simple and only needs one specialist, return a single-step plan.`;

  try {
    const { data: parsed } = await chatJSON(systemPrompt, prompt, {
      model: MODELS.fast,
      caller: 'llm-planner',
      temperature: 0.1,
      maxTokens: 1000,
    });

    // Ensure totalEstimatedCost is calculated if missing
    if (parsed.steps && parsed.totalEstimatedCost === undefined) {
      parsed.totalEstimatedCost = parsed.steps.reduce((sum: number, step: any) => sum + (step.estimatedCost || 0), 0);
    }

    return {
      planId: parsed.planId || `plan-${Date.now()}`,
      query: prompt,
      steps: parsed.steps || [],
      totalEstimatedCost: parsed.totalEstimatedCost || 0,
      reasoning: parsed.reasoning || 'Dynamic plan generated by Hivemind Orchestrator.'
    };
  } catch (error: any) {
    console.error(`[LLM Planner] Failed to plan DAG:`, error.message);
    // Fallback to a single-step scribe plan
    return {
      planId: `fallback-${Date.now()}`,
      query: prompt,
      steps: [{
        id: 'step-1',
        specialist: 'scribe',
        promptTemplate: prompt,
        dependencies: [],
        estimatedCost: 0.0001
      }],
      totalEstimatedCost: 0.0001,
      reasoning: `LLM planning failed, falling back to scribe`
    };
  }
}

/**
 * Plan routing using Gemini Flash LLM (Backward Compatibility)
 */
export async function planWithLLM(prompt: string): Promise<PlanningResult> {
  const plan = await planDAG(prompt);
  const firstStep = plan.steps[0];

  return {
    specialist: firstStep?.specialist || 'scribe',
    confidence: plan.steps.length > 0 ? 0.9 : 0.3,
    reasoning: plan.reasoning
  };
}

export default {
  planWithLLM,
  planDAG
};
