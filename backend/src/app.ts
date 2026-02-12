import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { rateLimiter } from './middleware/rate-limit';
import { authMiddleware } from './middleware/auth';
import agentRoutes from './routes/agents';
import dispatchRoutes from './routes/dispatch';
import paymentRoutes from './routes/payments';
import reputationRoutes from './routes/reputation';
import generalRoutes from './routes/general';
import bazaarRoutes from './routes/bazaar';
import { createX402Middleware } from './x402-server';

dotenv.config();

const app = express();

// Core middleware
// CORS — restrict to known frontends
app.use(cors({
  origin: [
    'https://circle-usdc-hackathon.vercel.app',
    'https://hivemindprotocol.ai',
    'http://localhost:3001', // local dev
    'http://localhost:3000',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Payment-Proof', 'Authorization'],
}));
app.use(express.json());

// Handle JSON parse errors gracefully (return 400 instead of 500)
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

app.use(rateLimiter);

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ──────────────────────────────────────
//  x402 Payment Middleware (real protocol)
// ──────────────────────────────────────
// Must be mounted BEFORE routes so it can intercept 
// specialist/dispatch requests and enforce payment.
// Non-protected routes pass through unaffected.
try {
  const x402 = createX402Middleware();
  app.use(x402);
  console.log('[App] x402 payment middleware active');
} catch (err: any) {
  console.warn(`[App] x402 middleware failed to initialize: ${err.message}`);
  console.warn('[App] Falling back to manual 402 responses');
  // The routes/general.ts still has manual paymentMiddleware as fallback
}

// ──────────────────────────────────────
//  PUBLIC routes (no API key required)
// ──────────────────────────────────────

// Health, costs, auth verification
app.use('/', generalRoutes);

// Agent registry (read + register)
app.use('/api', agentRoutes);

// Bazaar discovery (x402 services)
app.use('/api/bazaar', bazaarRoutes);

// Reputation (public read)
app.use('/api', reputationRoutes);

// Wallet balances, delegate-pay, lookup
app.use('/api', paymentRoutes);

// Serve registration docs
const skillPath = path.join(__dirname, '../../REGISTER_AGENT.md');
try {
  const skillMarkdown = fs.existsSync(skillPath)
    ? fs.readFileSync(skillPath, 'utf8')
    : '# Hivemind Protocol\n\nRegistration docs not found.';
  app.get('/skill.md', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/markdown');
    res.send(skillMarkdown);
  });
} catch {}

// ──────────────────────────────────────
//  AUTHENTICATED routes (API key / ERC-8128)
// ──────────────────────────────────────

app.use(authMiddleware);

// Dispatch, tasks, pricing, specialist queries
app.use('/api', dispatchRoutes);

// Backwards compat: /dispatch at root
app.post('/dispatch', (req, res, next) => {
  req.url = '/dispatch';
  dispatchRoutes(req, res, next);
});

// Task status polling at root (public — taskId is the auth)
app.get('/status/:taskId', (req, res, next) => {
  req.url = `/status/${req.params.taskId}`;
  dispatchRoutes(req, res, next);
});

// Status (authenticated, includes treasury balance)
app.get('/status', async (_req: Request, res: Response) => {
  try {
    const { getTreasuryBalance } = require('./payments');
    const balances = await getTreasuryBalance();
    res.json({
      status: 'ok',
      treasury: { address: '0x676fF3d546932dE6558a267887E58e39f405B135', balances },
      chain: 'Base Sepolia (EIP-155:84532)',
      specialists: ['magos', 'aura', 'bankr', 'seeker', 'scribe'],
      uptime: process.uptime(),
    });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// Wallet balance & transactions (authenticated)
app.get('/wallet/balances', paymentRoutes);
app.get('/wallet/transactions', paymentRoutes);

// Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
