import * as fs from 'fs';
import * as path from 'path';
import { Request, Response, NextFunction } from 'express';
import { getReliabilityConfig } from './config';
import {
  ReliabilityOpsAuditAction,
  ReliabilityOpsAuditEventV1,
  stringifyDeterministicReliabilityPayload,
} from './event-schema';

export type ReliabilityOpsAuditRecord = ReliabilityOpsAuditEventV1;

const DATA_DIR = path.join(__dirname, '../../data');
const AUDIT_FILE = path.join(DATA_DIR, 'reliability-ops-audit.jsonl');

const auditRecords: ReliabilityOpsAuditRecord[] = [];

interface OpsRateBucket {
  count: number;
  resetAt: number;
}

const opsRateBuckets = new Map<string, OpsRateBucket>();

function sanitizeDetail(detail?: string): string | undefined {
  if (!detail) return undefined;
  return String(detail).slice(0, 300);
}

function appendAuditRecord(record: ReliabilityOpsAuditRecord): void {
  auditRecords.push(record);
  const maxInMemory = getReliabilityConfig().ops.auditMaxInMemory;
  while (auditRecords.length > maxInMemory) {
    auditRecords.shift();
  }

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(AUDIT_FILE, `${stringifyDeterministicReliabilityPayload(record)}\n`, 'utf8');
  } catch (error: any) {
    console.error('[ReliabilityOps] Failed to persist audit record:', error?.message || error);
  }
}

export function getReliabilityOpsAuditRecords(limit = 50): ReliabilityOpsAuditRecord[] {
  const safeLimit = Math.min(Math.max(1, limit), 500);
  return auditRecords.slice(-safeLimit).reverse();
}

export function auditReliabilityOpsAction(
  req: Request,
  event: {
    action: ReliabilityOpsAuditAction;
    statusCode: number;
    outcome: 'allowed' | 'denied' | 'error';
    detail?: string;
  }
) {
  const user = (req as any).user;
  appendAuditRecord({
    schemaVersion: 'v1',
    id: `ops-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: event.action,
    statusCode: event.statusCode,
    outcome: event.outcome,
    actorId: String(user?.id || 'unknown'),
    authMethod: String(user?.authMethod || 'unknown'),
    ip: String((req.headers['x-forwarded-for'] as string) || req.ip || req.socket?.remoteAddress || 'unknown'),
    userAgent: String(req.get('user-agent') || 'unknown').slice(0, 200),
    path: req.path,
    method: req.method,
    detail: sanitizeDetail(event.detail),
    createdAt: new Date().toISOString(),
  });
}

export function reliabilityOpsRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const { rateWindowMs: windowMs, rateMax: max } = getReliabilityConfig().ops;

  const user = (req as any).user;
  const key = `${String(user?.id || 'anon')}::${req.ip || 'unknown'}`;
  const now = Date.now();
  const existing = opsRateBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    opsRateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  existing.count += 1;
  if (existing.count > max) {
    res.setHeader('Retry-After', Math.ceil((existing.resetAt - now) / 1000));
    auditReliabilityOpsAction(req, {
      action: 'dlq_read',
      statusCode: 429,
      outcome: 'denied',
      detail: 'Rate limit exceeded',
    });
    return res.status(429).json({
      error: 'Too many reliability ops requests. Slow down and retry.',
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    });
  }

  next();
}

export function requireReliabilityOpsAccess(
  req: Request,
  res: Response,
  next: NextFunction,
  mode: 'read' | 'write'
) {
  const { requireOperatorKey, requireNonPublicAuth: requireNonPublic, allowDemoWrite, keys: validKeys } = getReliabilityConfig().ops;

  const user = (req as any).user;
  const authMethod = String(user?.authMethod || 'unknown');
  const actorId = String(user?.id || 'unknown');

  if (requireNonPublic && authMethod === 'public') {
    auditReliabilityOpsAction(req, {
      action: mode === 'write' ? 'dlq_replay_request' : 'dlq_read',
      statusCode: 403,
      outcome: 'denied',
      detail: 'Public auth disabled for reliability ops',
    });
    return res.status(403).json({ error: 'Public auth disabled for reliability ops endpoints' });
  }

  if (!allowDemoWrite && mode === 'write' && actorId === 'demo-user') {
    auditReliabilityOpsAction(req, {
      action: 'dlq_replay_request',
      statusCode: 403,
      outcome: 'denied',
      detail: 'Demo user write disabled',
    });
    return res.status(403).json({ error: 'Demo user is read-only for reliability ops endpoints' });
  }

  if (!requireOperatorKey) {
    return next();
  }

  const headerKey = String(req.get('x-ops-key') || '');

  if (!headerKey || validKeys.length === 0 || !validKeys.includes(headerKey)) {
    auditReliabilityOpsAction(req, {
      action: mode === 'write' ? 'dlq_replay_request' : 'dlq_read',
      statusCode: 403,
      outcome: 'denied',
      detail: 'Missing or invalid x-ops-key',
    });
    return res.status(403).json({
      error: 'Forbidden: valid x-ops-key required for reliability ops',
    });
  }

  return next();
}

export function resetReliabilityOpsSafetyForTest() {
  auditRecords.splice(0, auditRecords.length);
  opsRateBuckets.clear();
  if (fs.existsSync(AUDIT_FILE)) {
    try {
      fs.unlinkSync(AUDIT_FILE);
    } catch {}
  }
}
