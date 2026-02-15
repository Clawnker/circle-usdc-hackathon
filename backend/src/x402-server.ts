/**
 * x402 Payment Protocol Setup
 * 
 * Wires the real x402 SDK (@x402/express + @x402/evm) for
 * payment-gated specialist endpoints on Base Sepolia.
 * 
 * Flow:
 * 1. Client hits /api/specialist/:id → gets 402 + PaymentRequirements
 * 2. Client signs EIP-3009 TransferWithAuthorization via Smart Wallet
 * 3. Client re-sends with PAYMENT header
 * 4. Middleware verifies via Coinbase facilitator → settles on-chain → passes through
 */

import { Request, Response } from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { registerExactEvmScheme } from '@x402/evm/exact/server';
import config from './config';

// Treasury receives all payments
const TREASURY_ADDRESS = '0x676fF3d546932dE6558a267887E58e39f405B135';

// Base Sepolia network in CAIP-2 format
const BASE_SEPOLIA_NETWORK = 'eip155:84532';

/**
 * Build x402 route config from our specialist fee config.
 * Each specialist endpoint gets a payment requirement.
 */
function buildRoutes(): Record<string, any> {
  const routes: Record<string, any> = {};

  const specialists = ['magos', 'aura', 'bankr', 'scribe', 'seeker', 'sentinel'] as const;
  
  for (const specialist of specialists) {
    const fee = (config.fees as any)[specialist] || 0;
    if (fee <= 0) continue;

    // Protect both /api/specialist/:id and /api/query/:id
    const paths = [
      `POST /api/specialist/${specialist}`,
      `POST /api/query/${specialist}`,
    ];

    for (const path of paths) {
      routes[path] = {
        accepts: {
          scheme: 'exact',
          network: BASE_SEPOLIA_NETWORK,
          payTo: TREASURY_ADDRESS,
          price: fee,
          maxTimeoutSeconds: 300,
        },
        description: `Query the ${specialist} AI specialist via Hivemind Protocol`,
        mimeType: 'application/json',
      };
    }
  }

  // Note: /dispatch is NOT protected by x402 — it has its own payment
  // handling via delegation (approve/transferFrom) and X-Payment-Proof header.
  // Individual specialist endpoints (/api/specialist/:id) ARE x402-protected.

  return routes;
}

function isProtectedRoute(req: Request): boolean {
  return req.method === 'POST' && (
    req.path.startsWith('/api/specialist/') ||
    req.path.startsWith('/api/query/')
  );
}

export function createFailClosedMiddleware(reason = 'x402 middleware unavailable') {
  return (req: Request, res: Response, next: any) => {
    if (isProtectedRoute(req)) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        reason,
      });
    }
    return next();
  };
}

/**
 * Create the x402 payment middleware for Express.
 * Uses the Coinbase-hosted facilitator for verification and settlement.
 */
export function createX402Middleware() {
  try {
    // Connect to Coinbase's hosted facilitator
    const facilitator = new HTTPFacilitatorClient();

    // Create the resource server with EVM support
    const server = new x402ResourceServer(facilitator);
    registerExactEvmScheme(server);

    // Build route config
    const routes = buildRoutes();

    console.log('[x402] Routes configured:', Object.keys(routes).join(', '));
    console.log(`[x402] Treasury: ${TREASURY_ADDRESS}`);
    console.log(`[x402] Network: ${BASE_SEPOLIA_NETWORK}`);

    // Create middleware — do NOT sync on start (5th arg = false)
    // Sync can throw unhandled rejections that crash the process
    const middleware = paymentMiddleware(
      routes,
      server,
      {
        title: 'Hivemind Protocol',
        description: 'Pay-per-query AI agent marketplace on Base',
      } as any,
      undefined,
      false,
    );

    console.log('[x402] Payment middleware created successfully');
    return middleware;
  } catch (err: any) {
    console.error('[x402] Failed to create middleware:', err.message);
    // Fail CLOSED for payment-protected routes; do not pass-through.
    return createFailClosedMiddleware(err.message || 'x402 initialization failed');
  }
}

// Export route config for introspection
export { buildRoutes, TREASURY_ADDRESS, BASE_SEPOLIA_NETWORK };
