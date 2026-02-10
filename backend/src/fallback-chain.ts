/**
 * Fallback Chain Service
 * Manages failover logic and ordered execution paths.
 */

import { RankedAgent, SpecialistResult, SpecialistType } from './types';
import { capabilityMatcher } from './capability-matcher';
import { circuitBreaker } from './circuit-breaker';

export interface FallbackOptions {
  maxRetries?: number;
  timeoutMs?: number;
}

export class FallbackChainService {
  /**
   * Build an ordered list of candidate agents for a specific capability/intent
   */
  async buildFallbackChain(prompt: string, excludeAgents: string[] = []): Promise<RankedAgent[]> {
    try {
      // 1. Extract intent from prompt (or use capability string directly as requiredCapabilities)
      const intent = await capabilityMatcher.extractIntent(prompt);
      
      // 2. Match agents
      let candidates = await capabilityMatcher.matchAgents(intent);
      
      // 3. Filter out excluded agents and those with OPEN circuit breakers
      candidates = candidates.filter(agent => 
        !excludeAgents.includes(agent.agentId) && 
        circuitBreaker.canCall(agent.agentId)
      );
      
      // 4. Return top candidates (already sorted by score in matchAgents)
      return candidates;
    } catch (error) {
      console.error('[FallbackChain] Failed to build fallback chain:', error);
      return [];
    }
  }

  /**
   * Execute a task with automatic fallback to next agent in chain
   */
  async executeWithFallback(
    chain: RankedAgent[],
    taskPrompt: string,
    executor: (agentId: string, prompt: string) => Promise<SpecialistResult>,
    options: FallbackOptions = {}
  ): Promise<SpecialistResult> {
    const maxRetries = options.maxRetries ?? 3;
    const timeoutMs = options.timeoutMs ?? 30000;
    
    let lastError: any = null;
    
    // Limit chain length to maxRetries + 1
    const limitedChain = chain.slice(0, maxRetries + 1);
    
    for (const candidate of limitedChain) {
      const agentId = candidate.agentId;
      
      console.log(`[FallbackChain] Attempting execution with agent: ${agentId}`);
      
      try {
        // Record that we are attempting a call (important for HALF_OPEN state)
        circuitBreaker.recordCall(agentId);
        
        // Wrap executor in a timeout
        const result = await this.withTimeout(
          executor(agentId, taskPrompt),
          timeoutMs
        );
        
        if (result.success) {
          console.log(`[FallbackChain] Success with agent: ${agentId}`);
          circuitBreaker.recordSuccess(agentId);
          return result;
        } else {
          console.warn(`[FallbackChain] Failure with agent: ${agentId}:`, result.data?.error);
          circuitBreaker.recordFailure(agentId);
          lastError = result.data?.error || 'Unknown error';
        }
      } catch (error: any) {
        console.error(`[FallbackChain] Error calling agent ${agentId}:`, error.message);
        circuitBreaker.recordFailure(agentId);
        lastError = error.message;
      }
      
      console.log(`[FallbackChain] Falling back from ${agentId}...`);
    }
    
    return {
      success: false,
      data: { error: `Fallback chain exhausted. Last error: ${lastError}` },
      timestamp: new Date(),
      executionTimeMs: 0
    };
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
      )
    ]);
  }
}

export const fallbackChain = new FallbackChainService();
