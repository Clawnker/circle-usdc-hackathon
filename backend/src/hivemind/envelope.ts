export const ENVELOPE_VERSION_V1 = 1 as const;

export interface HivemindEnvelopeV1<TPayload = unknown> {
  version: typeof ENVELOPE_VERSION_V1;
  messageId: string;
  createdAt: string;
  source: string;
  type: string;
  payload: TPayload;
  meta?: Record<string, unknown>;
}

export interface LegacyEnvelope<TPayload = unknown> {
  id?: string;
  messageId?: string;
  timestamp?: string;
  createdAt?: string;
  kind?: string;
  type?: string;
  source?: string;
  payload?: TPayload;
  meta?: Record<string, unknown>;
}

export class EnvelopeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvelopeValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function ensureNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EnvelopeValidationError(`Invalid envelope field: ${field}`);
  }
  return value;
}

function normalizeIsoDate(value: unknown, field: string): string {
  const raw = ensureNonEmptyString(value, field);
  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw new EnvelopeValidationError(`Invalid envelope field: ${field}`);
  }

  return parsed.toISOString();
}

/**
 * Backward-compatible parser for legacy (versionless) payloads and v1 envelopes.
 */
export function parseEnvelopeV1<TPayload = unknown>(input: unknown): HivemindEnvelopeV1<TPayload> {
  if (!isRecord(input)) {
    throw new EnvelopeValidationError('Envelope must be an object');
  }

  const incomingVersion = input.version;

  if (incomingVersion === undefined || incomingVersion === null) {
    const legacy = input as LegacyEnvelope<TPayload>;
    return {
      version: ENVELOPE_VERSION_V1,
      messageId: ensureNonEmptyString(legacy.messageId ?? legacy.id, 'messageId'),
      createdAt: normalizeIsoDate(legacy.createdAt ?? legacy.timestamp, 'createdAt'),
      source: ensureNonEmptyString(legacy.source ?? 'legacy', 'source'),
      type: ensureNonEmptyString(legacy.type ?? legacy.kind, 'type'),
      payload: legacy.payload as TPayload,
      ...(legacy.meta ? { meta: legacy.meta } : {}),
    };
  }

  if (incomingVersion !== ENVELOPE_VERSION_V1) {
    throw new EnvelopeValidationError(`Unsupported envelope version: ${String(incomingVersion)}`);
  }

  return {
    version: ENVELOPE_VERSION_V1,
    messageId: ensureNonEmptyString(input.messageId, 'messageId'),
    createdAt: normalizeIsoDate(input.createdAt, 'createdAt'),
    source: ensureNonEmptyString(input.source, 'source'),
    type: ensureNonEmptyString(input.type, 'type'),
    payload: input.payload as TPayload,
    ...(isRecord(input.meta) ? { meta: input.meta } : {}),
  };
}
