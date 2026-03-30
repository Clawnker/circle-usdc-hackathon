import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getExplorerTxUrl,
  getModeScopedStorageKey,
  isChainIdForMode,
  resolveNetworkMode,
  supportsDirectPayments,
} from './networkMode';

describe('networkMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves mainnet and testnet identifiers', () => {
    expect(resolveNetworkMode('testnet')).toBe('testnet');
    expect(resolveNetworkMode('eip155:84532')).toBe('testnet');
    expect(resolveNetworkMode('base-mainnet')).toBe('mainnet');
    expect(resolveNetworkMode('8453')).toBe('mainnet');
    expect(resolveNetworkMode(undefined)).toBe('testnet');
  });

  it('builds mode-scoped storage keys', () => {
    expect(getModeScopedStorageKey('hivemind-swarm', 'testnet')).toBe('hivemind-swarm:testnet');
    expect(getModeScopedStorageKey('hivemind-swarm', 'mainnet')).toBe('hivemind-swarm:mainnet');
  });

  it('enables mainnet direct payments by default and honors kill switches', () => {
    expect(supportsDirectPayments('testnet')).toBe(true);
    expect(supportsDirectPayments('mainnet')).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_ENABLE_MAINNET_PAYMENTS', 'false');
    expect(supportsDirectPayments('mainnet')).toBe(false);

    vi.stubEnv('NEXT_PUBLIC_ENABLE_MAINNET_PAYMENTS', 'true');
    expect(supportsDirectPayments('mainnet')).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_DISABLE_MAINNET_PAYMENTS', 'true');
    expect(supportsDirectPayments('testnet')).toBe(true);
    expect(supportsDirectPayments('mainnet')).toBe(false);
  });

  it('builds explorer links and chain id checks correctly', () => {
    expect(getExplorerTxUrl('testnet', '0xabc')).toBe('https://sepolia.basescan.org/tx/0xabc');
    expect(getExplorerTxUrl('mainnet', '0xdef')).toBe('https://basescan.org/tx/0xdef');
    expect(isChainIdForMode('testnet', 84532)).toBe(true);
    expect(isChainIdForMode('mainnet', 84532)).toBe(false);
  });
});
