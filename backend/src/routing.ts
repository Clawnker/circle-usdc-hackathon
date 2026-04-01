import {
  SpecialistType,
  DAGPlan,
  RoutingDecision,
  RoutingPlan,
  RoutingPlanSource,
  RoutingPlanStep,
} from './types';
import type { CapabilityMetrics } from './types';
import config from './config';
import { getReputationScore, getReputationStats } from './reputation';
import { planWithLLM } from './llm-planner';
import { capabilityMatcher } from './capability-matcher';
import { isExternalAgent, getExternalAgents, getExternalAgent } from './external-agents';
import { classifyIntent } from './intent-classifier';
import { priceRouter } from './price-router';
import type { ClientNetworkMode } from './utils/client-network';
import {
  getBuiltInRoutingCatalogAgents,
  getRoutingCatalogAgents,
  type RoutingCatalogAgent,
  type RoutingCatalogCapability,
} from './routing/capability-catalog';

const SPECIALIST_DESCRIPTIONS: Record<SpecialistType, string> = {
  magos: 'Market analysis & predictions',
  aura: 'Social sentiment analysis',
  bankr: 'Wallet operations',
  scribe: 'General assistant & fallback',
  seeker: 'Web research & search',
  general: 'General queries',
  'multi-hop': 'Orchestrated multi-agent workflow',
};

const SPECIALIST_PRICING: Record<SpecialistType, { fee: string; description: string }> = {
  magos: { fee: '0.10', description: 'Market analysis & predictions' },
  aura: { fee: '0.10', description: 'Social sentiment analysis' },
  bankr: { fee: '0.10', description: 'Wallet operations' },
  scribe: { fee: '0.10', description: 'General assistant & fallback' },
  seeker: { fee: '0.10', description: 'Web research & search' },
  general: { fee: '0', description: 'General queries' },
  'multi-hop': { fee: '0', description: 'Orchestrated multi-agent workflow' },
};

type LocalRoutingCandidate = {
  agentId: SpecialistType;
  score: number;
  reasoning: string;
};

const ROUTING_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'onto', 'your', 'their', 'this', 'that',
  'what', 'when', 'where', 'which', 'will', 'would', 'could', 'should', 'about', 'around',
  'have', 'need', 'want', 'show', 'tell', 'give', 'make', 'please', 'just', 'than', 'them',
  'then', 'after', 'before', 'using', 'use', 'into', 'over', 'under', 'also', 'latest',
]);

const SPECIALIST_SIGNAL_KEYWORDS: Record<string, string[]> = {
  bankr: ['wallet', 'balance', 'transfer', 'send', 'swap', 'trade', 'buy', 'sell', 'approve', 'allowance', 'portfolio', 'deposit', 'withdraw'],
  magos: ['price', 'market', 'analysis', 'predict', 'prediction', 'forecast', 'trend', 'support', 'resistance', 'valuation', 'liquidity'],
  aura: ['sentiment', 'social', 'trending', 'trend', 'buzz', 'hype', 'fomo', 'fud', 'mentions', 'twitter', 'alpha', 'popular'],
  seeker: ['search', 'research', 'news', 'latest', 'find', 'lookup', 'web', 'current', 'happened', 'report'],
  scribe: ['summarize', 'summary', 'bullet', 'explain', 'rewrite', 'readable', 'draft', 'format', 'clean'],
  general: ['help', 'general'],
};

const routeCache: Map<string, { specialist: SpecialistType; expiresAt: number }> = new Map();
const ROUTE_CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_ROUTE_CACHE_SIZE = 300;
const EXTERNAL_AGENT_HEALTH_STALE_MS = 5 * 60 * 1000;
const ROUTING_LATENCY_WARN_MS = 5000;
const ROUTING_LATENCY_HIGH_MS = 15000;
const ROUTING_LATENCY_SEVERE_MS = 30000;

type RoutingPlanOptions = {
  confidence?: number;
  reasoning?: string;
  metadata?: Record<string, any>;
  selectedSpecialist?: SpecialistType;
  source?: RoutingPlanSource;
};

function hasLlmRoutingSupport(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

function tokenizeRoutingText(text: string): string[] {
  return [...new Set(
    text
      .toLowerCase()
      .replace(/0x[a-f0-9]{40}/g, ' contractaddress ')
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !ROUTING_STOP_WORDS.has(token))
  )];
}

function scoreKeywordMatches(tokens: string[], keywords: string[]): number {
  return tokens.reduce((count, token) => {
    if (keywords.some((keyword) => token === keyword || token.includes(keyword) || keyword.includes(token))) {
      return count + 1;
    }
    return count;
  }, 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildCapabilityTokenSet(
  agentId: string,
  capabilities: RoutingCatalogCapability[],
  description?: string
): Set<string> {
  const parts: string[] = [agentId, description || ''];

  for (const capability of capabilities) {
    const details = capability.capability;
    parts.push(
      details.id || '',
      details.name || '',
      details.description || '',
      details.category || '',
      ...(details.subcategories || []),
      ...(capability.keywords || []),
      ...(capability.verbs || []),
      ...(capability.entities || [])
    );
  }

  return new Set(tokenizeRoutingText(parts.join(' ')));
}

function getRepresentativeCapabilityId(
  capabilities: RoutingCatalogCapability[],
  capabilityTokens: Set<string>,
  promptTokens: string[]
): string {
  let bestMatch = capabilities[0]?.capabilityId || 'generic';
  let bestScore = -1;

  for (const capability of capabilities) {
    const details = capability.capability;
    const tokens = new Set(tokenizeRoutingText([
      details.id || '',
      details.name || '',
      details.description || '',
      ...(details.subcategories || []),
      ...(capability.keywords || []),
    ].join(' ')));

    const overlap = promptTokens.reduce((count, token) => count + (tokens.has(token) ? 1 : 0), 0);
    if (overlap > bestScore) {
      bestScore = overlap;
      bestMatch = capability.capabilityId || bestMatch;
    }
  }

  if (bestScore <= 0 && capabilityTokens.size > 0) {
    return capabilities[0]?.capabilityId || bestMatch;
  }

  return bestMatch;
}

function buildPromptIntentFlags(prompt: string, tokens: string[]) {
  const lower = prompt.toLowerCase();

  const invokesAgent = (agentName: string) => {
    const nameTokens = tokenizeRoutingText(agentName);
    if (nameTokens.length === 0) return false;
    const joinedName = nameTokens.map(escapeRegExp).join('[\\s_-]+');
    return new RegExp(`\\b(?:use|ask|route(?:\\s+this)?\\s+to|send(?:\\s+this)?\\s+to|have)\\s+${joinedName}\\b`, 'i').test(prompt);
  };

  return {
    hasAddress: /0x[a-fA-F0-9]{40}/.test(prompt),
    wantsSecurity: /\b(audit|security|vulnerabilit|exploit|reentrancy|review|contract)\b/i.test(prompt),
    wantsWallet: /\b(balance|wallet|transfer|send|swap|trade|buy|sell|approve|allowance|deposit|withdraw)\b/i.test(prompt),
    wantsResearch: /\b(search|research|news|latest|find|lookup|web|current|happened)\b/i.test(prompt),
    wantsSentiment: /\b(sentiment|social|trending|popular|buzz|hype|fomo|fud|mentions|twitter|alpha)\b/i.test(prompt),
    wantsMarket: /\b(price|market|analysis|predict|prediction|forecast|trend|support|resistance|valuation|liquidity)\b/i.test(prompt),
    wantsSummary: /\b(summarize|summary|bullet|explain|rewrite|readable|draft|format|clean)\b/i.test(prompt),
    mentionsName: (agentName: string) => {
      const nameTokens = tokenizeRoutingText(agentName);
      return nameTokens.length > 0 && nameTokens.some((token) => tokens.includes(token));
    },
    invokesAgent,
    lower,
  };
}

function getHealthMultiplier(agent?: RoutingCatalogAgent): number {
  if (!agent || agent.source === 'built-in') return 1;
  if (!agent.health.active || !agent.health.healthy) return 0;
  if (agent.health.stale) return 0.55;
  return 1;
}

function getLatencyMetric(
  agentId: string,
  representativeCapabilityId: string,
  capabilities: RoutingCatalogCapability[]
): CapabilityMetrics | null {
  const reputation = getReputationStats(agentId);
  const capabilityStats = reputation.capabilities as Record<string, CapabilityMetrics | undefined>;
  const lookupKeys = new Set<string>(['generic', representativeCapabilityId]);

  for (const capability of capabilities) {
    const details = capability.capability;
    if (details.id) lookupKeys.add(details.id);
    if (details.category) lookupKeys.add(details.category);
    for (const subcategory of details.subcategories || []) {
      lookupKeys.add(subcategory);
    }
  }

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

function getLatencyMultiplier(
  agentId: string,
  representativeCapabilityId: string,
  capabilities: RoutingCatalogCapability[]
): { multiplier: number; p50: number } {
  const metric = getLatencyMetric(agentId, representativeCapabilityId, capabilities);
  const p50 = metric?.p50 || 0;

  if (p50 >= ROUTING_LATENCY_SEVERE_MS) return { multiplier: 0.45, p50 };
  if (p50 >= ROUTING_LATENCY_HIGH_MS) return { multiplier: 0.72, p50 };
  if (p50 >= ROUTING_LATENCY_WARN_MS) return { multiplier: 0.9, p50 };

  return { multiplier: 1, p50 };
}

function rankAgentsWithLocalSignals(
  prompt: string,
  hiredAgents?: SpecialistType[],
  networkMode: ClientNetworkMode = 'testnet'
): LocalRoutingCandidate[] {
  const promptTokens = tokenizeRoutingText(prompt);
  const flags = buildPromptIntentFlags(prompt, promptTokens);
  const candidates: LocalRoutingCandidate[] = [];
  const builtInAgents = getBuiltInRoutingCatalogAgents();
  const externalAgents = getRoutingCatalogAgents(networkMode)
    .filter((agent) => agent.source === 'external' && agent.health.active && agent.health.healthy);

  const maybeAddCandidate = (catalogAgent: RoutingCatalogAgent) => {
    const agentId = catalogAgent.agentId;
    const description = catalogAgent.source === 'external'
      ? `${catalogAgent.displayName} ${catalogAgent.description || ''}`.trim()
      : (SPECIALIST_DESCRIPTIONS[agentId as SpecialistType] || catalogAgent.description || agentId);
    const capabilities = catalogAgent.capabilities;

    if (hiredAgents && agentId !== 'general' && !hiredAgents.includes(agentId as SpecialistType)) {
      return;
    }

    const capabilityTokens = buildCapabilityTokenSet(agentId, capabilities, description);
    const capabilityOverlap = promptTokens.reduce((count, token) => count + (capabilityTokens.has(token) ? 1 : 0), 0);
    const keywordHits = scoreKeywordMatches(promptTokens, SPECIALIST_SIGNAL_KEYWORDS[agentId] || []);
    const representativeCapabilityId = getRepresentativeCapabilityId(capabilities, capabilityTokens, promptTokens);
    const marketData = priceRouter.getMarketData(representativeCapabilityId);
    const matchedCapability = capabilities.find((capability) => capability.capabilityId === representativeCapabilityId);
    const agentPrice = matchedCapability?.estimatedPrice ?? resolveAgentFee(agentId, representativeCapabilityId, networkMode);
    const priceEfficiency = priceRouter.calculatePriceEfficiency(agentPrice, marketData.average);
    const reputation = getReputationScore(agentId, representativeCapabilityId);
    const confidence = capabilities.reduce((sum, capability) => sum + (capability.capability.confidenceScore || 0.8), 0) / Math.max(capabilities.length, 1);
    const healthMultiplier = getHealthMultiplier(catalogAgent);
    const latency = getLatencyMultiplier(agentId, representativeCapabilityId, capabilities);

    let score = 0;
    score += Math.min(keywordHits, 4) * 0.18;
    score += Math.min(capabilityOverlap, 4) * 0.08;
    score += reputation * 0.12;
    score += priceEfficiency * 0.08;
    score += Math.min(confidence, 1) * 0.08;

    if (flags.mentionsName(agentId) || (catalogAgent.source === 'external' && flags.mentionsName(catalogAgent.displayName))) {
      score += 0.16;
    }
    if (flags.invokesAgent(agentId) || (catalogAgent.source === 'external' && flags.invokesAgent(catalogAgent.displayName))) {
      score += 0.34;
    }

    if (flags.wantsSecurity && (capabilityTokens.has('security') || capabilityTokens.has('audit') || capabilityTokens.has('contract') || capabilityTokens.has('vulnerability'))) {
      score += 0.34;
    }
    if (flags.wantsWallet && (capabilityTokens.has('wallet') || capabilityTokens.has('balance') || capabilityTokens.has('transfer') || capabilityTokens.has('swap') || capabilityTokens.has('trade'))) {
      score += 0.32;
    }
    if (flags.wantsResearch && (capabilityTokens.has('search') || capabilityTokens.has('research') || capabilityTokens.has('news') || capabilityTokens.has('web'))) {
      score += 0.28;
    }
    if (flags.wantsSentiment && (capabilityTokens.has('sentiment') || capabilityTokens.has('social') || capabilityTokens.has('trending') || capabilityTokens.has('buzz'))) {
      score += 0.28;
    }
    if (flags.wantsMarket && (capabilityTokens.has('market') || capabilityTokens.has('price') || capabilityTokens.has('analysis') || capabilityTokens.has('prediction') || capabilityTokens.has('liquidity'))) {
      score += 0.28;
    }
    if (flags.wantsSummary && (capabilityTokens.has('summarize') || capabilityTokens.has('summary') || capabilityTokens.has('explain') || capabilityTokens.has('rewrite'))) {
      score += 0.28;
    }

    if (flags.hasAddress && flags.wantsSecurity && catalogAgent.source === 'external') {
      score += 0.16;
    }

    if (agentId === 'bankr' && flags.wantsWallet) score += 0.22;
    if (agentId === 'magos' && flags.wantsMarket) score += 0.2;
    if (agentId === 'aura' && flags.wantsSentiment) score += 0.2;
    if (agentId === 'seeker' && flags.wantsResearch) score += 0.2;
    if (agentId === 'scribe' && flags.wantsSummary) score += 0.2;
    if (agentId === 'general' && score === 0) score = 0.05;

    score *= healthMultiplier;
    score *= latency.multiplier;

    if (score <= 0) return;

    candidates.push({
      agentId: agentId as SpecialistType,
      score,
      reasoning: `local-signals keywords=${keywordHits} overlap=${capabilityOverlap} rep=${reputation.toFixed(2)} price=${priceEfficiency.toFixed(2)} health=${healthMultiplier.toFixed(2)} latency=${latency.multiplier.toFixed(2)} p50=${latency.p50}`,
    });
  };

  for (const agent of builtInAgents) {
    maybeAddCandidate(agent);
  }

  for (const agent of externalAgents) {
    maybeAddCandidate(agent);
  }

  if (!hiredAgents || hiredAgents.length === 0 || hiredAgents.includes('general')) {
    candidates.push({
      agentId: 'general',
      score: 0.05,
      reasoning: 'local-signals fallback-general',
    });
  }

  return candidates.sort((left, right) => right.score - left.score);
}

export function resolveAgentFee(
  specialistId: string,
  taskType?: string,
  networkMode: ClientNetworkMode = 'testnet'
): number {
  const internalFee = (config.fees as any)[specialistId];
  if (internalFee !== undefined) return internalFee;

  if (isExternalAgent(specialistId)) {
    const agent = getExternalAgent(specialistId, networkMode);
    if (agent?.pricing) {
      return agent.pricing[taskType || ''] ||
        agent.pricing['security-audit'] ||
        agent.pricing['generic'] ||
        Object.values(agent.pricing)[0] ||
        0;
    }
  }

  return 0;
}

export function getSpecialistPreviewInfo(
  specialist: SpecialistType,
  networkMode: ClientNetworkMode = 'testnet'
): { fee: string; description: string } {
  const builtIn = SPECIALIST_PRICING[specialist];
  if (builtIn) return builtIn;

  if (isExternalAgent(specialist)) {
    const extAgent = getExternalAgent(specialist, networkMode);
    const extFee = extAgent?.pricing?.['security-audit'] ||
      extAgent?.pricing?.['generic'] ||
      Object.values(extAgent?.pricing || {})[0] ||
      0;

    return {
      fee: String(extFee),
      description: extAgent?.description || 'External agent',
    };
  }

  return { fee: '0', description: 'Unknown' };
}

function buildRoutingPlanId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildRoutingPlanStepFromSelection(
  promptTemplate: string,
  specialist: SpecialistType,
  networkMode: ClientNetworkMode,
  index = 0,
  reason?: string
): RoutingPlanStep {
  return {
    id: `step-${index + 1}`,
    specialist,
    promptTemplate,
    dependencies: index === 0 ? [] : [`step-${index}`],
    estimatedCost: resolveAgentFee(specialist, undefined, networkMode),
    reason,
  };
}

export function buildRoutingPlanFromSpecialist(
  prompt: string,
  specialist: SpecialistType,
  networkMode: ClientNetworkMode = 'testnet',
  options: RoutingPlanOptions = {}
): RoutingPlan {
  const reasoning = options.reasoning || `Route selector chose ${specialist}.`;
  const step = buildRoutingPlanStepFromSelection(prompt, specialist, networkMode, 0, reasoning);
  const kind = specialist === 'multi-hop' ? 'multi-hop' : 'single-hop';

  return {
    planId: buildRoutingPlanId(kind === 'multi-hop' ? 'route-multi' : 'route-single'),
    kind,
    source: options.source || 'route-selector',
    query: prompt,
    networkMode,
    entrySpecialist: specialist,
    selectedSpecialist: options.selectedSpecialist || specialist,
    steps: [step],
    totalEstimatedCost: step.estimatedCost,
    reasoning,
    confidence: options.confidence,
    metadata: options.metadata,
  };
}

export function buildRoutingPlanFromLegacyMultiHop(
  prompt: string,
  hops: SpecialistType[],
  networkMode: ClientNetworkMode = 'testnet',
  options: RoutingPlanOptions = {}
): RoutingPlan {
  const steps = hops.map((specialist, index) => {
    const promptTemplate = index === 0
      ? prompt
      : `Continue the original request using the output from step-${index}: ${prompt}`;

    return buildRoutingPlanStepFromSelection(
      promptTemplate,
      specialist,
      networkMode,
      index,
      `Legacy multi-hop step ${index + 1}: ${specialist}`
    );
  });

  return {
    planId: buildRoutingPlanId('route-legacy'),
    kind: 'multi-hop',
    source: options.source || 'legacy-multi-hop',
    query: prompt,
    networkMode,
    entrySpecialist: hops[0] || 'general',
    selectedSpecialist: options.selectedSpecialist || 'multi-hop',
    steps,
    totalEstimatedCost: steps.reduce((sum, step) => sum + step.estimatedCost, 0),
    reasoning: options.reasoning || `Legacy multi-hop router selected ${hops.join(' -> ')}.`,
    confidence: options.confidence,
    metadata: options.metadata,
  };
}

export function buildRoutingPlanFromDAG(
  dagPlan: DAGPlan,
  networkMode: ClientNetworkMode = 'testnet',
  options: RoutingPlanOptions = {}
): RoutingPlan {
  const steps = dagPlan.steps.map((step) => ({
    id: step.id,
    specialist: step.specialist,
    promptTemplate: step.promptTemplate,
    dependencies: step.dependencies,
    estimatedCost: step.estimatedCost,
    reason: `DAG step ${step.id}`,
  }));
  const isMultiHop = steps.length > 1;
  const firstSpecialist = steps[0]?.specialist || options.selectedSpecialist || 'general';

  return {
    planId: dagPlan.planId || buildRoutingPlanId('route-dag'),
    kind: isMultiHop ? 'multi-hop' : 'single-hop',
    source: options.source || 'dag-planner',
    query: dagPlan.query,
    networkMode,
    entrySpecialist: firstSpecialist,
    selectedSpecialist: options.selectedSpecialist || (isMultiHop ? 'multi-hop' : firstSpecialist),
    steps,
    totalEstimatedCost: dagPlan.totalEstimatedCost || steps.reduce((sum, step) => sum + step.estimatedCost, 0),
    reasoning: options.reasoning || dagPlan.reasoning || 'DAG planner generated a routing plan.',
    confidence: options.confidence,
    metadata: {
      originalDagPlanId: dagPlan.planId,
      ...options.metadata,
    },
  };
}

export async function buildRoutingDecision(
  prompt: string,
  hiredAgents?: SpecialistType[],
  networkMode: ClientNetworkMode = 'testnet'
): Promise<RoutingDecision> {
  const legacyHops = detectMultiHop(prompt);
  if (legacyHops) {
    return {
      specialist: 'multi-hop',
      plan: buildRoutingPlanFromLegacyMultiHop(prompt, legacyHops, networkMode),
    };
  }

  const specialist = await routePrompt(prompt, hiredAgents, networkMode);
  return {
    specialist,
    plan: buildRoutingPlanFromSpecialist(prompt, specialist, networkMode),
  };
}

export function isComplexQuery(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const domains = [
    { name: 'social', patterns: [/sentiment/, /vibe/, /mood/, /social/, /trending/, /popular/, /alpha/, /gem/, /influencer/, /kol/, /whale/, /twitter/, /fomo/, /fud/, /hype/, /buzz/] },
    { name: 'price', patterns: [/price/, /value/, /worth/, /cost/, /predict/, /forecast/, /chart/, /trend/, /market/, /valuation/, /support/, /resistance/, /technical/] },
    { name: 'security', patterns: [/audit/, /security/, /vulnerabilit/, /exploit/, /hack/, /safe/, /secure/, /risk/, /danger/, /smart\s*contract/] },
    { name: 'wallet', patterns: [/\bswap\b/, /\btrade\b/, /\bbuy\b/, /\bsell\b/, /\bexchange\b/, /\btransfer\b/, /\bsend\b/, /\bwithdraw\b/, /\bdeposit\b/, /\bbalance\b/, /\bportfolio\b/, /\bdca\b/] },
    { name: 'research', patterns: [/search/, /research/, /find/, /news/, /latest/, /happened/, /google/, /brave/, /internet/, /web/] },
  ];

  let detectedDomains = 0;
  for (const domain of domains) {
    if (domain.patterns.some((pattern) => pattern.test(lower))) {
      detectedDomains++;
    }
  }

  return detectedDomains >= 2;
}

export function detectMultiHop(prompt: string): SpecialistType[] | null {
  const lower = prompt.toLowerCase();

  if (lower.includes('buy') && (lower.includes('trending') || lower.includes('popular') || lower.includes('hot') || lower.includes('sentiment') || lower.includes('talked about') || lower.includes('most hyped') || lower.includes('most popular'))) {
    return ['aura', 'bankr'];
  }

  if ((lower.includes('find') || lower.includes('discover') || lower.includes('what')) && lower.includes('buy')) {
    return ['seeker', 'bankr'];
  }

  if ((lower.includes('analyze') || lower.includes('research')) && lower.includes('buy')) {
    return ['magos', 'bankr'];
  }

  if ((lower.includes('research') || lower.includes('search') || lower.includes('news')) && (lower.includes('summary') || lower.includes('summarize'))) {
    return ['seeker', 'scribe'];
  }

  if (isComplexQuery(prompt)) {
    return ['seeker', 'scribe'];
  }

  return null;
}

export function getSpecialistDisplayName(specialist: SpecialistType): string {
  const names: Record<string, string> = {
    magos: 'Market Oracle',
    aura: 'Social Analyst',
    bankr: 'DeFi Executor',
    scribe: 'General Assistant',
    seeker: 'Web Researcher',
    general: 'General',
    'multi-hop': 'Multi-Agent Workflow',
  };

  return names[specialist] || specialist;
}

function buildRouteCacheKey(
  prompt: string,
  hiredAgents?: SpecialistType[],
  networkMode: ClientNetworkMode = 'testnet'
): string {
  const normalizedPrompt = prompt.trim().toLowerCase();
  const swarm = (hiredAgents || []).slice().sort().join(',');
  return `${networkMode}::${normalizedPrompt}::${swarm}`;
}

function setRouteCache(key: string, specialist: SpecialistType): void {
  if (routeCache.size >= MAX_ROUTE_CACHE_SIZE) {
    const oldestKey = routeCache.keys().next().value;
    routeCache.delete(oldestKey);
  }
  routeCache.set(key, { specialist, expiresAt: Date.now() + ROUTE_CACHE_TTL_MS });
}

export async function routePrompt(
  prompt: string,
  hiredAgents?: SpecialistType[],
  networkMode: ClientNetworkMode = 'testnet'
): Promise<SpecialistType> {
  const lower = prompt.toLowerCase();
  const planningMode = process.env.PLANNING_MODE || 'capability';
  const llmRoutingSupported = hasLlmRoutingSupport();
  const cacheKey = buildRouteCacheKey(prompt, hiredAgents, networkMode);
  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.specialist;
  }

  if (/\b(liquidity|pool|deepest|best)\b/i.test(prompt) && /\b(clawnch|token|base)\b/i.test(prompt)) {
    console.log('[Router] DeFi liquidity query detected, routing to silverback');
    if (!hiredAgents || hiredAgents.includes('silverback')) {
      setRouteCache(cacheKey, 'silverback');
      return 'silverback';
    }
  }

  if (/\b(market|analysis|liquidity|price|trend)\b/i.test(prompt)) {
    if (hiredAgents) {
      const minaraId = hiredAgents.find((id) => id.includes('minara'));
      if (minaraId) {
        console.log(`[Router] Minara query detected, routing to ${minaraId}`);
        setRouteCache(cacheKey, minaraId as SpecialistType);
        return minaraId as SpecialistType;
      }
    }
  }

  if (/\b(trending|popular|hot|buzz|hype|sentiment|mood|vibe|fomo|fud|talking\s+about)\b/i.test(prompt) &&
      /\b(meme|coin|token|crypto|base|ecosystem)\b/i.test(prompt) &&
      !/\b(buy|sell|swap|trade|send|transfer)\b/i.test(prompt)) {
    console.log('[Router] Fast-path: social/trending query detected, routing to aura');
    if (!hiredAgents || hiredAgents.includes('aura')) {
      setRouteCache(cacheKey, 'aura');
      return 'aura';
    }
  }

  if (/\b(summarize|summary|bullet\s*points?|explain|rewrite|clean\s+up|make\s+this\s+readable)\b/i.test(prompt) &&
      !/\b(search|find|lookup|latest\s+on|news\s+about|research\b|google|brave|web)\b/i.test(prompt)) {
    console.log('[Router] Fast-path: readability/summarization query detected (early), routing to scribe');
    if (!hiredAgents || hiredAgents.includes('scribe')) {
      setRouteCache(cacheKey, 'scribe');
      return 'scribe';
    }
  }

  const explicitMultiHop = detectMultiHop(prompt);
  if (explicitMultiHop) {
    console.log('[Router] Explicit multi-hop pattern detected, routing to multi-hop');
    setRouteCache(cacheKey, 'multi-hop');
    return 'multi-hop';
  }

  const localCandidates = rankAgentsWithLocalSignals(prompt, hiredAgents, networkMode);
  const topLocalCandidate = localCandidates[0];
  const secondLocalCandidate = localCandidates[1];
  if (topLocalCandidate) {
    const lead = topLocalCandidate.score - (secondLocalCandidate?.score || 0);
    const isStrongLocalMatch = topLocalCandidate.score >= 0.72 ||
      (topLocalCandidate.score >= 0.48 && lead >= 0.12) ||
      (/\b(audit|security|vulnerabilit|exploit|reentrancy|review|contract)\b/i.test(prompt) && topLocalCandidate.score >= 0.42);

    if (isStrongLocalMatch) {
      console.log(`[Router] Local scorer selected ${topLocalCandidate.agentId} (${topLocalCandidate.score.toFixed(2)}) - ${topLocalCandidate.reasoning}`);
      setRouteCache(cacheKey, topLocalCandidate.agentId);
      return topLocalCandidate.agentId;
    }
  }

  if (planningMode === 'capability' && llmRoutingSupported) {
    try {
      const intent = await capabilityMatcher.extractIntent(prompt);
      const matches = await capabilityMatcher.matchAgents(intent, networkMode);

      if (matches.length > 0) {
        const swarmMatches = hiredAgents
          ? matches.filter((match) => hiredAgents.includes(match.agentId as SpecialistType))
          : matches;

        if (swarmMatches.length > 0) {
          const best = swarmMatches[0];
          console.log(`[Capability Matcher] Top match: ${best.agentId} (score: ${best.score.toFixed(2)})`);

          if (best.score >= 0.6) {
            setRouteCache(cacheKey, best.agentId as SpecialistType);
            return best.agentId as SpecialistType;
          }
        }
      }

      console.log('[Capability Matcher] No high-confidence match (top score < 0.6), falling back to fast-paths');
    } catch (error: any) {
      console.error('[Capability Matcher] Error:', error.message, '- falling back to fast-paths');
    }
  } else if (planningMode === 'capability') {
    console.log('[Router] Skipping capability matcher - LLM routing support unavailable');
  }

  if (llmRoutingSupported) {
    try {
    const intent = await classifyIntent(prompt);
    if (intent && intent.confidence >= 0.7) {
      const specialist = intent.specialist;
      if (!hiredAgents || hiredAgents.includes(specialist)) {
        console.log(`[Intent Classifier] ${intent.category} -> ${specialist} (${(intent.confidence * 100).toFixed(0)}%)`);
        setRouteCache(cacheKey, specialist);
        return specialist;
      }
    }
    } catch (error: any) {
      console.log(`[Intent Classifier] Error: ${error.message}, falling through`);
    }
  }

  if (/\b(audit|security|vulnerabilit|exploit|scan|review)\b/i.test(prompt) &&
      (/0x[a-fA-F0-9]{40}/.test(prompt) || /\b(contract|function|mapping|pragma|solidity|modifier|require)\b/i.test(prompt))) {
    console.log('[Router] Fast-path: contract audit query detected, looking for security specialist');

    const securityAgent = getRoutingCatalogAgents(networkMode)
      .filter((agent) => agent.source === 'external')
      .find((agent) =>
        agent.capabilities.some((capability) => {
          const normalized = capability.capabilityId.toLowerCase().replace(/\s+/g, '-');
        return ['security-audit', 'smart-contract-audit', 'audit', 'vulnerability-scanning', 'security'].some(
          (keyword) => normalized.includes(keyword) || keyword.includes(normalized)
        );
        })
      );

    if (securityAgent) {
      console.log(`[Router] Found security agent: ${securityAgent.agentId}`);
      if (!hiredAgents || hiredAgents.includes(securityAgent.agentId as SpecialistType)) {
        setRouteCache(cacheKey, securityAgent.agentId as SpecialistType);
        return securityAgent.agentId as SpecialistType;
      }
    }
  }

  if (/\b(price|value|worth|cost|how much)\b/i.test(prompt) &&
      /\b(bitcoin|btc|ethereum|eth|solana|sol|bonk|wif|pepe|doge|avax|matic|bnb|jup|crypto|token|coin)\b/i.test(prompt) &&
      !/\b(buy|sell|swap|trade|send|transfer)\b/i.test(prompt)) {
    console.log('[Router] Fast-path: price query detected, routing to magos');
    if (!hiredAgents || hiredAgents.includes('magos')) {
      setRouteCache(cacheKey, 'magos');
      return 'magos';
    }
  }

  if (/\b(sentiment|vibe|mood|social\s+analysis|what.+saying|what.+think|buzz|hype|fud|fomo|talking\s+about|mentions?|discussing)\b/i.test(prompt) &&
      !/\b(buy|sell|swap|trade|send|transfer)\b/i.test(prompt)) {
    console.log('[Router] Fast-path: sentiment/social query detected, routing to aura');
    if (!hiredAgents || hiredAgents.includes('aura')) {
      setRouteCache(cacheKey, 'aura');
      return 'aura';
    }
  }

  if (/\b(summarize|summary|bullet\s*points?|explain|rewrite|clean\s+up|make\s+this\s+readable)\b/i.test(prompt) &&
      !/\b(search|find|lookup|latest\s+on|news\s+about|research\b|google|brave|web)\b/i.test(prompt)) {
    console.log('[Router] Fast-path: readability/summarization query detected, routing to scribe');
    if (!hiredAgents || hiredAgents.includes('scribe')) {
      setRouteCache(cacheKey, 'scribe');
      return 'scribe';
    }
  }

  if (isComplexQuery(prompt)) {
    console.log('[Router] Complex query or multi-hop pattern detected, routing to multi-hop');
    setRouteCache(cacheKey, 'multi-hop');
    return 'multi-hop';
  }

  if (/\b(buy|sell|swap|send|transfer|withdraw|deposit|approve|allowance)\b/.test(lower) &&
      !/\b(should i|good|recommend|analysis|analyze|compare|predict)\b/.test(lower)) {
    console.log('[Router] Fast-path: explicit trade intent detected, routing to bankr');
    if (!hiredAgents || hiredAgents.includes('bankr')) {
      setRouteCache(cacheKey, 'bankr');
      return 'bankr';
    }
  }

  if (planningMode === 'llm') {
    if (!llmRoutingSupported) {
      const fallback = routeWithRegExp(prompt, hiredAgents);
      setRouteCache(cacheKey, fallback);
      return fallback;
    }

    try {
      const plan = await planWithLLM(prompt);
      console.log(`[LLM Planner] ${plan.specialist} (confidence: ${plan.confidence.toFixed(2)}) - ${plan.reasoning}`);

      if (hiredAgents && !hiredAgents.includes(plan.specialist)) {
        console.log(`[LLM Planner] Specialist ${plan.specialist} not in swarm, falling back to regexp routing`);
        const fallback = routeWithRegExp(prompt, hiredAgents);
        setRouteCache(cacheKey, fallback);
        return fallback;
      }

      setRouteCache(cacheKey, plan.specialist);
      return plan.specialist;
    } catch (error: any) {
      console.error('[LLM Planner] Error:', error.message, '- falling back to regexp');
      const fallback = routeWithRegExp(prompt, hiredAgents);
      setRouteCache(cacheKey, fallback);
      return fallback;
    }
  }

  const fallback = routeWithRegExp(prompt, hiredAgents);
  setRouteCache(cacheKey, fallback);
  return fallback;
}

export function routeWithRegExp(prompt: string, hiredAgents?: SpecialistType[]): SpecialistType {
  const lower = prompt.toLowerCase();

  if (lower.includes('good buy') || lower.includes('should i') || lower.includes('recommend') || /is \w+ a good/.test(lower)) {
    if (!hiredAgents || hiredAgents.includes('magos')) return 'magos';
  }

  if (lower.includes('talking about') || lower.includes('mentions') || lower.includes('discussing')) {
    if (!hiredAgents || hiredAgents.includes('aura')) return 'aura';
  }

  if (/(?:price|value|worth|cost).*\b(sol|eth|btc|bonk|wif|pepe|usdc|usdt|solana|bitcoin|ethereum)\b/i.test(prompt) ||
      /\b(sol|eth|btc|bonk|wif|pepe|solana|bitcoin|ethereum)\b.*price/i.test(prompt)) {
    if (!hiredAgents || hiredAgents.includes('magos')) return 'magos';
  }

  const rules: Array<{ specialist: SpecialistType; patterns: RegExp[]; weight: number }> = [
    {
      specialist: 'magos',
      patterns: [
        /predict|forecast|price\s+target|will\s+\w+\s+(go|reach|hit)/,
        /risk|danger|safe|analysis|analyze|technical/,
        /support|resistance|trend|pattern|chart/,
      ],
      weight: 1,
    },
    {
      specialist: 'aura',
      patterns: [
        /sentiment|vibe|mood|feeling|social/,
        /trending|hot|popular|alpha|gem/,
        /influencer|kol|whale\s+watch|twitter|x\s+/,
        /fomo|fud|hype|buzz/,
      ],
      weight: 1,
    },
    {
      specialist: 'bankr',
      patterns: [
        /\b(?:swap|trade|buy|sell|exchange)\b.*\b(?:token|coin|sol|eth|btc|usdc|for)\b/,
        /\b(?:transfer|send|withdraw|deposit)\b/,
        /\bbalance\b|my wallet|my holdings|my portfolio/,
        /\b(?:dca|dollar\s+cost|recurring|auto-buy)\b/,
      ],
      weight: 1,
    },
    {
      specialist: 'seeker',
      patterns: [
        /search|find|lookup|what is|who is|where is|news about|latest on/,
        /research|google|brave|internet|web|look up/,
        /news|happened|today|recent|current events/,
        /what happened|tell me about/,
      ],
      weight: 1.2,
    },
    {
      specialist: 'scribe',
      patterns: [
        /summarize|explain|write|draft|document/,
        /help|question|how to|what can you/,
      ],
      weight: 0.5,
    },
  ];

  const scores: Record<SpecialistType, number> = {
    magos: 0,
    aura: 0,
    bankr: 0,
    scribe: 0,
    seeker: 0,
    general: 0,
    'multi-hop': 0,
  };

  for (const rule of rules) {
    if (hiredAgents && !hiredAgents.includes(rule.specialist)) {
      continue;
    }

    for (const pattern of rule.patterns) {
      if (pattern.test(lower)) {
        scores[rule.specialist] += rule.weight;
      }
    }
  }

  let bestSpecialist: SpecialistType = 'general';
  let bestScore = 0;

  for (const [specialist, score] of Object.entries(scores)) {
    if (hiredAgents && !hiredAgents.includes(specialist as SpecialistType) && specialist !== 'general') {
      continue;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSpecialist = specialist as SpecialistType;
    }
  }

  console.log('[Router] Scores:', scores, `-> ${bestSpecialist}`, hiredAgents ? `(filtered by swarm: ${hiredAgents.join(', ')})` : '');
  return bestSpecialist;
}

export function getSpecialistPricing(): Record<SpecialistType, { fee: string; description: string; success_rate: number }> {
  const pricingWithRep: any = {};

  for (const [key, description] of Object.entries(SPECIALIST_DESCRIPTIONS)) {
    const fee = (config.fees as any)[key] || 0;
    pricingWithRep[key] = {
      fee: String(fee),
      description,
      success_rate: Math.round(getReputationScore(key as SpecialistType) * 100),
    };
  }

  return pricingWithRep;
}

export function getSpecialists(): any[] {
  const catalogAgents = getRoutingCatalogAgents('testnet');
  const builtInCatalog = new Map(
    catalogAgents
      .filter((agent) => agent.source === 'built-in')
      .map((agent) => [agent.agentId, agent])
  );
  const builtIn = Object.entries(SPECIALIST_DESCRIPTIONS).map(([name, description]) => {
    const catalogAgent = builtInCatalog.get(name);
    const structuredCapabilities = catalogAgent?.capabilities.map((capability) => capability.capability) || [];

    return {
      name,
      description: catalogAgent?.description || description,
      fee: String((config.fees as any)[name] || catalogAgent?.defaultPrice || 0),
      success_rate: Math.round(getReputationScore(name as SpecialistType) * 100),
      external: false,
      structuredCapabilities,
    };
  });

  const external = catalogAgents
    .filter((agent) => agent.source === 'external' && agent.health.active && agent.health.healthy && agent.externalAgent)
    .map((agent) => ({
      name: agent.agentId,
      displayName: agent.displayName,
      description: agent.description,
      fee: String(agent.defaultPrice || 0),
      success_rate: 0,
      external: true,
      endpoint: agent.externalAgent?.endpoint,
      wallet: agent.externalAgent?.wallet,
      capabilities: agent.externalAgent?.capabilities,
      structuredCapabilities: agent.capabilities.map((capability) => capability.capability),
      pricing: agent.externalAgent?.pricing,
    }));

  return [...builtIn, ...external];
}
