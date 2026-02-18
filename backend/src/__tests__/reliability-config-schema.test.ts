import { buildReliabilityConfig, resetReliabilityConfigForTest } from '../reliability/config';
import { buildSloDegradedEvent } from '../reliability/alerts';
import { stringifyDeterministicReliabilityPayload } from '../reliability/event-schema';

describe('reliability config normalization + schema determinism', () => {
  afterEach(() => {
    resetReliabilityConfigForTest();
  });

  it('normalizes reliability defaults from empty env', () => {
    const config = buildReliabilityConfig({} as NodeJS.ProcessEnv);
    expect(config.slo.maxErrorRate).toBe(0.05);
    expect(config.alerts.enabled).toBe(false);
    expect(config.dlqReplay.batchSize).toBe(5);
  });

  it('fails fast on invalid bounded env values', () => {
    expect(() =>
      buildReliabilityConfig({
        SLO_MAX_ERROR_RATE: '1.5',
      } as NodeJS.ProcessEnv)
    ).toThrow(/SLO_MAX_ERROR_RATE/);

    expect(() =>
      buildReliabilityConfig({
        RETRY_BASE_DELAY_MS: '500',
        RETRY_MAX_DELAY_MS: '100',
      } as NodeJS.ProcessEnv)
    ).toThrow(/RETRY_BASE_DELAY_MS/);
  });

  it('emits deterministic v1 alert payload shape', () => {
    const event = buildSloDegradedEvent({
      reasons: ['errorRate=0.5>0.2'],
      total: 10,
      failures: 5,
      errorRate: 0.5,
      p95Ms: 1200,
      maxErrorRate: 0.2,
      maxP95Ms: 1000,
    });

    const serialized = stringifyDeterministicReliabilityPayload(event);
    expect(event.schemaVersion).toBe('v1');
    expect(serialized).toContain('"schemaVersion":"v1"');
    expect(serialized.indexOf('"at"')).toBeLessThan(serialized.indexOf('"payload"'));
  });
});
