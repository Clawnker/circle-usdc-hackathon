/**
 * bankr Specialist - AgentWallet Devnet Integration
 * Uses AgentWallet for devnet Solana transactions
 * Falls back to bankr API mock for complex operations
 */

import axios from 'axios';
import { BankrAction, SpecialistResult } from '../types';
import config from '../config';

const AGENTWALLET_API = 'https://agentwallet.mcpay.tech/api';
const AGENTWALLET_USERNAME = config.agentWallet.username;
const AGENTWALLET_TOKEN = config.agentWallet.fundToken;

// Bankr API for complex operations (dry-run mode)
const BANKR_CONFIG = (() => {
  try {
    const fs = require('fs');
    const configPath = process.env.HOME + '/.clawdbot/skills/bankr/config.json';
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return { apiKey: '', apiUrl: 'https://api.bankr.bot' };
  }
})();

/**
 * Execute Solana transfer via AgentWallet (devnet)
 */
async function executeAgentWalletTransfer(
  to: string, 
  amount: string, 
  asset: 'sol' | 'usdc' = 'sol'
): Promise<{ txHash: string; explorer: string; status: string }> {
  console.log(`[bankr] AgentWallet devnet transfer: ${amount} ${asset} to ${to}`);
  
  // Convert amount to lamports/smallest unit
  const decimals = asset === 'sol' ? 9 : 6;
  const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString();
  
  const response = await axios.post(
    `${AGENTWALLET_API}/wallets/${AGENTWALLET_USERNAME}/actions/transfer-solana`,
    {
      to,
      amount: amountInSmallestUnit,
      asset,
      network: 'devnet',
    },
    {
      headers: {
        'Authorization': `Bearer ${AGENTWALLET_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  return response.data;
}

/**
 * Get wallet balances from AgentWallet
 */
async function getAgentWalletBalances(): Promise<any> {
  const response = await axios.get(
    `${AGENTWALLET_API}/wallets/${AGENTWALLET_USERNAME}/balances`,
    {
      headers: {
        'Authorization': `Bearer ${AGENTWALLET_TOKEN}`,
      },
    }
  );
  return response.data;
}

/**
 * Simulate swap via bankr API (dry-run) or mock
 */
async function simulateSwap(from: string, to: string, amount: string): Promise<BankrAction> {
  console.log(`[bankr] Simulating swap: ${amount} ${from} -> ${to}`);
  
  // Try bankr API with dry-run
  if (BANKR_CONFIG.apiKey) {
    try {
      const response = await axios.post(
        `${BANKR_CONFIG.apiUrl}/v1/agent/jobs`,
        { prompt: `Simulate swapping ${amount} ${from} for ${to} (dry run, do not execute)` },
        {
          headers: {
            'Authorization': `Bearer ${BANKR_CONFIG.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      
      // Poll for result briefly
      const jobId = response.data.jobId;
      await new Promise(r => setTimeout(r, 2000));
      
      const status = await axios.get(
        `${BANKR_CONFIG.apiUrl}/v1/agent/jobs/${jobId}`,
        { headers: { 'Authorization': `Bearer ${BANKR_CONFIG.apiKey}` } }
      );
      
      return {
        type: 'swap',
        status: 'simulated',
        details: {
          from,
          to,
          amount,
          jobId,
          response: status.data.response || 'Swap simulated via bankr (dry-run)',
          estimatedOutput: estimateOutput(from, to, amount),
        },
      };
    } catch (err: any) {
      console.log('[bankr] Bankr API unavailable, using local mock');
    }
  }
  
  // Local mock fallback
  return {
    type: 'swap',
    status: 'simulated',
    details: {
      from,
      to,
      amount,
      estimatedOutput: estimateOutput(from, to, amount),
      note: 'Simulated swap (demo mode)',
      estimatedFee: '0.000005 SOL',
    },
  };
}

/**
 * Estimate swap output based on mock rates
 */
function estimateOutput(from: string, to: string, amount: string): string {
  const rates: Record<string, number> = {
    'SOL_USDC': 125.50,
    'USDC_SOL': 0.00797,
    'SOL_BONK': 2500000,
    'BONK_SOL': 0.0000004,
    'SOL_WIF': 50,
    'WIF_SOL': 0.02,
  };
  
  const key = `${from.toUpperCase()}_${to.toUpperCase()}`;
  const rate = rates[key] || 1;
  return (parseFloat(amount) * rate * 0.995).toFixed(6); // 0.5% slippage
}

/**
 * Parse user intent from prompt
 */
function parseIntent(prompt: string): {
  type: 'swap' | 'transfer' | 'balance';
  from?: string;
  to?: string;
  amount?: string;
  address?: string;
} {
  const lower = prompt.toLowerCase();
  
  // Extract amount
  const amountMatch = prompt.match(/([\d.]+)\s*(SOL|USDC|BONK|WIF)/i);
  const amount = amountMatch ? amountMatch[1] : '0.1';
  
  // Detect intent
  if (lower.includes('swap') || lower.includes('buy') || lower.includes('sell') || lower.includes('trade')) {
    const swapMatch = prompt.match(/(?:swap|buy|trade|sell)\s+(?:([\d.]+)\s+)?(\w+)\s+(?:for|to)\s+(\w+)/i);
    if (swapMatch) {
      return {
        type: 'swap',
        amount: swapMatch[1] || amount,
        from: swapMatch[2].toUpperCase(),
        to: swapMatch[3].toUpperCase(),
      };
    }
    return { type: 'swap', from: 'SOL', to: 'USDC', amount };
  }
  
  if (lower.includes('transfer') || lower.includes('send')) {
    const addressMatch = prompt.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    return { 
      type: 'transfer', 
      address: addressMatch?.[0],
      amount,
    };
  }
  
  return { type: 'balance' };
}

/**
 * bankr specialist handler
 */
export const bankr = {
  name: 'bankr',
  description: 'DeFi specialist using AgentWallet for devnet transactions',
  
  async handle(prompt: string): Promise<SpecialistResult> {
    const startTime = Date.now();
    
    try {
      const intent = parseIntent(prompt);
      console.log(`[bankr] Intent: ${intent.type}`, intent);
      
      let data: BankrAction;
      let txSignature: string | undefined;
      
      switch (intent.type) {
        case 'swap':
          // Swaps are simulated (no devnet DEX liquidity)
          data = await simulateSwap(intent.from!, intent.to!, intent.amount!);
          break;
          
        case 'transfer':
          if (intent.address) {
            // Real devnet transfer via AgentWallet
            const result = await executeAgentWalletTransfer(
              intent.address,
              intent.amount || '0.01',
              'sol'
            );
            txSignature = result.txHash;
            data = {
              type: 'transfer',
              status: 'confirmed',
              txSignature,
              details: {
                to: intent.address,
                amount: intent.amount,
                explorer: result.explorer,
                network: 'devnet',
              },
            };
          } else {
            data = {
              type: 'transfer',
              status: 'failed',
              details: { error: 'No recipient address provided' },
            };
          }
          break;
          
        case 'balance':
        default:
          const balances = await getAgentWalletBalances();
          const solBalance = balances.solana?.balances?.find((b: any) => b.asset === 'sol');
          const usdcBalance = balances.solana?.balances?.find((b: any) => b.asset === 'usdc');
          
          data = {
            type: 'balance',
            status: 'confirmed',
            details: {
              address: balances.solana?.address,
              sol: solBalance ? (parseInt(solBalance.rawValue) / 1e9).toFixed(4) : '0',
              usdc: usdcBalance ? (parseInt(usdcBalance.rawValue) / 1e6).toFixed(2) : '0',
              network: 'devnet',
            },
          };
          break;
      }
      
      return {
        success: true,
        data,
        confidence: 0.95,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
        cost: txSignature ? {
          amount: '0.000005',
          currency: 'SOL',
          network: 'solana',
          recipient: 'network',
        } : undefined,
      };
    } catch (error: any) {
      console.error('[bankr] Error:', error.message);
      
      return {
        success: false,
        data: {
          type: 'balance',
          status: 'failed',
          details: { error: error.message },
        },
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};

export default bankr;
