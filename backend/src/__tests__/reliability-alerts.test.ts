import { enqueueDlq, requestDlqReplay, resetDlqForTest } from '../reliability/dlq';
import { startDlqReplayWorker, stopDlqReplayWorker } from '../reliability/dlq-replay-worker';
import { recordDispatchSlo, resetDispatchSloForTest } from '../reliability/slo';
import { buildSloDegradedEvent, emitReliabilityEvent } from '../reliability/alerts';
import { resetReliabilityConfigForTest } from '../reliability/config';

describe('reliability alert routing hooks', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetReliabilityConfigForTest();
    stopDlqReplayWorker();

    process.env.RELIABILITY_ALERTS_ENABLED = 'true';
    process.env.RELIABILITY_ALERTS_WEBHOOK_URL = 'https://alerts.example.test/hook';
    process.env.RELIABILITY_ALERTS_CONSOLE = 'false';
    delete process.env.RELIABILITY_ALERTS_WEBHOOK_SECRET;

    process.env.SLO_ALERT_MIN_SAMPLES = '5';
    process.env.SLO_ALERT_COOLDOWN_MS = '0';
    process.env.SLO_MAX_ERROR_RATE = '0.2';
    process.env.SLO_MAX_P95_MS = '1000';

    resetReliabilityConfigForTest();
    resetDispatchSloForTest();
    resetDlqForTest();

    global.fetch = jest.fn(async () => ({ ok: true, status: 200 } as any)) as any;
  });

  afterEach(() => {
    stopDlqReplayWorker();
    resetDispatchSloForTest();
    resetDlqForTest();
    global.fetch = originalFetch;

    delete process.env.RELIABILITY_ALERTS_ENABLED;
    delete process.env.RELIABILITY_ALERTS_WEBHOOK_URL;
    delete process.env.RELIABILITY_ALERTS_CONSOLE;
    delete process.env.RELIABILITY_ALERTS_WEBHOOK_SECRET;
    delete process.env.SLO_ALERT_MIN_SAMPLES;
    delete process.env.SLO_ALERT_COOLDOWN_MS;
    delete process.env.SLO_MAX_ERROR_RATE;
    delete process.env.SLO_MAX_P95_MS;
  });

  it('delivers structured reliability events to webhook adapter', async () => {
    await emitReliabilityEvent(buildSloDegradedEvent({
      reasons: ['errorRate=0.5>0.2'],
      total: 10,
      failures: 5,
      errorRate: 0.5,
      p95Ms: 1200,
      maxErrorRate: 0.2,
      maxP95Ms: 1000,
    }));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, request] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('alerts.example.test');
    expect(request.method).toBe('POST');

    const payload = JSON.parse(String(request.body));
    expect(payload.type).toBe('dispatch_slo_degraded');
    expect(payload.schemaVersion).toBe('v1');
    expect(payload.payload.errorRate).toBe(0.5);
  });

  it('emits dispatch_slo_degraded when SLO budget breaches', async () => {
    for (let i = 0; i < 6; i++) {
      recordDispatchSlo(i < 2 ? 'failure' : 'success', i < 2 ? 2500 : 300);
    }

    await new Promise((resolve) => setTimeout(resolve, 20));

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const eventBodies = calls.map(([, req]) => JSON.parse(String(req.body)));
    expect(eventBodies.some((body) => body.type === 'dispatch_slo_degraded')).toBe(true);
  });

  it('emits dlq_replay_failed when replay worker fails a record', async () => {
    const record = enqueueDlq({
      taskId: 'task-alert-1',
      specialist: 'scribe',
      reason: 'transient upstream timeout',
      transient: true,
      payload: { prompt: 'retry me' },
    });

    requestDlqReplay(record.id);

    startDlqReplayWorker({
      enabled: true,
      intervalMs: 10,
      maxBatchSize: 1,
      guardrails: {
        minRecordAgeMs: 0,
        minRetryIntervalMs: 0,
      },
      replayHandler: async () => ({ success: false, error: 'upstream unavailable' }),
    });

    await new Promise((resolve) => setTimeout(resolve, 80));

    const calls = (global.fetch as jest.Mock).mock.calls;
    const eventBodies = calls.map(([, req]) => JSON.parse(String(req.body)));
    const replayFailure = eventBodies.find((body) => body.type === 'dlq_replay_failed');
    expect(replayFailure).toBeTruthy();
    expect(replayFailure.payload.recordId).toBe(record.id);
    expect(replayFailure.payload.error).toContain('upstream unavailable');
  });
});
