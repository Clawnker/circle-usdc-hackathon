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
 * Execute an x402 payment-gated API call
 * This proxies through AgentWallet which handles payment negotiation
 */
export async function x402Fetch(request: X402Request): Promise<X402Response> {
  const startTime = Date.now();
  
  try {
    if (!TOKEN) {
      throw new Error('AGENTWALLET_TOKEN is not configured');
    }

    const payload = {
      url: request.url,
      method: request.method,
      body: request.body,
      headers: request.headers,
      dryRun: request.dryRun ?? false,
    };

    console.log(`[x402] Fetching ${request.method} ${request.url} (dryRun: ${payload.dryRun})`);

    const response = await axios.post(
      `${AGENTWALLET_API}/wallets/${USERNAME}/actions/x402/fetch`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const elapsed = Date.now() - startTime;
    console.log(`[x402] Completed in ${elapsed}ms`);

    return {
      success: true,
      data: response.data.response,
      payment: response.data.payment,
    };
  } catch (error: any) {
    console.error('[x402] Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
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

/**
 * Execute a real x402 transfer on Solana devnet
 */
export async function executePayment(
  from: string,
  to: string,
  amount: number,
): Promise<{ success: boolean; txSignature?: string }> {
  try {
    const apiKey = process.env.AGENTWALLET_FUND_TOKEN || config.agentWallet.token;
    const username = config.agentWallet.username || 'claw';
    const apiUrl = config.agentWallet.apiUrl || 'https://agentwallet.mcpay.tech/api';
    
    if (!apiKey) {
      console.warn('[x402] No API key for payment execution');
      return { success: false };
    }

    console.log(`[x402] Executing real payment: ${amount} USDC from ${username} to ${to}`);
    
    // Use the correct AgentWallet API endpoint
    const response = await axios.post(
      `${apiUrl}/wallets/${username}/actions/transfer`,
      {
        chain: 'solana',
        network: 'devnet',
        asset: 'usdc',
        amount: amount.toString(),
        recipient: to,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log('[x402] Transfer response:', response.data);
    
    const txSignature = response.data?.txHash || response.data?.signature || response.data?.transactionHash;
    
    // Log the transaction
    logTransaction({
      amount: amount.toString(),
      currency: 'USDC',
      network: 'solana',
      recipient: to,
      txHash: txSignature,
      status: 'completed',
      timestamp: new Date(),
    });

    return {
      success: true,
      txSignature,
    };
  } catch (error: any) {
    console.error('[x402] Payment failed:', error.response?.data || error.message);
    
    // Still log failed attempt
    logTransaction({
      amount: amount.toString(),
      currency: 'USDC',
      network: 'solana',
      recipient: to,
      status: 'failed',
      timestamp: new Date(),
    });
    
    return { success: false };
  }
}

export default {
  getBalances,
  x402Fetch,
  createPaymentRecord,
  logTransaction,
  getTransactionLog,
  executePayment,
};
