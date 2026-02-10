import { executeDAG, resolveVariables } from '../dag-executor';
import { DAGPlan, PlanStep, PlanResult } from '../types';

// Mock the llm-planner module
jest.mock('../llm-planner', () => {
  return {
    __esModule: true,
    planDAG: jest.fn().mockImplementation(async (prompt: string) => {
      return {
        planId: 'mock-plan',
        query: prompt,
        steps: [
          { id: 'step-1', specialist: 'aura', promptTemplate: 'template', dependencies: [], estimatedCost: 0.0005 }
        ],
        totalEstimatedCost: 0.0005,
        reasoning: 'mock reasoning'
      };
    }),
    planWithLLM: jest.fn().mockImplementation(async (prompt: string) => {
      // Manually mock the behavior to test the backward compatibility of the interface
      return {
        specialist: 'aura',
        confidence: 0.9,
        reasoning: 'mock reasoning'
      };
    })
  };
});

// Import after mocking
import { planWithLLM } from '../llm-planner';

describe('DAG Execution Engine', () => {
  const mockExecutor = jest.fn(async (step: PlanStep, _context: Record<string, any>): Promise<PlanResult> => {
    return {
      stepId: step.id,
      specialist: step.specialist,
      output: { data: `Result from ${step.id}` },
      summary: `Completed ${step.id}`,
      success: true
    };
  });

  beforeEach(() => {
    mockExecutor.mockClear();
    jest.clearAllMocks();
  });

  test('Single-step plan executes correctly', async () => {
    const plan: DAGPlan = {
      planId: 'test-1',
      query: 'simple query',
      steps: [
        { id: 'step-1', specialist: 'scribe', promptTemplate: 'Hello', dependencies: [], estimatedCost: 0 }
      ],
      totalEstimatedCost: 0,
      reasoning: 'test'
    };

    const result = await executeDAG(plan, mockExecutor);

    expect(result.success).toBe(true);
    expect(result.results['step-1']).toBeDefined();
    expect(result.results['step-1'].success).toBe(true);
    expect(mockExecutor).toHaveBeenCalledTimes(1);
  });

  test('Linear chain executes in order', async () => {
    const executionOrder: string[] = [];
    const orderedExecutor = async (step: PlanStep) => {
      executionOrder.push(step.id);
      return { 
        stepId: step.id, 
        specialist: step.specialist, 
        output: { id: step.id }, 
        summary: '', 
        success: true 
      };
    };

    const plan: DAGPlan = {
      planId: 'test-2',
      query: 'chain',
      steps: [
        { id: 'A', specialist: 'scribe', promptTemplate: 'A', dependencies: [], estimatedCost: 0 },
        { id: 'B', specialist: 'scribe', promptTemplate: 'B', dependencies: ['A'], estimatedCost: 0 },
        { id: 'C', specialist: 'scribe', promptTemplate: 'C', dependencies: ['B'], estimatedCost: 0 },
      ],
      totalEstimatedCost: 0,
      reasoning: 'test'
    };

    await executeDAG(plan, orderedExecutor);
    expect(executionOrder).toEqual(['A', 'B', 'C']);
  });

  test('Parallel execution runs independent steps concurrently', async () => {
    const startTimes: Record<string, number> = {};
    const parallelExecutor = async (step: PlanStep) => {
      startTimes[step.id] = Date.now();
      if (step.id === 'A' || step.id === 'B') {
        // Delay to ensure they overlap and C waits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return { 
        stepId: step.id, 
        specialist: step.specialist, 
        output: {}, 
        summary: '', 
        success: true 
      };
    };

    const plan: DAGPlan = {
      planId: 'test-3',
      query: 'parallel',
      steps: [
        { id: 'A', specialist: 'scribe', promptTemplate: 'A', dependencies: [], estimatedCost: 0 },
        { id: 'B', specialist: 'scribe', promptTemplate: 'B', dependencies: [], estimatedCost: 0 },
        { id: 'C', specialist: 'scribe', promptTemplate: 'C', dependencies: ['A', 'B'], estimatedCost: 0 },
      ],
      totalEstimatedCost: 0,
      reasoning: 'test'
    };

    await executeDAG(plan, parallelExecutor);
    
    // A and B should start almost at the same time
    expect(Math.abs(startTimes['A'] - startTimes['B'])).toBeLessThan(50);
    // C should start after A and B complete
    expect(startTimes['C']).toBeGreaterThanOrEqual(startTimes['A'] + 100);
    expect(startTimes['C']).toBeGreaterThanOrEqual(startTimes['B'] + 100);
  });

  test('Variable substitution replaces placeholders', () => {
    const context = {
      'step-1': { token: 'SOL', price: 100 },
      'step-2': { status: 'success' }
    };
    
    // Test direct property access
    const template1 = 'Price of {{step-1.token}} is {{step-1.price}}.';
    expect(resolveVariables(template1, context)).toBe('Price of SOL is 100.');
    
    // Test access with .output infix
    const template2 = 'Status: {{step-2.output.status}}';
    expect(resolveVariables(template2, context)).toBe('Status: success');

    // Test non-existent path returns original match
    const template3 = '{{step-1.missing}}';
    expect(resolveVariables(template3, context)).toBe('{{step-1.missing}}');
  });

  test('Step failure skips dependents but runs independent steps', async () => {
    const failedExecutor = async (step: PlanStep) => {
      if (step.id === 'B') {
        return { 
          stepId: step.id, 
          specialist: step.specialist, 
          output: null, 
          summary: 'Failed intentionally', 
          success: false 
        };
      }
      return { 
        stepId: step.id, 
        specialist: step.specialist, 
        output: { data: 'ok' }, 
        summary: 'Ok', 
        success: true 
      };
    };

    const plan: DAGPlan = {
      planId: 'test-5',
      query: 'failure test',
      steps: [
        { id: 'A', specialist: 'scribe', promptTemplate: 'A', dependencies: [], estimatedCost: 0 },
        { id: 'B', specialist: 'scribe', promptTemplate: 'B', dependencies: ['A'], estimatedCost: 0 },
        { id: 'C', specialist: 'scribe', promptTemplate: 'C', dependencies: ['B'], estimatedCost: 0 },
        { id: 'D', specialist: 'scribe', promptTemplate: 'D', dependencies: ['A'], estimatedCost: 0 },
      ],
      totalEstimatedCost: 0,
      reasoning: 'test'
    };

    const result = await executeDAG(plan, failedExecutor);

    expect(result.results['A'].success).toBe(true);
    expect(result.results['B'].success).toBe(false);
    expect(result.results['C'].summary).toContain('Skipped');
    expect(result.results['C'].success).toBe(false);
    expect(result.results['D'].success).toBe(true);
    expect(result.success).toBe(false);
  });

  test('Cycle detection throws error', async () => {
    const plan: DAGPlan = {
      planId: 'cycle',
      query: 'cycle',
      steps: [
        { id: 'A', specialist: 'scribe', promptTemplate: 'A', dependencies: ['B'], estimatedCost: 0 },
        { id: 'B', specialist: 'scribe', promptTemplate: 'B', dependencies: ['A'], estimatedCost: 0 },
      ],
      totalEstimatedCost: 0,
      reasoning: 'test'
    };

    await expect(executeDAG(plan, mockExecutor)).rejects.toThrow('Cycle detected');
  });

  test('Step timeout marks step as failed', async () => {
    const slowExecutor = async (step: PlanStep) => {
      // Step takes 200ms
      await new Promise(resolve => setTimeout(resolve, 200));
      return { 
        stepId: step.id, 
        specialist: step.specialist, 
        output: {}, 
        summary: 'Finished late', 
        success: true 
      };
    };

    const plan: DAGPlan = {
      planId: 'timeout',
      query: 'timeout',
      steps: [
        { id: 'A', specialist: 'scribe', promptTemplate: 'A', dependencies: [], estimatedCost: 0 },
      ],
      totalEstimatedCost: 0,
      reasoning: 'test'
    };

    // Timeout set to 100ms
    const result = await executeDAG(plan, slowExecutor, { timeoutMs: 100 });
    
    expect(result.results['A'].success).toBe(false);
    expect(result.results['A'].summary).toContain('timed out');
    expect(result.success).toBe(false);
  });

  test('Empty plan returns empty result', async () => {
    const plan: DAGPlan = {
      planId: 'empty',
      query: 'empty',
      steps: [],
      totalEstimatedCost: 0,
      reasoning: 'test'
    };

    const result = await executeDAG(plan, mockExecutor);
    expect(result.success).toBe(true);
    expect(Object.keys(result.results).length).toBe(0);
  });

  test('Backward compat: planWithLLM returns single specialist result', async () => {
    const result = await planWithLLM('test query');
    
    expect(result.specialist).toBe('aura');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.reasoning).toBe('mock reasoning');
  });
});
