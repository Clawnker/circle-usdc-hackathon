import { Router, Request, Response } from 'express';
import { getTreasuryBalance } from '../payments';
import { costTracker } from '../llm-client';
import { callSpecialist, getSpecialists } from '../dispatcher';
import { SpecialistType } from '../types';
import magos from '../specialists/magos';
import aura from '../specialists/aura';
import bankr from '../specialists/bankr';
import { hasErc8128Headers, verifyErc8128Request } from '../middleware/erc8128-auth';
// Note: x402 payment enforcement is handled at app level by x402-server.ts
// The manual paymentMiddleware in middleware/payment.ts is kept as fallback

const router = Router();
const TREASURY_WALLET_EVM = '0x676fF3d546932dE6558a267887E58e39f405B135';

/**
 * Health check
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Hivemind Protocol',
    version: '0.6.0',
    chain: 'Base Sepolia (EIP-155:84532)',
    trustLayer: 'ERC-8004',
    auth: ['api-key', 'erc8128'],
    llmRouter: 'ClawRouter/BlockRun',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Get system status including wallet balances
 */
router.get('/status', async (req: Request, res: Response) => {
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
 * LLM Cost tracking endpoint
 */
router.get('/v1/costs', (req: Request, res: Response) => {
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
 * ERC-8128 Verification endpoint
 */
router.get('/api/auth/verify', async (req: Request, res: Response) => {
  try {
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
 * Get all specialists
 */
router.get('/v1/specialists', (req: Request, res: Response) => {
  const specialists = getSpecialists();
  res.json({ specialists });
});

/**
 * Direct specialist query — x402 payment enforced at app level
 */
router.post(['/specialist/:id', '/query/:id'], async (req: Request, res: Response) => {
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

/**
 * Test specialists directly (for debugging)
 */
router.post('/test/:specialist', async (req: Request, res: Response) => {
  try {
    const { specialist } = req.params;
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Route to specialist
    let result;
    switch (specialist) {
      case 'magos':
        result = await magos.handle(prompt);
        break;
      case 'aura':
        result = await aura.handle(prompt);
        break;
      case 'bankr':
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

export default router;
