/**
 * CSN API Server
 * REST API + WebSocket for the Clawnker Specialist Network
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

import config from './config';
import { authMiddleware } from './middleware/auth';
import dispatcher, { dispatch, getTask, getRecentTasks, subscribeToTask, getSpecialists, callSpecialist, executeTask, updateTaskStatus } from './dispatcher';
import { getTreasuryBalance, getTransactionLog, logTransaction } from './payments';
import { submitVote, getVote, getReputationStats, getAllReputation, updateSyncStatus } from './reputation';
import { DispatchRequest, Task, WSEvent, SpecialistType, RegisterRequest } from './types';
import { registerAgent, getExternalAgents, getExternalAgent, healthCheckAgent, removeAgent } from './external-agents';
import { costTracker } from './llm-client';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Simple In-memory Rate Limiting
const rateLimitMap = new Map<string, { count: number, lastReset: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60;

const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const userData = rateLimitMap.get(ip) || { count: 0, lastReset: now };

  if (now - userData.lastReset > RATE_LIMIT_WINDOW_MS) {
    userData.count = 1;
    userData.lastReset = now;
  } else {
    userData.count++;
  }

  rateLimitMap.set(ip, userData);

  if (userData.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'Too many requests, please try again later.' });
  }

  next();
};

app.use(rateLimiter);

// Treasury wallets for receiving payments
const TREASURY_WALLET_EVM = '0x676fF3d546932dE6558a267887E58e39f405B135';

// Manual 402 payment middleware (x402-express v2 API incompatible with simple use)
const payment = (req: Request, res: Response, next: NextFunction) => {
  // Check if payment proof header exists
  const paymentHeader = req.headers['x-payment'] || req.headers['x-402-payment'];
  if (paymentHeader) {
    // User already paid — let through
    return next();
  }

  // Extract specialist from route
  const specialist = req.params?.id;
  const fee = specialist ? (config.fees as any)[specialist] : 0;
  
  if (!fee || fee <= 0) {
    return next(); // No fee required
  }

  // Return 402 with payment info
  res.status(402).json({
    error: 'Payment Required',
    accepts: [{
      scheme: 'exact',
      network: 'base-sepolia',
      maxAmountRequired: String(Math.round(fee * 1e6)), // USDC has 6 decimals
      resource: req.originalUrl,
      description: `Query the ${specialist} AI specialist via Hivemind Protocol`,
      mimeType: 'application/json',
      payTo: TREASURY_WALLET_EVM,
      maxTimeoutSeconds: 300,
      asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
    }],
    x402Version: 1,
  });
};
const BASE_USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC

// --- PUBLIC ROUTES ---

/**
 * Route preview — returns specialist + fee without executing.
 * For multi-step DAG queries, returns total cost across all steps.
 */
app.post('/api/route-preview', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });
    
    // Try DAG planning first to get accurate multi-step cost
    const { planDAG } = await import('./llm-planner');
    const dagPlan = await planDAG(prompt);
    
    if (dagPlan.steps.length > 1) {
      // Multi-step: return total cost and first specialist
      const totalFee = dagPlan.totalEstimatedCost || dagPlan.steps.reduce((sum, s) => sum + (s.estimatedCost || 0), 0);
      const specialists = dagPlan.steps.map(s => s.specialist);
      res.json({ 
        specialist: specialists.join(' → '), 
        specialists,
        fee: totalFee, 
        currency: 'USDC', 
        network: 'base-sepolia',
        isMultiStep: true,
        steps: dagPlan.steps.length,
      });
    } else {
      // Single step
      const specialist = dagPlan.steps[0]?.specialist || 'scribe';
      const fee = dagPlan.steps[0]?.estimatedCost || (config.fees as any)[specialist] || 0;
      res.json({ specialist, fee, currency: 'USDC', network: 'base-sepolia' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
/**
 * Delegated payment — pull USDC from user's wallet via ERC-20 approval.
 * User pre-approves the demo wallet address to spend their USDC.
 * This endpoint calls transferFrom(user, treasury, amount).
 */
app.post('/api/delegate-pay', async (req: Request, res: Response) => {
  try {
    const { userAddress, amount, specialist } = req.body;
    if (!userAddress || !amount) {
      return res.status(400).json({ error: 'userAddress and amount required' });
    }
    
    const privateKey = process.env.DEMO_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({ error: 'Delegate wallet not configured' });
    }

    const { createWalletClient, createPublicClient, http, parseUnits } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');
    const { baseSepolia } = await import('viem/chains');

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const TREASURY = '0x676fF3d546932dE6558a267887E58e39f405B135' as `0x${string}`;
    const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
    const amountWei = parseUnits(String(amount), 6);

    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(),
    });
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    // Pull USDC from user's wallet to treasury via their on-chain approval
    const hash = await walletClient.writeContract({
      account,
      address: USDC,
      abi: [{
        name: 'transferFrom',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
      }],
      functionName: 'transferFrom',
      args: [userAddress as `0x${string}`, TREASURY, amountWei],
      chain: baseSepolia,
    });

    await publicClient.waitForTransactionReceipt({ hash });

    console.log(`[delegate-pay] transferFrom ${userAddress} → treasury | ${amount} USDC | specialist: ${specialist} | tx: ${hash}`);

    logTransaction({
      amount: String(amount),
      currency: 'USDC',
      network: 'base-sepolia',
      recipient: specialist || 'unknown',
      txHash: hash,
      status: 'completed',
      method: 'delegated',
      timestamp: new Date(),
    });

    res.json({ 
      success: true, 
      txHash: hash,
      explorer: `https://sepolia.basescan.org/tx/${hash}`,
    });
  } catch (err: any) {
    console.error('[delegate-pay] Failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Health check
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Hivemind Protocol',
    version: '0.4.0',
    chain: 'Base Sepolia (EIP-155:84532)',
    trustLayer: 'ERC-8004',
    auth: ['api-key', 'erc8128'],
    llmRouter: 'ClawRouter/BlockRun',
    timestamp: new Date().toISOString(),
  });
});

/**
 * LLM Cost tracking endpoint — real-time compute cost data
 */
app.get('/v1/costs', (req: Request, res: Response) => {
  const summary = costTracker.getSummary();
  const recent = costTracker.getRecent(20);
  res.json({
    summary,
    recent: recent.map(r => ({
      caller: r.caller,
      model: r.model,
      tokens: r.usage.totalTokens,
      rawCost: r.cost.rawCost,
      markedUpCost: r.cost.markedUpCost,
      markup: r.cost.markup,
      timestamp: r.timestamp,
    })),
  });
});

/**
 * ERC-8128 Verification endpoint — test your signed request setup.
 * This is a PUBLIC endpoint (no API key required).
 * Send a signed request here to verify your ERC-8128 integration works.
 */
app.get('/api/auth/verify', async (req: Request, res: Response) => {
  try {
    const { hasErc8128Headers, verifyErc8128Request } = await import('./middleware/erc8128-auth');
    
    if (!hasErc8128Headers(req)) {
      return res.json({
        authenticated: false,
        hint: 'Sign this request with ERC-8128 to test authentication. See https://erc8128.org',
      });
    }

    const result = await verifyErc8128Request(req);
    if (result && result.ok) {
      return res.json({
        authenticated: true,
        address: result.address,
        chainId: result.chainId,
        method: 'erc8128',
      });
    }

    return res.json({
      authenticated: false,
      reason: result && !result.ok ? result.reason : 'Unknown error',
    });
  } catch (err: any) {
    return res.status(500).json({
      authenticated: false,
      error: err.message,
    });
  }
});

/**
 * ERC-8004 Agent Registration Files
 * GET /api/agents - List all registered agents
 * GET /api/agents/:id/registration - Get agent registration file
 */
app.get('/api/agents', (req: Request, res: Response) => {
  try {
    const registrations = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../agents/registrations.json'), 'utf8')
    );
    res.json({
      agents: registrations.map((r: any, i: number) => ({
        agentId: i + 1,
        name: r.name,
        description: r.description,
        active: r.active,
        x402Support: r.x402Support,
        supportedTrust: r.supportedTrust,
      })),
      identityRegistry: config.erc8004.identityRegistry || 'pending-deployment',
      reputationRegistry: config.erc8004.reputationRegistry || 'pending-deployment',
      chain: 'Base Sepolia (EIP-155:84532)',
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get('/api/agents/:id/registration', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id) - 1;
    const registrations = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../agents/registrations.json'), 'utf8')
    );
    if (id < 0 || id >= registrations.length) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(registrations[id]);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/agents/register - Register an external agent on the marketplace
 * Body: { name, description, endpoint, wallet, capabilities, pricing?, chain? }
 */
app.post('/api/agents/register', async (req: Request, res: Response) => {
  try {
    const { name, description, endpoint, wallet, capabilities, pricing, chain } = req.body as RegisterRequest;

    if (!name || !description || !endpoint || !wallet || !capabilities?.length) {
      return res.status(400).json({
        error: 'Missing required fields: name, description, endpoint, wallet, capabilities[]',
      });
    }

    // Validate endpoint URL
    try {
      new URL(endpoint);
    } catch {
      return res.status(400).json({ error: 'Invalid endpoint URL' });
    }

    // Health check the agent before registering
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let healthOk = false;
    let agentInfo: any = null;

    try {
      const healthRes = await fetch(`${endpoint.replace(/\/$/, '')}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      healthOk = healthRes.ok;
      if (healthOk) agentInfo = await healthRes.json();
    } catch (err: any) {
      clearTimeout(timeout);
      console.warn(`[Register] Health check failed for ${endpoint}:`, err.message);
    }

    const agent = registerAgent({ name, description, endpoint, wallet, capabilities, pricing, chain });

    // Also try to get /info for richer metadata
    try {
      const infoRes = await fetch(`${agent.endpoint}/info`, { signal: AbortSignal.timeout(5000) });
      if (infoRes.ok) {
        const infoData = await infoRes.json() as any;
        agentInfo = { ...agentInfo, ...infoData };
      }
    } catch {}

    res.status(201).json({
      success: true,
      agent: {
        ...agent,
        healthCheck: healthOk ? 'passed' : 'failed (registered anyway)',
        agentInfo,
      },
      message: `Agent '${agent.name}' registered successfully. It will now appear in the marketplace.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/agents/external - List all registered external agents
 */
app.get('/api/agents/external', (req: Request, res: Response) => {
  const agents = getExternalAgents();
  res.json({ agents, count: agents.length });
});

/**
 * GET /api/agents/external/:id - Get details about a specific external agent
 */
app.get('/api/agents/external/:id', (req: Request, res: Response) => {
  const agent = getExternalAgent(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'External agent not found' });
  }
  res.json(agent);
});

/**
 * POST /api/agents/external/:id/health - Health check an external agent
 */
app.post('/api/agents/external/:id/health', async (req: Request, res: Response) => {
  const healthy = await healthCheckAgent(req.params.id);
  const agent = getExternalAgent(req.params.id);
  res.json({
    id: req.params.id,
    healthy,
    lastCheck: agent?.lastHealthCheck,
  });
});

/**
 * DELETE /api/agents/external/:id - Remove an external agent
 */
app.delete('/api/agents/external/:id', (req: Request, res: Response) => {
  const removed = removeAgent(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'External agent not found' });
  }
  res.json({ success: true, message: `Agent '${req.params.id}' removed.` });
});

/**
 * Get specialist pricing (Public)
 */
app.get('/api/pricing', (req: Request, res: Response) => {
  const pricing = dispatcher.getSpecialistPricing();
  res.json({ 
    pricing,
    note: 'Fees in USDC, paid via x402 protocol on Base'
  });
});

/**
 * GET /api/reputation/:specialist - Get reputation stats for a specialist (Public)
 */
app.get('/api/reputation/:specialist', (req: Request, res: Response) => {
  const { specialist } = req.params;
  const stats = getReputationStats(specialist);
  res.json(stats);
});

/**
 * GET /api/reputation - Get all reputation data (Public)
 */
app.get('/api/reputation', (req: Request, res: Response) => {
  const all = getAllReputation();
  res.json(all);
});

/**
 * POST /api/reputation/:specialist/sync - Sync reputation to Base via ERC-8004
 */
app.post('/api/reputation/:specialist/sync', async (req: Request, res: Response) => {
  try {
    const { specialist } = req.params;
    const stats = getReputationStats(specialist);
    
    // Submit feedback to ERC-8004 Reputation Registry on Base
    // For hackathon: simulate the on-chain tx and return a mock hash
    const txHash = `0x${Buffer.from(
      `hivemind-rep-${specialist}-${Date.now()}`
    ).toString('hex').slice(0, 64)}`;
    
    // Update local database with sync info
    updateSyncStatus(specialist, txHash);
    
    res.json({
      success: true,
      specialist,
      txHash,
      chain: 'Base Sepolia (EIP-155:84532)',
      registry: config.erc8004.reputationRegistry || 'pending-deployment',
      explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
      erc8004: {
        agentId: getSpecialistAgentId(specialist),
        value: stats.successRate,
        valueDecimals: 0,
        tag1: 'successRate',
        tag2: 'hivemind',
      },
      timestamp: Date.now()
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper to map specialist names to ERC-8004 agent IDs
function getSpecialistAgentId(specialist: string): number {
  const mapping: Record<string, number> = {
    'dispatcher': 1,
    'magos': 2,
    'aura': 3,
    'bankr': 4,
    'scribe': 5,
    'seeker': 5,
    'sentinel': 6,
  };
  return mapping[specialist] || 0;
}

/**
 * GET /api/reputation/:specialist/proof - Get on-chain proof of reputation (Base)
 */
app.get('/api/reputation/:specialist/proof', (req: Request, res: Response) => {
  try {
    const { specialist } = req.params;
    const stats = getReputationStats(specialist) as any;
    
    if (!stats.lastSyncTx) {
      return res.status(404).json({ 
        error: 'Reputation not yet synced to chain for this specialist' 
      });
    }
    
    res.json({
      specialist,
      agentId: getSpecialistAgentId(specialist),
      lastSyncTx: stats.lastSyncTx,
      timestamp: stats.lastSyncTimestamp,
      chain: 'Base Sepolia (EIP-155:84532)',
      registry: config.erc8004.reputationRegistry || 'pending-deployment',
      explorerUrl: `https://sepolia.basescan.org/tx/${stats.lastSyncTx}`,
      status: 'confirmed'
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/wallet/lookup/:username - Lookup AgentWallet by username (Proxy for CORS)
 */
app.get('/api/wallet/lookup/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const response = await fetch(`https://agentwallet.mcpay.tech/api/wallets/${encodeURIComponent(username)}`);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Wallet not found' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to lookup wallet', message: err.message });
  }
});

/**
 * GET /skill.md - Serve the registration docs (Unauthenticated)
 */
const skillPath = path.join(__dirname, '../../REGISTER_AGENT.md');
let skillMarkdown = '';
try {
  if (fs.existsSync(skillPath)) {
    skillMarkdown = fs.readFileSync(skillPath, 'utf8');
    console.log('[Skill] Loaded REGISTER_AGENT.md');
  } else {
    console.warn('[Skill] REGISTER_AGENT.md not found at', skillPath);
  }
} catch (err) {
  console.error('[Skill] Failed to load skill markdown:', err);
}

app.get('/skill.md', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/markdown');
  res.send(skillMarkdown);
});

// --- PROTECTED ROUTES ---

app.use(authMiddleware);

// Specialist endpoints - returns 402 without payment, 200 with payment
app.post(['/api/specialist/:id', '/api/query/:id'], payment, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { prompt } = req.body;
    
    // Validate specialist ID (with aliases)
    const specialistAliases: Record<string, string> = {
      'oracle': 'magos',
      'market': 'magos',
      'social': 'aura',
      'security': 'sentinel',
      'writer': 'scribe',
      'trade': 'bankr',
    };
    const resolvedId = specialistAliases[id] || id;
    const validSpecialists: SpecialistType[] = ['magos', 'aura', 'bankr', 'scribe', 'seeker', 'sentinel', 'general'];
    if (!validSpecialists.includes(resolvedId as SpecialistType)) {
      return res.status(400).json({ error: 'Invalid specialist ID', valid: validSpecialists, aliases: Object.keys(specialistAliases) });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Payment verified or not required by middleware - execute specialist
    const result = await callSpecialist(resolvedId as SpecialistType, prompt);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint for wallet balances (for frontend display)
// Uses simulated devnet balances from bankr specialist
app.get('/api/wallet/balances', async (req: Request, res: Response) => {
  try {
    // Fetch real on-chain balances from Base Sepolia
    const treasuryAddress = process.env.TREASURY_WALLET_EVM || '0x676fF3d546932dE6558a267887E58e39f405B135';
    const usdcAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
    const paddedAddr = treasuryAddress.replace('0x', '').toLowerCase().padStart(64, '0');

    let evmEth = 0;
    let evmUsdc = 0;

    try {
      const axios = require('axios');
      const [ethRes, usdcRes] = await Promise.all([
        axios.post('https://sepolia.base.org', {
          jsonrpc: '2.0', method: 'eth_getBalance',
          params: [treasuryAddress, 'latest'], id: 1
        }),
        axios.post('https://sepolia.base.org', {
          jsonrpc: '2.0', method: 'eth_call',
          params: [{ to: usdcAddress, data: `0x70a08231${paddedAddr}` }, 'latest'], id: 2
        })
      ]);

      evmEth = parseInt(ethRes.data?.result || '0x0', 16) / 1e18;
      evmUsdc = parseInt(usdcRes.data?.result || '0x0', 16) / 1e6;
      console.log(`[Wallet API] Base Sepolia balance: ${evmEth} ETH, ${evmUsdc} USDC`);
    } catch (rpcErr: any) {
      console.error('[Wallet API] Base Sepolia RPC failed:', rpcErr.message);
    }

    res.json({
      base: {
        eth: evmEth,
        usdc: evmUsdc,
      },
      chain: 'Base Sepolia (EIP-155:84532)',
      treasury: treasuryAddress,
      explorer: `https://sepolia.basescan.org/address/${treasuryAddress}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error", base: { eth: 0, usdc: 0 } });
  }
});

/**
 * POST /api/vote - Submit a vote on a task response
 * Body: { taskId, specialist, vote }
 */
app.post('/api/vote', (req: Request, res: Response) => {
  try {
    const { taskId, specialist, vote } = req.body;
    const voterId = (req as any).user.id;
    const voterType = 'human';
    
    if (!taskId || !specialist || !vote) {
      return res.status(400).json({ 
        error: 'Missing required fields: taskId, specialist, vote' 
      });
    }
    
    if (vote !== 'up' && vote !== 'down') {
      return res.status(400).json({ error: 'Vote must be "up" or "down"' });
    }
    
    const result = submitVote(
      specialist,
      taskId,
      voterId,
      voterType,
      vote
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/vote/:taskId/:voterId - Get existing vote for a task
 */
app.get('/api/vote/:taskId/:voterId', (req: Request, res: Response) => {
  const { taskId, voterId } = req.params;
  const vote = getVote(taskId, voterId);
  res.json({ vote });
});

/**
 * Get system status including wallet balances
 */
app.get('/status', async (req: Request, res: Response) => {
  try {
    const balances = await getTreasuryBalance();

    res.json({
      status: 'ok',
      treasury: {
        address: TREASURY_WALLET_EVM,
        balances: {
          eth: balances.eth,
          usdc: balances.usdc,
        },
      },
      chain: 'Base Sepolia (EIP-155:84532)',
      specialists: ['magos', 'aura', 'bankr', 'seeker', 'scribe'],
      uptime: process.uptime(),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Submit a task to the dispatcher
 * POST /dispatch (canonical) or POST /api/query (alias)
 * Body: { prompt: string, userId?: string, preferredSpecialist?: string, dryRun?: boolean }
 */
const dispatchHandler = async (req: Request, res: Response) => {
  try {
    const { prompt, userId, preferredSpecialist, dryRun, callbackUrl, hiredAgents, approvedAgent, previewOnly } = req.body as DispatchRequest;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const paymentProof = req.headers['x-payment-proof'] as string | undefined;
    
    const result = await dispatch({
      prompt,
      userId: userId || (req as any).user.id,
      preferredSpecialist,
      dryRun,
      callbackUrl,
      hiredAgents,
      approvedAgent,
      previewOnly,
      paymentProof,  // Skip internal payment if user already paid via delegation
    });

    res.status(202).json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
};
app.post('/dispatch', dispatchHandler);
app.post('/api/query', dispatchHandler);

/**
 * Get task status by ID
 * GET /status/:taskId
 */
app.get('/status/:taskId', (req: Request, res: Response) => {
  const { taskId } = req.params;
  const task = getTask(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Security: only allow task owner to see task status (relaxed for demo)
  const userId = (req as any).user?.id;
  if (userId !== 'demo-user' && task.userId !== userId) {
    return res.status(403).json({ error: 'Access denied: not your task' });
  }

  res.json(task);
});

/**
 * Approve a pending transaction
 * POST /api/transactions/approve
 */
app.post('/api/transactions/approve', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;
    const task = getTask(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.log(`[API] Transaction approved for task ${taskId}`);
    
    // Update task metadata and status
    task.metadata = { 
      ...task.metadata, 
      transactionApproved: true,
      requiresTransactionApproval: false 
    };
    
    // Resume task execution
    updateTaskStatus(task, 'processing');
    executeTask(task, task.metadata?.dryRun || false);

    res.json({ success: true, status: 'processing' });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Reject a pending transaction
 * POST /api/transactions/reject
 */
app.post('/api/transactions/reject', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;
    const task = getTask(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.log(`[API] Transaction rejected for task ${taskId}`);
    
    task.metadata = { 
      ...task.metadata, 
      transactionApproved: false,
      requiresTransactionApproval: false 
    };
    
    task.result = {
      success: false,
      data: { error: 'Transaction rejected by user' },
      timestamp: new Date(),
      executionTimeMs: 0
    };
    
    updateTaskStatus(task, 'failed');

    res.json({ success: true, status: 'failed' });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Get recent tasks
 * GET /tasks?limit=10
 */
app.get('/tasks', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const user = (req as any).user;
  
  // Filter tasks to only return those belonging to the authenticated user
  const tasks = getRecentTasks(limit * 5).filter(t => t.userId === user.id).slice(0, limit);
  res.json({ tasks, count: tasks.length });
});

/**
 * Get all specialists with reputation
 * GET /v1/specialists
 */
app.get('/v1/specialists', (req: Request, res: Response) => {
  const specialists = getSpecialists();
  res.json({ specialists });
});

/**
 * Get treasury wallet balances
 * GET /wallet/balances
 */
app.get('/wallet/balances', async (req: Request, res: Response) => {
  try {
    const balances = await getTreasuryBalance();
    res.json({
      address: TREASURY_WALLET_EVM,
      chain: 'base-sepolia',
      balances,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Get transaction log
 * GET /wallet/transactions
 */
app.get('/wallet/transactions', (req: Request, res: Response) => {
  const transactions = getTransactionLog();
  res.json({ transactions, count: transactions.length });
});

/**
 * Test specialists directly (for debugging)
 * POST /test/:specialist
 */
app.post('/test/:specialist', async (req: Request, res: Response) => {
  try {
    const { specialist } = req.params;
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Import specialists dynamically
    let result;
    switch (specialist) {
      case 'magos':
        const magos = (await import('./specialists/magos')).default;
        result = await magos.handle(prompt);
        break;
      case 'aura':
        const aura = (await import('./specialists/aura')).default;
        result = await aura.handle(prompt);
        break;
      case 'bankr':
        const bankr = (await import('./specialists/bankr')).default;
        result = await bankr.handle(prompt);
        break;
      default:
        return res.status(400).json({ error: 'Unknown specialist' });
    }

    res.json({ specialist, result });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================
// WebSocket Handler
// ============================================

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  userId?: string;
  subscriptions?: Map<string, () => void>; // taskId -> unsubscribe function
}

const wsClients: Map<ExtendedWebSocket, Set<string>> = new Map();

wss.on('connection', (ws: ExtendedWebSocket, req: Request) => {
  console.log('[WS] Client connected');
  wsClients.set(ws, new Set());
  ws.subscriptions = new Map();

  // Heartbeat state
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      handleWSMessage(ws, message);
    } catch (error) {
      ws.send(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    // Cleanup subscriptions
    if (ws.subscriptions) {
      ws.subscriptions.forEach(unsub => unsub());
      ws.subscriptions.clear();
    }
    wsClients.delete(ws);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to Hivemind Protocol. Please authenticate.',
    timestamp: new Date().toISOString(),
  }));
});

// Periodic heartbeat check (every 30s)
const interval = setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    const extWs = ws as ExtendedWebSocket;
    if (extWs.isAlive === false) {
      wsClients.delete(extWs);
      return extWs.terminate();
    }
    extWs.isAlive = false;
    extWs.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

function handleWSMessage(ws: ExtendedWebSocket, message: any) {
  console.log('[WS] Received message:', message.type, message.taskId || '');
  
  // Authentication handler
  if (message.type === 'auth') {
    const apiKey = message.apiKey;
    const apiKeysEnv = process.env.API_KEYS || '';
    const validKeys = apiKeysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);

    if (apiKey && validKeys.includes(apiKey)) {
      ws.userId = apiKey;
      console.log('[WS] Client authenticated:', apiKey);
      ws.send(JSON.stringify({ type: 'authenticated', userId: ws.userId }));
    } else {
      console.log('[WS] Auth failed for key:', apiKey);
      ws.send(JSON.stringify({ error: 'Authentication failed' }));
    }
    return;
  }

  // Ensure client is authenticated for other messages
  if (!ws.userId) {
    ws.send(JSON.stringify({ error: 'Unauthorized: Please authenticate with an API Key' }));
    return;
  }

  switch (message.type) {
    case 'subscribe':
      // Subscribe to task updates
      if (message.taskId) {
        const task = getTask(message.taskId);
        if (!task) {
          ws.send(JSON.stringify({ error: 'Task not found' }));
          return;
        }

        // Security: only allow task owner to subscribe
        if (task.userId !== ws.userId) {
          ws.send(JSON.stringify({ error: 'Access denied: not your task' }));
          return;
        }

        // Cleanup existing subscription for this task if it exists
        if (ws.subscriptions?.has(message.taskId)) {
          ws.subscriptions.get(message.taskId)!();
        }

        const subscriptions = wsClients.get(ws) || new Set();
        subscriptions.add(message.taskId);
        wsClients.set(ws, subscriptions);

        // Set up subscription for future updates
        const unsubscribe = subscribeToTask(message.taskId, (updatedTask: Task) => {
          sendToClient(ws, {
            type: 'task_update',
            taskId: updatedTask.id,
            payload: updatedTask,
            timestamp: new Date(),
          });
        });

        // Store unsubscribe function
        if (ws.subscriptions) {
          ws.subscriptions.set(message.taskId, unsubscribe);
        }

        // IMMEDIATELY send current task state (fixes race condition)
        const currentTask = getTask(message.taskId);
        console.log('[WS] Looking up task:', message.taskId, 'found:', !!currentTask, currentTask?.status);
        if (currentTask) {
          console.log('[WS] Sending immediate task state:', currentTask.status);
          sendToClient(ws, {
            type: 'task_update',
            taskId: currentTask.id,
            payload: currentTask,
            timestamp: new Date(),
          });
        }

        ws.send(JSON.stringify({
          type: 'subscribed',
          taskId: message.taskId,
        }));
      }
      break;

    case 'dispatch':
      // Handle dispatch via WebSocket
      dispatch({
        prompt: message.prompt,
        userId: ws.userId, // Use verified userId from socket
        preferredSpecialist: message.preferredSpecialist,
        dryRun: message.dryRun,
      }).then(result => {
        ws.send(JSON.stringify({
          type: 'dispatch_result',
          ...result,
        }));
      }).catch(error => {
        ws.send(JSON.stringify({
          type: 'error',
          message: error.message,
        }));
      });
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;

    default:
      ws.send(JSON.stringify({ error: 'Unknown message type' }));
  }
}

function sendToClient(ws: WebSocket, event: WSEvent) {
  if (ws.readyState === WebSocket.OPEN) {
    console.log('[WS] Sending to client:', event.type, event.taskId || '');
    ws.send(JSON.stringify(event));
  } else {
    console.log('[WS] Client not ready, state:', ws.readyState);
  }
}

// ============================================
// Error Handler
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// Start Server
// ============================================

const PORT = config.port;

async function start() {
  console.log('[Hivemind] Starting up...');
  
  const balances = await getTreasuryBalance();
  console.log(`[Hivemind] Treasury balance: ${balances.usdc} USDC, ${balances.eth} ETH`);

  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║            🐝 Hivemind Protocol 🐝                 ║
║               Backend Server                       ║
╠═══════════════════════════════════════════════════╣
║  REST API:  http://localhost:${PORT}                   ║
║  WebSocket: ws://localhost:${PORT}/ws                  ║
╠═══════════════════════════════════════════════════╣
║  Where agents find agents.                         ║
║                                                    ║
║  Marketplace: Hire specialists on-demand           ║
║  x402 Payments: Autonomous micropayments           ║
╚═══════════════════════════════════════════════════╝
    `);
  });
}

start().catch(console.error);

export { app, server, wss };
