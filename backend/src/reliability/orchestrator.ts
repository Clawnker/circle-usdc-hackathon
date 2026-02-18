import { DlqRecord, getDlqRecords, getDlqStats, requestDlqReplay } from './dlq';
import { getDlqReplayWorkerMetrics } from './dlq-replay-worker';
import { getReliabilityOpsAuditRecords } from './ops-safety';
import { getDispatchSloSnapshot } from './slo';
import { getReliabilityConfig } from './config';

export function getReliabilitySloView() {
  const snapshot = getDispatchSloSnapshot();
  const { maxErrorRate, maxP95Ms } = getReliabilityConfig().slo;
  const healthy = snapshot.errorRate <= maxErrorRate && snapshot.p95Ms <= maxP95Ms;

  return {
    snapshot,
    thresholds: { maxErrorRate, maxP95Ms },
    recommendation: healthy
      ? {
          level: 'healthy' as const,
          action: 'Continue rollout. Keep canary percentage steady or expand gradually.',
        }
      : {
          level: 'degraded' as const,
          action: 'Pause rollout expansion. Reduce canary % or enable DISPATCH_KILL_SWITCH=true while triaging.',
        },
  };
}

export function getReliabilityDlqView(limit = 50) {
  const safeLimit = Math.min(Math.max(1, limit), 200);
  return {
    stats: getDlqStats(),
    records: getDlqRecords(safeLimit),
  };
}

export function requestReliabilityDlqReplay(id: string, dryRun: boolean) {
  return requestDlqReplay(id, { dryRun });
}

export function getReliabilityReplayWorkerView() {
  return { worker: getDlqReplayWorkerMetrics() };
}

export function getReliabilityAuditView(limit = 50) {
  const safeLimit = Math.min(Math.max(1, limit), 500);
  return {
    records: getReliabilityOpsAuditRecords(safeLimit),
    note: 'Most recent reliability ops actions. File-backed JSONL at data/reliability-ops-audit.jsonl',
  };
}

export async function executeDlqReplayRecord(
  record: DlqRecord,
  replayExecutor: (specialistId: string, prompt: string, metadata: Record<string, any>) => Promise<{ success: boolean; data?: any }>
): Promise<{ success: boolean; error?: string }> {
  const specialistId = String(record.specialist || '').trim();
  const prompt = String(record.payload?.prompt || '').trim();
  if (!specialistId || !prompt) {
    return { success: false, error: 'missing specialist or payload.prompt' };
  }

  const result = await replayExecutor(specialistId, prompt, {
    id: record.taskId,
    replaySource: record.id,
  });

  if (result.success) {
    return { success: true };
  }

  return {
    success: false,
    error: String(result.data?.error || 'specialist replay failed'),
  };
}
