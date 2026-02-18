export type ReliabilitySchemaVersion = 'v1';

export type ReliabilityAlertType = 'dispatch_slo_degraded' | 'dlq_replay_failed';

export interface ReliabilityAlertEventV1 {
  schemaVersion: ReliabilitySchemaVersion;
  type: ReliabilityAlertType;
  at: string;
  severity: 'warning' | 'critical';
  summary: string;
  payload: Record<string, any>;
}

export type ReliabilityOpsAuditAction =
  | 'slo_read'
  | 'dlq_read'
  | 'dlq_replay_request'
  | 'dlq_replay_worker_read';

export interface ReliabilityOpsAuditEventV1 {
  schemaVersion: ReliabilitySchemaVersion;
  id: string;
  action: ReliabilityOpsAuditAction;
  statusCode: number;
  outcome: 'allowed' | 'denied' | 'error';
  actorId: string;
  authMethod: string;
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  detail?: string;
  createdAt: string;
}

function normalizeValue(value: any): any {
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const sortedEntries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, normalizeValue(v)]);
    return Object.fromEntries(sortedEntries);
  }
  return value;
}

export function normalizeReliabilityPayload<T>(payload: T): T {
  return normalizeValue(payload);
}

export function stringifyDeterministicReliabilityPayload(payload: unknown): string {
  return JSON.stringify(normalizeValue(payload));
}
