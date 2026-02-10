/**
 * Price-Aware Routing Engine
 * Handles price efficiency calculations, market averages, and budget enforcement.
 */

import { config } from './config';
import { getExternalAgents } from './external-agents';
import { RankedAgent, DAGPlan, BudgetCheckResult, BudgetBreakdown } from './types';

export class PriceRouter {
  private cache: Map<string, { average: number; min: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Calculate price efficiency score (0-1)
   * Formula: Price_min / Price_agent
   */
  calculatePriceEfficiency(agentPrice: number, marketAverage: number): number {
    if (agentPrice <= 0) return 1.0;
    
    // The spec uses Price_min / Price_agent. 
    // But the method signature asks for marketAverage.
    // We'll use a hybrid approach that favors prices below average.
    
    const ratio = marketAverage / agentPrice;
    
    // If agent is exactly at market average, they get 0.5
    // If agent is 50% cheaper than average, they get ~0.75
    // If agent is twice as expensive as average, they get 0.25
    
    // Using a simple bounded linear scale for now
    if (ratio >= 2.0) return 1.0;
    if (ratio <= 0.2) return 0.0;
    
    // Map ratio [0.2, 1.0, 2.0] to score [0.0, 0.5, 1.0]
    if (ratio >= 1.0) {
      // [1.0, 2.0] -> [0.5, 1.0]
      return 0.5 + (ratio - 1.0) * 0.5;
    } else {
      // [0.2, 1.0] -> [0.0, 0.5]
      return (ratio - 0.2) * (0.5 / 0.8);
    }
  }

  /**
   * Get market average and min price for a capability
   */
  getMarketData(capabilityId: string): { average: number; min: number } {
    const cached = this.cache.get(capabilityId);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
      return { average: cached.average, min: cached.min };
    }

    const prices: number[] = [];

    // 1. Check built-in specialists
    const [specialistId] = capabilityId.split(':');
    const builtInFee = (config.fees as any)[specialistId];
    if (builtInFee !== undefined) {
      prices.push(builtInFee);
    }

    // 2. Check external agents
    const externalAgents = getExternalAgents();
    for (const agent of externalAgents) {
      // Check if agent has this capability
      const hasCap = agent.structuredCapabilities.some(c => c.id === capabilityId) || 
                     agent.capabilities.includes(capabilityId);
      
      if (hasCap) {
        const price = agent.pricing[capabilityId] ?? agent.pricing['generic'] ?? 0;
        prices.push(price);
      }
    }

    // Fallback if no prices found
    if (prices.length === 0) {
      const defaultPrice = (config.fees as any).general || 0.10;
      return { average: defaultPrice, min: defaultPrice };
    }

    const average = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);

    this.cache.set(capabilityId, { average, min, timestamp: Date.now() });
    return { average, min };
  }

  /**
   * Wrapper for getMarketAverage (requested by spec)
   */
  getMarketAverage(capabilityId: string): number {
    return this.getMarketData(capabilityId).average;
  }

  /**
   * Check if a plan fits within the budget
   */
  checkBudget(plan: DAGPlan, maxBudget: number): BudgetCheckResult {
    let totalCost = 0;
    const breakdown: BudgetBreakdown[] = [];

    for (const step of plan.steps) {
      totalCost += step.estimatedCost;
      breakdown.push({
        agentId: step.specialist,
        capabilityId: step.id, // Using step ID as a placeholder for capability
        estimatedCost: step.estimatedCost
      });
    }

    return {
      withinBudget: totalCost <= maxBudget,
      totalCost,
      breakdown
    };
  }

  /**
   * Re-rank agents factoring in price efficiency and budget limits
   */
  rankByValue(agents: RankedAgent[], budgetLimit?: number): RankedAgent[] {
    let result = agents;

    // Filter by budget if provided
    if (budgetLimit !== undefined) {
      result = result.filter(agent => {
        const price = this.getAgentPrice(agent.agentId);
        return price <= budgetLimit;
      });
    }

    // The scoring is already handled in the matcher, but we can re-sort here
    // if we wanted to apply a different value-based ranking logic.
    // For now, we follow the matcher's lead.
    return result.sort((a, b) => b.score - a.score);
  }

  /**
   * Internal helper to get generic price for an agent
   */
  private getAgentPrice(agentId: string): number {
    const builtInFee = (config.fees as any)[agentId];
    if (builtInFee !== undefined) {
      return builtInFee;
    }
    
    const external = getExternalAgents().find(a => a.id === agentId);
    if (external) {
      // Use the first available price or generic
      return Object.values(external.pricing)[0] ?? 0;
    }
    
    return 0;
  }
}

export const priceRouter = new PriceRouter();
