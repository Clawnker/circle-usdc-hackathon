/**
 * x402 Payment Integration
 * Handles payments through AgentWallet's x402 protocol
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import config from './config';
import { X402Request, X402Response, PaymentRecord } from './types';

const AGENTWALLET_API = config.agentWallet.apiUrl;
const USERNAME = config.agentWallet.username;
const TOKEN = config.agentWallet.token;

// Persistence settings
const DATA_DIR = path.join(__dirname, '../data');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');

/**
 * Check wallet balances before making payments
 */
export async function getBalances(): Promise<{
  solana: { sol: number; usdc: number };
  evm: { eth: number; usdc: number };
}> {
  try {
    const response = await axios.get(
      `${AGENTWALLET_API}/wallets/${USERNAME}/balances`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
      }
    );
    
    const data = response.data;
    
    // Parse Solana balances
    const solanaBalances = data.solana?.balances || [];
    const solBalance = solanaBalances.find((b: any) => b.asset === 'sol');
    const solUsdcBalance = solanaBalances.find((b: any) => b.asset === 'usdc');
    
    // Parse EVM balances (use base as primary)
    const evmBalances = data.evm?.balances || [];
    const ethBalance = evmBalances.find((b: any) => b.chain === 'base' && b.asset === 'eth');
    const evmUsdcBalance = evmBalances.find((b: any) => b.chain === 'base' && b.asset === 'usdc');
    
    let evmUsdc = evmUsdcBalance ? parseFloat(evmUsdcBalance.rawValue) / Math.pow(10, evmUsdcBalance.decimals) : 0;
    let evmEth = ethBalance ? parseFloat(ethBalance.rawValue) / Math.pow(10, ethBalance.decimals) : 0;
    
    // If AgentWallet reports 0, check on-chain directly via Base RPC
    if (evmUsdc === 0) {
      try {
        const treasuryAddress = process.env.TREASURY_WALLET_EVM || '0x676fF3d546932dE6558a267887E58e39f405B135';
        const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
        const paddedAddr = treasuryAddress.replace('0x', '').toLowerCase().padStart(64, '0');
        
        const [ethRes, usdcRes] = await Promise.all([
          axios.post('https://mainnet.base.org', {
            jsonrpc: '2.0', method: 'eth_getBalance',
            params: [treasuryAddress, 'latest'], id: 1
          }),
          axios.post('https://mainnet.base.org', {
            jsonrpc: '2.0', method: 'eth_call',
            params: [{ to: usdcAddress, data: `0x70a08231${paddedAddr}` }, 'latest'], id: 2
          })
        ]);
        
        evmEth = parseInt(ethRes.data?.result || '0x0', 16) / 1e18;
        evmUsdc = parseInt(usdcRes.data?.result || '0x0', 16) / 1e6;
        console.log(`[Wallet] On-chain Base balance: ${evmEth} ETH, ${evmUsdc} USDC`);
      } catch (rpcErr: any) {
        console.error('[Wallet] Base RPC fallback failed:', rpcErr.message);
      }
    }
    
    return {
      solana: {
        sol: solBalance ? parseFloat(solBalance.rawValue) / Math.pow(10, solBalance.decimals) : 0,
        usdc: solUsdcBalance ? parseFloat(solUsdcBalance.rawValue) / Math.pow(10, solUsdcBalance.decimals) : 0,
      },
      evm: {
        eth: evmEth,
        usdc: evmUsdc,
      },
    };
  } catch (error: any) {
    console.error('Failed to get balances:', error.message);
    
    // Even if AgentWallet fails, try on-chain check
    try {
      const treasuryAddress = process.env.TREASURY_WALLET_EVM || '0x676fF3d546932dE6558a267887E58e39f405B135';
      const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      const paddedAddr = treasuryAddress.replace('0x', '').toLowerCase().padStart(64, '0');
      
      const [ethRes, usdcRes] = await Promise.all([
        axios.post('https://mainnet.base.org', {
          jsonrpc: '2.0', method: 'eth_getBalance',
          params: [treasuryAddress, 'latest'], id: 1
        }),
        axios.post('https://mainnet.base.org', {
          jsonrpc: '2.0', method: 'eth_call',
          params: [{ to: usdcAddress, data: `0x70a08231${paddedAddr}` }, 'latest'], id: 2
        })
      ]);
      
      return {
        solana: { sol: 0, usdc: 0 },
        evm: {
          eth: parseInt(ethRes.data?.result || '0x0', 16) / 1e18,
          usdc: parseInt(usdcRes.data?.result || '0x0', 16) / 1e6,
        },
      };
    } catch {
      return {
        solana: { sol: 0, usdc: 0 },
        evm: { eth: 0, usdc: 0 },
      };
    }
  }
}

/**
 * Create a payment record for logging
 */
export function createPaymentRecord(
  amount: string,
  currency: string,
  network: 'solana' | 'base' | 'ethereum',
  recipient: string,
  txHash?: string
): PaymentRecord {
  return {
    amount,
    currency,
    network,
    recipient,
    txHash,
    status: txHash ? 'completed' : 'pending',
    timestamp: new Date(),
  };
}

/**
 * Log transaction for audit trail
 */
const transactionLog: PaymentRecord[] = [];

/**
 * Load payments from disk
 */
function loadPayments(): void {
  try {
    if (fs.existsSync(PAYMENTS_FILE)) {
      const data = fs.readFileSync(PAYMENTS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      parsed.forEach((p: any) => {
        p.timestamp = new Date(p.timestamp);
        transactionLog.push(p);
      });
      console.log(`[x402] Loaded ${transactionLog.length} payments from persistence`);
    }
  } catch (error: any) {
    console.error(`[x402] Failed to load payments:`, error.message);
  }
}

/**
 * Save payments to disk
 */
function savePayments(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(transactionLog, null, 2), 'utf8');
  } catch (error: any) {
    console.error(`[x402] Failed to save payments:`, error.message);
  }
}

// Initial load
loadPayments();

export function logTransaction(record: PaymentRecord): void {
  transactionLog.push(record);
  savePayments();
  console.log(`[Payment] ${record.status}: ${record.amount} ${record.currency} on ${record.network}`);
  if (record.txHash) {
    console.log(`  TxHash: ${record.txHash}`);
  }
}

export function getTransactionLog(): PaymentRecord[] {
  return [...transactionLog];
}

export default {
  getBalances,
  createPaymentRecord,
  logTransaction,
  getTransactionLog,
};
