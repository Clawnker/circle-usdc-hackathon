import * as fs from 'fs';
import * as path from 'path';
import { IdempotencyStore } from '../reliability/idempotency-store';
import { withRetry } from '../reliability/retry';
import { enqueueDlq, getDlqRecords } from '../reliability/dlq';

describe('reliability primitives', () => {
  it('dedupes by idempotency key + fingerprint and replays stored response', () => {
    const file = path.join(__dirname, '../../data/test-idempotency.json');
    if (fs.existsSync(file)) fs.unlinkSync(file);

    const store = new IdempotencyStore(file, 60000);
    const first = store.reserve('key-1', 'fp-1', 'task-1');
    expect(first.duplicate).toBe(false);

    store.complete('key-1', { taskId: 'task-1', status: 'pending' }, 'task-1');

    const duplicate = store.reserve('key-1', 'fp-1');
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.record.response).toMatchObject({ taskId: 'task-1' });

    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  it('retries transient failures with backoff then succeeds', async () => {
    let attempts = 0;
    const out = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('ETIMEDOUT temporary failure');
        return 'ok';
      },
      { baseDelayMs: 1, maxDelayMs: 5 }
    );

    expect(out).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('adds exhausted transient failures to DLQ skeleton', () => {
    const before = getDlqRecords(5).length;
    enqueueDlq({
      taskId: 'task-dlq-1',
      specialist: 'seeker',
      reason: 'timeout after retries',
      transient: true,
      payload: { test: true },
    });
    const after = getDlqRecords(5).length;
    expect(after).toBeGreaterThanOrEqual(before + 1);
  });
});
