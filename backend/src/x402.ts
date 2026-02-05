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
    
    return {
      solana: {
        sol: solBalance ? parseFloat(solBalance.rawValue) / Math.pow(10, solBalance.decimals) : 0,
        usdc: solUsdcBalance ? parseFloat(solUsdcBalance.rawValue) / Math.pow(10, solUsdcBalance.decimals) : 0,
      },
      evm: {
        eth: ethBalance ? parseFloat(ethBalance.rawValue) / Math.pow(10, ethBalance.decimals) : 0,
        usdc: evmUsdcBalance ? parseFloat(evmUsdcBalance.rawValue) / Math.pow(10, evmUsdcBalance.decimals) : 0,
      },
    };
  } catch (error: any) {
    console.error('Failed to get balances:', error.message);
    return {
      solana: { sol: 0, usdc: 0 },
      evm: { eth: 0, usdc: 0 },
    };
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
