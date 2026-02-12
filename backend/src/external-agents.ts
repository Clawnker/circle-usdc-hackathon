/**
 * External Agent Registry
 * Manages registration and communication with external agents.
 * ERC-8128: Outgoing requests to compatible agents are signed with the Hivemind wallet.
 */

import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SpecialistResult, Capability, ExternalAgent, RegisterRequest } from './types';

// Use require to avoid tsc following @slicekit/erc8128's ox dependency types
const { createSignerClient } = require('@slicekit/erc8128');

const DATA_DIR = path.join(__dirname, '../data');
const EXTERNAL_AGENTS_FILE = path.join(DATA_DIR, 'external-agents.json');

// ── ERC-8128 Signer (for outgoing requests) ───────────────────────────
const privateKey = process.env.DEMO_WALLET_PRIVATE_KEY;
let signerClient: any = null;
let signerAddress: string | null = null;

if (privateKey) {
  try {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    signerAddress = account.address;
    signerClient = createSignerClient({
      chainId: baseSepolia.id,
      address: account.address,
      signMessage: async (message: any) => {
        return await account.signMessage({ message: { raw: message } });
      },
    });
    console.log(`[ExternalAgents] ERC-8128 signer ready: ${account.address}`);
  } catch (err) {
    console.error('[ExternalAgents] Failed to init ERC-8128 signer:', err);
  }
}

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
    erc8128Support: req.erc8128Support || false,
    erc8004: { registered: true },
    registeredAt: new Date().toISOString(),
    healthy: true, // Assume healthy until proven otherwise
    active: true,
  };

  externalAgents.set(id, agent);
  saveAgents();

  // Trigger embedding sync (non-blocking)
  import('./capability-matcher.js').then(({ capabilityMatcher }) => {
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
      erc8128Support: agent.erc8128Support,
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
    
    // Candidate paths to try (in order)
    // Some agents use /execute, others use /api/v1/execute, etc.
    const pathsToTry = [
      '/execute', 
      '/api/v1/execute', 
      '/api/execute', 
      '/v1/execute',
      '/audit',
      '/api/v1/audit',
      '/chat',
      '/api/v1/chat',
      '/x402/chat', // Minara-style
      '/x402/execute',
      '/' // Root fallback
    ];

    // Priority paths based on task type
    if (effectiveType === 'security-audit' || effectiveType === 'audit') {
      pathsToTry.unshift('/audit', '/api/v1/audit');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const requestBody = {
      prompt,
      taskType: effectiveType,
      // For Sentinel-specific audit endpoint
      contractAddress: extractContractAddress(prompt),
      chain: 'base-sepolia',
    };

    let lastError: any;
    let successfulResponse: any = null;

    // Try paths sequentially
    for (const path of pathsToTry) {
      const url = `${agent.endpoint.replace(/\/$/, '')}${path}`;
      console.log(`[ExternalAgents] Trying ${agent.name} at ${url}`);

      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-402-Payment': 'demo-payment-signature', // For x402 gating
      };

      // Use ERC-8128 signing if the agent supports it and we have a signer
      if (agent.erc8128Support && signerClient) {
        try {
          const signedRequest = await signerClient.signRequest(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
          });
          const newHeaders: Record<string, string> = {};
          signedRequest.headers.forEach((v: string, k: string) => {
            newHeaders[k] = v;
          });
          headers = newHeaders;
        } catch (err) {
          console.error(`[ExternalAgents] ERC-8128 signing failed for ${url}:`, err);
        }
      }

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        // Handle 402 (payment required) — success signal for reachability
        if (res.status === 402) {
          clearTimeout(timeout);
          const paymentInfo = await res.json() as any;
          console.log(`[ExternalAgents] ${agent.name} requested payment at ${path}:`, paymentInfo);
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

        if (res.ok) {
          clearTimeout(timeout);
          successfulResponse = await res.json();
          console.log(`[ExternalAgents] ${agent.name} success at ${path}`);
          break; // Stop trying paths
        } else {
          // If 404 or 405, try next path
          if (res.status === 404 || res.status === 405) {
            console.log(`[ExternalAgents] ${path} returned ${res.status}, trying next...`);
            continue;
          }
          const errorText = await res.text();
          throw new Error(`Agent returned ${res.status}: ${errorText}`);
        }
      } catch (err: any) {
        lastError = err;
        // Continue to next path if connection error or 404/405 (handled above)
        // If timeout/abort, we should stop?
        if (err.name === 'AbortError') throw err; 
      }
    }
    
    clearTimeout(timeout);

    if (!successfulResponse) {
      throw lastError || new Error(`Failed to find working endpoint for ${agent.name}`);
    }

    const result = successfulResponse;
    console.log(`[ExternalAgents] ${agent.name} response received:`, JSON.stringify(result).slice(0, 500) + '...');
    
    // Check for null data which indicates a failed or empty analysis
    if (result === null || (result.data === null && !result.error)) {
      console.warn(`[ExternalAgents] ${agent.name} returned null data. This usually means contract address was missing.`);
      return {
        success: false,
        data: { 
          error: `External agent ${agent.name} returned no data. Please ensure your prompt includes a valid contract address (0x...) for auditing.`,
          agentName: agent.name 
        },
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Update health status
    agent.healthy = true;
    agent.lastHealthCheck = new Date().toISOString();
    saveAgents();

    // Extract analysis score for confidence (handle nested result.data if present)
    const agentData = result.data || result;
    const confidence = agentData.analysis?.score ? agentData.analysis.score / 100 : 0.8;

    return {
      success: true,
      data: {
        ...result,
        externalAgent: agent.name,
        agentId: agent.id,
      },
      confidence,
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
