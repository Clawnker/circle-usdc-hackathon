export type ClientNetworkMode = 'testnet' | 'mainnet';

export function normalizeClientNetworkMode(input: unknown): ClientNetworkMode {
  const value = String(input || '').toLowerCase();
  if (value === 'mainnet' || value.includes('8453')) return 'mainnet';
  return 'testnet';
}

export function toRouteNetworkLabel(mode: ClientNetworkMode): string {
  return mode === 'mainnet' ? 'base-mainnet' : 'base-sepolia';
}

export function isExecutionSupportedForMode(mode: ClientNetworkMode): boolean {
  if (mode === 'testnet') return true;
  return process.env.ENABLE_MAINNET_DISPATCH === 'true';
}
