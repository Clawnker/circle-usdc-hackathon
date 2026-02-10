// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

// Use require to avoid tsc following types into the broken ox dependency
const { createVerifierClient } = require('@slicekit/erc8128');

const NONCE_STORE_FILE = path.join(__dirname, '../../data/erc8128-nonces.json');

// Simple persistent NonceStore for replay protection
class PersistentNonceStore {
  private nonces: Set<string> = new Set();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(NONCE_STORE_FILE)) {
        const data = fs.readFileSync(NONCE_STORE_FILE, 'utf8');
        this.nonces = new Set(JSON.parse(data));
        console.log(`[ERC-8128] Loaded ${this.nonces.size} nonces from persistence`);
      }
    } catch (err) {
      console.error('[ERC-8128] Failed to load nonces:', err);
    }
  }

  private save() {
    try {
      const dir = path.dirname(NONCE_STORE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(NONCE_STORE_FILE, JSON.stringify(Array.from(this.nonces)), 'utf8');
    } catch (err) {
      console.error('[ERC-8128] Failed to save nonces:', err);
    }
  }

  async has(nonce: string): Promise<boolean> {
    return this.nonces.has(nonce);
  }

  async set(nonce: string): Promise<void> {
    this.nonces.add(nonce);
    // Keep last 10,000 nonces
    if (this.nonces.size > 10000) {
      const list = Array.from(this.nonces);
      this.nonces = new Set(list.slice(-5000));
    }
    this.save();
  }
}

const persistentNonceStore = new PersistentNonceStore();

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const nonceStore = {
  async consume(key: string, ttlSeconds: number): Promise<boolean> {
    if (await persistentNonceStore.has(key)) return false;
    await persistentNonceStore.set(key);
    return true;
  }
};

const verifyMessage = async (args: any) => {
  return publicClient.verifyMessage({
    address: args.address,
    message: { raw: args.message.raw },
    signature: args.signature,
  });
};

const verifier = createVerifierClient(verifyMessage, nonceStore);

export function hasErc8128Headers(req: Request): boolean {
  return !!(req.headers['signature'] && req.headers['signature-input']);
}

export async function verifyErc8128Request(req: Request) {
  try {
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost';
    const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;
    
    const nativeRequest = new Request(fullUrl, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });

    return await verifier.verifyRequest(nativeRequest);
  } catch (error: any) {
    console.error('[ERC-8128] Verification error:', error);
    return { ok: false, reason: 'internal_error', detail: error.message };
  }
}

/**
 * ERC-8128 Authentication Middleware
 */
export const erc8128AuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (!hasErc8128Headers(req)) {
    return next();
  }

  try {
    const verification = await verifyErc8128Request(req);

    if (verification.ok) {
      console.log(`[ERC-8128] Verified request from ${verification.address}`);
      (req as any).user = {
        id: verification.address,
        address: verification.address,
        authMethod: 'erc8128',
      };
      return next();
    } else {
      console.warn(`[ERC-8128] Verification failed: ${verification.reason}`);
      return res.status(401).json({ 
        error: 'ERC-8128 verification failed', 
        reason: verification.reason 
      });
    }
  } catch (error: any) {
    console.error('[ERC-8128] Middleware error:', error);
    return res.status(500).json({ error: 'Internal server error during ERC-8128 verification' });
  }
};
