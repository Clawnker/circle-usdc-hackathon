import {
  auditReliabilityOpsAction,
  getReliabilityOpsAuditRecords,
  reliabilityOpsRateLimitMiddleware,
  requireReliabilityOpsAccess,
  resetReliabilityOpsSafetyForTest,
} from '../reliability/ops-safety';
import { resetReliabilityConfigForTest } from '../reliability/config';

function makeReq(overrides: any = {}) {
  const headers = overrides.headers || {};
  return {
    path: '/ops/reliability/dlq',
    method: 'GET',
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers,
    user: { id: 'demo-user', authMethod: 'public' },
    get(name: string) {
      return headers[String(name).toLowerCase()];
    },
    ...overrides,
  } as any;
}

function makeRes() {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name: string, value: any) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('reliability ops safety controls', () => {
  beforeEach(() => {
    resetReliabilityConfigForTest();
    resetReliabilityOpsSafetyForTest();
    delete process.env.RELIABILITY_OPS_REQUIRE_OPERATOR_KEY;
    delete process.env.RELIABILITY_OPS_KEYS;
    delete process.env.RELIABILITY_OPS_REQUIRE_NON_PUBLIC_AUTH;
    delete process.env.RELIABILITY_OPS_ALLOW_DEMO_WRITE;
    delete process.env.RELIABILITY_OPS_RATE_MAX;
    delete process.env.RELIABILITY_OPS_RATE_WINDOW_MS;
  });

  it('keeps backward-compatible defaults (public read allowed)', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    requireReliabilityOpsAccess(req, res as any, next, 'read');
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('enforces operator key when enabled', () => {
    process.env.RELIABILITY_OPS_REQUIRE_OPERATOR_KEY = 'true';
    process.env.RELIABILITY_OPS_KEYS = 'ops-secret';

    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = jest.fn();

    requireReliabilityOpsAccess(req, res as any, next, 'read');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);

    const req2 = makeReq({ headers: { 'x-ops-key': 'ops-secret' } });
    const res2 = makeRes();
    const next2 = jest.fn();
    requireReliabilityOpsAccess(req2, res2 as any, next2, 'read');
    expect(next2).toHaveBeenCalled();
  });

  it('supports write lock for demo users', () => {
    process.env.RELIABILITY_OPS_ALLOW_DEMO_WRITE = 'false';

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    requireReliabilityOpsAccess(req, res as any, next, 'write');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('applies dedicated rate limit and emits audit records', () => {
    process.env.RELIABILITY_OPS_RATE_MAX = '2';
    process.env.RELIABILITY_OPS_RATE_WINDOW_MS = '60000';

    const next = jest.fn();
    reliabilityOpsRateLimitMiddleware(makeReq(), makeRes() as any, next);
    reliabilityOpsRateLimitMiddleware(makeReq(), makeRes() as any, next);

    const resBlocked = makeRes();
    const nextBlocked = jest.fn();
    reliabilityOpsRateLimitMiddleware(makeReq(), resBlocked as any, nextBlocked);

    expect(resBlocked.statusCode).toBe(429);
    expect(nextBlocked).not.toHaveBeenCalled();

    auditReliabilityOpsAction(makeReq(), {
      action: 'slo_read',
      statusCode: 200,
      outcome: 'allowed',
    });

    const records = getReliabilityOpsAuditRecords(10);
    expect(records.length).toBeGreaterThan(0);
    expect(records[0]).toHaveProperty('actorId');
    expect(records[0]).toHaveProperty('schemaVersion', 'v1');
  });
});
