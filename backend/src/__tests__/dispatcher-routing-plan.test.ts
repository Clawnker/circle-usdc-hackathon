jest.mock('../llm-planner', () => ({
  planDAG: jest.fn(async (prompt: string) => ({
    planId: 'mock-single-step-plan',
    query: prompt,
    steps: [{
      id: 'step-1',
      specialist: 'scribe',
      promptTemplate: prompt,
      dependencies: [],
      estimatedCost: 0.0001,
    }],
    totalEstimatedCost: 0.0001,
    reasoning: 'Mocked single-step DAG fallback for routing plan tests.',
  })),
}));

jest.mock('../fallback-chain', () => ({
  fallbackChain: {
    buildFallbackChain: jest.fn(async () => []),
    executeWithFallback: jest.fn(),
  },
}));

import { dispatch } from '../dispatcher';

describe('dispatch routing plans', () => {
  it('returns a single-hop routing plan for simple preview requests', async () => {
    const result = await dispatch({
      prompt: 'Check my wallet balance on Base mainnet',
      previewOnly: true,
      networkMode: 'mainnet',
    });

    expect(result.status).toBe('pending');
    expect(result.specialist).toBe('bankr');
    expect(result.routingPlan).toMatchObject({
      kind: 'single-hop',
      source: 'route-selector',
      networkMode: 'mainnet',
      selectedSpecialist: 'bankr',
      entrySpecialist: 'bankr',
    });
    expect(result.routingPlan?.steps).toHaveLength(1);
    expect(result.routingPlan?.steps[0]).toMatchObject({
      id: 'step-1',
      specialist: 'bankr',
    });
  });

  it('returns a legacy multi-hop routing plan for multi-step preview requests', async () => {
    const result = await dispatch({
      prompt: 'Find the latest news about Circle USDC on Base and summarize it for me',
      previewOnly: true,
      networkMode: 'testnet',
    });

    expect(result.status).toBe('pending');
    expect(result.specialist).toBe('seeker');
    expect(result.routingPlan).toMatchObject({
      kind: 'multi-hop',
      source: 'legacy-multi-hop',
      networkMode: 'testnet',
      selectedSpecialist: 'multi-hop',
      entrySpecialist: 'seeker',
    });
    expect(result.routingPlan?.steps.map((step) => step.specialist)).toEqual(['seeker', 'scribe']);
  });
});
