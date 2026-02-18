import { createHash } from 'crypto';
import { getReliabilityConfig } from './config';
import {
  ReliabilityAlertEventV1,
  stringifyDeterministicReliabilityPayload,
} from './event-schema';

async function sendWebhook(event: ReliabilityAlertEventV1, config: ReturnType<typeof getReliabilityConfig>['alerts']): Promise<void> {
  if (!config.webhookUrl) return;

  const body = stringifyDeterministicReliabilityPayload(event);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-reliability-event-type': event.type,
  };

  if (config.webhookSecret) {
    const signature = createHash('sha256').update(`${config.webhookSecret}.${body}`).digest('hex');
    headers['x-reliability-signature'] = signature;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.webhookTimeoutMs);
  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[ReliabilityAlerts] Webhook returned ${response.status} for ${event.type}`);
    }
  } catch (error: any) {
    console.warn(`[ReliabilityAlerts] Webhook delivery failed for ${event.type}: ${error?.message || String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function emitReliabilityEvent(event: ReliabilityAlertEventV1): Promise<void> {
  const config = getReliabilityConfig().alerts;
  if (!config.enabled) return;

  if (config.includeConsole) {
    console.warn(`[ReliabilityAlerts] ${event.type}: ${event.summary}`);
  }

  await sendWebhook(event, config);
}

export function buildSloDegradedEvent(input: {
  reasons: string[];
  total: number;
  failures: number;
  errorRate: number;
  p95Ms: number;
  maxErrorRate: number;
  maxP95Ms: number;
}): ReliabilityAlertEventV1 {
  return {
    schemaVersion: 'v1',
    type: 'dispatch_slo_degraded',
    at: new Date().toISOString(),
    severity: 'warning',
    summary: `Dispatch SLO degraded: ${input.reasons.join(' ')}`,
    payload: {
      reasons: input.reasons,
      total: input.total,
      failures: input.failures,
      errorRate: input.errorRate,
      p95Ms: input.p95Ms,
      thresholds: {
        maxErrorRate: input.maxErrorRate,
        maxP95Ms: input.maxP95Ms,
      },
    },
  };
}

export function buildDlqReplayFailedEvent(input: {
  recordId: string;
  taskId?: string;
  specialist?: string;
  replayCount: number;
  error?: string;
}): ReliabilityAlertEventV1 {
  return {
    schemaVersion: 'v1',
    type: 'dlq_replay_failed',
    at: new Date().toISOString(),
    severity: 'critical',
    summary: `DLQ replay failed for ${input.recordId}`,
    payload: {
      recordId: input.recordId,
      taskId: input.taskId,
      specialist: input.specialist,
      replayCount: input.replayCount,
      error: input.error || 'unknown replay failure',
    },
  };
}
