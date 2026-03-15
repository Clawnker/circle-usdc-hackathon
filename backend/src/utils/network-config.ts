import { base, baseSepolia } from 'viem/chains';
import type { ClientNetworkMode } from './client-network';

export interface HivemindNetworkConfig {
  mode: ClientNetworkMode;
  chain: typeof base | typeof baseSepolia;
  chainId: number;
  chainName: string;
  displayName: string;
  routeLabel: 'base-mainnet' | 'base-sepolia';
  eip155: `eip155:${number}`;
  explorerBase: string;
  rpcUrl: string;
  usdcAddress: `0x${string}`;
  facilitatorUrl: string;
  identityRegistry: string;
  reputationRegistry: string;
  treasuryAddress: `0x${string}`;
  delegateAddress: `0x${string}`;
}

const DEFAULT_TREASURY = '0x676fF3d546932dE6558a267887E58e39f405B135' as const;
const DEFAULT_DELEGATE = '0x4a9948159B7e6c19301ebc388E72B1EdFf87187B' as const;

const NETWORK_CONFIGS: Record<ClientNetworkMode, HivemindNetworkConfig> = {
  testnet: {
    mode: 'testnet',
    chain: baseSepolia,
    chainId: 84532,
    chainName: 'Base Sepolia',
    displayName: 'Base Sepolia (EIP-155:84532)',
    routeLabel: 'base-sepolia',
    eip155: 'eip155:84532',
    explorerBase: 'https://sepolia.basescan.org',
    rpcUrl: process.env.BASE_TESTNET_RPC_URL || process.env.BASE_RPC_URL || 'https://sepolia.base.org',
    usdcAddress: (process.env.BASE_TESTNET_USDC_ADDRESS || process.env.BASE_USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`,
    facilitatorUrl: process.env.X402_TESTNET_FACILITATOR_URL || process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
    identityRegistry: process.env.ERC8004_TESTNET_IDENTITY_REGISTRY || process.env.ERC8004_IDENTITY_REGISTRY || '',
    reputationRegistry: process.env.ERC8004_TESTNET_REPUTATION_REGISTRY || process.env.ERC8004_REPUTATION_REGISTRY || '',
    treasuryAddress: (process.env.TREASURY_WALLET_EVM_TESTNET || process.env.TREASURY_WALLET_EVM || DEFAULT_TREASURY) as `0x${string}`,
    delegateAddress: (process.env.DELEGATE_WALLET_EVM_TESTNET || process.env.DELEGATE_WALLET_EVM || DEFAULT_DELEGATE) as `0x${string}`,
  },
  mainnet: {
    mode: 'mainnet',
    chain: base,
    chainId: 8453,
    chainName: 'Base Mainnet',
    displayName: 'Base Mainnet (EIP-155:8453)',
    routeLabel: 'base-mainnet',
    eip155: 'eip155:8453',
    explorerBase: 'https://basescan.org',
    rpcUrl: process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org',
    usdcAddress: (process.env.BASE_MAINNET_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`,
    facilitatorUrl: process.env.X402_MAINNET_FACILITATOR_URL || process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
    identityRegistry: process.env.ERC8004_MAINNET_IDENTITY_REGISTRY || '',
    reputationRegistry: process.env.ERC8004_MAINNET_REPUTATION_REGISTRY || '',
    treasuryAddress: (process.env.TREASURY_WALLET_EVM_MAINNET || process.env.TREASURY_WALLET_EVM || DEFAULT_TREASURY) as `0x${string}`,
    delegateAddress: (process.env.DELEGATE_WALLET_EVM_MAINNET || process.env.DELEGATE_WALLET_EVM || DEFAULT_DELEGATE) as `0x${string}`,
  },
};

export function getNetworkConfig(mode: ClientNetworkMode = 'testnet'): HivemindNetworkConfig {
  return NETWORK_CONFIGS[mode];
}

export function getNetworkModeFromChain(value: string | number | undefined | null): ClientNetworkMode {
  const normalized = String(value || '').toLowerCase();
  if (
    normalized === 'testnet' ||
    normalized.includes('84532') ||
    normalized.includes('base-sepolia') ||
    normalized.includes('eip155:84532')
  ) {
    return 'testnet';
  }
  if (
    normalized === 'mainnet' ||
    normalized.includes('eip155:8453') ||
    normalized.includes('base-mainnet') ||
    /(^|[^0-9])8453([^0-9]|$)/.test(normalized)
  ) {
    return 'mainnet';
  }
  return 'testnet';
}

export function getNetworkConfigFromChain(value: string | number | undefined | null): HivemindNetworkConfig {
  return getNetworkConfig(getNetworkModeFromChain(value));
}

export function isAgentOnNetwork(agentChain: string | undefined, mode: ClientNetworkMode): boolean {
  if (!agentChain) return mode === 'testnet';
  return getNetworkModeFromChain(agentChain) === mode;
}
