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
});
