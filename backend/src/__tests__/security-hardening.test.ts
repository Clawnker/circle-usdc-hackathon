jest.mock('../middleware/erc8128-auth', () => ({
  hasErc8128Headers: jest.fn(() => false),
  verifyErc8128Request: jest.fn(),
}));

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  stat: jest.fn(),
  readFile: jest.fn(),
}));

import { lookup } from 'node:dns/promises';
import { stat, readFile } from 'node:fs/promises';
import { authMiddleware } from '../middleware/auth';
import { createFailClosedMiddleware } from '../x402-server';
import { getRegistrations, resetRegistrationsCacheForTest } from '../utils/registrations-cache';
import { isUnsafeIp, revalidateEndpointResolution, validateExternalEndpointUrl } from '../utils/ssrf';
import { computeDispatchSignature, dispatchGuardMiddleware, resetDispatchGuardStateForTest } from '../middleware/dispatch-guard';
import { evaluateDispatchRollout } from '../reliability/rollout-guard';
import { getDispatchSloSnapshot, recordDispatchSlo, resetDispatchSloForTest } from '../reliability/slo';

function makeRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
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

describe('HM-001 fail-closed x402 behavior', () => {
  it('blocks protected specialist/query routes when x402 is unavailable', () => {
    const middleware = createFailClosedMiddleware('boom');
    const res = makeRes();
    const next = jest.fn();

    middleware({ method: 'POST', path: '/api/specialist/magos' } as any, res as any, next);
    expect(res.statusCode).toBe(503);
    expect(next).not.toHaveBeenCalled();

    const res2 = makeRes();
    middleware({ method: 'GET', path: '/api/agents' } as any, res2 as any, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('HM-002 agent mutation auth lock-down', () => {
  beforeEach(() => {
    process.env.API_KEYS = 'test-key';
  });

  it('keeps discovery path public', async () => {
    const req: any = { path: '/api/agents', headers: {} };
    const res = makeRes();
    const next = jest.fn();

    await authMiddleware(req, res as any, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.authMethod).toBe('public');
  });

  it('requires auth for /agents/register route-layer call', async () => {
    const req: any = { path: '/agents/register', headers: {} };
    const res = makeRes();
    const next = jest.fn();

    await authMiddleware(req, res as any, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('HM-003 SSRF protections', () => {
  const mockedLookup = lookup as jest.Mock;

  beforeEach(() => mockedLookup.mockReset());

  it('flags unsafe IP classes', () => {
    expect(isUnsafeIp('127.0.0.1')).toBe(true);
    expect(isUnsafeIp('10.0.0.5')).toBe(true);
    expect(isUnsafeIp('169.254.1.5')).toBe(true);
    expect(isUnsafeIp('::1')).toBe(true);
    expect(isUnsafeIp('fd00::1')).toBe(true);
    expect(isUnsafeIp('8.8.8.8')).toBe(false);
  });

  it('rejects endpoints resolving to private IPs', async () => {
    mockedLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    await expect(validateExternalEndpointUrl('https://example.com')).rejects.toThrow(/disallowed IP/i);
  });

  it('detects DNS rebinding (no overlap with initial resolution)', async () => {
    mockedLookup.mockResolvedValue([{ address: '1.1.1.1', family: 4 }]);
    await expect(revalidateEndpointResolution(new URL('https://example.com'), ['8.8.8.8'])).rejects.toThrow(/rebinding/i);
  });
});

describe('HM-004 async cached registrations loading', () => {
  const mockedStat = stat as jest.Mock;
  const mockedReadFile = readFile as jest.Mock;

  beforeEach(() => {
    resetRegistrationsCacheForTest();
    mockedStat.mockReset();
    mockedReadFile.mockReset();
  });

  it('uses async read and cache by mtime', async () => {
    mockedStat.mockResolvedValue({ mtimeMs: 111 });
    mockedReadFile.mockResolvedValue('[{"name":"a"}]');

    await getRegistrations();
    await getRegistrations();

    expect(mockedStat).toHaveBeenCalledTimes(2);
    expect(mockedReadFile).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent reads per mtime generation', async () => {
    mockedStat.mockResolvedValue({ mtimeMs: 222 });

    let resolveRead: ((value: string) => void) | undefined;
    mockedReadFile.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveRead = resolve;
        }),
    );

    const p1 = getRegistrations();
    const p2 = getRegistrations();
    const p3 = getRegistrations();

    await Promise.resolve();
    expect(mockedReadFile).toHaveBeenCalledTimes(1);
    expect(resolveRead).toBeDefined();

    resolveRead!('[{"name":"concurrent"}]');

    await expect(Promise.all([p1, p2, p3])).resolves.toEqual([
      [{ name: 'concurrent' }],
      [{ name: 'concurrent' }],
      [{ name: 'concurrent' }],
    ]);
    expect(mockedReadFile).toHaveBeenCalledTimes(1);
  });
});

describe('HM-005 dispatch integrity + strict auth guard', () => {
  beforeEach(() => {
    delete process.env.DISPATCH_HMAC_SECRET;
    delete process.env.DISPATCH_REQUIRE_AUTH;
    resetDispatchGuardStateForTest();
  });

  it('blocks public user when strict dispatch auth is enabled', () => {
    process.env.DISPATCH_REQUIRE_AUTH = 'true';
    const req: any = {
      method: 'POST',
      path: '/dispatch',
      headers: {},
      header(name: string) { return this.headers[name.toLowerCase()]; },
      body: {},
      user: { id: 'demo-user', authMethod: 'public' },
    };
    const res = makeRes();
    const next = jest.fn();

    dispatchGuardMiddleware(req, res as any, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid HMAC signature and rejects nonce replay', () => {
    process.env.DISPATCH_HMAC_SECRET = 'test-secret';
    const now = Date.now();
    const body = { prompt: 'hello' };
    const req: any = {
      method: 'POST',
      path: '/dispatch',
      headers: {
        'x-dispatch-timestamp': String(now),
        'x-dispatch-nonce': 'nonce-1234',
      },
      header(name: string) { return this.headers[name.toLowerCase()]; },
      body,
      user: { id: 'abc', authMethod: 'api-key' },
    };

    req.headers['x-dispatch-signature'] = computeDispatchSignature({
      method: req.method,
      path: req.path,
      timestamp: req.headers['x-dispatch-timestamp'],
      nonce: req.headers['x-dispatch-nonce'],
      body,
      secret: process.env.DISPATCH_HMAC_SECRET,
    });

    const res = makeRes();
    const next = jest.fn();
    dispatchGuardMiddleware(req, res as any, next);
    expect(next).toHaveBeenCalled();

    const replayRes = makeRes();
    const replayNext = jest.fn();
    dispatchGuardMiddleware(req, replayRes as any, replayNext);
    expect(replayRes.statusCode).toBe(409);
    expect(replayNext).not.toHaveBeenCalled();
  });

  it('rejects malformed nonce and signature format before verification', () => {
    process.env.DISPATCH_HMAC_SECRET = 'test-secret';
    const req: any = {
      method: 'POST',
      path: '/dispatch',
      headers: {
        'x-dispatch-timestamp': String(Date.now()),
        'x-dispatch-nonce': 'bad nonce with spaces',
        'x-dispatch-signature': 'abc123',
      },
      header(name: string) { return this.headers[name.toLowerCase()]; },
      body: { prompt: 'hi' },
      user: { id: 'abc', authMethod: 'api-key' },
    };

    const res = makeRes();
    const next = jest.fn();
    dispatchGuardMiddleware(req, res as any, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('HM-006 rollout + SLO hooks', () => {
  beforeEach(() => {
    delete process.env.DISPATCH_KILL_SWITCH;
    delete process.env.DISPATCH_ROLLOUT_MODE;
    delete process.env.DISPATCH_CANARY_PERCENT;
    delete process.env.DISPATCH_CANARY_ALLOWLIST;
    resetDispatchSloForTest();
  });

  it('supports kill-switch rollback and allowlist canary', () => {
    process.env.DISPATCH_KILL_SWITCH = 'true';
    expect(evaluateDispatchRollout('user-1').allowed).toBe(false);

    process.env.DISPATCH_KILL_SWITCH = 'false';
    process.env.DISPATCH_ROLLOUT_MODE = 'canary';
    process.env.DISPATCH_CANARY_PERCENT = '0';
    process.env.DISPATCH_CANARY_ALLOWLIST = 'vip-user';

    expect(evaluateDispatchRollout('regular-user').allowed).toBe(false);
    expect(evaluateDispatchRollout('vip-user').allowed).toBe(true);
  });

  it('captures dispatch SLO snapshot', () => {
    for (let i = 0; i < 20; i++) {
      recordDispatchSlo(i < 2 ? 'failure' : 'success', i < 2 ? 5000 : 120);
    }

    const snapshot = getDispatchSloSnapshot();
    expect(snapshot.total).toBe(20);
    expect(snapshot.failures).toBe(2);
    expect(snapshot.errorRate).toBeGreaterThan(0);
    expect(snapshot.p95Ms).toBeGreaterThan(0);
  });
});
