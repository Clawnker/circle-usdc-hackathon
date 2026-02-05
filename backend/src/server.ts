/**
 * CSN API Server
 * REST API + WebSocket for the Clawnker Specialist Network
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import * as dotenv from 'dotenv';

import config from './config';
import { authMiddleware } from './middleware/auth';
import dispatcher, { dispatch, getTask, getRecentTasks, subscribeToTask, getSpecialists } from './dispatcher';
import { getBalances, getTransactionLog } from './x402';
import solana from './solana';
import { DispatchRequest, Task, WSEvent } from './types';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(cors());
app.use(express.json());
app.use(authMiddleware);

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// REST API Endpoints
// ============================================

/**
 * Health check
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'CSN Backend',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
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
    const { prompt, userId, preferredSpecialist, dryRun, callbackUrl } = req.body as DispatchRequest;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await dispatch({
      prompt,
      userId: userId || (req as any).user.id,
      preferredSpecialist,
      dryRun,
      callbackUrl,
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

  res.json(task);
});

/**
 * Get recent tasks
 * GET /tasks?limit=10
 */
app.get('/tasks', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const user = (req as any).user;
  
  // Filter tasks to only return those belonging to the authenticated user
  const tasks = getRecentTasks(limit * 5).filter(t => t.userId === user.id).slice(0, limit);
  res.json({ tasks, count: tasks.length });
});

/**
 * Get specialist pricing
 * GET /pricing
 */
app.get('/pricing', (req: Request, res: Response) => {
  const pricing = dispatcher.getSpecialistPricing();
  res.json({ 
    pricing,
    note: 'Fees in USDC, paid via x402 protocol on Solana'
  });
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
    const limit = parseInt(req.query.limit as string) || 10;
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

const wsClients: Map<WebSocket, Set<string>> = new Map();

wss.on('connection', (ws: WebSocket) => {
  console.log('[WS] Client connected');
  wsClients.set(ws, new Set());

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
    wsClients.delete(ws);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to CSN WebSocket',
    timestamp: new Date().toISOString(),
  }));
});

function handleWSMessage(ws: WebSocket, message: any) {
  switch (message.type) {
    case 'subscribe':
      // Subscribe to task updates
      if (message.taskId) {
        const subscriptions = wsClients.get(ws) || new Set();
        subscriptions.add(message.taskId);
        wsClients.set(ws, subscriptions);

        // Set up subscription
        subscribeToTask(message.taskId, (task: Task) => {
          sendToClient(ws, {
            type: 'task_update',
            taskId: task.id,
            payload: task,
            timestamp: new Date(),
          });
        });

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
        userId: message.userId,
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
    ws.send(JSON.stringify(event));
  }
}

// Broadcast to all clients subscribed to a task
function broadcastTaskUpdate(task: Task) {
  for (const [ws, subscriptions] of wsClients.entries()) {
    if (subscriptions.has(task.id)) {
      sendToClient(ws, {
        type: 'task_update',
        taskId: task.id,
        payload: task,
        timestamp: new Date(),
      });
    }
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
  console.log('[CSN] Testing connections...');
  
  const heliusOk = await solana.testConnection('devnet');
  console.log(`[CSN] Helius devnet: ${heliusOk ? '✓' : '✗'}`);
  
  const balances = await getBalances();
  console.log(`[CSN] AgentWallet balances:`, balances);

  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║       Clawnker Specialist Network (CSN)           ║
║                Backend Server                      ║
╠═══════════════════════════════════════════════════╣
║  REST API:  http://localhost:${PORT}                   ║
║  WebSocket: ws://localhost:${PORT}/ws                  ║
╠═══════════════════════════════════════════════════╣
║  Specialists:                                      ║
║    • Magos  (predictions, risk)                   ║
║    • Aura   (sentiment, social)                   ║
║    • bankr  (trading, wallets)                    ║
╚═══════════════════════════════════════════════════╝
    `);
  });
}

start().catch(console.error);

export { app, server, wss };
