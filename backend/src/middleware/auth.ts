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

  const apiKey = (req.headers['x-api-key'] as string) || (req.query.apiKey as string);
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
