/**
 * DAG Execution Engine for Hivemind Protocol
 */

import { DAGPlan, DAGResult, PlanStep, PlanResult, StepExecutor } from './types';

/**
 * Executes a Directed Acyclic Graph (DAG) of agent tasks
 */
export async function executeDAG(
  plan: DAGPlan, 
  executeStep: StepExecutor,
  options: { timeoutMs?: number } = {}
): Promise<DAGResult> {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || 30000;
  
  const results: Record<string, PlanResult> = {};
  const completedStepIds = new Set<string>();
  const failedStepIds = new Set<string>();
  const skippedStepIds = new Set<string>();
  
  const allStepIds = plan.steps.map(s => s.id);
  
  // Execution loop: continue until all steps are processed (completed, failed, or skipped)
  while (completedStepIds.size + failedStepIds.size + skippedStepIds.size < allStepIds.length) {
    // 1. Identify "ready" steps: all dependencies are in completedStepIds
    const readySteps = plan.steps.filter(step => {
      if (completedStepIds.has(step.id) || failedStepIds.has(step.id) || skippedStepIds.has(step.id)) {
        return false;
      }
      
      // All dependencies must be completed successfully
      return step.dependencies.every(depId => completedStepIds.has(depId));
    });
    
    // 2. Identify "blocked" steps that should be skipped: a dependency failed or was skipped
    const stepsToSkip = plan.steps.filter(step => {
      if (completedStepIds.has(step.id) || failedStepIds.has(step.id) || skippedStepIds.has(step.id)) {
        return false;
      }
      
      // If any dependency failed or was skipped, this step cannot proceed
      return step.dependencies.some(depId => failedStepIds.has(depId) || skippedStepIds.has(depId));
    });
    
    // Mark blocked steps as skipped
    for (const step of stepsToSkip) {
      skippedStepIds.add(step.id);
      results[step.id] = {
        stepId: step.id,
        specialist: step.specialist,
        output: null,
        summary: `Skipped due to dependency failure in: ${step.dependencies.join(', ')}`,
        success: false
      };
    }
    
    // 3. If no steps are ready and we're not finished, we have a problem (cycle or deadlock)
    if (readySteps.length === 0 && stepsToSkip.length === 0) {
      if (completedStepIds.size + failedStepIds.size + skippedStepIds.size < allStepIds.length) {
        throw new Error('Cycle detected in DAG plan or invalid dependency IDs');
      }
      break;
    }
    
    // 4. Execute all ready steps in parallel
    await Promise.all(readySteps.map(async (step) => {
      try {
        // Context for variable substitution (map of stepId -> output)
        const context = Object.fromEntries(
          Object.entries(results)
            .filter(([_, res]) => res.success)
            .map(([id, res]) => [id, res.output])
        );
        
        // Execute the step with a timeout
        const stepResult = await withTimeout(
          executeStep(step, context),
          timeoutMs,
          `Step ${step.id} (${step.specialist}) timed out after ${timeoutMs}ms`
        );
        
        results[step.id] = stepResult;
        
        if (stepResult.success) {
          completedStepIds.add(step.id);
        } else {
          failedStepIds.add(step.id);
        }
      } catch (error: any) {
        console.error(`[DAG Executor] Error executing step ${step.id}:`, error.message);
        failedStepIds.add(step.id);
        results[step.id] = {
          stepId: step.id,
          specialist: step.specialist,
          output: { error: error.message },
          summary: `Execution Error: ${error.message}`,
          success: false
        };
      }
    }));
  }
  
  const executionTimeMs = Date.now() - startTime;
  const success = failedStepIds.size === 0 && skippedStepIds.size === 0;
  
  return {
    planId: plan.planId,
    success,
    results,
    totalCost: plan.totalEstimatedCost,
    executionTimeMs
  };
}

/**
 * Utility: Execute promise with timeout
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Utility: Resolve variables in prompt templates
 * Supports {{step-id.output.path.to.value}} and {{step-id.summary}}
 * Falls back to step summary when specific path not found
 */
export function resolveVariables(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
    const parts = expression.trim().split('.');
    const stepId = parts[0];
    
    if (!context[stepId]) {
      // Step result not available — remove the template tag and note it
      return `[data from ${stepId} unavailable]`;
    }
    
    let current = context[stepId];
    
    // If path is step-1.output.foo, the context already holds the output for step-1
    // So we skip 'output' if it's the second part
    const startIndex = parts[1] === 'output' ? 2 : 1;
    
    for (let i = startIndex; i < parts.length; i++) {
      const part = parts[i];
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        // Path not found — fall back to stringifying the entire step output
        // This ensures downstream specialists get actual data, not raw template tags
        const stepData = context[stepId];
        if (typeof stepData === 'object') {
          // Try to extract meaningful content: insight, summary, analysis, or full JSON
          const fallback = stepData.insight || stepData.summary || stepData.analysis || 
                          stepData.description || stepData.content || JSON.stringify(stepData);
          console.log(`[DAG] Template fallback for {{${expression}}}: using step ${stepId} full output`);
          return typeof fallback === 'string' ? fallback : JSON.stringify(fallback);
        }
        return String(stepData);
      }
    }
    
    if (typeof current === 'object') {
      return JSON.stringify(current);
    }
    
    return String(current);
  });
}
