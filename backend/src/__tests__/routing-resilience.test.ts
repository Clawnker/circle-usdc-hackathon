import { PriceRouter } from '../price-router';
import { CircuitBreakerService } from '../circuit-breaker';
import { FallbackChainService } from '../fallback-chain';
import { DAGPlan, RankedAgent, SpecialistResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Mock external-agents and config to avoid side effects
jest.mock('../external-agents', () => ({
  getExternalAgents: jest.fn(() => [])
}));

jest.mock('../config', () => ({
  config: {
    fees: {
      magos: 0.5,
      aura: 0.3,
      bankr: 0.1,
      general: 0.1
    }
  }
}));

// Mock capability-matcher
jest.mock('../capability-matcher', () => ({
  capabilityMatcher: {
    extractIntent: jest.fn(),
    matchAgents: jest.fn()
  }
}));

describe('Routing Resilience Integration Tests (Phase 2d-2e)', () => {
  let priceRouter: PriceRouter;
  let circuitBreaker: any; // Using any to access private/internal state for testing
  let fallbackChain: FallbackChainService;
  
  const DATA_DIR = path.join(__dirname, '../../data');
  const CIRCUIT_FILE = path.join(DATA_DIR, 'circuit-breakers.json');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Clean up circuit breaker file if it exists
    if (fs.existsSync(CIRCUIT_FILE)) {
      fs.unlinkSync(CIRCUIT_FILE);
    }

    priceRouter = new PriceRouter();
    // Re-initialize to clear cache and start fresh
    circuitBreaker = new (CircuitBreakerService as any)({
      failureThreshold: 5,
      cooldownMs: 60000,
      halfOpenMaxAttempts: 1
    });
    fallbackChain = new FallbackChainService();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (fs.existsSync(CIRCUIT_FILE)) {
      fs.unlinkSync(CIRCUIT_FILE);
    }
  });

  describe('Price Router (Phase 2d)', () => {
    test('1. Price efficiency calculation', () => {
      const marketAvg = 1.0;
      
      // Cheaper agent (0.5 USDC vs 1.0 avg) -> ratio 2.0 -> score 1.0
      const scoreCheap = priceRouter.calculatePriceEfficiency(0.5, marketAvg);
      
      // Market average agent (1.0 USDC vs 1.0 avg) -> ratio 1.0 -> score 0.5
      const scoreAvg = priceRouter.calculatePriceEfficiency(1.0, marketAvg);
      
      // Expensive agent (2.0 USDC vs 1.0 avg) -> ratio 0.5 -> score (0.5 - 0.2) * (0.5/0.8) = 0.1875
      const scoreExpensive = priceRouter.calculatePriceEfficiency(2.0, marketAvg);
      
      expect(scoreCheap).toBe(1.0);
      expect(scoreAvg).toBe(0.5);
      expect(scoreExpensive).toBeLessThan(0.5);
      expect(scoreCheap).toBeGreaterThan(scoreAvg);
      expect(scoreAvg).toBeGreaterThan(scoreExpensive);
    });

    test('2. Market average calculation', () => {
      const { getExternalAgents } = require('../external-agents');
      (getExternalAgents as jest.Mock).mockReturnValue([
        {
          id: 'agent1',
          capabilities: ['test:cap'],
          structuredCapabilities: [],
          pricing: { 'test:cap': 0.2 }
        },
        {
          id: 'agent2',
          capabilities: ['test:cap'],
          structuredCapabilities: [],
          pricing: { 'test:cap': 0.4 }
        }
      ]);

      const avg = priceRouter.getMarketAverage('test:cap');
      // (0.2 + 0.4) / 2 = 0.3
      expect(avg).toBeCloseTo(0.3);
    });

    test('3. Budget enforcement - reject exceeding', () => {
      const plan: DAGPlan = {
        planId: 'p1',
        query: 'test',
        steps: [
          { id: 's1', specialist: 'magos', promptTemplate: '', dependencies: [], estimatedCost: 10.0 },
          { id: 's2', specialist: 'aura', promptTemplate: '', dependencies: [], estimatedCost: 5.0 }
        ],
        totalEstimatedCost: 15.0,
        reasoning: ''
      };
      
      const result = priceRouter.checkBudget(plan, 12.0);
      expect(result.withinBudget).toBe(false);
      expect(result.totalCost).toBe(15.0);
    });

    test('4. Budget enforcement - pass within budget', () => {
      const plan: DAGPlan = {
        planId: 'p1',
        query: 'test',
        steps: [
          { id: 's1', specialist: 'magos', promptTemplate: '', dependencies: [], estimatedCost: 2.0 }
        ],
        totalEstimatedCost: 2.0,
        reasoning: ''
      };
      
      const result = priceRouter.checkBudget(plan, 5.0);
      expect(result.withinBudget).toBe(true);
    });
  });

  describe('Circuit Breaker (Phase 2e)', () => {
    test('5. CLOSED -> OPEN transition after 5 failures', () => {
      const agentId = 'flaky-agent';
      
      for (let i = 0; i < 4; i++) {
        circuitBreaker.recordFailure(agentId);
        expect(circuitBreaker.getState(agentId)).toBe('CLOSED');
      }
      
      circuitBreaker.recordFailure(agentId);
      expect(circuitBreaker.getState(agentId)).toBe('OPEN');
      expect(circuitBreaker.canCall(agentId)).toBe(false);
    });

    test('6. OPEN -> HALF_OPEN transition after cooldown', () => {
      const agentId = 'cooldown-agent';
      
      // Trip it
      for (let i = 0; i < 5; i++) circuitBreaker.recordFailure(agentId);
      expect(circuitBreaker.getState(agentId)).toBe('OPEN');
      
      // Fast forward 61 seconds
      jest.advanceTimersByTime(61000);
      
      // canCall should return true and transition state
      expect(circuitBreaker.canCall(agentId)).toBe(true);
      expect(circuitBreaker.getState(agentId)).toBe('HALF_OPEN');
    });

    test('7. HALF_OPEN -> CLOSED transition on success', () => {
      const agentId = 'recovery-agent';
      
      // Get to HALF_OPEN
      for (let i = 0; i < 5; i++) circuitBreaker.recordFailure(agentId);
      jest.advanceTimersByTime(61000);
      circuitBreaker.canCall(agentId); 
      expect(circuitBreaker.getState(agentId)).toBe('HALF_OPEN');
      
      // Record success
      circuitBreaker.recordSuccess(agentId);
      expect(circuitBreaker.getState(agentId)).toBe('CLOSED');
      expect(circuitBreaker.canCall(agentId)).toBe(true);
    });
  });

  describe('Fallback Chain (Phase 2e)', () => {
    test('8. Fallback chain - primary fails, second succeeds', async () => {
      const chain: RankedAgent[] = [
        { agentId: 'primary', score: 0.9, confidence: 0.9, reasoning: '' },
        { agentId: 'secondary', score: 0.8, confidence: 0.8, reasoning: '' }
      ];
      
      const executor = jest.fn()
        .mockResolvedValueOnce({ success: false, data: { error: 'Primary failed' } })
        .mockResolvedValueOnce({ success: true, data: { result: 'Success!' } });
      
      const result = await fallbackChain.executeWithFallback(chain, 'test prompt', executor);
      
      expect(result.success).toBe(true);
      expect(result.data.result).toBe('Success!');
      expect(executor).toHaveBeenCalledTimes(2);
    });

    test('9. Fallback exhaustion - all fail', async () => {
      const chain: RankedAgent[] = [
        { agentId: 'agent1', score: 0.9, confidence: 0.9, reasoning: '' }
      ];
      
      const executor = jest.fn().mockResolvedValue({ success: false, data: { error: 'Fatal' } });
      
      const result = await fallbackChain.executeWithFallback(chain, 'test prompt', executor, { maxRetries: 0 });
      
      expect(result.success).toBe(false);
      expect(result.data.error).toContain('Fallback chain exhausted');
    });

    test('10. Fallback with circuit breaker - skip OPEN agents', async () => {
      const { capabilityMatcher } = require('../capability-matcher');
      (capabilityMatcher.extractIntent as jest.Mock).mockResolvedValue({});
      (capabilityMatcher.matchAgents as jest.Mock).mockResolvedValue([
        { agentId: 'open-agent', score: 0.9 },
        { agentId: 'closed-agent', score: 0.8 }
      ]);
      
      // Inject circuitBreaker into fallbackChain context if needed, 
      // but here it uses the singleton. We need to trip the singleton for 'open-agent'.
      const { circuitBreaker: singletonCB } = require('../circuit-breaker');
      for (let i = 0; i < 5; i++) singletonCB.recordFailure('open-agent');
      
      const chain = await fallbackChain.buildFallbackChain('test');
      
      expect(chain.find(a => a.agentId === 'open-agent')).toBeUndefined();
      expect(chain.find(a => a.agentId === 'closed-agent')).toBeDefined();
    });

    test('11. Timeout enforcement', async () => {
      const chain: RankedAgent[] = [
        { agentId: 'slow-agent', score: 0.9, confidence: 0.9, reasoning: '' },
        { agentId: 'fast-agent', score: 0.8, confidence: 0.8, reasoning: '' }
      ];
      
      const executor = jest.fn()
        .mockImplementation(async (id) => {
          if (id === 'slow-agent') {
            await new Promise(resolve => setTimeout(resolve, 5000));
            return { success: true };
          }
          return { success: true, data: { from: 'fast-agent' } };
        });
      
      // Use a short timeout
      const resultPromise = fallbackChain.executeWithFallback(chain, 'test', executor, { timeoutMs: 1000 });
      
      // Fast forward past the timeout
      jest.advanceTimersByTime(1100);
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.data.from).toBe('fast-agent');
    });
  });
});
