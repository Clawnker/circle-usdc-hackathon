import * as fs from 'fs';
import * as path from 'path';

export type IdempotencyStatus = 'in_progress' | 'completed' | 'failed';

export interface IdempotencyRecord<T = any> {
  key: string;
  fingerprint: string;
  status: IdempotencyStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  taskId?: string;
  response?: T;
  error?: string;
}

interface StoreFile<T = any> {
  records: Record<string, IdempotencyRecord<T>>;
}

export class IdempotencyStore<T = any> {
  private records = new Map<string, IdempotencyRecord<T>>();

  constructor(private readonly filePath: string, private readonly ttlMs: number) {
    this.load();
  }

  reserve(key: string, fingerprint: string, taskId?: string): { duplicate: boolean; record: IdempotencyRecord<T> } {
    this.pruneExpired();
    const now = new Date();
    const existing = this.records.get(key);

    if (existing && existing.fingerprint === fingerprint) {
      return { duplicate: true, record: existing };
    }

    const created: IdempotencyRecord<T> = {
      key,
      fingerprint,
      status: 'in_progress',
      taskId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
    };

    this.records.set(key, created);
    this.persist();
    return { duplicate: false, record: created };
  }

  complete(key: string, response: T, taskId?: string): void {
    const existing = this.records.get(key);
    if (!existing) return;

    const updated: IdempotencyRecord<T> = {
      ...existing,
      status: 'completed',
      response,
      taskId: taskId ?? existing.taskId,
      updatedAt: new Date().toISOString(),
    };

    this.records.set(key, updated);
    this.persist();
  }

  fail(key: string, error: string): void {
    const existing = this.records.get(key);
    if (!existing) return;

    const updated: IdempotencyRecord<T> = {
      ...existing,
      status: 'failed',
      error,
      updatedAt: new Date().toISOString(),
    };

    this.records.set(key, updated);
    this.persist();
  }

  get(key: string): IdempotencyRecord<T> | undefined {
    this.pruneExpired();
    return this.records.get(key);
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as StoreFile<T>;
      Object.values(parsed.records || {}).forEach((record) => {
        this.records.set(record.key, record);
      });
      this.pruneExpired();
    } catch (error: any) {
      console.error('[IdempotencyStore] Failed to load:', error.message);
    }
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const payload: StoreFile<T> = { records: Object.fromEntries(this.records.entries()) };
      fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (error: any) {
      console.error('[IdempotencyStore] Failed to persist:', error.message);
    }
  }

  private pruneExpired(): void {
    const now = Date.now();
    let changed = false;
    for (const [key, record] of this.records.entries()) {
      if (new Date(record.expiresAt).getTime() <= now) {
        this.records.delete(key);
        changed = true;
      }
    }
    if (changed) this.persist();
  }
}

const DATA_DIR = path.join(__dirname, '../../data');
const IDEMPOTENCY_FILE = path.join(DATA_DIR, 'idempotency.json');
const PROCESSING_FILE = path.join(DATA_DIR, 'processing-idempotency.json');

const ttlMs = Number(process.env.IDEMPOTENCY_TTL_MS || 15 * 60 * 1000);
const processingTtlMs = Number(process.env.PROCESSING_IDEMPOTENCY_TTL_MS || 6 * 60 * 60 * 1000);

export const dispatchIdempotencyStore = new IdempotencyStore<any>(IDEMPOTENCY_FILE, ttlMs);
export const processingIdempotencyStore = new IdempotencyStore<any>(PROCESSING_FILE, processingTtlMs);
