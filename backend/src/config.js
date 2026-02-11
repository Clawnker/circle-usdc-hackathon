"use strict";
/**
 * Hivemind Protocol Configuration
 * Loads configuration from environment and config files
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
var fs = require("fs");
var path = require("path");
var dotenv = require("dotenv");
dotenv.config();
function loadJsonConfig(filePath) {
    try {
        var resolved = filePath.startsWith('~')
            ? path.join(process.env.HOME || '', filePath.slice(1))
            : filePath;
        var content = fs.readFileSync(resolved, 'utf-8');
        return JSON.parse(content);
    }
    catch (err) {
        console.warn("Could not load config from ".concat(filePath, ":"), err);
        return null;
    }
}
var agentWalletConfig = loadJsonConfig('~/.agentwallet/config.json');
var heliusConfig = loadJsonConfig('~/.config/helius/config.json');
exports.config = {
    // Server
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    // AgentWallet
    agentWallet: {
        apiUrl: process.env.AGENTWALLET_API_URL || 'https://agentwallet.mcpay.tech/api',
        username: (agentWalletConfig === null || agentWalletConfig === void 0 ? void 0 : agentWalletConfig.username) || process.env.AGENTWALLET_USERNAME || 'claw',
        token: (agentWalletConfig === null || agentWalletConfig === void 0 ? void 0 : agentWalletConfig.apiToken) || process.env.AGENTWALLET_FUND_TOKEN || process.env.AGENTWALLET_TOKEN || '',
        fundToken: (agentWalletConfig === null || agentWalletConfig === void 0 ? void 0 : agentWalletConfig.apiToken) || process.env.AGENTWALLET_FUND_TOKEN || process.env.AGENTWALLET_TOKEN || '',
        solanaAddress: (agentWalletConfig === null || agentWalletConfig === void 0 ? void 0 : agentWalletConfig.solanaAddress) || '',
        evmAddress: (agentWalletConfig === null || agentWalletConfig === void 0 ? void 0 : agentWalletConfig.evmAddress) || '',
    },
    // Helius RPC
    helius: {
        apiKey: process.env.HELIUS_API_KEY || (heliusConfig === null || heliusConfig === void 0 ? void 0 : heliusConfig.apiKey) || '',
        mainnet: process.env.HELIUS_API_KEY
            ? "https://mainnet.helius-rpc.com/?api-key=".concat(process.env.HELIUS_API_KEY)
            : ((heliusConfig === null || heliusConfig === void 0 ? void 0 : heliusConfig.mainnet) || 'https://mainnet.helius-rpc.com'),
        devnet: process.env.HELIUS_API_KEY
            ? "https://devnet.helius-rpc.com/?api-key=".concat(process.env.HELIUS_API_KEY)
            : ((heliusConfig === null || heliusConfig === void 0 ? void 0 : heliusConfig.devnet) || 'https://devnet.helius-rpc.com'),
        credits: (heliusConfig === null || heliusConfig === void 0 ? void 0 : heliusConfig.credits) || 0,
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
        sentinel: 2.50,
        general: 0,
    },
    // Specialist Wallets (Receiving addresses)
    specialistWallets: {
        aura: process.env.WALLET_AURA || '8vK86u6Ndf2sScb9jS6s55VnB7rN68f3T4E4E4E4E4E4',
        magos: process.env.WALLET_MAGOS || '7vK86u6Ndf2sScb9jS6s55VnB7rN68f3T4E4E4E4E4E4',
        bankr: process.env.WALLET_BANKR || 'Bq48PaxtoWv62QHeX3WYfmHHw9E7hJp38sx5t6tugDyd',
        seeker: process.env.WALLET_SEEKER || '9vK86u6Ndf2sScb9jS6s55VnB7rN68f3T4E4E4E4E4E4',
        scribe: process.env.WALLET_SCRIBE || 'CvK86u6Ndf2sScb9jS6s55VnB7rN68f3T4E4E4E4E4E4',
    },
    x402: {
        facilitator: 'https://x402.org/facilitator',
        network: 'eip155:84532', // Base Sepolia testnet
        solanaNetwork: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', // Kept for fallback
    },
    // ERC-8004 Agent Trust Layer
    erc8004: {
        identityRegistry: process.env.ERC8004_IDENTITY_REGISTRY || '',
        reputationRegistry: process.env.ERC8004_REPUTATION_REGISTRY || '',
        chainId: 84532, // Base Sepolia testnet
        rpcUrl: process.env.BASE_RPC_URL || 'https://sepolia.base.org',
    },
    // Base chain config
    base: {
        rpcUrl: process.env.BASE_RPC_URL || 'https://sepolia.base.org',
        usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        chainId: 84532,
    }
};
exports.default = exports.config;
