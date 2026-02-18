export interface ReliabilityConfig {
  retry: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
  slo: {
    maxErrorRate: number;
    maxP95Ms: number;
    alertMinSamples: number;
    alertCooldownMs: number;
    persistenceEnabled: boolean;
    maxPersistedSamples: number;
  };
  alerts: {
    enabled: boolean;
    includeConsole: boolean;
    webhookUrl?: string;
    webhookTimeoutMs: number;
    webhookSecret?: string;
  };
  ops: {
    requireOperatorKey: boolean;
    keys: string[];
    requireNonPublicAuth: boolean;
    allowDemoWrite: boolean;
    rateWindowMs: number;
    rateMax: number;
    auditMaxInMemory: number;
  };
  dlqReplay: {
    workerEnabled: boolean;
    intervalMs: number;
    batchSize: number;
    maxCount: number;
    minAgeMs: number;
    minRetryIntervalMs: number;
    requireTransient: boolean;
  };
  featureFlags: {
    enableIdempotency: boolean;
    enableRetry: boolean;
  };
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`expected "true" or "false" but got "${raw}"`);
}

function parseNumber(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a finite number`);
  }
  return parsed;
}

function parseIntBounded(raw: string | undefined, fallback: number, name: string, min: number, max?: number): number {
  const parsed = Math.floor(parseNumber(raw, fallback, name));
  if (parsed < min) throw new Error(`${name} must be >= ${min}`);
  if (max !== undefined && parsed > max) throw new Error(`${name} must be <= ${max}`);
  return parsed;
}

function parseFloatBounded(raw: string | undefined, fallback: number, name: string, min: number, max: number): number {
  const parsed = parseNumber(raw, fallback, name);
  if (parsed < min || parsed > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return parsed;
}

function parseKeys(raw: string | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

let cachedConfig: ReliabilityConfig | null = null;

export function buildReliabilityConfig(env: NodeJS.ProcessEnv = process.env): ReliabilityConfig {
  const config: ReliabilityConfig = {
    retry: {
      maxAttempts: parseIntBounded(env.RETRY_MAX_ATTEMPTS, 3, 'RETRY_MAX_ATTEMPTS', 1, 20),
      baseDelayMs: parseIntBounded(env.RETRY_BASE_DELAY_MS, 250, 'RETRY_BASE_DELAY_MS', 1, 60_000),
      maxDelayMs: parseIntBounded(env.RETRY_MAX_DELAY_MS, 2000, 'RETRY_MAX_DELAY_MS', 1, 300_000),
    },
    slo: {
      maxErrorRate: parseFloatBounded(env.SLO_MAX_ERROR_RATE, 0.05, 'SLO_MAX_ERROR_RATE', 0, 1),
      maxP95Ms: parseIntBounded(env.SLO_MAX_P95_MS, 2500, 'SLO_MAX_P95_MS', 1, 300_000),
      alertMinSamples: parseIntBounded(env.SLO_ALERT_MIN_SAMPLES, 20, 'SLO_ALERT_MIN_SAMPLES', 1, 1_000_000),
      alertCooldownMs: parseIntBounded(env.SLO_ALERT_COOLDOWN_MS, 60_000, 'SLO_ALERT_COOLDOWN_MS', 0, 86_400_000),
      persistenceEnabled: parseBoolean(env.SLO_PERSISTENCE_ENABLED, true),
      maxPersistedSamples: parseIntBounded(env.SLO_MAX_PERSISTED_SAMPLES, 5000, 'SLO_MAX_PERSISTED_SAMPLES', 10, 1_000_000),
    },
    alerts: {
      enabled: parseBoolean(env.RELIABILITY_ALERTS_ENABLED, false),
      includeConsole: parseBoolean(env.RELIABILITY_ALERTS_CONSOLE, true),
      webhookUrl: env.RELIABILITY_ALERTS_WEBHOOK_URL || undefined,
      webhookTimeoutMs: parseIntBounded(env.RELIABILITY_ALERTS_WEBHOOK_TIMEOUT_MS, 3000, 'RELIABILITY_ALERTS_WEBHOOK_TIMEOUT_MS', 500, 120_000),
      webhookSecret: env.RELIABILITY_ALERTS_WEBHOOK_SECRET || undefined,
    },
    ops: {
      requireOperatorKey: parseBoolean(env.RELIABILITY_OPS_REQUIRE_OPERATOR_KEY, false),
      keys: parseKeys(env.RELIABILITY_OPS_KEYS),
      requireNonPublicAuth: parseBoolean(env.RELIABILITY_OPS_REQUIRE_NON_PUBLIC_AUTH, false),
      allowDemoWrite: parseBoolean(env.RELIABILITY_OPS_ALLOW_DEMO_WRITE, true),
      rateWindowMs: parseIntBounded(env.RELIABILITY_OPS_RATE_WINDOW_MS, 60_000, 'RELIABILITY_OPS_RATE_WINDOW_MS', 1000, 3_600_000),
      rateMax: parseIntBounded(env.RELIABILITY_OPS_RATE_MAX, 120, 'RELIABILITY_OPS_RATE_MAX', 1, 100_000),
      auditMaxInMemory: parseIntBounded(env.RELIABILITY_OPS_AUDIT_MAX_IN_MEMORY, 1000, 'RELIABILITY_OPS_AUDIT_MAX_IN_MEMORY', 100, 100_000),
    },
    dlqReplay: {
      workerEnabled: parseBoolean(env.RELIABILITY_DLQ_REPLAY_WORKER_ENABLED, false),
      intervalMs: parseIntBounded(env.RELIABILITY_DLQ_REPLAY_INTERVAL_MS, 15_000, 'RELIABILITY_DLQ_REPLAY_INTERVAL_MS', 1000, 3_600_000),
      batchSize: parseIntBounded(env.RELIABILITY_DLQ_REPLAY_BATCH_SIZE, 5, 'RELIABILITY_DLQ_REPLAY_BATCH_SIZE', 1, 1000),
      maxCount: parseIntBounded(env.RELIABILITY_DLQ_REPLAY_MAX_COUNT, 3, 'RELIABILITY_DLQ_REPLAY_MAX_COUNT', 0, 1000),
      minAgeMs: parseIntBounded(env.RELIABILITY_DLQ_REPLAY_MIN_AGE_MS, 15_000, 'RELIABILITY_DLQ_REPLAY_MIN_AGE_MS', 0, 86_400_000),
      minRetryIntervalMs: parseIntBounded(env.RELIABILITY_DLQ_REPLAY_MIN_RETRY_INTERVAL_MS, 10_000, 'RELIABILITY_DLQ_REPLAY_MIN_RETRY_INTERVAL_MS', 0, 86_400_000),
      requireTransient: parseBoolean(env.RELIABILITY_DLQ_REPLAY_REQUIRE_TRANSIENT, true),
    },
    featureFlags: {
      enableIdempotency: parseBoolean(env.RELIABILITY_ENABLE_IDEMPOTENCY, true),
      enableRetry: parseBoolean(env.RELIABILITY_ENABLE_RETRY, true),
    },
  };

  if (config.retry.baseDelayMs > config.retry.maxDelayMs) {
    throw new Error('RETRY_BASE_DELAY_MS must be <= RETRY_MAX_DELAY_MS');
  }
  if (config.ops.requireOperatorKey && config.ops.keys.length === 0) {
    throw new Error('RELIABILITY_OPS_KEYS must be set when RELIABILITY_OPS_REQUIRE_OPERATOR_KEY=true');
  }

  return config;
}

export function getReliabilityConfig(): ReliabilityConfig {
  if (!cachedConfig) {
    cachedConfig = buildReliabilityConfig(process.env);
  }
  return cachedConfig;
}

export function validateReliabilityConfigOrThrow(): ReliabilityConfig {
  const config = buildReliabilityConfig(process.env);
  cachedConfig = config;
  return config;
}

export function resetReliabilityConfigForTest() {
  cachedConfig = null;
}
