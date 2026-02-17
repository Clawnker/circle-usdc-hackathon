import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const DEFAULT_MAX_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_NONCE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_NONCES = 50_000;
const NONCE_RE = /^[A-Za-z0-9._:-]{8,128}$/;
const SIG_HEX_RE = /^[a-f0-9]{64}$/;
const seenNonces = new Map<string, number>();

function pruneNonces(now = Date.now()) {
  for (const [nonce, expiry] of seenNonces.entries()) {
    if (expiry <= now) seenNonces.delete(nonce);
  }
}

export function canonicalJson(value: any): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const props = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`);
  return `{${props.join(',')}}`;
}

export function computeDispatchSignature(input: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: any;
  secret: string;
}): string {
  const bodyHash = createHash('sha256').update(canonicalJson(input.body)).digest('hex');
  const message = `${input.method.toUpperCase()}\n${input.path}\n${input.timestamp}\n${input.nonce}\n${bodyHash}`;
  return createHmac('sha256', input.secret).update(message).digest('hex');
}

function requiresStrictDispatchAuth(req: Request): boolean {
  const enabled = process.env.DISPATCH_REQUIRE_AUTH === 'true';
  if (!enabled) return false;

  const path = req.path || '';
  return (
    path === '/dispatch' ||
    path === '/query' ||
    path === '/transactions/approve' ||
    path === '/transactions/reject' ||
    path === '/api/dispatch' ||
    path === '/api/query' ||
    path === '/api/transactions/approve' ||
    path === '/api/transactions/reject'
  );
}

/**
 * Guard for hardened dispatch endpoints.
 * - Optional strict auth requirement for public demo paths
 * - Optional HMAC request integrity (timestamp + nonce + canonical body)
 */
export function dispatchGuardMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;

  if (requiresStrictDispatchAuth(req) && user?.authMethod === 'public') {
    return res.status(401).json({
      error: 'Unauthorized: dispatch requires authenticated caller',
      hint: 'Provide X-API-Key or ERC-8128 signed request',
    });
  }

  const secret = process.env.DISPATCH_HMAC_SECRET;
  if (!secret) return next();

  const timestamp = String(req.header('x-dispatch-timestamp') || '');
  const nonce = String(req.header('x-dispatch-nonce') || '');
  const signature = String(req.header('x-dispatch-signature') || '').toLowerCase();

  if (!timestamp || !nonce || !signature) {
    return res.status(401).json({
      error: 'Missing dispatch integrity headers',
      requiredHeaders: ['x-dispatch-timestamp', 'x-dispatch-nonce', 'x-dispatch-signature'],
    });
  }

  if (!NONCE_RE.test(nonce)) {
    return res.status(400).json({ error: 'Invalid x-dispatch-nonce format' });
  }

  if (!SIG_HEX_RE.test(signature)) {
    return res.status(400).json({ error: 'Invalid x-dispatch-signature format' });
  }

  const tsMs = Number(timestamp);
  if (!Number.isFinite(tsMs)) {
    return res.status(400).json({ error: 'Invalid x-dispatch-timestamp (expected epoch milliseconds)' });
  }

  const maxSkew = Number(process.env.DISPATCH_MAX_SKEW_MS || DEFAULT_MAX_SKEW_MS);
  if (Math.abs(Date.now() - tsMs) > maxSkew) {
    return res.status(401).json({ error: 'Dispatch signature expired or not yet valid' });
  }

  pruneNonces();
  if (seenNonces.has(nonce)) {
    return res.status(409).json({ error: 'Replay detected: nonce already used' });
  }

  const maxNonces = Number(process.env.DISPATCH_MAX_NONCES || DEFAULT_MAX_NONCES);
  if (seenNonces.size >= maxNonces) {
    return res.status(503).json({ error: 'Dispatch integrity guard overloaded, retry shortly' });
  }

  const expected = computeDispatchSignature({
    method: req.method,
    path: req.path,
    timestamp,
    nonce,
    body: req.body || {},
    secret,
  });

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    return res.status(401).json({ error: 'Dispatch signature verification failed' });
  }

  const nonceTtlMs = Number(process.env.DISPATCH_NONCE_TTL_MS || DEFAULT_NONCE_TTL_MS);
  seenNonces.set(nonce, Date.now() + nonceTtlMs);
  return next();
}

export function resetDispatchGuardStateForTest() {
  seenNonces.clear();
}
