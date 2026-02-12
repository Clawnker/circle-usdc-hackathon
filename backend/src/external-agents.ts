/**
 * External Agent Registry
 * Manages registration and communication with external agents.
 * ERC-8128: Outgoing requests to compatible agents are signed with the Hivemind wallet.
 * x402: Handles payment-required responses by completing on-chain USDC payments.
 */

import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SpecialistResult, Capability, ExternalAgent, RegisterRequest } from './types';

// Use require to avoid tsc following transitive type issues
const { createSignerClient } = require('@slicekit/erc8128');
const { x402Client, x402HTTPClient } = require('@x402/core/client');
const { registerExactEvmScheme } = require('@x402/evm/exact/client');

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

// ── x402 Payment Client (for paying external agents) ──────────────────
let x402HttpClient: any = null;

if (privateKey) {
  try {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const client = new x402Client();
    registerExactEvmScheme(client, { signer: account });
    x402HttpClient = new x402HTTPClient(client);
    console.log(`[ExternalAgents] x402 payment client ready: ${account.address}`);
  } catch (err) {
    console.error('[ExternalAgents] Failed to init x402 client:', err);
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

        // Handle 402 (payment required) — complete x402 payment and retry
        if (res.status === 402) {
          console.log(`[ExternalAgents] ${agent.name} requires payment at ${path}`);
          
          if (!x402HttpClient) {
            console.error(`[ExternalAgents] x402 client not configured — cannot pay ${agent.name}`);
            clearTimeout(timeout);
            return {
              success: false,
              data: { error: 'x402 payment client not configured', paymentRequired: true },
              timestamp: new Date(),
              executionTimeMs: Date.now() - startTime,
            };
          }

          try {
            // Parse the payment-required header (base64 JSON)
            const paymentRequiredHeader = res.headers.get('payment-required');
            if (!paymentRequiredHeader) {
              throw new Error('402 response missing payment-required header');
            }

            const paymentRequired = JSON.parse(Buffer.from(paymentRequiredHeader, 'base64').toString());
            console.log(`[ExternalAgents] Payment requirements:`, JSON.stringify({
              accepts: paymentRequired.accepts?.map((a: any) => ({ scheme: a.scheme, network: a.network, amount: a.amount })),
              resource: paymentRequired.resource?.url,
            }));

            // Create payment payload (signs EIP-3009 TransferWithAuthorization)
            const paymentPayload = await x402HttpClient.createPaymentPayload(paymentRequired);
            console.log(`[ExternalAgents] Payment payload created, retrying with payment...`);

            // Encode payment into HTTP headers
            const paymentHeaders = x402HttpClient.encodePaymentSignatureHeader(paymentPayload);

            // Retry the request with the payment proof
            const paidRes = await fetch(url, {
              method: 'POST',
              headers: {
                ...headers,
                ...paymentHeaders,
              },
              body: JSON.stringify(requestBody),
              signal: controller.signal,
            });

            if (paidRes.ok) {
              clearTimeout(timeout);
              successfulResponse = await paidRes.json();
              
              // Extract settlement info if present
              let settleTxHash: string | undefined;
              try {
                const settleResponse = x402HttpClient.getPaymentSettleResponse(
                  (name: string) => paidRes.headers.get(name)
                );
                settleTxHash = settleResponse?.txHash;
              } catch {}
              
              console.log(`[ExternalAgents] ${agent.name} paid + responded successfully! tx: ${settleTxHash || 'pending'}`);
              
              // Attach payment metadata to the response
              successfulResponse._x402Payment = {
                paid: true,
                amount: paymentRequired.accepts?.[0]?.amount,
                network: paymentRequired.accepts?.[0]?.network,
                payTo: paymentRequired.accepts?.[0]?.payTo,
                txHash: settleTxHash,
              };
              break; // Success!
            } else {
              const errorText = await paidRes.text();
              console.error(`[ExternalAgents] Payment sent but agent returned ${paidRes.status}: ${errorText}`);
              throw new Error(`Payment sent but agent returned ${paidRes.status}: ${errorText}`);
            }
          } catch (payErr: any) {
            console.error(`[ExternalAgents] x402 payment flow failed for ${agent.name}:`, payErr.message);
            lastError = payErr;
            // Don't try other paths — payment failure is definitive for this agent
            break;
          }
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
    
    // Extract x402 payment info if present
    const x402Payment = result._x402Payment;
    delete result._x402Payment;

    return {
      success: true,
      data: {
        ...result,
        externalAgent: agent.name,
        agentId: agent.id,
        ...(x402Payment ? { x402Payment } : {}),
      },
      confidence,
      timestamp: new Date(),
      executionTimeMs: Date.now() - startTime,
      cost: {
        amount: x402Payment?.amount 
          ? String(Number(x402Payment.amount) / 1_000_000) // Convert from micro-USDC
          : String(agent.pricing[effectiveType] || agent.pricing['generic'] || 0),
        currency: 'USDC',
        network: 'base',
        recipient: x402Payment?.payTo || agent.wallet,
        txHash: x402Payment?.txHash,
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
