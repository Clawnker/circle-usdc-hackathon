import { HivemindEnvelopeV1 } from './envelope';

export const LEDGER_STATE_VERSION_V1 = 1 as const;

export type LedgerOperation = 'credit' | 'debit';

export interface LedgerTransitionPayload {
  seq: number;
  op: LedgerOperation;
  account: string;
  amount: number;
}

export interface LedgerStateV1 {
  version: typeof LEDGER_STATE_VERSION_V1;
  sequence: number;
  balances: Record<string, number>;
  appliedMessageIds: string[];
}

export class LedgerTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerTransitionError';
  }
}

export function createLedgerStateV1(): LedgerStateV1 {
  return {
    version: LEDGER_STATE_VERSION_V1,
    sequence: 0,
    balances: {},
    appliedMessageIds: [],
  };
}

function cloneBalances(balances: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(balances).sort(([a], [b]) => a.localeCompare(b)));
}

function validatePayload(payload: LedgerTransitionPayload): void {
  if (!Number.isInteger(payload.seq) || payload.seq <= 0) {
    throw new LedgerTransitionError('Transition seq must be a positive integer');
  }
  if (payload.op !== 'credit' && payload.op !== 'debit') {
    throw new LedgerTransitionError(`Unsupported ledger operation: ${String(payload.op)}`);
  }
  if (typeof payload.account !== 'string' || payload.account.trim().length === 0) {
    throw new LedgerTransitionError('Transition account must be a non-empty string');
  }
  if (typeof payload.amount !== 'number' || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new LedgerTransitionError('Transition amount must be a positive finite number');
  }
}

export function applyLedgerTransitionV1(
  state: LedgerStateV1,
  envelope: HivemindEnvelopeV1<LedgerTransitionPayload>
): LedgerStateV1 {
  if (envelope.type !== 'ledger.transition') {
    throw new LedgerTransitionError(`Unsupported envelope type: ${envelope.type}`);
  }

  if (state.appliedMessageIds.includes(envelope.messageId)) {
    throw new LedgerTransitionError(`Duplicate transition messageId: ${envelope.messageId}`);
  }

  validatePayload(envelope.payload);

  if (envelope.payload.seq !== state.sequence + 1) {
    throw new LedgerTransitionError(
      `Out-of-order transition seq=${envelope.payload.seq}, expected=${state.sequence + 1}`
    );
  }

  const balances = cloneBalances(state.balances);
  const current = balances[envelope.payload.account] ?? 0;
  const delta = envelope.payload.op === 'credit' ? envelope.payload.amount : -envelope.payload.amount;
  const nextBalance = current + delta;

  if (nextBalance < 0) {
    throw new LedgerTransitionError(`Insufficient funds for account: ${envelope.payload.account}`);
  }

  balances[envelope.payload.account] = nextBalance;

  return {
    version: LEDGER_STATE_VERSION_V1,
    sequence: envelope.payload.seq,
    balances: cloneBalances(balances),
    appliedMessageIds: [...state.appliedMessageIds, envelope.messageId],
  };
}
