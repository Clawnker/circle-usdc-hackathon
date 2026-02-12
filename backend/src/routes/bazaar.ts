import { Router, Request, Response } from 'express';
import { discoverAgents, getAgentDetails } from '../bazaar';

const router = Router();

/**
 * GET /api/bazaar/discovery
 * Discover external ERC-8004 agents with x402 support.
 * Source: 8004scan.io registry (single source of truth).
 * Query params: limit (default 50, max 100), offset (default 0), search (optional)
 */
router.get('/discovery', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string) || '';

    const { agents, total } = await discoverAgents({ limit, offset, search });
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

export default router;
