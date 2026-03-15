import { base, baseSepolia } from 'wagmi/chains';

export type NetworkMode = 'testnet' | 'mainnet';

export const NETWORK_MODE_STORAGE_KEY = 'hivemind-network-mode';
export const NETWORK_MODE_EVENT = 'hivemind-network-mode-change';

export interface FrontendNetworkConfig {
  mode: NetworkMode;
  chain: typeof base | typeof baseSepolia;
  chainId: number;
  chainName: string;
  label: string;
  shortLabel: string;
  badge: string;
  routeLabel: 'base-mainnet' | 'base-sepolia';
  eip155: `eip155:${number}`;
  explorerBase: string;
  usdcAddress: `0x${string}`;
  treasuryAddress: `0x${string}`;
  delegateAddress: `0x${string}`;
  identityRegistry?: string;
  reputationRegistry?: string;
}

const NETWORKS: Record<NetworkMode, FrontendNetworkConfig> = {
  testnet: {
    mode: 'testnet',
    chain: baseSepolia,
    chainId: 84532,
    chainName: 'Base Sepolia',
    label: 'Base Sepolia (Testnet)',
    shortLabel: 'Testnet',
    badge: 'TESTNET',
    routeLabel: 'base-sepolia',
    eip155: 'eip155:84532',
    explorerBase: 'https://sepolia.basescan.org',
    usdcAddress: (process.env.NEXT_PUBLIC_BASE_TESTNET_USDC_ADDRESS || process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`,
    treasuryAddress: (process.env.NEXT_PUBLIC_TREASURY_WALLET_EVM_TESTNET || process.env.NEXT_PUBLIC_TREASURY_WALLET_EVM || '0x676fF3d546932dE6558a267887E58e39f405B135') as `0x${string}`,
    delegateAddress: (process.env.NEXT_PUBLIC_DELEGATE_WALLET_EVM_TESTNET || process.env.NEXT_PUBLIC_DELEGATE_WALLET_EVM || '0x4a9948159B7e6c19301ebc388E72B1EdFf87187B') as `0x${string}`,
    identityRegistry: process.env.NEXT_PUBLIC_ERC8004_TESTNET_IDENTITY_REGISTRY || process.env.NEXT_PUBLIC_ERC8004_IDENTITY_REGISTRY,
    reputationRegistry: process.env.NEXT_PUBLIC_ERC8004_TESTNET_REPUTATION_REGISTRY || process.env.NEXT_PUBLIC_ERC8004_REPUTATION_REGISTRY,
  },
  mainnet: {
    mode: 'mainnet',
    chain: base,
    chainId: 8453,
    chainName: 'Base Mainnet',
    label: 'Base Mainnet',
    shortLabel: 'Mainnet',
    badge: 'MAINNET',
    routeLabel: 'base-mainnet',
    eip155: 'eip155:8453',
    explorerBase: 'https://basescan.org',
    usdcAddress: (process.env.NEXT_PUBLIC_BASE_MAINNET_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`,
    treasuryAddress: (process.env.NEXT_PUBLIC_TREASURY_WALLET_EVM_MAINNET || process.env.NEXT_PUBLIC_TREASURY_WALLET_EVM || '0x676fF3d546932dE6558a267887E58e39f405B135') as `0x${string}`,
    delegateAddress: (process.env.NEXT_PUBLIC_DELEGATE_WALLET_EVM_MAINNET || process.env.NEXT_PUBLIC_DELEGATE_WALLET_EVM || '0x4a9948159B7e6c19301ebc388E72B1EdFf87187B') as `0x${string}`,
    identityRegistry: process.env.NEXT_PUBLIC_ERC8004_MAINNET_IDENTITY_REGISTRY,
    reputationRegistry: process.env.NEXT_PUBLIC_ERC8004_MAINNET_REPUTATION_REGISTRY,
  },
};

export const NETWORK_MODE_LABELS: Record<NetworkMode, { label: string; shortLabel: string; badge: string; explorerBase: string }> = {
  testnet: NETWORKS.testnet,
  mainnet: NETWORKS.mainnet,
};

export function getNetworkConfig(mode: NetworkMode): FrontendNetworkConfig {
  return NETWORKS[mode];
}

export function getExplorerTxUrl(mode: NetworkMode, txHash: string): string {
  return `${NETWORKS[mode].explorerBase}/tx/${txHash}`;
}

export function getExplorerAddressUrl(mode: NetworkMode, address: string): string {
  return `${NETWORKS[mode].explorerBase}/address/${address}`;
}

export function resolveNetworkMode(input?: string | null): NetworkMode {
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
    value.includes('eip155:8453') ||
    value.includes('mainnet') ||
    value.includes('base-mainnet') ||
    /(^|[^0-9])8453([^0-9]|$)/.test(value)
  ) {
    return 'mainnet';
  }
  return 'testnet';
}

export function supportsDirectPayments(mode: NetworkMode): boolean {
  if (mode === 'testnet') return true;
  return process.env.NEXT_PUBLIC_ENABLE_MAINNET_PAYMENTS === 'true';
}

export function getModeScopedStorageKey(baseKey: string, mode: NetworkMode): string {
  return `${baseKey}:${mode}`;
}

export function getStoredNetworkMode(): NetworkMode {
  if (typeof window === 'undefined') return 'testnet';
  return resolveNetworkMode(window.localStorage.getItem(NETWORK_MODE_STORAGE_KEY));
}

export function isChainIdForMode(mode: NetworkMode, chainId?: number): boolean {
  return chainId === undefined ? false : NETWORKS[mode].chainId === chainId;
}
