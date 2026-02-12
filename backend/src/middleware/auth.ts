import { Request, Response, NextFunction } from 'express';
import { hasErc8128Headers, verifyErc8128Request } from './erc8128-auth';

/**
 * Authentication middleware.
 * Supports two methods (checked in order):
 *   1. ERC-8128 — Signed HTTP requests with Ethereum wallets (cryptographic)
 *   2. API Key  — Static X-API-Key header (legacy)
 *
 * ERC-8128 is preferred: agents authenticate with their wallet, same identity
 * that pays and earns reputation on-chain.
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Always allow /health
  if (req.path === '/health') {
    return next();
  }

  // x402-gated specialist endpoints bypass API key auth (protected by payment instead)
  if (req.path.startsWith('/api/specialist/')) {
    (req as any).user = { id: 'x402-payer', authMethod: 'x402' };
    return next();
  }

  // Public demo endpoints (hackathon demo — no API key required)
  const publicPaths = [
    '/dispatch',
    '/pricing',
    '/api/pricing',
    '/api/agents',
    '/api/bazaar',
    '/api/reputation',
    '/api/vote',
    '/api/wallet',
    '/wallet/balances',
    '/wallet/transactions',
    '/status',
    '/tasks',
    '/api/auth/verify',
  ];
  if (publicPaths.some(p => req.path === p || req.path.startsWith(p + '/'))) {
    (req as any).user = { id: 'demo-user', authMethod: 'public' };
    return next();
  }

  // ── Method 1: ERC-8128 Signed HTTP Request ──────────────────────────
  if (hasErc8128Headers(req)) {
    try {
      const result = await verifyErc8128Request(req);

      if (result && result.ok) {
        (req as any).user = {
          id: result.address,
          address: result.address,
          chainId: result.chainId,
          authMethod: 'erc8128' as const,
        };
        (req as any).erc8128Verified = true;
        return next();
      }

      // ERC-8128 headers present but invalid — reject
      if (result && !result.ok) {
        return res.status(401).json({
          error: 'ERC-8128 authentication failed',
          reason: result.reason,
        });
      }
    } catch (err: any) {
      console.error('[Auth] ERC-8128 verification error:', err.message);
      return res.status(401).json({
        error: 'ERC-8128 authentication error',
        reason: err.message,
      });
    }
  }

  // ── Method 2: API Key (legacy) ──────────────────────────────────────
  const apiKey = req.headers['x-api-key'] as string;
  const apiKeysEnv = process.env.API_KEYS || '';
  const validKeys = apiKeysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);

  if (!apiKey || !validKeys.includes(apiKey)) {
    return res.status(401).json({ 
      error: 'Unauthorized: Invalid or missing API Key',
      hint: 'Provide X-API-Key header or sign requests with ERC-8128 (https://erc8128.org)',
    });
  }

  (req as any).user = {
    id: apiKey,
    authMethod: 'api-key' as const,
  };

  next();
};
