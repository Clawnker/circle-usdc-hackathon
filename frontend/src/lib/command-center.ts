import type { NetworkMode } from '@/types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
export const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'demo-key';

export const SPECIALIST_NAMES: Record<string, string> = {
  aura: 'Social Analyst',
  magos: 'Market Oracle',
  bankr: 'DeFi Specialist Bankr',
  general: 'General Assistant',
  alphahunter: 'AlphaHunter',
  riskbot: 'RiskBot',
  newsdigest: 'NewsDigest',
  whalespy: 'WhaleSpy',
  scribe: 'Scribe',
  seeker: 'Seeker',
  sentinel: 'Sentinel',
  dispatcher: 'Dispatcher',
  'multi-hop': 'Multi-hop Orchestrator',
};

export const SPECIALIST_FEES: Record<string, number> = {
  bankr: 0.1,
  scribe: 0.1,
  seeker: 0.1,
  magos: 0.1,
  aura: 0.1,
  sentinel: 2.5,
  general: 0,
};

export const CORE_AGENTS = ['bankr', 'scribe', 'seeker'] as const;
export const DEFAULT_SWARM_AGENTS = [...CORE_AGENTS];

export interface RegistryMetaEntry {
  name: string;
  description: string;
  capabilities: string[];
  color: string;
  price?: number;
}

export type RegistryMetaMap = Record<string, RegistryMetaEntry>;

export interface PendingApprovalState {
  prompt: string;
  specialist: string;
  specialistInfo: {
    name: string;
    description: string;
    fee: string;
    feeCurrency: string;
    successRate?: number;
  };
}

export interface PaymentRequiredState {
  specialistId: string;
  fee: number;
  prompt: string;
  transferTo?: string;
}

export interface CommandCenterLastResult {
  query: string;
  status: 'success' | 'failure';
  result: string;
  cost: number;
  specialist: string;
  taskId?: string;
  rawResult?: unknown;
  isMultiHop?: boolean;
}

export interface BazaarAgentPayload {
  name: string;
  description?: string;
  networkMode?: NetworkMode;
  [key: string]: unknown;
}

const CAPABILITY_MAP: Record<string, string[]> = {
  defi: ['DeFi', 'Swap routing', 'Liquidity analysis'],
  trading: ['Trading', 'Market analysis'],
  security: ['Security audit', 'Vulnerability scanning'],
  audit: ['Smart contract audit', 'Risk assessment'],
  coding: ['Code generation', 'Development'],
  developer: ['Software development', 'Code review'],
  research: ['Research', 'Data analysis'],
  creative: ['Creative writing', 'Content generation'],
  portfolio: ['Portfolio management', 'Rebalancing'],
  'fact-check': ['Fact checking', 'Verification'],
  market: ['Market intelligence', 'Price analysis'],
  cloud: ['Cloud architecture', 'Infrastructure'],
  frontend: ['Frontend development', 'UI/UX'],
  backend: ['Backend development', 'API design'],
};

const REGISTRY_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#F97316', '#06D6A0', '#E879F9', '#38BDF8'];

function hashCode(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function deriveBazaarCapabilities(description?: string): string[] {
  const normalizedDescription = (description || '').toLowerCase();
  const capabilities: string[] = [];

  for (const [keyword, mappedCapabilities] of Object.entries(CAPABILITY_MAP)) {
    if (normalizedDescription.includes(keyword)) {
      capabilities.push(...mappedCapabilities);
    }
  }

  if (capabilities.length === 0) {
    capabilities.push('General purpose agent');
  }

  return [...new Set(capabilities)].slice(0, 5);
}

export function getRegistryColor(agentId: string): string {
  return REGISTRY_COLORS[hashCode(agentId) % REGISTRY_COLORS.length];
}

export function buildBazaarRegistration(agentPayload: BazaarAgentPayload): {
  agentId: string;
  capabilities: string[];
  metadata: RegistryMetaEntry;
} {
  const agentId = agentPayload.name.toLowerCase().replace(/\s+/g, '-');
  const capabilities = deriveBazaarCapabilities(agentPayload.description);
  const color = getRegistryColor(agentId);

  return {
    agentId,
    capabilities,
    metadata: {
      name: agentPayload.name,
      description: agentPayload.description || 'External ERC-8004 agent',
      capabilities,
      color,
    },
  };
}
