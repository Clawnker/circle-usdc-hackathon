import { enqueueDlq, getDlqRecords, requestDlqReplay, resetDlqForTest } from '../reliability/dlq';
import { getDlqReplayWorkerMetrics, startDlqReplayWorker, stopDlqReplayWorker } from '../reliability/dlq-replay-worker';

describe('dlq replay worker', () => {
  afterEach(() => {
    stopDlqReplayWorker();
    resetDlqForTest();
  });

  it('replays replay_requested transient records and marks them replayed', async () => {
    const item = enqueueDlq({
      taskId: 'task-replay-worker-1',
      specialist: 'scribe',
      reason: 'timeout',
      transient: true,
      payload: { prompt: 'hello' },
    });

    requestDlqReplay(item.id);

    startDlqReplayWorker({
      enabled: true,
      intervalMs: 20,
      maxBatchSize: 2,
      guardrails: {
        minRecordAgeMs: 0,
        minRetryIntervalMs: 0,
        maxReplayCount: 5,
      },
      replayHandler: async () => ({ success: true }),
    });

    await new Promise((resolve) => setTimeout(resolve, 80));

    const updated = getDlqRecords(10).find((r) => r.id === item.id);
    expect(updated?.status).toBe('replayed');
    expect(updated?.lastReplayOutcome).toBe('success');

    const metrics = getDlqReplayWorkerMetrics();
    expect(metrics.totalSucceeded).toBeGreaterThanOrEqual(1);
  });

  it('applies guardrails and skips non-transient records', async () => {
    const item = enqueueDlq({
      taskId: 'task-replay-worker-2',
      specialist: 'scribe',
      reason: 'manual review',
      transient: false,
      payload: { prompt: 'manual' },
    });

    requestDlqReplay(item.id);

    startDlqReplayWorker({
      enabled: true,
      intervalMs: 20,
      maxBatchSize: 2,
      guardrails: {
        minRecordAgeMs: 0,
        minRetryIntervalMs: 0,
        requireTransient: true,
      },
      replayHandler: async () => ({ success: true }),
    });

    await new Promise((resolve) => setTimeout(resolve, 80));

    const updated = getDlqRecords(10).find((r) => r.id === item.id);
    expect(updated?.status).toBe('replay_requested');
    expect(updated?.lastReplayOutcome).toBe('guardrail_skipped');
    expect(updated?.lastReplayError).toMatch(/non-transient/i);

    const metrics = getDlqReplayWorkerMetrics();
    expect(metrics.totalGuardrailSkipped).toBeGreaterThanOrEqual(1);
  });
});
