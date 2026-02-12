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
 * Validates a DAGPlan, ensuring no cycles, within step limits, and valid variable references.
 * Also calculates timeoutMs for each step.
 */
function validateDAGPlan(plan: DAGPlan): DAGPlan {
  // 1. Step count limit
  if (plan.steps.length > 5) {
    console.warn(`[DAG Validation] Plan has ${plan.steps.length} steps, truncating to 5.`);
    plan.steps = plan.steps.slice(0, 5);
  }

  // Add timeout budget to plan and each step
  plan.timeoutMs = 45000;
  const stepTimeout = plan.steps.length > 0 ? plan.timeoutMs / plan.steps.length : plan.timeoutMs;
  plan.steps.forEach(step => step.timeoutMs = stepTimeout);

  // Rebuild steps array to filter out invalid ones
  const validatedSteps: PlanStep[] = [];
  const stepIds = new Set(plan.steps.map(s => s.id));

  for (const currentStep of plan.steps) {
    let isValidStep = true;

    // 2a. Filter out dependencies that point to non-existent steps
    currentStep.dependencies = currentStep.dependencies.filter(depId => {
      if (!stepIds.has(depId)) {
        console.warn(`[DAG Validation] Step ${currentStep.id} depends on non-existent step ${depId}. Removing dependency.`);
        return false;
      }
      return true;
    });

    // 2b. Variable reference check
    // Verify that {{step-X.output...}} references only reference steps that exist and are listed as dependencies.
    const references = currentStep.promptTemplate.match(/{{step-(\w+)\.output\..+}}/g);
    if (references) {
      for (const ref of references) {
        const referredStepId = ref.match(/step-(\w+)/)?.[1];
        if (referredStepId && !stepIds.has(`step-${referredStepId}`)) {
          console.warn(`[DAG Validation] Step ${currentStep.id} references non-existent step-ref 'step-${referredStepId}'. Invalidating step.`);
          isValidStep = false;
          break;
        }
        // Also ensure referenced step is a dependency
        if (referredStepId && !currentStep.dependencies.includes(`step-${referredStepId}`)) {
          console.warn(`[DAG Validation] Step ${currentStep.id} references 'step-${referredStepId}' but it's not listed as a dependency. Adding dependency.`);
          currentStep.dependencies.push(`step-${referredStepId}`);
        }
      }
    }

    if (isValidStep) {
      validatedSteps.push(currentStep);
    } else {
      console.warn(`[DAG Validation] Removing invalid step ${currentStep.id} due to bad references.`);
    }
  }

  plan.steps = validatedSteps;

  // 2c. Cycle detection (using Kahn's algorithm for topological sort)
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>(); // Dependency graph: depId -> [steps that depend on depId]

  plan.steps.forEach(step => {
    adjList.set(step.id, []);
    inDegree.set(step.id, 0);
  });

  plan.steps.forEach(step => {
    step.dependencies.forEach(depId => {
      // Only add to graph if depId exists in current plan.steps (already filtered above)
      if (inDegree.has(depId)) { 
        adjList.get(depId)!.push(step.id);
        inDegree.set(step.id, (inDegree.get(step.id) || 0) + 1);
      }
    });
  });

  const queue: string[] = [];
  inDegree.forEach((degree, stepId) => {
    if (degree === 0) {
      queue.push(stepId);
    }
  });

  const sortedStepIds: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sortedStepIds.push(nodeId);

    const neighbors = adjList.get(nodeId) || [];
    for (const neighborId of neighbors) {
      inDegree.set(neighborId, (inDegree.get(neighborId) || 0) - 1);
      if (inDegree.get(neighborId) === 0) {
        queue.push(neighborId);
      }
    }
  }

  if (sortedStepIds.length !== plan.steps.length) {
    // Cycle detected. `sortedStepIds` will contain all steps reachable from a node with 0 in-degree.
    // Steps that are part of a cycle will have an in-degree > 0 and won't be added to the queue.
    console.error(`[DAG Validation] Cycle detected in plan! Original plan had ${plan.steps.length} steps, topological sort found ${sortedStepIds.length}.`);
    
    // Remove cycle-causing dependencies. A simple approach is to remove all dependencies of steps that were not sorted.
    // This is a drastic measure to break cycles.
    const cyclicStepIds = new Set(plan.steps.map(s => s.id));
    sortedStepIds.forEach(id => cyclicStepIds.delete(id));

    plan.steps = plan.steps.map(step => {
      if (cyclicStepIds.has(step.id)) {
        console.warn(`[DAG Validation] Removing all dependencies for cyclic step ${step.id} to break cycle.`);
        step.dependencies = []; // Break all dependencies for cyclic steps
      }
      return step;
    });

    // Re-run the topological sort after modifying dependencies
    // This will ensure the plan is now acyclic, potentially with fewer dependencies
    const reInDegree = new Map<string, number>();
    const reAdjList = new Map<string, string[]>();
    plan.steps.forEach(step => {
      reAdjList.set(step.id, []);
      reInDegree.set(step.id, 0);
    });
    plan.steps.forEach(step => {
      step.dependencies.forEach(depId => {
        if (reInDegree.has(depId)) { 
          reAdjList.get(depId)!.push(step.id);
          reInDegree.set(step.id, (reInDegree.get(step.id) || 0) + 1);
        }
      });
    });

    const reQueue: string[] = [];
    reInDegree.forEach((degree, stepId) => {
      if (degree === 0) {
        reQueue.push(stepId);
      }
    });
    
    const finalSortedSteps: PlanStep[] = [];
    while (reQueue.length > 0) {
      const nodeId = reQueue.shift()!;
      finalSortedSteps.push(plan.steps.find(s => s.id === nodeId)!);
      const neighbors = reAdjList.get(nodeId) || [];
      for (const neighborId of neighbors) {
        reInDegree.set(neighborId, (reInDegree.get(neighborId) || 0) - 1);
        if (reInDegree.get(neighborId) === 0) {
          reQueue.push(neighborId);
        }
      }
    }
    plan.steps = finalSortedSteps; // Use the acyclic set of steps

    // If still empty or no progress, return a single scribe step as a safe fallback
    if (plan.steps.length === 0 && validatedSteps.length > 0) {
      console.error(`[DAG Validation] Cycle could not be resolved, reverting to single scribe step.`);
      return {
        planId: `fallback-cycle-${Date.now()}`,
        query: plan.query,
        steps: [{
          id: 'step-1',
          specialist: 'scribe',
          promptTemplate: plan.query,
          dependencies: [],
          estimatedCost: 0.0001,
          timeoutMs: plan.timeoutMs
        }],
        totalEstimatedCost: 0.0001,
        reasoning: `Cycle detected and resolved to single scribe step. Original: ${plan.reasoning}`,
        timeoutMs: plan.timeoutMs
      };
    }

  }

  // Recalculate total estimated cost after any modifications
  plan.totalEstimatedCost = plan.steps.reduce((sum, step) => sum + (step.estimatedCost || 0), 0);
  
  return plan;
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

    let dagPlan: DAGPlan = {
      planId: parsed.planId || `plan-${Date.now()}`,
      query: prompt,
      steps: parsed.steps || [],
      totalEstimatedCost: parsed.totalEstimatedCost || 0,
      reasoning: parsed.reasoning || 'Dynamic plan generated by Hivemind Orchestrator.'
    };

    // Validate the plan after LLM generation
    dagPlan = validateDAGPlan(dagPlan);

    return dagPlan;
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
