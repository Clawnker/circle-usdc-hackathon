import axios from 'axios';
import config from './config';
import { logTransaction } from './x402';

const AGENTWALLET_API = 'https://agentwallet.mcpay.tech/api';

/**
 * Fetch the most recent x402 payment event from AgentWallet activity
 */
async function getLatestPaymentEvent(username: string, token: string): Promise<{ eventId?: string; amount?: string } | null> {
  try {
    const response = await axios.get(
      `${AGENTWALLET_API}/wallets/${username}/activity?limit=1`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 5000,
      }
    );
    
    const events = response.data?.events;
    if (events && events.length > 0 && events[0].eventType === 'x402.fetch.completed') {
      return {
        eventId: events[0].id,
        amount: events[0].amountWithSymbol,
      };
    }
    return null;
  } catch (error) {
    console.error('[x402] Failed to fetch activity:', error);
    return null;
  }
}

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
  
  // Localhost bypass for development
  if (specialistEndpoint.includes('localhost') || specialistEndpoint.includes('127.0.0.1')) {
    console.log('[x402] Localhost detected, bypassing real x402/fetch proxy');
    return { success: true };
  }
  
  try {
    const response = await axios.post(
      `${AGENTWALLET_API}/wallets/${username}/actions/x402/fetch`,
      {
        url: specialistEndpoint,
        method: 'POST',
        body: requestBody,
        // Let AgentWallet auto-select chain based on 402 response payment options
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
      
      // Fetch the actual event ID from AgentWallet activity
      const latestEvent = await getLatestPaymentEvent(username, token);
      const receiptId = latestEvent?.eventId || response.data.policyEvaluationId || `x402-${Date.now()}`;
      
      console.log(`[Payment] completed: ${payment?.amountFormatted} ${payment?.tokenSymbol} on ${payment?.chain?.includes('solana') ? 'solana' : 'base'}`);
      console.log(`  Receipt: ${receiptId}`);
      console.log(`  Verify: https://agentwallet.mcpay.tech/u/${username}`);
      
      // Log the real transaction
      logTransaction({
        amount: payment?.amountFormatted || amountUsdc.toString(),
        currency: 'USDC',
        network: payment?.chain?.includes('solana') ? 'solana' : 'base',
        recipient: payment?.recipient || 'unknown',
        txHash: receiptId,
        status: 'completed',
        timestamp: new Date(),
      });

      return {
        success: true,
        txSignature: receiptId,
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
