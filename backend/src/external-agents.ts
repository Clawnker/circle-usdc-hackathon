/**
 * External Agent Registry
 * Manages registration and communication with external agents (non-built-in specialists).
 * External agents register via API, appear in the marketplace, and receive queries via HTTP proxy.
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SpecialistResult, Capability, ExternalAgent, RegisterRequest } from './types';

const DATA_DIR = path.join(__dirname, '../data');
const EXTERNAL_AGENTS_FILE = path.join(DATA_DIR, 'external-agents.json');

// In-memory store, persisted to disk
let externalAgents: Map<string, ExternalAgent> = new Map();

/**
 * Load external agents from disk
 */
function loadAgents(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(EXTERNAL_AGENTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(EXTERNAL_AGENTS_FILE, 'utf8'));
      for (const agent of data) {
        // Migration: ensure structuredCapabilities exist
        if (!agent.structuredCapabilities) {
          agent.structuredCapabilities = agent.capabilities.map((cap: string) => ({
            id: `${agent.id}:${cap}`,
            name: cap,
            description: `Capability ${cap} provided by ${agent.name}`,
            category: 'generic',
            subcategories: [],
            inputs: [],
            outputs: { type: 'json' },
            confidenceScore: 0.8,
            latencyEstimateMs: 1000,
          }));
        }
        externalAgents.set(agent.id, agent);
      }
      console.log(`[ExternalAgents] Loaded ${externalAgents.size} external agents`);
    }
  } catch (err) {
    console.error('[ExternalAgents] Failed to load:', err);
  }
}

/**
 * Save external agents to disk
 */
function saveAgents(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = Array.from(externalAgents.values());
    fs.writeFileSync(EXTERNAL_AGENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[ExternalAgents] Failed to save:', err);
  }
}

// Load on startup
loadAgents();

/**
 * Register a new external agent
 */
export function registerAgent(req: RegisterRequest): ExternalAgent {
  // Generate a slug-style ID from the name
  const id = req.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  
  // Ensure structured capabilities exist (backward compatibility)
  const structuredCapabilities = req.structuredCapabilities || req.capabilities.map(cap => ({
    id: `${id}:${cap}`,
    name: cap,
    description: `Capability ${cap} provided by ${req.name}`,
    category: 'generic' as const,
    subcategories: [],
    inputs: [],
    outputs: { type: 'json' as const },
    confidenceScore: 0.8,
    latencyEstimateMs: 1000,
  }));

  // Check if already registered
  if (externalAgents.has(id)) {
    // Update existing registration
    const existing = externalAgents.get(id)!;
    existing.description = req.description;
    existing.endpoint = req.endpoint;
    existing.wallet = req.wallet;
    existing.capabilities = req.capabilities;
    existing.structuredCapabilities = structuredCapabilities;
    existing.pricing = req.pricing || {};
    existing.chain = req.chain || 'base-sepolia';
    existing.active = true;
    saveAgents();
    console.log(`[ExternalAgents] Updated registration: ${id}`);
    return existing;
  }

  const agent: ExternalAgent = {
    id,
    name: req.name,
    description: req.description,
    endpoint: req.endpoint.replace(/\/$/, ''), // Remove trailing slash
    wallet: req.wallet,
    capabilities: req.capabilities,
    structuredCapabilities,
    pricing: req.pricing || {},
    chain: req.chain || 'base-sepolia',
    x402Support: true,
    erc8004: { registered: true },
    registeredAt: new Date().toISOString(),
    healthy: true, // Assume healthy until proven otherwise
    active: true,
  };

  externalAgents.set(id, agent);
  saveAgents();

  // Trigger embedding sync (non-blocking)
  import('./capability-matcher').then(({ capabilityMatcher }) => {
    capabilityMatcher.syncAgentEmbeddings(id, structuredCapabilities).catch(err => {
      console.error(`[ExternalAgents] Failed to sync embeddings for ${id}:`, err);
    });
  });

  // Also update the registrations.json for the /api/agents endpoint
  updateRegistrationsJson(agent);

  console.log(`[ExternalAgents] Registered new agent: ${id} -> ${agent.endpoint}`);
  return agent;
}

/**
 * Append to the main registrations.json so it shows up in /api/agents
 */
function updateRegistrationsJson(agent: ExternalAgent): void {
  try {
    const regFile = path.join(__dirname, '../../agents/registrations.json');
    const registrations = JSON.parse(fs.readFileSync(regFile, 'utf8'));
    
    // Check if agent already exists in registrations
    const existingIdx = registrations.findIndex((r: any) => r.name === agent.name);
    
    const registration = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: agent.name,
      description: agent.description,
      image: `${agent.endpoint}/icon.png`,
      services: [
        {
          name: "x402-endpoint",
          endpoint: agent.endpoint,
        },
        ...(agent.capabilities.map(cap => ({
          name: cap,
          endpoint: `${agent.endpoint}/${cap.replace('security-', '')}`,
        }))),
      ],
      x402Support: agent.x402Support,
      active: agent.active,
      registrations: [],
      supportedTrust: ["reputation"],
      external: true, // Mark as externally registered
      wallet: agent.wallet,
      capabilities: agent.capabilities,
      pricing: agent.pricing,
    };

    if (existingIdx >= 0) {
      registrations[existingIdx] = registration;
    } else {
      registrations.push(registration);
    }

    fs.writeFileSync(regFile, JSON.stringify(registrations, null, 2), 'utf8');
    console.log(`[ExternalAgents] Updated registrations.json with ${agent.name}`);
  } catch (err) {
    console.error('[ExternalAgents] Failed to update registrations.json:', err);
  }
}

/**
 * Get all external agents
 */
export function getExternalAgents(): ExternalAgent[] {
  return Array.from(externalAgents.values());
}

/**
 * Get a specific external agent
 */
export function getExternalAgent(id: string): ExternalAgent | undefined {
  return externalAgents.get(id);
}

/**
 * Remove an external agent
 */
export function removeAgent(id: string): boolean {
  const existed = externalAgents.delete(id);
  if (existed) saveAgents();
  return existed;
}

/**
 * Health check an external agent
 */
export async function healthCheckAgent(id: string): Promise<boolean> {
  const agent = externalAgents.get(id);
  if (!agent) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(`${agent.endpoint}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const healthy = res.ok;
    agent.healthy = healthy;
    agent.lastHealthCheck = new Date().toISOString();
    saveAgents();
    
    return healthy;
  } catch (err) {
    agent.healthy = false;
    agent.lastHealthCheck = new Date().toISOString();
    saveAgents();
    return false;
  }
}

/**
 * Call an external agent with a prompt/task
 * Proxies the request to the agent's endpoint and returns the result
 */
export async function callExternalAgent(id: string, prompt: string, taskType?: string): Promise<SpecialistResult> {
  const startTime = Date.now();
  const agent = externalAgents.get(id);
  
  if (!agent) {
    return {
      success: false,
      data: { error: `External agent '${id}' not found` },
      timestamp: new Date(),
      executionTimeMs: Date.now() - startTime,
    };
  }

  if (!agent.active || !agent.healthy) {
    return {
      success: false,
      data: { error: `External agent '${id}' is ${!agent.active ? 'inactive' : 'unhealthy'}` },
      timestamp: new Date(),
      executionTimeMs: Date.now() - startTime,
    };
  }

  try {
    // Determine which endpoint to call based on taskType or capabilities
    const effectiveType = taskType || agent.capabilities[0] || 'execute';
    let url: string;
    
    // Map task types to Sentinel-style endpoints
    if (effectiveType === 'security-audit' || effectiveType === 'audit') {
      url = `${agent.endpoint}/audit`;
    } else {
      url = `${agent.endpoint}/execute`;
    }

    console.log(`[ExternalAgents] Calling ${agent.name} at ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-402-Payment': 'demo-payment-signature', // For x402 gating
      },
      body: JSON.stringify({
        prompt,
        taskType: effectiveType,
        // For Sentinel-specific audit endpoint
        contractAddress: extractContractAddress(prompt),
        chain: 'base-sepolia',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Handle 402 (payment required) — expected from x402-gated agents
    if (res.status === 402) {
      const paymentInfo = await res.json() as any;
      return {
        success: false,
        data: {
          paymentRequired: true,
          ...paymentInfo,
          agentName: agent.name,
          agentEndpoint: agent.endpoint,
        },
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
        cost: {
          amount: String(paymentInfo.price || agent.pricing[effectiveType] || 0),
          currency: paymentInfo.currency || 'USDC',
          network: 'base' as const,
          recipient: agent.wallet,
        },
      };
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Agent returned ${res.status}: ${errorText}`);
    }

    const result = await res.json() as any;
    
    // Update health status
    agent.healthy = true;
    agent.lastHealthCheck = new Date().toISOString();
    saveAgents();

    return {
      success: true,
      data: {
        ...result,
        externalAgent: agent.name,
        agentId: agent.id,
      },
      confidence: result.analysis?.score ? result.analysis.score / 100 : 0.8,
      timestamp: new Date(),
      executionTimeMs: Date.now() - startTime,
      cost: {
        amount: String(agent.pricing[effectiveType] || agent.pricing['generic'] || 0),
        currency: 'USDC',
        network: 'base',
        recipient: agent.wallet,
      },
    };
  } catch (err: any) {
    console.error(`[ExternalAgents] Call to ${agent.name} failed:`, err.message);
    
    // Mark as unhealthy if connection failed
    if (err.name === 'AbortError' || err.code === 'ECONNREFUSED') {
      agent.healthy = false;
      saveAgents();
    }

    return {
      success: false,
      data: { error: err.message, agentName: agent.name },
      timestamp: new Date(),
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Extract a contract address from a prompt string
 */
function extractContractAddress(prompt: string): string | undefined {
  const match = prompt.match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0] : undefined;
}

/**
 * Check if a specialist ID refers to an external agent
 */
export function isExternalAgent(specialistId: string): boolean {
  return externalAgents.has(specialistId);
}

export default {
  registerAgent,
  getExternalAgents,
  getExternalAgent,
  removeAgent,
  healthCheckAgent,
  callExternalAgent,
  isExternalAgent,
};
