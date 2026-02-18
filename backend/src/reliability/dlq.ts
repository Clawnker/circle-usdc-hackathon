import * as fs from 'fs';
import * as path from 'path';

export type DlqStatus = 'queued' | 'replay_requested' | 'replayed';

export interface DlqRecord {
  id: string;
  taskId?: string;
  specialist?: string;
  reason: string;
  transient: boolean;
  payload?: Record<string, any>;
  createdAt: string;
  status?: DlqStatus;
  replayCount?: number;
  lastReplayRequestedAt?: string;
  lastReplayAttemptAt?: string;
  lastReplayOutcome?: 'success' | 'failed' | 'guardrail_skipped';
  lastReplayError?: string;
}

const DATA_DIR = path.join(__dirname, '../../data');
const DLQ_FILE = path.join(DATA_DIR, 'dlq.json');

const records: DlqRecord[] = [];

function save(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DLQ_FILE, JSON.stringify(records.slice(-1000), null, 2), 'utf8');
  } catch (error: any) {
    console.error('[DLQ] Failed to save:', error.message);
  }
}

function normalize(record: DlqRecord): DlqRecord {
  return {
    ...record,
    status: record.status || 'queued',
    replayCount: Number(record.replayCount || 0),
  };
}

function load(): void {
  try {
    if (!fs.existsSync(DLQ_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(DLQ_FILE, 'utf8')) as DlqRecord[];
    records.push(...(Array.isArray(parsed) ? parsed.map(normalize) : []));
  } catch (error: any) {
    console.error('[DLQ] Failed to load:', error.message);
  }
}

load();

export function enqueueDlq(record: Omit<DlqRecord, 'id' | 'createdAt'>): DlqRecord {
  const item: DlqRecord = normalize({
    id: `dlq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...record,
  });
  records.push(item);
  save();
  return item;
}

export function getDlqRecords(limit = 100): DlqRecord[] {
  return records.slice(-limit).reverse();
}

export function getDlqStats() {
  const stats = {
    total: records.length,
    queued: 0,
    replayRequested: 0,
    replayed: 0,
    transient: 0,
    guardrailSkipped: 0,
    replayFailed: 0,
  };

  for (const record of records) {
    if (record.transient) stats.transient += 1;
    if ((record.status || 'queued') === 'queued') stats.queued += 1;
    if (record.status === 'replay_requested') stats.replayRequested += 1;
    if (record.status === 'replayed') stats.replayed += 1;
    if (record.lastReplayOutcome === 'guardrail_skipped') stats.guardrailSkipped += 1;
    if (record.lastReplayOutcome === 'failed') stats.replayFailed += 1;
  }

  return {
    ...stats,
    updatedAt: new Date().toISOString(),
    file: DLQ_FILE,
  };
}

export function requestDlqReplay(id: string, options: { dryRun?: boolean } = {}) {
  const record = records.find((r) => r.id === id);
  if (!record) return null;

  if (!options.dryRun) {
    record.status = 'replay_requested';
    record.replayCount = Number(record.replayCount || 0) + 1;
    record.lastReplayRequestedAt = new Date().toISOString();
    record.lastReplayOutcome = undefined;
    record.lastReplayError = undefined;
    save();
  }

  return {
    id: record.id,
    dryRun: Boolean(options.dryRun),
    status: record.status || 'queued',
    replayCount: Number(record.replayCount || 0),
    specialist: record.specialist,
    taskId: record.taskId,
    payload: record.payload,
    reason: record.reason,
  };
}

export function getReplayRequestedRecords(limit = 25): DlqRecord[] {
  if (limit <= 0) return [];
  return records
    .filter((r) => r.status === 'replay_requested')
    .sort((a, b) => {
      const aTs = Date.parse(a.lastReplayRequestedAt || a.createdAt);
      const bTs = Date.parse(b.lastReplayRequestedAt || b.createdAt);
      return aTs - bTs;
    })
    .slice(0, limit);
}

export function markDlqReplayAttempt(
  id: string,
  attempt: {
    outcome: 'success' | 'failed' | 'guardrail_skipped';
    error?: string;
    replayed?: boolean;
  }
): DlqRecord | null {
  const record = records.find((r) => r.id === id);
  if (!record) return null;

  record.lastReplayAttemptAt = new Date().toISOString();
  record.lastReplayOutcome = attempt.outcome;
  record.lastReplayError = attempt.error ? String(attempt.error).slice(0, 500) : undefined;
  if (attempt.replayed) {
    record.status = 'replayed';
  }

  save();
  return record;
}

export function resetDlqForTest() {
  records.splice(0, records.length);
  if (fs.existsSync(DLQ_FILE)) {
    try { fs.unlinkSync(DLQ_FILE); } catch {}
  }
}
