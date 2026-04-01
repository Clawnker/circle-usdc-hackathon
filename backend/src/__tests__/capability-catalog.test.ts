const mockGetExternalAgents = jest.fn();
const mockGetExternalAgent = jest.fn();
const mockGetReputationScore = jest.fn();
const mockGetReputationStats = jest.fn();

jest.mock('../external-agents', () => ({
  getExternalAgents: mockGetExternalAgents,
  getExternalAgent: mockGetExternalAgent,
}));

jest.mock('../reputation', () => ({
  getReputationScore: mockGetReputationScore,
  getReputationStats: mockGetReputationStats,
}));

jest.mock('../capability-matcher', () => ({
  capabilityMatcher: {
    specialistManifests: new Map([
      ['bankr', [{
        id: 'bankr:balance',
        name: 'Wallet Balance',
        description: 'Check wallet balances and token holdings on Base.',
        category: 'defi',
        subcategories: ['wallet', 'balance'],
        inputs: [{ type: 'address' }],
        outputs: { type: 'json' },
        confidenceScore: 0.98,
        latencyEstimateMs: 1000,
      }]],
      ['seeker', [{
        id: 'seeker:search',
        name: 'Web Search',
        description: 'Research current news and search the web for updates.',
        category: 'research',
        subcategories: ['search', 'news'],
        inputs: [{ type: 'string' }],
        outputs: { type: 'report' },
        confidenceScore: 0.88,
        latencyEstimateMs: 3500,
      }]],
    ]),
  },
}));

import {
  getBuiltInRoutingCatalogAgents,
  getRoutingCatalogAgent,
  getRoutingCatalogAgents,
} from '../routing/capability-catalog';

describe('routing capability catalog', () => {
  const recentHealthCheck = new Date().toISOString();
  const staleHealthCheck = new Date(Date.now() - (10 * 60 * 1000)).toISOString();

  const testnetSecurityAgent = {
    id: 'sentinel',
    name: 'Sentinel Testnet',
    description: 'Security auditing for Base Sepolia contracts.',
    endpoint: 'https://sentinel-testnet.example.com',
    wallet: '0x1111111111111111111111111111111111111111',
    capabilities: ['security-audit'],
    structuredCapabilities: [{
      id: 'sentinel:security-audit',
      name: 'Security Audit',
      description: 'Audit Base contracts for vulnerabilities and exploit paths.',
      category: 'security',
      subcategories: ['audit', 'contract'],
      inputs: [{ type: 'address' }],
      outputs: { type: 'report' },
      confidenceScore: 0.97,
      latencyEstimateMs: 5000,
    }],
    pricing: { 'sentinel:security-audit': 0.25, generic: 0.25 },
    chain: 'base-sepolia',
    active: true,
    healthy: true,
    lastHealthCheck: recentHealthCheck,
  };

  const mainnetSecurityAgent = {
    id: 'sentinel',
    name: 'Sentinel Mainnet',
    description: 'Security auditing for Base mainnet contracts.',
    endpoint: 'https://sentinel-mainnet.example.com',
    wallet: '0x2222222222222222222222222222222222222222',
    capabilities: ['security-audit'],
    structuredCapabilities: [{
      id: 'sentinel:security-audit',
      name: 'Security Audit',
      description: 'Audit Base mainnet contracts for vulnerabilities and exploit paths.',
      category: 'security',
      subcategories: ['audit', 'contract'],
      inputs: [{ type: 'address' }],
      outputs: { type: 'report' },
      confidenceScore: 0.99,
      latencyEstimateMs: 4200,
    }],
    pricing: { 'sentinel:security-audit': 0.95, generic: 0.95 },
    chain: 'base-mainnet',
    active: true,
    healthy: true,
    lastHealthCheck: staleHealthCheck,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetExternalAgents.mockImplementation((mode?: string) => mode === 'mainnet' ? [mainnetSecurityAgent] : [testnetSecurityAgent]);
    mockGetExternalAgent.mockImplementation((id: string, mode?: string) => {
      if (id !== 'sentinel') return undefined;
      return mode === 'mainnet' ? mainnetSecurityAgent : testnetSecurityAgent;
    });
    mockGetReputationScore.mockImplementation((agentId: string) => {
      if (agentId === 'sentinel') return 0.91;
      if (agentId === 'bankr') return 0.96;
      return 0.8;
    });
    mockGetReputationStats.mockImplementation((agentId: string) => {
      if (agentId === 'sentinel') {
        return {
          capabilities: {
            'sentinel:security-audit': {
              capabilityId: 'sentinel:security-audit',
              currentScore: 0.83,
              p50: 4200,
              totalTasks: 12,
            },
          },
        };
      }

      if (agentId === 'bankr') {
        return {
          capabilities: {
            'bankr:balance': {
              capabilityId: 'bankr:balance',
              currentScore: 0.97,
              p50: 900,
              totalTasks: 48,
            },
          },
        };
      }

      return { capabilities: {} };
    });
  });

  it('normalizes built-in manifests into catalog agents with inferred routing hints', () => {
    const builtInAgents = getBuiltInRoutingCatalogAgents();
    const bankr = builtInAgents.find((agent) => agent.agentId === 'bankr');

    expect(bankr).toBeTruthy();
    expect(bankr?.source).toBe('built-in');
    expect(bankr?.supportedNetworks).toEqual(expect.arrayContaining(['testnet', 'mainnet']));
    expect(bankr?.health.healthy).toBe(true);
    expect(bankr?.capabilities[0].capabilityId).toBe('bankr:balance');
    expect(bankr?.capabilities[0].verbs).toContain('balance');
    expect(bankr?.capabilities[0].entities).toContain('wallet');
    expect(bankr?.capabilities[0].estimatedPrice).toBeGreaterThan(0);
  });

  it('keeps external agents isolated by network mode', () => {
    const testnetAgents = getRoutingCatalogAgents('testnet');
    const mainnetAgents = getRoutingCatalogAgents('mainnet');

    const testnetSentinel = testnetAgents.find((agent) => agent.agentId === 'sentinel' && agent.source === 'external');
    const mainnetSentinel = mainnetAgents.find((agent) => agent.agentId === 'sentinel' && agent.source === 'external');

    expect(testnetSentinel?.displayName).toBe('Sentinel Testnet');
    expect(mainnetSentinel?.displayName).toBe('Sentinel Mainnet');
    expect(testnetSentinel?.supportedNetworks).toEqual(['testnet']);
    expect(mainnetSentinel?.supportedNetworks).toEqual(['mainnet']);
    expect(testnetSentinel?.capabilities[0].estimatedPrice).toBe(0.25);
    expect(mainnetSentinel?.capabilities[0].estimatedPrice).toBe(0.95);
  });

  it('surfaces health and reliability hints on normalized capabilities', () => {
    const mainnetSentinel = getRoutingCatalogAgent('sentinel', 'mainnet');
    const auditCapability = mainnetSentinel?.capabilities[0];

    expect(mainnetSentinel?.health.stale).toBe(true);
    expect(auditCapability?.health.stale).toBe(true);
    expect(auditCapability?.reliability.reputationScore).toBe(0.91);
    expect(auditCapability?.reliability.capabilityScore).toBe(0.83);
    expect(auditCapability?.reliability.p50LatencyMs).toBe(4200);
    expect(auditCapability?.reliability.totalTasks).toBe(12);
    expect(auditCapability?.verbs).toContain('audit');
    expect(auditCapability?.entities).toContain('contract');
  });
});
