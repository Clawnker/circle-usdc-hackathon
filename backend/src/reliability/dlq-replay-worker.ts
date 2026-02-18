import { DlqRecord, getReplayRequestedRecords, markDlqReplayAttempt } from './dlq';
import { buildDlqReplayFailedEvent, emitReliabilityEvent } from './alerts';
import { getReliabilityConfig } from './config';

export interface DlqReplayGuardrails {
  maxReplayCount: number;
  minRecordAgeMs: number;
  minRetryIntervalMs: number;
  requireTransient: boolean;
}

export interface DlqReplayWorkerMetrics {
  enabled: boolean;
  intervalMs: number;
  maxBatchSize: number;
  inFlight: boolean;
  lastRunAt?: string;
  lastCompletedAt?: string;
  lastDurationMs?: number;
  totalRuns: number;
  totalClaimed: number;
  totalSucceeded: number;
  totalFailed: number;
  totalGuardrailSkipped: number;
}

export interface DlqReplayWorkerOptions {
  enabled?: boolean;
  intervalMs?: number;
  maxBatchSize?: number;
  guardrails?: Partial<DlqReplayGuardrails>;
  replayHandler: (record: DlqRecord) => Promise<{ success: boolean; error?: string }>;
}

const defaultGuardrails: DlqReplayGuardrails = {
  maxReplayCount: 3,
  minRecordAgeMs: 15_000,
  minRetryIntervalMs: 10_000,
  requireTransient: true,
};

let timer: NodeJS.Timeout | null = null;

const metrics: DlqReplayWorkerMetrics = {
  enabled: false,
  intervalMs: 15_000,
  maxBatchSize: 5,
  inFlight: false,
  totalRuns: 0,
  totalClaimed: 0,
  totalSucceeded: 0,
  totalFailed: 0,
  totalGuardrailSkipped: 0,
};

function shouldSkipByGuardrail(record: DlqRecord, guardrails: DlqReplayGuardrails): string | null {
  const now = Date.now();
  const createdAt = Date.parse(record.createdAt || '');
  const replayCount = Number(record.replayCount || 0);

  if (guardrails.requireTransient && !record.transient) {
    return 'record is non-transient';
  }

  if (Number.isFinite(createdAt) && now - createdAt < guardrails.minRecordAgeMs) {
    return 'record too fresh';
  }

  if (replayCount > guardrails.maxReplayCount) {
    return `replayCount ${replayCount} exceeds maxReplayCount ${guardrails.maxReplayCount}`;
  }

  const lastAttemptAt = Date.parse(record.lastReplayAttemptAt || '');
  if (Number.isFinite(lastAttemptAt) && now - lastAttemptAt < guardrails.minRetryIntervalMs) {
    return 'replay cooldown window active';
  }

  if (!record.specialist || !record.payload?.prompt) {
    return 'missing specialist or payload.prompt';
  }

  return null;
}

type ResolvedWorkerOptions = {
  enabled: boolean;
  intervalMs: number;
  maxBatchSize: number;
  guardrails: DlqReplayGuardrails;
  replayHandler: NonNullable<DlqReplayWorkerOptions['replayHandler']>;
};

async function runOnce(options: ResolvedWorkerOptions) {
  if (metrics.inFlight) return;
  metrics.inFlight = true;
  metrics.totalRuns += 1;
  metrics.lastRunAt = new Date().toISOString();
  const start = Date.now();

  try {
    const records = getReplayRequestedRecords(options.maxBatchSize);
    for (const record of records) {
      metrics.totalClaimed += 1;

      const blocked = shouldSkipByGuardrail(record, options.guardrails);
      if (blocked) {
        markDlqReplayAttempt(record.id, { outcome: 'guardrail_skipped', error: blocked, replayed: false });
        metrics.totalGuardrailSkipped += 1;
        continue;
      }

      try {
        const result = await options.replayHandler(record);
        if (result.success) {
          markDlqReplayAttempt(record.id, { outcome: 'success', replayed: true });
          metrics.totalSucceeded += 1;
        } else {
          const replayError = result.error || 'unknown replay failure';
          markDlqReplayAttempt(record.id, { outcome: 'failed', error: replayError, replayed: false });
          metrics.totalFailed += 1;
          void emitReliabilityEvent(buildDlqReplayFailedEvent({
            recordId: record.id,
            taskId: record.taskId,
            specialist: record.specialist,
            replayCount: Number(record.replayCount || 0),
            error: replayError,
          }));
        }
      } catch (error: any) {
        const replayError = error?.message || 'worker replay exception';
        markDlqReplayAttempt(record.id, { outcome: 'failed', error: replayError, replayed: false });
        metrics.totalFailed += 1;
        void emitReliabilityEvent(buildDlqReplayFailedEvent({
          recordId: record.id,
          taskId: record.taskId,
          specialist: record.specialist,
          replayCount: Number(record.replayCount || 0),
          error: replayError,
        }));
      }
    }
  } finally {
    metrics.inFlight = false;
    metrics.lastCompletedAt = new Date().toISOString();
    metrics.lastDurationMs = Date.now() - start;
  }
}

export function startDlqReplayWorker(options: DlqReplayWorkerOptions) {
  const dlqConfig = getReliabilityConfig().dlqReplay;
  const resolved: ResolvedWorkerOptions = {
    enabled: options.enabled ?? dlqConfig.workerEnabled,
    intervalMs: Math.max(Number(options.intervalMs ?? dlqConfig.intervalMs), 1000),
    maxBatchSize: Math.max(Number(options.maxBatchSize ?? dlqConfig.batchSize), 1),
    guardrails: {
      ...defaultGuardrails,
      maxReplayCount: Number(options.guardrails?.maxReplayCount ?? dlqConfig.maxCount),
      minRecordAgeMs: Number(options.guardrails?.minRecordAgeMs ?? dlqConfig.minAgeMs),
      minRetryIntervalMs: Number(options.guardrails?.minRetryIntervalMs ?? dlqConfig.minRetryIntervalMs),
      requireTransient: options.guardrails?.requireTransient ?? dlqConfig.requireTransient,
    },
    replayHandler: options.replayHandler,
  };

  metrics.enabled = resolved.enabled;
  metrics.intervalMs = resolved.intervalMs;
  metrics.maxBatchSize = resolved.maxBatchSize;

  if (!resolved.enabled) {
    console.log('[DLQ Replay Worker] Disabled (set RELIABILITY_DLQ_REPLAY_WORKER_ENABLED=true to enable)');
    return { started: false, metrics: getDlqReplayWorkerMetrics() };
  }

  if (timer) clearInterval(timer);

  timer = setInterval(() => {
    runOnce(resolved).catch((error) => {
      console.error('[DLQ Replay Worker] runOnce failed:', error?.message || error);
    });
  }, resolved.intervalMs);

  timer.unref?.();

  console.log(
    `[DLQ Replay Worker] Started. intervalMs=${resolved.intervalMs} batchSize=${resolved.maxBatchSize} maxReplayCount=${resolved.guardrails.maxReplayCount}`
  );

  runOnce(resolved).catch((error) => {
    console.error('[DLQ Replay Worker] initial run failed:', error?.message || error);
  });

  return { started: true, metrics: getDlqReplayWorkerMetrics() };
}

export function stopDlqReplayWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  metrics.enabled = false;
}

export function getDlqReplayWorkerMetrics(): DlqReplayWorkerMetrics {
  return { ...metrics };
}
