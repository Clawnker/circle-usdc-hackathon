/**
 * Hivemind Protocol Configuration
 * Loads configuration from environment and config files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Load AgentWallet config
interface AgentWalletConfig {
  username: string;
  displayName: string;
  evmAddress: string;
  solanaAddress: string;
  apiToken: string;
}

// Load Helius config
interface HeliusConfig {
  projectId: string;
  projectName: string;
  apiKey: string;
  mainnet: string;
  devnet: string;
  credits: number;
}

function loadJsonConfig<T>(filePath: string): T | null {
  try {
    const resolved = filePath.startsWith('~') 
      ? path.join(process.env.HOME || '', filePath.slice(1))
      : filePath;
    const content = fs.readFileSync(resolved, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.warn(`Could not load config from ${filePath}:`, err);
    return null;
  }
}

const agentWalletConfig = loadJsonConfig<AgentWalletConfig>('~/.agentwallet/config.json');
const heliusConfig = loadJsonConfig<HeliusConfig>('~/.config/helius/config.json');

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // AgentWallet
  agentWallet: {
    apiUrl: process.env.AGENTWALLET_API_URL || 'https://agentwallet.mcpay.tech/api',
    username: agentWalletConfig?.username || process.env.AGENTWALLET_USERNAME || 'claw',
    token: agentWalletConfig?.apiToken || process.env.AGENTWALLET_FUND_TOKEN || process.env.AGENTWALLET_TOKEN || '',
    fundToken: agentWalletConfig?.apiToken || process.env.AGENTWALLET_FUND_TOKEN || process.env.AGENTWALLET_TOKEN || '',
    solanaAddress: agentWalletConfig?.solanaAddress || '',
    evmAddress: agentWalletConfig?.evmAddress || '',
  },

  // Helius RPC
  helius: {
    apiKey: process.env.HELIUS_API_KEY || heliusConfig?.apiKey || '',
    mainnet: process.env.HELIUS_API_KEY 
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : (heliusConfig?.mainnet || 'https://mainnet.helius-rpc.com'),
    devnet: process.env.HELIUS_API_KEY
      ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : (heliusConfig?.devnet || 'https://devnet.helius-rpc.com'),
    credits: heliusConfig?.credits || 0,
  },

  // Security & Gating
  enforcePayments: process.env.ENFORCE_PAYMENTS === 'true',

  // Specialist endpoints (ClawArena, MoltX, etc.)
  specialists: {
    clawarena: {
      baseUrl: process.env.CLAWARENA_API_URL || 'https://api.clawarena.com',
      apiKey: process.env.CLAWARENA_API_KEY || '',
    },
    moltx: {
      baseUrl: process.env.MOLTX_API_URL || 'https://api.moltx.io',
      apiKey: process.env.MOLTX_API_KEY || '',
    },
    bankr: {
      apiKey: process.env.BANKR_API_KEY || '',
      apiUrl: 'https://api.bankr.bot',
    },
  },

  // Jupiter API for swap routing
  jupiter: {
    apiKey: process.env.JUPITER_API_KEY || '',
    baseUrl: process.env.JUPITER_API_URL || 'https://api.jup.ag',
    ultraUrl: process.env.JUPITER_ULTRA_URL || 'https://api.jup.ag/ultra',
  },
  
  // Specialist Fees (USDC) - Higher fees to ensure on-chain settlement
  fees: {
    bankr: 0.10,
    scribe: 0.10,
    seeker: 0.10,
    magos: 0.10,
    aura: 0.10,
    general: 0,
  },

  // Specialist Wallets (Receiving addresses)
  specialistWallets: {
    aura: process.env.WALLET_AURA || '8vK86u6Ndf2sScb9jS6s55VnB7rN68f3T4E4E4E4E4E4',
    magos: process.env.WALLET_MAGOS || '7vK86u6Ndf2sScb9jS6s55VnB7rN68f3T4E4E4E4E4E4',
    bankr: process.env.WALLET_BANKR || 'Bq48PaxtoWv62QHeX3WYfmHHw9E7hJp38sx5t6tugDyd',
    seeker: process.env.WALLET_SEEKER || '9vK86u6Ndf2sScb9jS6s55VnB7rN68f3T4E4E4E4E4E4',
    scribe: process.env.WALLET_SCRIBE || 'CvK86u6Ndf2sScb9jS6s55VnB7rN68f3T4E4E4E4E4E4',
  } as Record<string, string>,

  x402: {
    facilitator: 'https://x402.org/facilitator',
    network: 'eip155:8453',  // Base mainnet
    solanaNetwork: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',  // Kept for fallback
  },

  // ERC-8004 Agent Trust Layer
  erc8004: {
    identityRegistry: process.env.ERC8004_IDENTITY_REGISTRY || '',
    reputationRegistry: process.env.ERC8004_REPUTATION_REGISTRY || '',
    chainId: 8453,  // Base mainnet
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  },

  // Base chain config
  base: {
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    chainId: 8453,
  }
};

export default config;
