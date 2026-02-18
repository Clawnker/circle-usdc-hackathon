import * as fs from 'fs';
import * as path from 'path';
import { buildSloDegradedEvent, emitReliabilityEvent } from './alerts';
import { getReliabilityConfig } from './config';

type DispatchOutcome = 'success' | 'failure';

interface DispatchSample {
  at: number;
  durationMs: number;
  outcome: DispatchOutcome;
}

const WINDOW_MS = 15 * 60 * 1000;
const DATA_DIR = path.join(__dirname, '../../data');
const SLO_FILE = path.join(DATA_DIR, 'dispatch-slo.json');

const samples: DispatchSample[] = [];
let lastAlertAt = 0;

function persistEnabled(): boolean {
  return getReliabilityConfig().slo.persistenceEnabled;
}

function maxPersistedSamples(): number {
  return getReliabilityConfig().slo.maxPersistedSamples;
}

function save(now = Date.now()): void {
  if (!persistEnabled()) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload = {
      updatedAt: new Date(now).toISOString(),
      lastAlertAt,
      samples: samples.slice(-maxPersistedSamples()),
    };
    fs.writeFileSync(SLO_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (error: any) {
    console.error('[SLO] Failed to save:', error?.message || String(error));
  }
}

function load(): void {
  if (!persistEnabled()) return;
  try {
    if (!fs.existsSync(SLO_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(SLO_FILE, 'utf8')) as {
      samples?: DispatchSample[];
      lastAlertAt?: number;
    };
    const loaded = Array.isArray(parsed.samples) ? parsed.samples : [];
    samples.push(
      ...loaded.filter((s) => s && typeof s.at === 'number' && typeof s.durationMs === 'number' && (s.outcome === 'success' || s.outcome === 'failure'))
    );
    lastAlertAt = typeof parsed.lastAlertAt === 'number' ? parsed.lastAlertAt : 0;
    prune(Date.now());
  } catch (error: any) {
    console.error('[SLO] Failed to load:', error?.message || String(error));
  }
}

function prune(now = Date.now()) {
  while (samples.length > 0 && now - samples[0].at > WINDOW_MS) {
    samples.shift();
  }
}

load();

export function recordDispatchSlo(outcome: DispatchOutcome, durationMs: number, now = Date.now()) {
  samples.push({ at: now, durationMs: Math.max(0, durationMs), outcome });
  prune(now);
  save(now);

  const sloConfig = getReliabilityConfig().slo;
  const minSamples = sloConfig.alertMinSamples;
  if (samples.length < minSamples) return;

  const snapshot = getDispatchSloSnapshot(now);
  const maxErrorRate = sloConfig.maxErrorRate;
  const maxP95Ms = sloConfig.maxP95Ms;
  const cooldownMs = sloConfig.alertCooldownMs;

  const overErrorBudget = snapshot.errorRate > maxErrorRate;
  const overLatencyBudget = snapshot.p95Ms > maxP95Ms;

  if ((overErrorBudget || overLatencyBudget) && now - lastAlertAt >= cooldownMs) {
    const reasons = [
      overErrorBudget ? `errorRate=${snapshot.errorRate.toFixed(3)}>${maxErrorRate}` : null,
      overLatencyBudget ? `p95=${snapshot.p95Ms}ms>${maxP95Ms}ms` : null,
    ].filter(Boolean) as string[];

    console.warn(`[SLO] Dispatch SLO alert: ${reasons.join(' ')} samples=${snapshot.total}`);

    void emitReliabilityEvent(buildSloDegradedEvent({
      reasons,
      total: snapshot.total,
      failures: snapshot.failures,
      errorRate: snapshot.errorRate,
      p95Ms: snapshot.p95Ms,
      maxErrorRate,
      maxP95Ms,
    }));

    lastAlertAt = now;
    save(now);
  }
}

export function getDispatchSloSnapshot(now = Date.now()) {
  prune(now);
  const total = samples.length;
  const failures = samples.filter((s) => s.outcome === 'failure').length;
  const sorted = samples.map((s) => s.durationMs).sort((a, b) => a - b);
  const p95Index = sorted.length === 0 ? 0 : Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  const p95Ms = sorted.length === 0 ? 0 : sorted[p95Index];

  return {
    total,
    failures,
    errorRate: total > 0 ? failures / total : 0,
    p95Ms,
    windowMs: WINDOW_MS,
    updatedAt: new Date(now).toISOString(),
    persistence: {
      enabled: persistEnabled(),
      file: SLO_FILE,
      lastAlertAt,
    },
  };
}

export function resetDispatchSloForTest() {
  samples.splice(0, samples.length);
  lastAlertAt = 0;
  if (persistEnabled() && fs.existsSync(SLO_FILE)) {
    try { fs.unlinkSync(SLO_FILE); } catch {}
  }
}
