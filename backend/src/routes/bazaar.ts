import { Router, Request, Response } from 'express';
import { getAllDiscoverableServices, getBazaarServiceDetails } from '../bazaar';

const router = Router();

/**
 * GET /api/bazaar/discovery
 * List all discoverable x402 services (internal + external)
 */
router.get('/discovery', async (req: Request, res: Response) => {
  try {
    const services = await getAllDiscoverableServices();
    res.json({
      services,
      count: services.length,
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
