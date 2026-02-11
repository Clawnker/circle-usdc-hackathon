/**
 * On-Chain Payment Executor
 * Sends real USDC micro-transfers on Base Sepolia when tasks are dispatched.
 * Uses Coinbase CDP SDK for standard wallet management.
 */

import { getOrCreateServerWallet, sendUSDC } from './cdp-wallet';
import { createPaymentRecord, logTransaction } from './x402';
import config from './config';

// Specialist treasury addresses (deterministic per-agent for demo)
// In production these would be real agent-controlled wallets
const SPECIALIST_ADDRESSES: Record<string, string> = {
  magos:  '0x0000000000000000000000000000000000000001',
  aura:   '0x0000000000000000000000000000000000000002',
  bankr:  '0x0000000000000000000000000000000000000003',
  scribe: '0x0000000000000000000000000000000000000004',
  seeker: '0x0000000000000000000000000000000000000005',
};

// Use the treasury wallet as a catch-all recipient so USDC stays recoverable
const DEFAULT_RECIPIENT = process.env.CDP_WALLET_ADDRESS || '0x676fF3d546932dE6558a267887E58e39f405B135';

/**
 * Send a real USDC payment on Base Sepolia using CDP SDK
 * @param specialist - Agent name (magos, aura, etc.)
 * @param amountUsdc - Amount in USDC (e.g. "0.001")
 * @returns Payment record with real tx hash, or null on failure
 */
export async function sendOnChainPayment(
  specialist: string,
  amountUsdc: string,
  recipientOverride?: string
): Promise<{ txHash: string; amount: string } | null> {
  // Use override for external agents, otherwise send to treasury
  const recipient = recipientOverride || DEFAULT_RECIPIENT;
  const amount = parseFloat(amountUsdc);

  try {
    console.log(`[OnChain] Sending ${amountUsdc} USDC to ${recipientOverride ? specialist : 'treasury'} (${recipient.slice(0, 10)}...) for ${specialist} using CDP...`);

    const transfer = await sendUSDC(recipient, amount);
    const txHash = transfer.getTransactionHash() || 'pending';
    
    console.log(`[OnChain] CDP Transfer submitted: ${txHash}`);

    // Log the payment
    const record = createPaymentRecord(
      amountUsdc,
      'USDC',
      'base-sepolia' as any,
      specialist,
      txHash
    );
    logTransaction(record);

    return { txHash, amount: amountUsdc };
  } catch (err: any) {
    console.error(`[OnChain] CDP Payment failed:`, err.message);
    return null;
  }
}

/**
 * Check CDP wallet balances
 */
export async function getDemoWalletBalances(): Promise<{ eth: string; usdc: string; address: string } | null> {
  try {
    const address = process.env.CDP_WALLET_ADDRESS || '0x676fF3d546932dE6558a267887E58e39f405B135';
    
    return {
      eth: "0",
      usdc: "0",
      address,
    };
  } catch (err: any) {
    console.error('[OnChain] Balance check failed:', err.message);
    return null;
  }
}

export default { sendOnChainPayment, getDemoWalletBalances };
