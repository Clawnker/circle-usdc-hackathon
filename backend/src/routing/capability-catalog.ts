import { capabilityMatcher } from '../capability-matcher';
import config from '../config';
import { getExternalAgents, getExternalAgent } from '../external-agents';
import { getReputationScore, getReputationStats } from '../reputation';
import type { Capability, CapabilityMetrics, ExternalAgent, SpecialistType } from '../types';
import type { ClientNetworkMode } from '../utils/client-network';

export type RoutingCatalogAgentSource = 'built-in' | 'external';

export interface RoutingCatalogHealthHint {
  active: boolean;
  healthy: boolean;
  stale: boolean;
  lastHealthCheck?: string;
}

export interface RoutingCatalogReliabilityHint {
  reputationScore: number;
  capabilityScore: number;
  p50LatencyMs: number;
  totalTasks: number;
}

export interface RoutingCatalogCapability {
  agentId: string;
  agentName: string;
  agentSource: RoutingCatalogAgentSource;
  capabilityId: string;
  capability: Capability;
  estimatedPrice: number;
  supportedNetworks: ClientNetworkMode[];
  keywords: string[];
  verbs: string[];
  entities: string[];
  health: RoutingCatalogHealthHint;
  reliability: RoutingCatalogReliabilityHint;
  externalAgent?: ExternalAgent;
}

export interface RoutingCatalogAgent {
  agentId: string;
  displayName: string;
  description: string;
  source: RoutingCatalogAgentSource;
  supportedNetworks: ClientNetworkMode[];
  defaultPrice: number;
  keywords: string[];
  verbs: string[];
  entities: string[];
  health: RoutingCatalogHealthHint;
  capabilities: RoutingCatalogCapability[];
  externalAgent?: ExternalAgent;
}

const BUILT_IN_AGENT_METADATA: Record<string, { displayName: string; description: string }> = {
  magos: { displayName: 'Magos', description: 'Market analysis & predictions' },
  aura: { displayName: 'Aura', description: 'Social sentiment analysis' },
  bankr: { displayName: 'Bankr', description: 'Wallet operations' },
  scribe: { displayName: 'Scribe', description: 'General assistant & summarization' },
  seeker: { displayName: 'Seeker', description: 'Web research & search' },
  general: { displayName: 'General', description: 'General queries' },
  'multi-hop': { displayName: 'Multi-Hop', description: 'Orchestrated multi-agent workflow' },
};

const DEFAULT_BUILT_IN_NETWORKS: ClientNetworkMode[] = ['testnet', 'mainnet'];
const EXTERNAL_AGENT_HEALTH_STALE_MS = 5 * 60 * 1000;
const CAPABILITY_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'onto', 'your', 'their', 'this', 'that',
  'what', 'when', 'where', 'which', 'will', 'would', 'could', 'should', 'about', 'around',
  'have', 'need', 'want', 'show', 'tell', 'give', 'make', 'please', 'just', 'than', 'them',
  'then', 'after', 'before', 'using', 'use', 'into', 'over', 'under', 'also', 'latest',
]);
const VERB_KEYWORDS = [
  'analyze', 'audit', 'balance', 'buy', 'check', 'compare', 'discover', 'execute', 'explain',
  'find', 'lookup', 'monitor', 'predict', 'research', 'rewrite', 'scan', 'search', 'sell',
  'send', 'summarize', 'swap', 'trade', 'transfer',
];
const ENTITY_KEYWORDS = [
  'address', 'alpha', 'base', 'contract', 'defi', 'ecosystem', 'liquidity', 'market', 'news',
  'portfolio', 'price', 'research', 'security', 'sentiment', 'social', 'token', 'trending',
  'wallet', 'web',
];

function tokenizeCapabilityText(text: string): string[] {
  return [...new Set(
    text
      .toLowerCase()
      .replace(/0x[a-f0-9]{40}/g, ' contractaddress ')
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !CAPABILITY_STOP_WORDS.has(token))
  )];
}

function getCapabilityTextParts(capability: Capability): string[] {
  return [
    capability.id,
    capability.name,
    capability.description,
    capability.category,
    ...(capability.subcategories || []),
  ];
}

function inferKeywords(capability: Capability): string[] {
  return tokenizeCapabilityText(getCapabilityTextParts(capability).join(' '));
}

function inferVerbs(capability: Capability): string[] {
  const keywords = inferKeywords(capability);
  const verbs = VERB_KEYWORDS.filter((keyword) =>
    keywords.some((token) => token === keyword || token.includes(keyword) || keyword.includes(token))
  );
  return verbs.length > 0 ? verbs : keywords.slice(0, 3);
}

function inferEntities(capability: Capability): string[] {
  const keywords = inferKeywords(capability);
  const entities = ENTITY_KEYWORDS.filter((keyword) =>
    keywords.some((token) => token === keyword || token.includes(keyword) || keyword.includes(token))
  );
  return entities.length > 0 ? entities : keywords.slice(0, 4);
}

function getCapabilityMetric(agentId: string, capability: Capability): CapabilityMetrics | null {
  const reputation = getReputationStats(agentId);
  const capabilityStats = reputation.capabilities as Record<string, CapabilityMetrics | undefined>;
  const lookupKeys = new Set<string>(['generic', capability.id, capability.category, ...(capability.subcategories || [])]);

  let bestMetric: CapabilityMetrics | null = null;
  for (const key of lookupKeys) {
    const metric = capabilityStats[key];
    if (!metric) continue;

    if (!bestMetric) {
      bestMetric = metric;
      continue;
    }

    const bestTasks = bestMetric.totalTasks || 0;
    const nextTasks = metric.totalTasks || 0;
    if (nextTasks > bestTasks || (nextTasks === bestTasks && metric.p50 > 0 && bestMetric.p50 === 0)) {
      bestMetric = metric;
    }
  }

  return bestMetric;
}

function getBuiltInCapabilities(): Map<string, Capability[]> {
  const manifests = (capabilityMatcher as { specialistManifests?: Map<string, Capability[]> }).specialistManifests;
  return manifests instanceof Map ? manifests : new Map<string, Capability[]>();
}

function getBuiltInAgentMetadata(agentId: string, capabilities: Capability[]): { displayName: string; description: string } {
  const metadata = BUILT_IN_AGENT_METADATA[agentId];
  if (metadata) return metadata;

  return {
    displayName: agentId,
    description: capabilities[0]?.description || agentId,
  };
}

function buildHealthHint(source: RoutingCatalogAgentSource, externalAgent?: ExternalAgent): RoutingCatalogHealthHint {
  if (source === 'built-in' || !externalAgent) {
    return {
      active: true,
      healthy: true,
      stale: false,
    };
  }

  const active = externalAgent.active !== false;
  const healthy = externalAgent.healthy !== false;
  const lastHealthCheck = externalAgent.lastHealthCheck;
  const lastHealthCheckMs = lastHealthCheck ? new Date(lastHealthCheck).getTime() : NaN;
  const stale = Number.isFinite(lastHealthCheckMs)
    ? (Date.now() - lastHealthCheckMs) > EXTERNAL_AGENT_HEALTH_STALE_MS
    : false;

  return {
    active,
    healthy,
    stale,
    lastHealthCheck,
  };
}

function resolveCapabilityPrice(
  agentId: string,
  capability: Capability,
  source: RoutingCatalogAgentSource,
  externalAgent?: ExternalAgent
): number {
  const builtInFee = (config.fees as Record<string, number>)[agentId];
  if (builtInFee !== undefined) return builtInFee;

  if (source === 'external' && externalAgent?.pricing) {
    return externalAgent.pricing[capability.id] ??
      externalAgent.pricing['generic'] ??
      Object.values(externalAgent.pricing)[0] ??
      0;
  }

  return 0;
}

function buildCapabilityEntry(
  agentId: string,
  agentName: string,
  source: RoutingCatalogAgentSource,
  capability: Capability,
  supportedNetworks: ClientNetworkMode[],
  externalAgent?: ExternalAgent
): RoutingCatalogCapability {
  const metric = getCapabilityMetric(agentId, capability);
  const health = buildHealthHint(source, externalAgent);
  const capabilityId = capability.id || `${agentId}:generic`;

  return {
    agentId,
    agentName,
    agentSource: source,
    capabilityId,
    capability,
    estimatedPrice: resolveCapabilityPrice(agentId, { ...capability, id: capabilityId }, source, externalAgent),
    supportedNetworks,
    keywords: inferKeywords(capability),
    verbs: inferVerbs(capability),
    entities: inferEntities(capability),
    health,
    reliability: {
      reputationScore: getReputationScore(agentId, capabilityId),
      capabilityScore: metric?.currentScore || 0,
      p50LatencyMs: metric?.p50 || capability.latencyEstimateMs || 0,
      totalTasks: metric?.totalTasks || 0,
    },
    externalAgent,
  };
}

function buildAgentEntry(
  agentId: string,
  displayName: string,
  description: string,
  source: RoutingCatalogAgentSource,
  capabilities: Capability[],
  supportedNetworks: ClientNetworkMode[],
  externalAgent?: ExternalAgent
): RoutingCatalogAgent {
  const capabilityEntries = capabilities.map((capability) =>
    buildCapabilityEntry(agentId, displayName, source, capability, supportedNetworks, externalAgent)
  );
  const keywords = [...new Set(capabilityEntries.flatMap((entry) => entry.keywords))];
  const verbs = [...new Set(capabilityEntries.flatMap((entry) => entry.verbs))];
  const entities = [...new Set(capabilityEntries.flatMap((entry) => entry.entities))];

  return {
    agentId,
    displayName,
    description,
    source,
    supportedNetworks,
    defaultPrice: capabilityEntries[0]?.estimatedPrice ?? resolveCapabilityPrice(agentId, {
      id: `${agentId}:generic`,
      name: displayName,
      description,
      category: 'generic',
      subcategories: [],
      inputs: [],
      outputs: { type: 'json' },
      confidenceScore: 0.8,
      latencyEstimateMs: 1000,
    }, source, externalAgent),
    keywords,
    verbs,
    entities,
    health: buildHealthHint(source, externalAgent),
    capabilities: capabilityEntries,
    externalAgent,
  };
}

export function getBuiltInRoutingCatalogAgents(): RoutingCatalogAgent[] {
  const manifests = getBuiltInCapabilities();
  return Array.from(manifests.entries()).map(([agentId, capabilities]) => {
    const metadata = getBuiltInAgentMetadata(agentId, capabilities);
    return buildAgentEntry(
      agentId,
      metadata.displayName,
      metadata.description,
      'built-in',
      capabilities,
      DEFAULT_BUILT_IN_NETWORKS,
    );
  });
}

export function getRoutingCatalogAgents(networkMode: ClientNetworkMode = 'testnet'): RoutingCatalogAgent[] {
  const builtInAgents = getBuiltInRoutingCatalogAgents();
  const externalAgents = getExternalAgents(networkMode).map((agent) =>
    buildAgentEntry(
      agent.id,
      agent.name,
      agent.description,
      'external',
      agent.structuredCapabilities || [],
      [networkMode],
      agent,
    )
  );

  return [...builtInAgents, ...externalAgents];
}

export function getRoutingCatalogCapabilities(networkMode: ClientNetworkMode = 'testnet'): RoutingCatalogCapability[] {
  return getRoutingCatalogAgents(networkMode).flatMap((agent) => agent.capabilities);
}

export function getRoutingCatalogAgent(
  agentId: string,
  networkMode: ClientNetworkMode = 'testnet'
): RoutingCatalogAgent | undefined {
  const externalAgent = getExternalAgent(agentId, networkMode);
  if (externalAgent) {
    return buildAgentEntry(
      externalAgent.id,
      externalAgent.name,
      externalAgent.description,
      'external',
      externalAgent.structuredCapabilities || [],
      [networkMode],
      externalAgent,
    );
  }

  return getBuiltInRoutingCatalogAgents().find((agent) => agent.agentId === agentId);
}

export function getRoutingCatalogCapabilitiesForAgent(
  agentId: string,
  networkMode: ClientNetworkMode = 'testnet'
): RoutingCatalogCapability[] {
  return getRoutingCatalogAgent(agentId, networkMode)?.capabilities || [];
}
