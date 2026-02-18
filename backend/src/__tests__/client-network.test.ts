import { isExecutionSupportedForMode, normalizeClientNetworkMode, toRouteNetworkLabel } from '../utils/client-network';

describe('client network mode helpers', () => {
  const original = process.env.ENABLE_MAINNET_DISPATCH;

  afterEach(() => {
    process.env.ENABLE_MAINNET_DISPATCH = original;
  });

  it('normalizes unknown modes to testnet', () => {
    expect(normalizeClientNetworkMode(undefined)).toBe('testnet');
    expect(normalizeClientNetworkMode('weird')).toBe('testnet');
  });

  it('accepts explicit mainnet signals', () => {
    expect(normalizeClientNetworkMode('mainnet')).toBe('mainnet');
    expect(normalizeClientNetworkMode('eip155:8453')).toBe('mainnet');
  });

  it('maps route labels by mode', () => {
    expect(toRouteNetworkLabel('testnet')).toBe('base-sepolia');
    expect(toRouteNetworkLabel('mainnet')).toBe('base-mainnet');
  });

  it('gates mainnet execution by env flag', () => {
    process.env.ENABLE_MAINNET_DISPATCH = 'false';
    expect(isExecutionSupportedForMode('testnet')).toBe(true);
    expect(isExecutionSupportedForMode('mainnet')).toBe(false);

    process.env.ENABLE_MAINNET_DISPATCH = 'true';
    expect(isExecutionSupportedForMode('mainnet')).toBe(true);
  });
});
