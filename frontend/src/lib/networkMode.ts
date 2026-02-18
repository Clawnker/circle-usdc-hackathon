export type NetworkMode = 'testnet' | 'mainnet';

export const NETWORK_MODE_STORAGE_KEY = 'hivemind-network-mode';

export const NETWORK_MODE_LABELS: Record<NetworkMode, { label: string; shortLabel: string; badge: string; explorerBase: string }> = {
  testnet: {
    label: 'Base Sepolia (Testnet)',
    shortLabel: 'Testnet',
    badge: 'TESTNET',
    explorerBase: 'https://sepolia.basescan.org',
  },
  mainnet: {
    label: 'Base Mainnet',
    shortLabel: 'Mainnet',
    badge: 'MAINNET',
    explorerBase: 'https://basescan.org',
  },
};

export function getExplorerTxUrl(mode: NetworkMode, txHash: string): string {
  return `${NETWORK_MODE_LABELS[mode].explorerBase}/tx/${txHash}`;
}

export function getExplorerAddressUrl(mode: NetworkMode, address: string): string {
  return `${NETWORK_MODE_LABELS[mode].explorerBase}/address/${address}`;
}

export function resolveNetworkMode(input?: string | null): NetworkMode {
  const value = String(input || '').toLowerCase();
  if (value.includes('8453') || value.includes('mainnet')) return 'mainnet';
  return 'testnet';
}

export function supportsDirectPayments(mode: NetworkMode): boolean {
  if (mode === 'testnet') return true;
  return process.env.NEXT_PUBLIC_ENABLE_MAINNET_PAYMENTS === 'true';
}
