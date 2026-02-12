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

dotenv.config();

const app = express();

// Core middleware
app.use(cors());
app.use(express.json());
app.use(rateLimiter);

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ──────────────────────────────────────
//  PUBLIC routes (no API key required)
// ──────────────────────────────────────

// Health, status, costs, auth verification, skill.md
app.use('/', generalRoutes);

// Agent registry (read + register)
app.use('/api', agentRoutes);

// Reputation (read-only is public)
app.use('/api', reputationRoutes);

// Wallet balances & delegate-pay (public — they have their own guards)
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

// Also mount dispatch at root for backwards compat
app.post('/dispatch', (req, res, next) => {
  req.url = '/dispatch';
  dispatchRoutes(req, res, next);
});

// Status (authenticated version with wallet)
app.get('/status', async (req: Request, res: Response) => {
  const { getTreasuryBalance } = await import('./payments');
  try {
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
