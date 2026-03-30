const mockGetExternalAgents = jest.fn();
const mockGetExternalAgent = jest.fn();
const mockIsExternalAgent = jest.fn();
const mockExtractIntent = jest.fn();
const mockMatchAgents = jest.fn();
const mockClassifyIntent = jest.fn();
const mockGetReputationStats = jest.fn();

jest.mock('../external-agents', () => ({
  getExternalAgents: mockGetExternalAgents,
  getExternalAgent: mockGetExternalAgent,
  isExternalAgent: mockIsExternalAgent,
}));

jest.mock('../reputation', () => ({
  getReputationScore: jest.fn(() => 0.5),
  getReputationStats: mockGetReputationStats,
}));

jest.mock('../capability-matcher', () => ({
  capabilityMatcher: {
    specialistManifests: new Map([
      ['bankr', [{
        id: 'bankr:balance',
        name: 'Wallet Balance',
        description: 'Check wallet balances, transfers, swaps, and token approvals.',
        category: 'defi',
        subcategories: ['wallet', 'balance', 'transfer'],
        confidenceScore: 0.95,
      }]],
      ['magos', [{
        id: 'magos:analysis',
        name: 'Market Analysis',
        description: 'Analyze token prices, trends, valuations, and market structure.',
        category: 'defi',
        subcategories: ['market', 'price', 'analysis'],
        confidenceScore: 0.9,
      }]],
      ['aura', [{
        id: 'aura:sentiment',
        name: 'Social Sentiment',
        description: 'Track trending topics, hype, sentiment, and social buzz.',
        category: 'social',
        subcategories: ['sentiment', 'trending', 'social'],
        confidenceScore: 0.85,
      }]],
      ['scribe', [{
        id: 'scribe:summarize',
        name: 'Summarization',
        description: 'Summarize, rewrite, and explain text clearly.',
        category: 'generic',
        subcategories: ['summary', 'rewrite', 'explain'],
        confidenceScore: 0.95,
      }]],
      ['seeker', [{
        id: 'seeker:search',
        name: 'Web Research',
        description: 'Research the web, search news, and find current information.',
        category: 'research',
        subcategories: ['search', 'research', 'news'],
        confidenceScore: 0.85,
      }]],
    ]),
    extractIntent: mockExtractIntent,
    matchAgents: mockMatchAgents,
  },
}));

jest.mock('../intent-classifier', () => ({
  classifyIntent: mockClassifyIntent,
}));

import { routePrompt } from '../routing';

describe('routePrompt local routing selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    mockGetReputationStats.mockReturnValue({ capabilities: {} });
    mockGetExternalAgents.mockReturnValue([]);
    mockGetExternalAgent.mockReturnValue(undefined);
    mockIsExternalAgent.mockReturnValue(false);
  });

  it('routes wallet prompts locally without invoking llm routing', async () => {
    const specialist = await routePrompt(
      'Show my wallet balance and allowance for 0x1111111111111111111111111111111111111111 on Base mainnet',
      undefined,
      'mainnet'
    );

    expect(specialist).toBe('bankr');
    expect(mockExtractIntent).not.toHaveBeenCalled();
    expect(mockMatchAgents).not.toHaveBeenCalled();
    expect(mockClassifyIntent).not.toHaveBeenCalled();
  });

  it('selects the network-specific external security agent for audit prompts', async () => {
    const mainnetAgent = {
      id: 'sentinel-main',
      name: 'Sentinel Main',
      description: 'Mainnet smart contract security auditor for Base.',
      capabilities: ['security-audit'],
      structuredCapabilities: [{
        id: 'sentinel-main:security-audit',
        name: 'Smart Contract Security Audit',
        description: 'Audit contracts for vulnerabilities, reentrancy, exploit paths, and security risks.',
        category: 'security',
        subcategories: ['audit', 'contract', 'reentrancy'],
        confidenceScore: 0.98,
      }],
      pricing: { generic: 2.5 },
      active: true,
      healthy: true,
    };

    mockGetExternalAgents.mockImplementation((mode?: string) => mode === 'mainnet' ? [mainnetAgent] : []);
    mockGetExternalAgent.mockImplementation((id: string, mode?: string) =>
      id === 'sentinel-main' && mode === 'mainnet' ? mainnetAgent : undefined
    );
    mockIsExternalAgent.mockImplementation((id: string) => id === 'sentinel-main');

    const specialist = await routePrompt(
      'Audit this contract 0x1234567890123456789012345678901234567890 for reentrancy and security vulnerabilities',
      undefined,
      'mainnet'
    );

    expect(specialist).toBe('sentinel-main');
  });

  it('prefers a hired external research agent when its capabilities match the prompt', async () => {
    const researchAgent = {
      id: 'news-hawk',
      name: 'News Hawk',
      description: 'Research agent for current events, news, and web search.',
      capabilities: ['research', 'news'],
      structuredCapabilities: [{
        id: 'news-hawk:research',
        name: 'Current Events Research',
        description: 'Search the web, gather the latest news, and research projects on Base.',
        category: 'research',
        subcategories: ['search', 'news', 'web'],
        confidenceScore: 0.9,
      }],
      pricing: { generic: 0.2 },
      active: true,
      healthy: true,
    };

    mockGetExternalAgents.mockImplementation((mode?: string) => mode === 'mainnet' ? [researchAgent] : []);
    mockGetExternalAgent.mockImplementation((id: string, mode?: string) =>
      id === 'news-hawk' && mode === 'mainnet' ? researchAgent : undefined
    );
    mockIsExternalAgent.mockImplementation((id: string) => id === 'news-hawk');

    const specialist = await routePrompt(
      'Find the latest news and research on Circle USDC adoption on Base',
      ['news-hawk'] as any,
      'mainnet'
    );

    expect(specialist).toBe('news-hawk');
  });

  it('prefers an explicitly named healthy external agent when it is requested by name', async () => {
    const researchAgent = {
      id: 'news-hawk',
      name: 'News Hawk',
      description: 'Research agent for current events, Base ecosystem updates, and Circle USDC news.',
      capabilities: ['research', 'news'],
      structuredCapabilities: [{
        id: 'news-hawk:research',
        name: 'Current Events Research',
        description: 'Research current news, Base ecosystem updates, and Circle developments on the web.',
        category: 'research',
        subcategories: ['research', 'news', 'web', 'base', 'circle'],
        confidenceScore: 0.98,
      }],
      pricing: { generic: 0.01 },
      active: true,
      healthy: true,
      lastHealthCheck: new Date().toISOString(),
    };

    mockGetExternalAgents.mockImplementation((mode?: string) => mode === 'mainnet' ? [researchAgent] : []);
    mockGetExternalAgent.mockImplementation((id: string, mode?: string) =>
      id === 'news-hawk' && mode === 'mainnet' ? researchAgent : undefined
    );
    mockIsExternalAgent.mockImplementation((id: string) => id === 'news-hawk');

    const specialist = await routePrompt(
      'Use News Hawk for Circle USDC research on Base mainnet this morning',
      undefined,
      'mainnet'
    );

    expect(specialist).toBe('news-hawk');
  });

  it('downranks explicitly named external agents when their health check is stale', async () => {
    const researchAgent = {
      id: 'news-hawk',
      name: 'News Hawk',
      description: 'Research agent for current events, Base ecosystem updates, and Circle USDC news.',
      capabilities: ['research', 'news'],
      structuredCapabilities: [{
        id: 'news-hawk:research',
        name: 'Current Events Research',
        description: 'Research current news, Base ecosystem updates, and Circle developments on the web.',
        category: 'research',
        subcategories: ['research', 'news', 'web', 'base', 'circle'],
        confidenceScore: 0.98,
      }],
      pricing: { generic: 0.01 },
      active: true,
      healthy: true,
      lastHealthCheck: new Date(Date.now() - (10 * 60 * 1000)).toISOString(),
    };

    mockGetExternalAgents.mockImplementation((mode?: string) => mode === 'mainnet' ? [researchAgent] : []);
    mockGetExternalAgent.mockImplementation((id: string, mode?: string) =>
      id === 'news-hawk' && mode === 'mainnet' ? researchAgent : undefined
    );
    mockIsExternalAgent.mockImplementation((id: string) => id === 'news-hawk');

    const specialist = await routePrompt(
      'Use News Hawk for Circle USDC research on Base mainnet this afternoon',
      undefined,
      'mainnet'
    );

    expect(specialist).toBe('seeker');
  });

  it('downranks explicitly named external agents when their observed latency is severe', async () => {
    const researchAgent = {
      id: 'news-hawk',
      name: 'News Hawk',
      description: 'Research agent for current events, Base ecosystem updates, and Circle USDC news.',
      capabilities: ['research', 'news'],
      structuredCapabilities: [{
        id: 'news-hawk:research',
        name: 'Current Events Research',
        description: 'Research current news, Base ecosystem updates, and Circle developments on the web.',
        category: 'research',
        subcategories: ['research', 'news', 'web', 'base', 'circle'],
        confidenceScore: 0.98,
      }],
      pricing: { generic: 0.01 },
      active: true,
      healthy: true,
      lastHealthCheck: new Date().toISOString(),
    };

    mockGetExternalAgents.mockImplementation((mode?: string) => mode === 'mainnet' ? [researchAgent] : []);
    mockGetExternalAgent.mockImplementation((id: string, mode?: string) =>
      id === 'news-hawk' && mode === 'mainnet' ? researchAgent : undefined
    );
    mockIsExternalAgent.mockImplementation((id: string) => id === 'news-hawk');
    mockGetReputationStats.mockImplementation((agentId: string) => {
      if (agentId === 'news-hawk') {
        return {
          capabilities: {
            'news-hawk:research': {
              capabilityId: 'news-hawk:research',
              p50: 45000,
              totalTasks: 25,
            },
          },
        };
      }

      return { capabilities: {} };
    });

    const specialist = await routePrompt(
      'Use News Hawk for Circle USDC research on Base mainnet',
      undefined,
      'mainnet'
    );

    expect(specialist).toBe('seeker');
  });
});
