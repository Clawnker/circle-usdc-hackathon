import axios from 'axios';
import config from './config';
import { logTransaction } from './x402';

const AGENTWALLET_API = 'https://agentwallet.mcpay.tech/api';

/**
 * Execute real x402 payment via AgentWallet's x402/fetch proxy
 * This is the ONE-STEP solution that handles 402 detection, signing, and retry
 */
export async function executeDemoPayment(
  specialistEndpoint: string,  // e.g., "http://localhost:3000/api/specialist/aura"
  requestBody: any,
  amountUsdc: number
): Promise<{ success: boolean; txSignature?: string; response?: any }> {
  const username = config.agentWallet.username || 'claw';
  const token = config.agentWallet.token;
  
  if (!token) {
    console.error('[x402] No AgentWallet token configured');
    return { success: false };
  }

  console.log(`[x402] Calling x402/fetch for: ${specialistEndpoint}`);
  
  try {
    const response = await axios.post(
      `${AGENTWALLET_API}/wallets/${username}/actions/x402/fetch`,
      {
        url: specialistEndpoint,
        method: 'POST',
        body: requestBody,
        preferredChain: 'solana',  // Base Sepolia for testnet
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,  // 60s timeout
      }
    );

    console.log('[x402] Response:', JSON.stringify(response.data).slice(0, 300));

    if (response.data.success && response.data.paid) {
      const payment = response.data.payment;
      const txSignature = payment?.txHash || payment?.signature;
      
      // Log the real transaction
      logTransaction({
        amount: payment?.amountFormatted || amountUsdc.toString(),
        currency: 'USDC',
        network: payment?.chain?.includes('solana') ? 'solana' : 'base',
        recipient: payment?.recipient || 'unknown',
        txHash: txSignature,
        status: 'completed',
        timestamp: new Date(),
      });

      return {
        success: true,
        txSignature,
        response: response.data.response?.body,
      };
    }

    // Payment not required or failed
    if (response.data.success && !response.data.paid) {
      console.log('[x402] No payment required for this endpoint');
      return { success: true, response: response.data.response?.body };
    }

    console.error('[x402] Payment failed:', response.data);
    return { success: false };

  } catch (error: any) {
    console.error('[x402] x402/fetch error:', error.response?.data || error.message);
    return { success: false };
  }
}

/**
 * Check payment cost without paying (dry run)
 */
export async function checkPaymentCost(
  specialistEndpoint: string,
  requestBody: any
): Promise<{ required: boolean; amount?: string; chain?: string }> {
  const username = config.agentWallet.username || 'claw';
  const token = config.agentWallet.token;
  
  if (!token) {
    return { required: false };
  }

  try {
    const response = await axios.post(
      `${AGENTWALLET_API}/wallets/${username}/actions/x402/fetch`,
      {
        url: specialistEndpoint,
        method: 'POST',
        body: requestBody,
        dryRun: true,
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.payment?.required) {
      return {
        required: true,
        amount: response.data.payment.amountFormatted,
        chain: response.data.payment.chain,
      };
    }

    return { required: false };
  } catch (error) {
    return { required: false };
  }
}
