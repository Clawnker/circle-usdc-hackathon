/**
 * Capability-Based Matching Engine
 * Matches user intents to agent capabilities using semantic vector similarity and scoring.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Capability, UserIntent, RankedAgent, SpecialistType } from './types';
import { getExternalAgents } from './external-agents';
import { getReputationScore, getReputationStats } from './reputation';
import { priceRouter } from './price-router';
import { config } from './config';
import { chatJSON, MODELS } from './llm-client';

const DATA_DIR = path.join(__dirname, '../data');
const EMBEDDINGS_FILE = path.join(DATA_DIR, 'embeddings.json');
const MANIFESTS_DIR = path.join(__dirname, 'specialists/manifests');

/**
 * Service for generating text embeddings using Gemini
 */
export class EmbeddingService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  }

  /**
   * Generate an embedding vector for a given text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Node 18+ has global fetch — no need for node-fetch
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini Embedding API error: ${response.status} ${error}`);
    }

    const data: any = await response.json();
    return data.embedding.values;
  }

  /**
   * Batch generate embeddings
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    // Gemini supports batch embedding calls, but for simplicity we'll do them sequentially or in small groups
    // given the scale of our agents.
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }
}

/**
 * Main Capability Matching Engine
 */
export class CapabilityMatcher {
  private embeddingService: EmbeddingService;
  private vectorStore: Map<string, number[][]> = new Map(); // agentId -> vectors[]
  public specialistManifests: Map<string, Capability[]> = new Map();

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.loadManifests();
    this.loadEmbeddings();

    // Background sync of missing embeddings (skip in tests to avoid open handles/noise)
    if (process.env.NODE_ENV !== 'test') {
      this.initializeEmbeddings().catch(err => console.error('[CapabilityMatcher] Init failed:', err));
    }
  }

  /**
   * Ensure all specialists and external agents have embeddings
   */
  private async initializeEmbeddings(): Promise<void> {
    // Wait for a few seconds to let everything load
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('[CapabilityMatcher] Checking for missing embeddings...');

    // 1. Built-in specialists from manifests
    for (const [id, capabilities] of this.specialistManifests.entries()) {
      if (!this.vectorStore.has(id)) {
        console.log(`[CapabilityMatcher] Generating embeddings for built-in: ${id}`);
        await this.syncAgentEmbeddings(id, capabilities);
      }
    }

    // 2. External agents
    const externalAgents = getExternalAgents();
    for (const agent of externalAgents) {
      if (!this.vectorStore.has(agent.id)) {
        console.log(`[CapabilityMatcher] Generating embeddings for external: ${agent.id}`);
        await this.syncAgentEmbeddings(agent.id, agent.structuredCapabilities);
      }
    }
  }

  /**
   * Load specialist manifests from disk
   */
  private loadManifests(): void {
    try {
      if (!fs.existsSync(MANIFESTS_DIR)) {
        fs.mkdirSync(MANIFESTS_DIR, { recursive: true });
        return;
      }

      const files = fs.readdirSync(MANIFESTS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const specialistId = file.replace('.json', '');
          const manifest = JSON.parse(fs.readFileSync(path.join(MANIFESTS_DIR, file), 'utf8'));
          this.specialistManifests.set(specialistId, manifest);
        }
      }
      console.log(`[CapabilityMatcher] Loaded ${this.specialistManifests.size} specialist manifests`);
    } catch (err) {
      console.error('[CapabilityMatcher] Failed to load manifests:', err);
    }
  }

  /**
   * Load embeddings from persistence
   */
  private loadEmbeddings(): void {
    try {
      if (fs.existsSync(EMBEDDINGS_FILE)) {
        const data = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf8'));
        for (const [agentId, vectors] of Object.entries(data)) {
          this.vectorStore.set(agentId, vectors as number[][]);
        }
        console.log(`[CapabilityMatcher] Loaded embeddings for ${this.vectorStore.size} agents`);
      }
    } catch (err) {
      console.error('[CapabilityMatcher] Failed to load embeddings:', err);
    }
  }

  /**
   * Save embeddings to disk
   */
  private saveEmbeddings(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = Object.fromEntries(this.vectorStore);
      fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[CapabilityMatcher] Failed to save embeddings:', err);
    }
  }

  private async callGeminiFlash(systemPrompt: string, prompt: string): Promise<UserIntent> {
    const { data } = await chatJSON(systemPrompt, prompt, {
      model: MODELS.fast,
      caller: 'capability-matcher',
      temperature: 0.1,
      maxTokens: 500,
    });
    return data as UserIntent;
  }

  /**
   * Extract user intent from prompt using LLM
   */
  async extractIntent(prompt: string): Promise<UserIntent> {
    const systemPrompt = `You are an Intent Extractor for Hivemind Protocol.
Your goal is to transform a raw user prompt into a structured Intent Object.

Available categories: defi, security, social, research, dev, generic

Return ONLY a JSON object in this format:
{
  "category": "category_name",
  "requiredCapabilities": ["semantic description of needed capability", ...],
  "constraints": {
    "maxFee": number,
    "preferredNetwork": "string",
    "minSuccessRate": number
  },
  "entities": {
    "tokens": ["SYMBOL", ...],
    "addresses": ["0x...", ...],
    "protocols": ["name", ...]
  }
}

Example: "Audit this contract 0x123... on Base"
{
  "category": "security",
  "requiredCapabilities": ["smart contract security audit", "vulnerability scanning"],
  "constraints": { "preferredNetwork": "base" },
  "entities": { "addresses": ["0x123..."] }
}`;

    try {
      const data = await this.callGeminiFlash(systemPrompt, prompt);
      if (typeof data === 'string') {
        return JSON.parse(data) as UserIntent;
      }
      return data;
    } catch (err) {
      console.error('[CapabilityMatcher] Intent extraction failed:', err);
      return {
        category: 'generic',
        requiredCapabilities: [prompt || 'An internal error occurred during intent extraction.'],
        constraints: {},
        entities: {}
      };
    }
  }

  /**
   * Match agents against user intent
   */
  async matchAgents(intent: UserIntent): Promise<RankedAgent[]> {
    const queryText = intent.requiredCapabilities.join(' ') + ' ' + intent.category;
    const queryVector = await this.embeddingService.generateEmbedding(queryText);

    const candidates: RankedAgent[] = [];

    // 1. Get all agents (built-in + external)
    const builtInAgents = Array.from(this.specialistManifests.keys());
    const externalAgents = getExternalAgents();

    const allAgents = [
      ...builtInAgents.map(id => ({ id, capabilities: this.specialistManifests.get(id) || [] })),
      ...externalAgents.map(a => ({ id: a.id, capabilities: a.structuredCapabilities }))
    ];

    for (const agent of allAgents) {
      const agentVectors = this.vectorStore.get(agent.id);
      if (!agentVectors || agentVectors.length === 0) {
        // Skip if no embeddings (might need to generate them)
        continue;
      }

      // S_semantic: Max cosine similarity
      let maxSim = 0;
      let bestCapIdx = -1;
      for (let i = 0; i < agentVectors.length; i++) {
        const sim = this.cosineSimilarity(queryVector, agentVectors[i]);
        if (sim > maxSim) {
          maxSim = sim;
          bestCapIdx = i;
        }
      }

      if (maxSim < 0.6) continue; // Threshold lowered from 0.75 to 0.6 to capture sentence-to-keyword matches

      // Determine price for the matched capability
      const matchedCap = agent.capabilities[bestCapIdx];
      const capabilityId = matchedCap ? matchedCap.id : 'generic';
      
      let agentPrice = 0;
      if (config.fees[agent.id as keyof typeof config.fees] !== undefined) {
        agentPrice = config.fees[agent.id as keyof typeof config.fees];
      } else {
        const extAgent = externalAgents.find(a => a.id === agent.id);
        if (extAgent) {
          agentPrice = extAgent.pricing[capabilityId] ?? extAgent.pricing['generic'] ?? 0;
        }
      }

      const marketData = priceRouter.getMarketData(capabilityId);
      const priceEfficiency = priceRouter.calculatePriceEfficiency(agentPrice, marketData.average);

      // S_reputation
      let reputation = getReputationScore(agent.id);
      
      // Phase 2e: Health-Weighted Scoring
      const extAgent = externalAgents.find(a => a.id === agent.id);
      let isHealthy = extAgent ? extAgent.healthy : true; // Built-in are always healthy
      
      // Health-check freshness gate: if last health check > 5 min ago, treat as stale
      if (extAgent && extAgent.lastHealthCheck) {
        const lastCheck = new Date(extAgent.lastHealthCheck).getTime();
        const fiveMinAgo = Date.now() - 5 * 60 * 1000;
        if (lastCheck < fiveMinAgo) {
          isHealthy = false; // Stale health check — penalize until re-checked
        }
      }
      
      // Penalty: If unhealthy or stale, score is 0
      const healthPenalty = isHealthy ? 1.0 : 0.0;

      // Latency Penalty: If Latency_avg > Latency_target * 2, reputation is halved
      // (Target latency is 15s per SPEC-2DE timeout, so penalty if > 30s)
      // Actually, Capability metrics have p50/p95.
      const repData = getReputationStats(agent.id);
      const capabilities = (repData?.capabilities || {}) as Record<string, any>;
      const avgLatency = capabilities[capabilityId]?.p50 || 0;
      if (avgLatency > 30000) { // 30s threshold
        reputation *= 0.5;
      }

      // Updated weights per SPEC-2DE: semantic 0.4, reputation 0.3, price 0.3
      const score = ((maxSim * 0.4) + (reputation * 0.3) + (priceEfficiency * 0.3)) * healthPenalty;

      candidates.push({
        agentId: agent.id,
        score,
        confidence: maxSim,
        reasoning: `Matched via semantic similarity (${maxSim.toFixed(2)}), reputation (${reputation.toFixed(2)}), and price efficiency (${priceEfficiency.toFixed(2)}).`
      });
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  /**
   * Generate embeddings for an agent's capabilities
   */
  async syncAgentEmbeddings(agentId: string, capabilities: Capability[]): Promise<void> {
    const texts = capabilities.map(c => `${c.name}: ${c.description} (${c.category}) ${c.subcategories.join(' ')}`);
    const vectors = await this.embeddingService.generateBatchEmbeddings(texts);
    this.vectorStore.set(agentId, vectors);
    this.saveEmbeddings();
  }

  /**
   * Helper: Cosine Similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let mA = 0;
    let mB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      mA += a[i] * a[i];
      mB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
  }

}

// Singleton instance
export const capabilityMatcher = new CapabilityMatcher();
