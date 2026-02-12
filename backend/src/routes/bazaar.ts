import { Router, Request, Response } from 'express';
import { getAllDiscoverableServices, getBazaarServiceDetails } from '../bazaar';

const router = Router();

/**
 * GET /api/bazaar/discovery
 * List all discoverable x402 services (internal + external from CDP Bazaar)
 * Query params: limit (default 20), offset (default 0)
 */
router.get('/discovery', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const { services, externalTotal } = await getAllDiscoverableServices({ limit, offset });
    res.json({
      services,
      count: services.length,
      externalTotal,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Bazaar] Discovery failed:', error);
    res.status(500).json({ error: 'Failed to discover Bazaar services' });
  }
});

/**
 * GET /api/bazaar/service
 * Get details for a specific service URL (proxy to avoid CORS)
 */
router.get('/service', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    const details = await getBazaarServiceDetails(url);
    if (!details) {
      return res.status(404).json({ error: 'Service not found or unreachable' });
    }

    res.json(details);
  } catch (error: any) {
    console.error('[Bazaar] Service details failed:', error);
    res.status(500).json({ error: 'Failed to fetch service details' });
  }
});

export default router;
