import { Request, Response, NextFunction } from 'express';

/**
 * Simple API key authentication middleware.
 * Checks for X-API-Key header or apiKey query parameter.
 * Valid keys are loaded from process.env.API_KEYS (comma-separated).
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Always allow /health
  if (req.path === '/health') {
    return next();
  }

  // x402-gated specialist endpoints bypass API key auth (protected by payment instead)
  if (req.path.startsWith('/api/specialist/')) {
    // Set a placeholder user for the request
    (req as any).user = { id: 'x402-payer' };
    return next();
  }

  // Public demo endpoints (hackathon demo — no API key required)
  const publicPaths = [
    '/dispatch',
    '/pricing',
    '/api/pricing',
    '/api/agents',
    '/api/reputation',
    '/api/vote',
    '/api/wallet',
  ];
  if (publicPaths.some(p => req.path === p || req.path.startsWith(p + '/'))) {
    (req as any).user = { id: 'demo-user' };
    return next();
  }

  // Security: Only accept API key from headers, not query params (prevents logging exposure)
  const apiKey = req.headers['x-api-key'] as string;
  const apiKeysEnv = process.env.API_KEYS || '';
  const validKeys = apiKeysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);

  if (!apiKey || !validKeys.includes(apiKey)) {
    return res.status(401).json({ 
      error: 'Unauthorized: Invalid or missing API Key' 
    });
  }

  // Attach user context to request for downstream filtering
  (req as any).user = {
    id: apiKey // Use the key itself as a simple userId for this hackathon
  };

  next();
};
