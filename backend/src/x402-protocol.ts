import config from './config';
import { logTransaction } from './x402';

/**
 * x402 Protocol — User-Pays Model
 * 
 * With x402-express middleware on routes, users pay from their connected
 * Smart Wallet via the frontend PaymentFlow component. The middleware
 * verifies payment before the request reaches the handler.
 * 
 * This module now only records fees for display/tracking purposes.
 * No payments are made from the server-side demo wallet.
 */

/**
 * Record a fee for tracking purposes (no actual payment from server wallet).
 * The real payment comes from the user's connected wallet via x402-express.
 */
export async function executeDemoPayment(
  specialistEndpoint: string,
  requestBody: any,
  amountUsdc: number
): Promise<{ success: boolean; txSignature?: string; response?: any }> {
  console.log(`[x402] Fee recorded: ${amountUsdc} USDC for ${specialistEndpoint} (user pays via connected wallet)`);
  
  // Generate a tracking ID for the payment record
  const trackingId = `user-pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  // Extract specialist name from endpoint URL
  const specialistMatch = specialistEndpoint.match(/specialist\/(\w+)/);
  const specialistName = specialistMatch ? specialistMatch[1] : 'unknown';
  
  // Log for transaction history display (use standard field names)
  logTransaction({
    amount: String(amountUsdc),
    currency: 'USDC',
    network: 'base-sepolia',
    recipient: specialistName,
    txHash: trackingId,
    status: 'pending',
    method: 'x402-user',
    timestamp: new Date().toISOString(),
  });
  
  return { 
    success: true, 
    txSignature: trackingId,
  };
}

/**
 * Check payment cost from config fees
 */
export async function checkPaymentCost(
  specialistEndpoint: string,
  requestBody: any
): Promise<{ required: boolean; amount?: string; chain?: string }> {
  const match = specialistEndpoint.match(/specialist\/(\w+)/);
  if (match) {
    const specialist = match[1];
    const fee = (config.fees as any)[specialist];
    if (fee && fee > 0) {
      return { required: true, amount: `${fee} USDC`, chain: 'base-sepolia' };
    }
  }
  return { required: false };
}
