/**
 * bankr Specialist - AgentWallet Devnet Integration with Jupiter Routing
 * Uses Jupiter API for quotes/routing visualization
 * Uses AgentWallet for devnet Solana transactions
 */

import axios from 'axios';
import { BankrAction, SpecialistResult } from '../types';
import config from '../config';
import solana from '../solana';

const AGENTWALLET_API = config.agentWallet.apiUrl;
const AGENTWALLET_USERNAME = config.agentWallet.username;
const AGENTWALLET_TOKEN = config.agentWallet.token;

// AgentWallet Solana address (devnet)
const SOLANA_ADDRESS = config.agentWallet.solanaAddress || '5xUugg8ysgqpcGneM6qpM2AZ8ZGuMaH5TnGNWdCQC1Z1';

// Jupiter API for quotes (mainnet reference pricing)
const JUPITER_API = 'https://api.jup.ag/swap/v1';

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
    const response = await axios.get(`${JUPITER_API}/quote`, {
      params: {
        inputMint,
        outputMint,
        amount: amountInSmallestUnit,
        slippageBps: 100, // 1% slippage
        restrictIntermediateTokens: true,
      },
      timeout: 10000,
    });
    
    return response.data;
  } catch (error: any) {
    // Jupiter API might require API key or be rate limited
    console.log(`[bankr] Jupiter API error: ${error.response?.status || error.message}`);
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
  
  const data = response.data;
  
  // Extract Solana balances
  const solanaBalances = data.solana?.balances || data.solanaWallets?.[0]?.balances || [];
  const solBalance = solanaBalances.find((b: any) => b.asset === 'sol');
  const solUsdcBalance = solanaBalances.find((b: any) => b.asset === 'usdc');
  
  // Extract Base USDC (for demo)
  const evmBalances = data.evm?.balances || data.evmWallets?.[0]?.balances || [];
  const baseUsdcBalance = evmBalances.find((b: any) => b.chain === 'base' && b.asset === 'usdc');
  
  return {
    solanaAddress: data.solana?.address || data.solanaWallets?.[0]?.address,
    evmAddress: data.evm?.address || data.evmWallets?.[0]?.address,
    solana: {
      sol: solBalance ? (parseInt(solBalance.rawValue) / 1e9).toFixed(4) : '0',
      usdc: solUsdcBalance ? (parseInt(solUsdcBalance.rawValue) / 1e6).toFixed(2) : '0',
    },
    base: {
      usdc: baseUsdcBalance ? (parseInt(baseUsdcBalance.rawValue) / 1e6).toFixed(2) : '0',
    },
  };
}

/**
 * Execute swap via Jupiter (simulation with real routing)
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
  
  // Get Jupiter quote for routing info
  const quote = await getJupiterQuote(inputMint, outputMint, amount, decimals);
  
  if (quote && quote.outAmount) {
    const { route, hops } = formatRoutePlan(quote);
    const outputDecimals = to.toUpperCase() === 'SOL' ? 9 : 6;
    const outAmount = (parseInt(quote.outAmount) / Math.pow(10, outputDecimals)).toFixed(6);
    
    console.log(`[bankr] Jupiter route: ${route}`);
    console.log(`[bankr] Expected output: ${outAmount} ${to}`);
    
    // On devnet, we simulate the swap but show real routing
    // In production, this would execute the actual swap transaction
    return {
      type: 'swap',
      status: 'simulated',
      details: {
        from,
        to,
        amount,
        inputMint,
        outputMint,
        estimatedOutput: outAmount,
        priceImpact: quote.priceImpactPct || '0',
        slippageBps: quote.slippageBps,
        route,
        routePlan: hops,
        network: 'devnet (simulated with mainnet routing)',
        note: 'Devnet has no DEX liquidity. Showing mainnet Jupiter routing for demonstration.',
      },
    };
  }
  
  // Fallback to mock if Jupiter unavailable
  return {
    type: 'swap',
    status: 'simulated',
    details: {
      from,
      to,
      amount,
      estimatedOutput: estimateOutput(from, to, amount),
      route: 'Mock routing (Jupiter API unavailable)',
      network: 'devnet',
      note: 'Using mock prices. Jupiter API requires authentication.',
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
  // Don't treat "buy" as swap if it's an advice query (e.g., "is it a good buy")
  const isAdvice = lower.includes('good') || lower.includes('should') || lower.includes('recommend');
  
  if (!isAdvice && (lower.includes('swap') || lower.includes('buy') || lower.includes('sell') || lower.includes('trade') || lower.includes('exchange'))) {
    // Pattern: "swap 0.1 SOL for USDC" or "buy USDC with 0.1 SOL"
    const swapMatch = prompt.match(/(?:swap|buy|trade|sell|exchange)\s+(?:([\d.]+)\s+)?(\w+)\s+(?:for|to|with)\s+(\w+)/i);
    if (swapMatch) {
      let from = swapMatch[2].toUpperCase();
      let to = swapMatch[3].toUpperCase();
      let amt = swapMatch[1] || amount;
      
      // Handle "buy X with Y" (reverse order)
      if (lower.includes('with') && lower.indexOf('with') > lower.indexOf(swapMatch[2].toLowerCase())) {
        [from, to] = [to, from];
      }
      
      return { type: 'swap', amount: amt, from, to };
    }
    
    // Simpler pattern: "buy 0.1 SOL"
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
      
      let data: BankrAction;
      let txSignature: string | undefined;
      
      switch (intent.type) {
        case 'swap':
          // Use Jupiter for routing visualization
          data = await executeJupiterSwap(intent.from!, intent.to!, intent.amount!);
          
          // Build summary
          const routeInfo = data.details.route || 'Direct';
          (data as any).summary = `🔄 **Swap Routed via Jupiter**\n` +
            `• Input: ${intent.amount} ${intent.from}\n` +
            `• Output: ~${data.details.estimatedOutput} ${intent.to}\n` +
            `• Route: ${routeInfo}\n` +
            `• Price Impact: ${data.details.priceImpact || '<0.01'}%\n` +
            `• Status: ${data.status} (devnet)`;
          break;
          
        case 'transfer':
          if (intent.address) {
            try {
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
              details: { error: 'No recipient address provided. Please provide a valid Solana address.' },
            };
            (data as any).summary = `❌ Transfer failed: No recipient address provided.`;
          }
          break;
          
        case 'balance':
        default:
          // Use Helius for devnet balance (more accurate)
          const devnetSol = await solana.getBalance(SOLANA_ADDRESS, 'devnet');
          
          // Also get AgentWallet balances for Base USDC
          let baseUsdc = '0.00';
          let evmAddress = '';
          try {
            const agentBalances = await getAgentWalletBalances();
            baseUsdc = agentBalances.base?.usdc || '0.00';
            evmAddress = agentBalances.evmAddress || '';
          } catch (e) {
            console.log('[bankr] AgentWallet API unavailable for EVM balances');
          }
          
          data = {
            type: 'balance',
            status: 'confirmed',
            details: {
              solanaAddress: SOLANA_ADDRESS,
              evmAddress,
              solana: {
                sol: devnetSol.toFixed(4),
                usdc: '0.00', // Devnet USDC would need SPL token lookup
                network: 'devnet',
              },
              base: {
                usdc: baseUsdc,
              },
              summary: `💰 **Wallet Balance**\n• Solana (devnet): ${devnetSol.toFixed(4)} SOL\n• Base: ${baseUsdc} USDC`,
            },
          };
          (data as any).summary = data.details.summary;
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
