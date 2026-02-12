import { Router, Request, Response } from 'express';
import { discoverAgents, getAgentDetails, probeAgentPricing } from '../bazaar';

const router = Router();

/**
 * GET /api/bazaar/discovery
 * Discover external ERC-8004 agents with x402 support.
 * Source: 8004scan.io leaderboard (single source of truth).
 * Query params: limit (default 50, max 100), offset (default 0), search (optional), network (mainnet|testnet|all, default testnet)
 */
router.get('/discovery', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string) || '';
    const network = (req.query.network as 'mainnet' | 'testnet' | 'all') || 'testnet';

    const { agents, total } = await discoverAgents({ limit, offset, search, network });
    res.json({
      agents,
      count: agents.length,
      total,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Discovery] Route failed:', error);
    res.status(500).json({ error: 'Failed to discover agents' });
  }
});

/**
 * GET /api/bazaar/agent
 * Get details for a specific agent by name.
 */
router.get('/agent', async (req: Request, res: Response) => {
  try {
    const { name } = req.query;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Missing name parameter' });
    }

    const agent = await getAgentDetails(name);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(agent);
  } catch (error: any) {
    console.error('[Discovery] Agent details failed:', error);
    res.status(500).json({ error: 'Failed to fetch agent details' });
  }
});

/**
 * GET /api/bazaar/pricing
 * Probe an agent's x402 endpoint to discover pricing.
 * Query params: endpoint (required) — the agent's base URL
 */
router.get('/pricing', async (req: Request, res: Response) => {
  try {
    const endpoint = req.query.endpoint as string;
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    const pricing = await probeAgentPricing(endpoint);
    if (!pricing) {
      return res.json({ found: false, message: 'No x402 pricing discovered' });
    }

    res.json({ found: true, ...pricing });
  } catch (error: any) {
    console.error('[Discovery] Pricing probe failed:', error);
    res.status(500).json({ error: 'Failed to probe pricing' });
  }
});

export default router;
