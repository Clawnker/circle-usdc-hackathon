/**
 * bankr Specialist - AgentWallet Devnet Integration with Jupiter Routing
 * Uses Jupiter API for quotes/routing visualization
 * Uses Helius for accurate devnet balance
 * Maintains simulated balance state for swap demonstrations
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { BankrAction, SpecialistResult } from '../types';
import config from '../config';
import solana from '../solana';

const AGENTWALLET_API = config.agentWallet.apiUrl;
const AGENTWALLET_USERNAME = config.agentWallet.username;
const AGENTWALLET_TOKEN = config.agentWallet.token;

// AgentWallet Solana address (devnet)
const SOLANA_ADDRESS = config.agentWallet.solanaAddress || '5xUugg8ysgqpcGneM6qpM2AZ8ZGuMaH5TnGNWdCQC1Z1';

// Jupiter API for quotes (with API key for authenticated access)
const JUPITER_API = config.jupiter?.baseUrl || 'https://api.jup.ag';
const JUPITER_ULTRA_API = config.jupiter?.ultraUrl || 'https://api.jup.ag/ultra';
const JUPITER_API_KEY = config.jupiter?.apiKey || '';

// Well-known token mints
const TOKEN_MINTS: Record<string, string> = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  'PYTH': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
};

// Simulated balance state file
const SIMULATED_STATE_PATH = path.join(__dirname, '../../data/simulated-balances.json');

interface SimulatedBalances {
  lastRealBalanceCheck: number;
  realSOL: number;
  balances: Record<string, number>;
  transactions: Array<{
    type: 'swap' | 'transfer';
    from: string;
    to: string;
    amountIn: number;
    amountOut: number;
    timestamp: number;
    route?: string;
  }>;
}

/**
 * Load simulated balance state
 */
function loadSimulatedState(): SimulatedBalances {
  try {
    if (fs.existsSync(SIMULATED_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(SIMULATED_STATE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.log('[bankr] Could not load simulated state, creating new');
  }
  
  return {
    lastRealBalanceCheck: 0,
    realSOL: 0,
    balances: { SOL: 0, USDC: 0 },
    transactions: [],
  };
}

/**
 * Save simulated balance state
 */
function saveSimulatedState(state: SimulatedBalances): void {
  try {
    const dir = path.dirname(SIMULATED_STATE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SIMULATED_STATE_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[bankr] Could not save simulated state:', e);
  }
}

/**
 * Sync simulated state with real devnet balance
 */
async function syncWithRealBalance(): Promise<SimulatedBalances> {
  const state = loadSimulatedState();
  const now = Date.now();
  
  // Refresh real balance every 5 minutes or if never checked
  if (now - state.lastRealBalanceCheck > 5 * 60 * 1000 || state.realSOL === 0) {
    console.log('[bankr] Syncing with real devnet balance via Helius...');
    const realBalance = await solana.getBalance(SOLANA_ADDRESS, 'devnet');
    
    // If this is first sync or balance changed externally, update simulated SOL
    if (state.realSOL === 0 || Math.abs(realBalance - state.realSOL) > 0.001) {
      console.log(`[bankr] Real balance: ${realBalance} SOL (was ${state.realSOL})`);
      state.realSOL = realBalance;
      state.balances.SOL = realBalance;
    }
    
    state.lastRealBalanceCheck = now;
    saveSimulatedState(state);
  }
  
  return state;
}

/**
 * Apply a simulated swap to balances
 */
function applySimulatedSwap(
  state: SimulatedBalances,
  from: string,
  to: string,
  amountIn: number,
  amountOut: number,
  route?: string
): SimulatedBalances {
  const fromToken = from.toUpperCase();
  const toToken = to.toUpperCase();
  
  // Initialize balances if needed
  if (state.balances[fromToken] === undefined) state.balances[fromToken] = 0;
  if (state.balances[toToken] === undefined) state.balances[toToken] = 0;
  
  // Check if we have enough balance
  if (state.balances[fromToken] < amountIn) {
    console.log(`[bankr] Insufficient ${fromToken}: have ${state.balances[fromToken]}, need ${amountIn}`);
    return state;
  }
  
  // Apply swap
  state.balances[fromToken] -= amountIn;
  state.balances[toToken] += amountOut;
  
  // Record transaction
  state.transactions.push({
    type: 'swap',
    from: fromToken,
    to: toToken,
    amountIn,
    amountOut,
    timestamp: Date.now(),
    route,
  });
  
  // Keep only last 50 transactions
  if (state.transactions.length > 50) {
    state.transactions = state.transactions.slice(-50);
  }
  
  saveSimulatedState(state);
  return state;
}

/**
 * Get Jupiter quote for swap routing visualization
 */
async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  decimals: number = 9
): Promise<any> {
  const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString();
  
  console.log(`[bankr] Jupiter quote: ${amount} (${amountInSmallestUnit} lamports) ${inputMint.slice(0,8)}... -> ${outputMint.slice(0,8)}...`);
  
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add API key if available
    if (JUPITER_API_KEY) {
      headers['x-api-key'] = JUPITER_API_KEY;
    }
    
    const response = await axios.get(`${JUPITER_API}/swap/v1/quote`, {
      params: {
        inputMint,
        outputMint,
        amount: amountInSmallestUnit,
        slippageBps: 100, // 1% slippage
        restrictIntermediateTokens: true,
      },
      headers,
      timeout: 10000,
    });
    
    console.log(`[bankr] Jupiter quote received: ${response.data.outAmount} output`);
    return response.data;
  } catch (error: any) {
    console.log(`[bankr] Jupiter API error: ${error.response?.status || error.message}`);
    if (error.response?.data) {
      console.log(`[bankr] Jupiter error details:`, error.response.data);
    }
    return null;
  }
}

/**
 * Format Jupiter route plan for display
 */
function formatRoutePlan(quote: any): { route: string; hops: any[] } {
  if (!quote?.routePlan?.length) {
    return { route: 'Direct swap', hops: [] };
  }
  
  const hops = quote.routePlan.map((step: any) => ({
    dex: step.swapInfo?.label || 'Unknown DEX',
    inputMint: step.swapInfo?.inputMint?.slice(0, 8) + '...',
    outputMint: step.swapInfo?.outputMint?.slice(0, 8) + '...',
    inAmount: step.swapInfo?.inAmount,
    outAmount: step.swapInfo?.outAmount,
    percent: step.percent,
  }));
  
  const route = hops.map((h: any) => h.dex).join(' → ');
  
  return { route, hops };
}

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
 * Execute swap via Jupiter (simulation with real routing and balance tracking)
 */
async function executeJupiterSwap(
  from: string, 
  to: string, 
  amount: string
): Promise<BankrAction> {
  console.log(`[bankr] Jupiter swap: ${amount} ${from} -> ${to}`);
  
  const inputMint = TOKEN_MINTS[from.toUpperCase()] || from;
  const outputMint = TOKEN_MINTS[to.toUpperCase()] || to;
  const decimals = from.toUpperCase() === 'SOL' ? 9 : 6;
  
  // Sync with real balance first
  let state = await syncWithRealBalance();
  const amountIn = parseFloat(amount);
  
  // Check if we have enough balance
  const currentBalance = state.balances[from.toUpperCase()] || 0;
  if (currentBalance < amountIn) {
    return {
      type: 'swap',
      status: 'failed',
      details: {
        error: `Insufficient ${from} balance`,
        available: currentBalance.toFixed(4),
        required: amountIn.toFixed(4),
      },
    };
  }
  
  // Get Jupiter quote for routing info
  const quote = await getJupiterQuote(inputMint, outputMint, amount, decimals);
  
  if (quote && quote.outAmount) {
    const { route, hops } = formatRoutePlan(quote);
    const outputDecimals = to.toUpperCase() === 'SOL' ? 9 : 6;
    const outAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);
    const outAmountStr = outAmount.toFixed(6);
    
    console.log(`[bankr] Jupiter route: ${route}`);
    console.log(`[bankr] Expected output: ${outAmountStr} ${to}`);
    
    // Apply simulated swap to balance state
    state = applySimulatedSwap(state, from, to, amountIn, outAmount, route);
    
    // Build response with updated balances
    return {
      type: 'swap',
      status: 'executed',
      details: {
        from,
        to,
        amount,
        inputMint,
        outputMint,
        estimatedOutput: outAmountStr,
        priceImpact: quote.priceImpactPct || '0',
        slippageBps: quote.slippageBps,
        route,
        routePlan: hops,
        network: 'devnet (simulated)',
        // Include updated balances
        balancesBefore: {
          [from]: (currentBalance).toFixed(4),
          [to]: ((state.balances[to.toUpperCase()] || 0) - outAmount).toFixed(4),
        },
        balancesAfter: {
          [from]: state.balances[from.toUpperCase()]?.toFixed(4) || '0',
          [to]: state.balances[to.toUpperCase()]?.toFixed(4) || '0',
        },
      },
    };
  }
  
  // Fallback to mock if Jupiter unavailable
  const mockOutput = parseFloat(estimateOutput(from, to, amount));
  state = applySimulatedSwap(state, from, to, amountIn, mockOutput, 'Mock');
  
  return {
    type: 'swap',
    status: 'executed',
    details: {
      from,
      to,
      amount,
      estimatedOutput: mockOutput.toFixed(6),
      route: 'Mock routing (Jupiter API unavailable)',
      network: 'devnet (simulated)',
      balancesAfter: {
        [from]: state.balances[from.toUpperCase()]?.toFixed(4) || '0',
        [to]: state.balances[to.toUpperCase()]?.toFixed(4) || '0',
      },
    },
  };
}

/**
 * Estimate swap output based on mock rates (fallback)
 */
function estimateOutput(from: string, to: string, amount: string): string {
  const rates: Record<string, number> = {
    'SOL_USDC': 170.00,
    'USDC_SOL': 0.00588,
    'SOL_BONK': 3500000,
    'BONK_SOL': 0.000000286,
    'SOL_WIF': 85,
    'WIF_SOL': 0.0118,
    'SOL_JUP': 200,
    'JUP_SOL': 0.005,
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
  const amountMatch = prompt.match(/([\d.]+)\s*(SOL|USDC|USDT|BONK|WIF|JUP|RAY)/i);
  const amount = amountMatch ? amountMatch[1] : '0.1';
  
  // Detect intent
  const isAdvice = lower.includes('good') || lower.includes('should') || lower.includes('recommend');
  
  if (!isAdvice && (lower.includes('swap') || lower.includes('buy') || lower.includes('sell') || lower.includes('trade') || lower.includes('exchange'))) {
    const swapMatch = prompt.match(/(?:swap|buy|trade|sell|exchange)\s+(?:([\d.]+)\s+)?(\w+)\s+(?:for|to|with)\s+(\w+)/i);
    if (swapMatch) {
      let from = swapMatch[2].toUpperCase();
      let to = swapMatch[3].toUpperCase();
      let amt = swapMatch[1] || amount;
      
      if (lower.includes('with') && lower.indexOf('with') > lower.indexOf(swapMatch[2].toLowerCase())) {
        [from, to] = [to, from];
      }
      
      return { type: 'swap', amount: amt, from, to };
    }
    
    if (amountMatch) {
      const token = amountMatch[2].toUpperCase();
      if (lower.includes('sell')) {
        return { type: 'swap', from: token, to: 'USDC', amount };
      } else {
        return { type: 'swap', from: 'SOL', to: token === 'SOL' ? 'USDC' : token, amount };
      }
    }
    
    return { type: 'swap', from: 'SOL', to: 'USDC', amount };
  }
  
  if (lower.includes('transfer') || lower.includes('send') || lower.includes('pay')) {
    const addressMatch = prompt.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    return { 
      type: 'transfer', 
      address: addressMatch ? addressMatch[0] : undefined,
      amount,
    };
  }
  
  return { type: 'balance' };
}

/**
 * Reset simulated balances to real devnet state
 */
async function resetSimulatedBalances(): Promise<SimulatedBalances> {
  const realBalance = await solana.getBalance(SOLANA_ADDRESS, 'devnet');
  const state: SimulatedBalances = {
    lastRealBalanceCheck: Date.now(),
    realSOL: realBalance,
    balances: { SOL: realBalance, USDC: 0 },
    transactions: [],
  };
  saveSimulatedState(state);
  return state;
}

/**
 * bankr specialist handler
 */
export const bankr = {
  name: 'bankr',
  description: 'DeFi specialist using Jupiter routing and AgentWallet for transactions',
  
  async handle(prompt: string): Promise<SpecialistResult> {
    const startTime = Date.now();
    
    try {
      const intent = parseIntent(prompt);
      console.log(`[bankr] Intent: ${intent.type}`, intent);
      
      // Handle reset command
      if (prompt.toLowerCase().includes('reset balance') || prompt.toLowerCase().includes('sync balance')) {
        const state = await resetSimulatedBalances();
        return {
          success: true,
          data: {
            type: 'balance',
            status: 'reset',
            details: {
              message: 'Balances reset to real devnet state',
              balances: state.balances,
            },
          },
          timestamp: new Date(),
          executionTimeMs: Date.now() - startTime,
        };
      }
      
      let data: BankrAction;
      let txSignature: string | undefined;
      
      switch (intent.type) {
        case 'swap':
          data = await executeJupiterSwap(intent.from!, intent.to!, intent.amount!);
          
          if (data.status === 'failed') {
            (data as any).summary = `❌ **Swap Failed**\n• ${data.details.error}\n• Available: ${data.details.available} ${intent.from}\n• Required: ${data.details.required} ${intent.from}`;
          } else {
            const routeInfo = data.details.route || 'Direct';
            (data as any).summary = `🔄 **Swap Executed via Jupiter**\n` +
              `• Input: ${intent.amount} ${intent.from}\n` +
              `• Output: ${data.details.estimatedOutput} ${intent.to}\n` +
              `• Route: ${routeInfo}\n` +
              `• Price Impact: ${data.details.priceImpact || '<0.01'}%\n` +
              `\n📊 **Updated Balances:**\n` +
              `• ${intent.from}: ${data.details.balancesAfter?.[intent.from!] || '0'}\n` +
              `• ${intent.to}: ${data.details.balancesAfter?.[intent.to!] || '0'}`;
          }
          break;
          
        case 'transfer':
          if (intent.address) {
            try {
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
              (data as any).summary = `✅ Successfully sent ${intent.amount} SOL to ${intent.address?.slice(0, 8)}...`;
            } catch (transferError: any) {
              console.error('[bankr] Transfer execution failed:', transferError.message);
              data = {
                type: 'transfer',
                status: 'failed',
                details: { 
                  error: transferError.response?.data?.error || transferError.message,
                  note: 'Check if devnet wallet has sufficient SOL for gas'
                },
              };
              (data as any).summary = `❌ Transfer failed: ${transferError.message}`;
            }
          } else {
            data = {
              type: 'transfer',
              status: 'failed',
              details: { error: 'No recipient address provided.' },
            };
            (data as any).summary = `❌ Transfer failed: No recipient address provided.`;
          }
          break;
          
        case 'balance':
        default:
          // Get synced balance state
          const state = await syncWithRealBalance();
          
          // Format balance display
          const balanceLines = Object.entries(state.balances)
            .filter(([_, v]) => v > 0)
            .map(([token, amount]) => `• ${token}: ${(amount as number).toFixed(4)}`)
            .join('\n');
          
          // Get recent transactions
          const recentTxs = state.transactions.slice(-5).reverse();
          const txLines = recentTxs.length > 0
            ? recentTxs.map(tx => 
                `• ${tx.type}: ${tx.amountIn.toFixed(4)} ${tx.from} → ${tx.amountOut.toFixed(4)} ${tx.to}`
              ).join('\n')
            : 'No recent transactions';
          
          data = {
            type: 'balance',
            status: 'confirmed',
            details: {
              solanaAddress: SOLANA_ADDRESS,
              network: 'devnet',
              balances: state.balances,
              realSOL: state.realSOL,
              lastSync: new Date(state.lastRealBalanceCheck).toISOString(),
              recentTransactions: recentTxs,
            },
          };
          
          (data as any).summary = `💰 **Wallet Balance** (Devnet)\n` +
            `📍 \`${SOLANA_ADDRESS.slice(0, 8)}...${SOLANA_ADDRESS.slice(-4)}\`\n\n` +
            `**Balances:**\n${balanceLines || '• No tokens'}\n\n` +
            `**Recent Activity:**\n${txLines}`;
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
