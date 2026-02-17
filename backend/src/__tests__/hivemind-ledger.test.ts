import { parseEnvelopeV1, EnvelopeValidationError } from '../hivemind/envelope';
import {
  applyLedgerTransitionV1,
  createLedgerStateV1,
  LedgerTransitionError,
  LedgerTransitionPayload,
  reconcileLedgerTransitionsV1,
} from '../hivemind/ledger';

function transitionEnvelope(params: {
  messageId: string;
  seq: number;
  op: 'credit' | 'debit';
  account: string;
  amount: number;
}) {
  return parseEnvelopeV1<LedgerTransitionPayload>({
    version: 1,
    messageId: params.messageId,
    createdAt: '2026-02-17T20:00:00.000Z',
    source: 'test',
    type: 'ledger.transition',
    payload: {
      seq: params.seq,
      op: params.op,
      account: params.account,
      amount: params.amount,
    },
  });
}

describe('hivemind envelope v1 parsing', () => {
  it('accepts explicit v1 envelope', () => {
    const envelope = parseEnvelopeV1({
      version: 1,
      messageId: 'msg-1',
      createdAt: '2026-02-17T20:00:00Z',
      source: 'scheduler',
      type: 'ledger.transition',
      payload: { seq: 1, op: 'credit', account: 'alice', amount: 10 },
    });

    expect(envelope.version).toBe(1);
    expect(envelope.createdAt).toBe('2026-02-17T20:00:00.000Z');
  });

  it('normalizes legacy versionless envelope into v1', () => {
    const envelope = parseEnvelopeV1({
      id: 'legacy-1',
      timestamp: '2026-02-17T20:00:00Z',
      source: 'legacy-dispatcher',
      kind: 'ledger.transition',
      payload: { seq: 1, op: 'credit', account: 'alice', amount: 10 },
    });

    expect(envelope).toMatchObject({
      version: 1,
      messageId: 'legacy-1',
      type: 'ledger.transition',
      source: 'legacy-dispatcher',
    });
  });

  it('rejects unsupported envelope version', () => {
    expect(() =>
      parseEnvelopeV1({
        version: 2,
        messageId: 'msg-2',
        createdAt: '2026-02-17T20:00:00Z',
        source: 'test',
        type: 'ledger.transition',
        payload: {},
      })
    ).toThrow(EnvelopeValidationError);
  });

  it('rejects malformed legacy envelope missing id/messageId', () => {
    expect(() =>
      parseEnvelopeV1({
        timestamp: '2026-02-17T20:00:00Z',
        source: 'legacy-dispatcher',
        kind: 'ledger.transition',
        payload: { seq: 1, op: 'credit', account: 'alice', amount: 10 },
      })
    ).toThrow(EnvelopeValidationError);
  });

  it('rejects malformed legacy envelope with bad timestamp', () => {
    expect(() =>
      parseEnvelopeV1({
        id: 'legacy-bad-time',
        timestamp: 'not-a-date',
        source: 'legacy-dispatcher',
        kind: 'ledger.transition',
        payload: { seq: 1, op: 'credit', account: 'alice', amount: 10 },
      })
    ).toThrow(EnvelopeValidationError);
  });
});

describe('deterministic ledger transition engine', () => {
  it('produces the same final state from the same transition stream', () => {
    const stream = [
      transitionEnvelope({ messageId: 'm1', seq: 1, op: 'credit', account: 'alice', amount: 100 }),
      transitionEnvelope({ messageId: 'm2', seq: 2, op: 'debit', account: 'alice', amount: 20 }),
      transitionEnvelope({ messageId: 'm3', seq: 3, op: 'credit', account: 'bob', amount: 7 }),
    ];

    const run = () => stream.reduce((state, next) => applyLedgerTransitionV1(state, next), createLedgerStateV1());

    const stateA = run();
    const stateB = run();

    expect(stateA).toEqual(stateB);
    expect(stateA).toMatchObject({
      sequence: 3,
      balances: {
        alice: 80,
        bob: 7,
      },
    });
  });

  it('rejects out-of-order seq transitions', () => {
    const initial = createLedgerStateV1();
    const bad = transitionEnvelope({ messageId: 'm10', seq: 2, op: 'credit', account: 'alice', amount: 5 });

    expect(() => applyLedgerTransitionV1(initial, bad)).toThrow(LedgerTransitionError);
  });

  it('rejects insufficient funds', () => {
    const initial = createLedgerStateV1();
    const bad = transitionEnvelope({ messageId: 'm11', seq: 1, op: 'debit', account: 'alice', amount: 1 });

    expect(() => applyLedgerTransitionV1(initial, bad)).toThrow(LedgerTransitionError);
  });

  it('rejects duplicate message ids', () => {
    const first = transitionEnvelope({ messageId: 'm12', seq: 1, op: 'credit', account: 'alice', amount: 5 });
    const state = applyLedgerTransitionV1(createLedgerStateV1(), first);
    const duplicate = transitionEnvelope({ messageId: 'm12', seq: 2, op: 'credit', account: 'alice', amount: 5 });

    expect(() => applyLedgerTransitionV1(state, duplicate)).toThrow(LedgerTransitionError);
  });

  it('accepts causality metadata and tracks last causation id', () => {
    const envelope = parseEnvelopeV1<LedgerTransitionPayload>({
      version: 1,
      messageId: 'causal-1',
      createdAt: '2026-02-17T20:00:00Z',
      source: 'scheduler',
      type: 'ledger.transition',
      causality: { traceId: 'trace-1', causationId: 'cause-1', sourceSeq: 1 },
      payload: { seq: 1, op: 'credit', account: 'alice', amount: 10 },
    });

    const state = applyLedgerTransitionV1(createLedgerStateV1(), envelope);
    expect(state.lastCausationIdByAccount?.alice).toBe('cause-1');
  });

  it('reconciles out-of-order and duplicate envelopes deterministically', () => {
    const envelopes = [
      transitionEnvelope({ messageId: 'r2', seq: 2, op: 'credit', account: 'alice', amount: 10 }),
      transitionEnvelope({ messageId: 'r1', seq: 1, op: 'credit', account: 'alice', amount: 5 }),
      transitionEnvelope({ messageId: 'r1', seq: 1, op: 'credit', account: 'alice', amount: 5 }),
      transitionEnvelope({ messageId: 'r4', seq: 4, op: 'credit', account: 'bob', amount: 1 }),
      transitionEnvelope({ messageId: 'r3', seq: 3, op: 'debit', account: 'alice', amount: 2 }),
    ];

    const result = reconcileLedgerTransitionsV1(createLedgerStateV1(), envelopes);
    expect(result.applied).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(result.duplicates).toContain('r1');
    expect(result.deferred).toEqual([]);
    expect(result.state.sequence).toBe(4);
    expect(result.state.balances.alice).toBe(13);
    expect(result.state.balances.bob).toBe(1);
  });
});
