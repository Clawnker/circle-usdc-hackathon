/**
 * Payments Module — Hivemind Protocol
 * 
 * Consolidated payment tracking and on-chain balance queries.
 * All USDC payments settle on Base Sepolia via the x402 facilitator
 * or ERC-20 transferFrom (delegation).
 */

import * as fs from 'fs';
import * as path from 'path';
import config from './config';
import { PaymentRecord } from './types';
import axios from 'axios';

// Persistence
const DATA_DIR = path.join(__dirname, '../data');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');

// In-memory transaction log
const transactionLog: PaymentRecord[] = [];

// Payment replay prevention — track used tx hashes (in-memory, resets on restart)
const usedPaymentProofs = new Set<string>();

/**
 * Check if a payment proof has already been used (replay prevention).
 * Returns true if the proof is valid (not yet used), false if replayed.
 */
export function validateAndConsumePaymentProof(proof: string): boolean {
  if (usedPaymentProofs.has(proof)) {
    console.warn(`[Payments] Replay detected: ${proof}`);
    return false;
  }
  usedPaymentProofs.add(proof);
  // Prevent memory leak — cap at 10k entries, prune oldest
  if (usedPaymentProofs.size > 10000) {
    const first = usedPaymentProofs.values().next().value;
    if (first) usedPaymentProofs.delete(first);
  }
  return true;
}

// ─── Persistence ───────────────────────────────────────────────

function loadPayments(): void {
  try {
    if (fs.existsSync(PAYMENTS_FILE)) {
      const data = fs.readFileSync(PAYMENTS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      parsed.forEach((p: any) => {
        p.timestamp = new Date(p.timestamp);
        transactionLog.push(p);
      });
      console.log(`[Payments] Loaded ${transactionLog.length} records from disk`);
    }
  } catch (error: any) {
    console.error(`[Payments] Failed to load:`, error.message);
  }
}

function savePayments(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(transactionLog, null, 2), 'utf8');
  } catch (error: any) {
    console.error(`[Payments] Failed to save:`, error.message);
  }
}

// Load on startup
loadPayments();

// ─── Public API ────────────────────────────────────────────────

/**
 * Create a payment record
 */
export function createPaymentRecord(
  amount: string,
  currency: string,
  network: string,
  recipient: string,
  txHash?: string,
  method?: string
): PaymentRecord {
  return {
    amount,
    currency,
    network,
    recipient,
    txHash,
    status: txHash ? 'completed' : 'pending',
    timestamp: new Date(),
    method,
  };
}

/**
 * Log a transaction to the audit trail
 */
export function logTransaction(record: PaymentRecord): void {
  transactionLog.push(record);
  savePayments();
  console.log(`[Payment] ${record.status}: ${record.amount} ${record.currency} on ${record.network}`);
  if (record.txHash) {
    console.log(`  TxHash: ${record.txHash}`);
  }
}

/**
 * Get all transaction records
 */
export function getTransactionLog(): PaymentRecord[] {
  return [...transactionLog];
}

/**
 * Get treasury balance on Base Sepolia (USDC + ETH)
 */
export async function getTreasuryBalance(): Promise<{ eth: number; usdc: number }> {
  const treasuryAddress = process.env.TREASURY_WALLET_EVM || '0x676fF3d546932dE6558a267887E58e39f405B135';
  const usdcAddress = config.base.usdcAddress;
  const paddedAddr = treasuryAddress.replace('0x', '').toLowerCase().padStart(64, '0');

  try {
    const [ethRes, usdcRes] = await Promise.all([
      axios.post(config.base.rpcUrl, {
        jsonrpc: '2.0', method: 'eth_getBalance',
        params: [treasuryAddress, 'latest'], id: 1
      }),
      axios.post(config.base.rpcUrl, {
        jsonrpc: '2.0', method: 'eth_call',
        params: [{ to: usdcAddress, data: `0x70a08231${paddedAddr}` }, 'latest'], id: 2
      })
    ]);

    return {
      eth: parseInt(ethRes.data?.result || '0x0', 16) / 1e18,
      usdc: parseInt(usdcRes.data?.result || '0x0', 16) / 1e6,
    };
  } catch (err: any) {
    console.error('[Payments] Balance check failed:', err.message);
    return { eth: 0, usdc: 0 };
  }
}

export default {
  createPaymentRecord,
  logTransaction,
  getTransactionLog,
  getTreasuryBalance,
};
