export type ClientNetworkMode = 'testnet' | 'mainnet';

export function normalizeClientNetworkMode(input: unknown): ClientNetworkMode {
  const value = String(input || '').toLowerCase();
  if (
    value === 'testnet' ||
    value.includes('84532') ||
    value.includes('base-sepolia') ||
    value.includes('eip155:84532')
  ) {
    return 'testnet';
  }
  if (
    value === 'mainnet' ||
    value.includes('eip155:8453') ||
    value.includes('base-mainnet') ||
    /(^|[^0-9])8453([^0-9]|$)/.test(value)
  ) {
    return 'mainnet';
  }
  return 'testnet';
}

export function toRouteNetworkLabel(mode: ClientNetworkMode): string {
  return mode === 'mainnet' ? 'base-mainnet' : 'base-sepolia';
}

export function isExecutionSupportedForMode(mode: ClientNetworkMode): boolean {
  if (mode === 'testnet') return true;
  return process.env.ENABLE_MAINNET_DISPATCH === 'true';
}
