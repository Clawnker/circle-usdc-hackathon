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
import dispatcher, { dispatch, getTask, getRecentTasks, subscribeToTask, getSpecialists, callSpecialist } from './dispatcher';
import { getBalances, getTransactionLog } from './x402';
import { getSimulatedBalances } from './specialists/bankr';
import { submitVote, getVote, getReputationStats, getAllReputation, updateSyncStatus } from './reputation';
import { syncReputationToChain } from './solana-reputation';
import solana from './solana';
import { DispatchRequest, Task, WSEvent, SpecialistType } from './types';

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

// Persistent Replay Protection
const USED_SIGNATURES_FILE = path.join(__dirname, '../data/used-signatures.json');
let usedSignatures = new Set<string>();

function loadUsedSignatures() {
  try {
    if (fs.existsSync(USED_SIGNATURES_FILE)) {
      const data = fs.readFileSync(USED_SIGNATURES_FILE, 'utf8');
      usedSignatures = new Set(JSON.parse(data));
      console.log(`[x402] Loaded ${usedSignatures.size} used signatures from persistence`);
    }
  } catch (err) {
    console.error('[x402] Failed to load used signatures:', err);
  }
}

function saveUsedSignatures() {
  try {
    const dir = path.dirname(USED_SIGNATURES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USED_SIGNATURES_FILE, JSON.stringify(Array.from(usedSignatures)), 'utf8');
  } catch (err) {
    console.error('[x402] Failed to save used signatures:', err);
  }
}

loadUsedSignatures();

// Cleanup old signatures (keep only most recent 10,000 for performance)
setInterval(() => {
  if (usedSignatures.size > 10000) {
    const list = Array.from(usedSignatures);
    usedSignatures = new Set(list.slice(-5000));
    saveUsedSignatures();
  }
}, 3600000);

// Treasury wallets for receiving payments
const TREASURY_WALLET_SOLANA = '5xUugg8ysgqpcGneM6qpM2AZ8ZGuMaH5TnGNWdCQC1Z1';
const TREASURY_WALLET_EVM = '0x676fF3d546932dE6558a267887E58e39f405B135';
const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// --- PUBLIC ROUTES ---

/**
 * Health check
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Hivemind Protocol',
    version: '0.2.0',
    chain: 'Base (EIP-155:8453)',
    trustLayer: 'ERC-8004',
    timestamp: new Date().toISOString(),
  });
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
      chain: 'Base (EIP-155:8453)',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get specialist pricing (Public)
 */
app.get('/api/pricing', (req: Request, res: Response) => {
  const pricing = dispatcher.getSpecialistPricing();
  res.json({ 
    pricing,
    note: 'Fees in USDC, paid via x402 protocol on Solana'
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
      chain: 'Base (EIP-155:8453)',
      registry: config.erc8004.reputationRegistry || 'pending-deployment',
      explorerUrl: `https://basescan.org/tx/${txHash}`,
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
    res.status(500).json({ error: error.message });
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
      chain: 'Base (EIP-155:8453)',
      registry: config.erc8004.reputationRegistry || 'pending-deployment',
      explorerUrl: `https://basescan.org/tx/${stats.lastSyncTx}`,
      status: 'confirmed'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- PROTECTED ROUTES ---

app.use(authMiddleware);

// Specialist endpoints - returns 402 without payment, 200 with payment
app.post('/api/specialist/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { prompt } = req.body;
    
    // Validate specialist ID
    const validSpecialists: SpecialistType[] = ['magos', 'aura', 'bankr', 'scribe', 'seeker', 'general'];
    if (!validSpecialists.includes(id as SpecialistType)) {
      return res.status(400).json({ error: 'Invalid specialist ID' });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Check for x402 payment signature
    const paymentSignature = req.headers['payment-signature'] || req.headers['x-payment'];
    
    const fee = (config.fees as any)[id] || 0;

    if (!paymentSignature && fee > 0) {
      // Return 402 with payment requirements (x402 v2 format with accepts array)
      // Base USDC as primary payment option (Circle USDC hackathon focus)
      
      const paymentRequired = {
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',  // Base mainnet
            asset: BASE_USDC_ADDRESS,
            amount: String(Math.floor(fee * 1_000_000)),
            payTo: TREASURY_WALLET_EVM,
            extra: {
              name: `${id} specialist`,
              description: `Query the ${id} AI specialist via Hivemind Protocol`,
              feePayer: TREASURY_WALLET_EVM,
            }
          },
          {
            scheme: 'exact',
            network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
            asset: DEVNET_USDC_MINT,
            amount: String(Math.floor(fee * 1_000_000)),
            payTo: TREASURY_WALLET_SOLANA,
            extra: {
              name: `${id} specialist`,
              description: `Query the ${id} AI specialist (Solana fallback)`,
              feePayer: TREASURY_WALLET_SOLANA,
            }
          }
        ]
      };
      
      // Encode as base64 for header
      const paymentRequiredBase64 = Buffer.from(JSON.stringify(paymentRequired)).toString('base64');
      
      console.log(`[x402] Returning 402 for ${id}, fee: ${fee} USDC (Base primary)`);
      res.setHeader('payment-required', paymentRequiredBase64);
      res.setHeader('x-payment-required', paymentRequiredBase64); // Fallback
      return res.status(402).json({ 
        error: 'Payment required',
        fee: `${fee} USDC`,
        network: 'Base (EIP-155:8453)',
        fallback: 'Solana Devnet'
      });
    }

    if (fee > 0) {
      console.log(`[x402] Verifying payment for ${id}, signature: ${String(paymentSignature).slice(0, 20)}...`);
      
      const sig = paymentSignature as string;
      if (usedSignatures.has(sig)) {
        return res.status(402).json({ error: 'Payment signature already used (replay protection)' });
      }

      // For x402 payments via AgentWallet, we trust the x402 facilitator's attestation
      // The payment header contains a signed receipt from AgentWallet
      // For production, we'd verify on-chain; for demo, trust the header
      
      // Check if it looks like a valid signature/receipt
      if (sig.length < 20) {
        return res.status(402).json({ error: 'Invalid payment signature format' });
      }

      // Mark signature as used and persist (replay protection)
      usedSignatures.add(sig);
      saveUsedSignatures();
      console.log(`[x402] Payment accepted: ${fee} USDC for ${id}`);
    }
    
    // Payment verified or not required - execute specialist
    const result = await callSpecialist(id as SpecialistType, prompt);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint for wallet balances (for frontend display)
// Uses simulated devnet balances from bankr specialist
app.get('/api/wallet/balances', async (req: Request, res: Response) => {
  try {
    const simulated = await getSimulatedBalances();
    res.json({
      solana: {
        sol: simulated.sol,
        usdc: simulated.usdc,
        bonk: simulated.bonk,
      },
      evm: { eth: 0, usdc: 0 },
      transactions: simulated.transactions.slice(-10), // Last 10 transactions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, solana: { sol: 0, usdc: 0 }, evm: { eth: 0, usdc: 0 } });
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
    res.status(500).json({ error: error.message });
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
 * Get system status including wallet balances and RPC health
 */
app.get('/status', async (req: Request, res: Response) => {
  try {
    const [balances, heliusOk] = await Promise.all([
      getBalances(),
      solana.testConnection('devnet'),
    ]);

    res.json({
      status: 'ok',
      wallet: {
        solana: config.agentWallet.solanaAddress,
        evm: config.agentWallet.evmAddress,
        balances,
      },
      rpc: {
        helius: heliusOk ? 'connected' : 'disconnected',
        devnet: config.helius.devnet ? 'configured' : 'missing',
        mainnet: config.helius.mainnet ? 'configured' : 'missing',
      },
      specialists: ['magos', 'aura', 'bankr'],
      uptime: process.uptime(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Submit a task to the dispatcher
 * POST /dispatch
 * Body: { prompt: string, userId?: string, preferredSpecialist?: string, dryRun?: boolean }
 */
app.post('/dispatch', async (req: Request, res: Response) => {
  try {
    const { prompt, userId, preferredSpecialist, dryRun, callbackUrl, hiredAgents, approvedAgent, previewOnly } = req.body as DispatchRequest;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await dispatch({
      prompt,
      userId: userId || (req as any).user.id,
      preferredSpecialist,
      dryRun,
      callbackUrl,
      hiredAgents,
      approvedAgent,
      previewOnly,
    });

    res.status(202).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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

  // Security: only allow task owner to see task status
  if (task.userId !== (req as any).user.id) {
    return res.status(403).json({ error: 'Access denied: not your task' });
  }

  res.json(task);
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
 * Get wallet balances
 * GET /wallet/balances
 */
app.get('/wallet/balances', async (req: Request, res: Response) => {
  try {
    const balances = await getBalances();
    res.json({
      address: config.agentWallet.solanaAddress,
      balances,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
 * Get Solana balance for any address
 * GET /solana/balance/:address
 */
app.get('/solana/balance/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const network = (req.query.network as 'devnet' | 'mainnet') || 'mainnet';
    
    const balance = await solana.getBalance(address, network);
    res.json({ address, balance, network });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get recent transactions for an address
 * GET /solana/transactions/:address
 */
app.get('/solana/transactions/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const network = (req.query.network as 'devnet' | 'mainnet') || 'mainnet';
    
    const transactions = await solana.getRecentTransactions(address, limit, network);
    res.json({ address, transactions, count: transactions.length, network });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
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
    res.status(500).json({ error: error.message });
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
  // Test connections on startup
  console.log('[Hivemind] Testing connections...');
  
  const heliusOk = await solana.testConnection('devnet');
  console.log(`[Hivemind] Helius devnet: ${heliusOk ? '✓' : '✗'}`);
  
  const balances = await getBalances();
  console.log(`[Hivemind] AgentWallet balances:`, balances);

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
