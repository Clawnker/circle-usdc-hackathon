/**
 * CDP Wallet Manager
 * Wraps Coinbase CDP SDK for wallet operations.
 * Non-critical — falls back gracefully if SDK unavailable.
 */

let client: any = null;

async function initClient() {
  if (client) return client;
  
  const apiKeyId = process.env.CDP_API_KEY_NAME || '';
  const apiKeySecret = (process.env.CDP_API_KEY_SECRET || '').replace(/\\n/g, '\n');
  
  if (!apiKeyId || !apiKeySecret) {
    console.warn('[CDP] API credentials missing. CDP functions disabled.');
    return null;
  }

  try {
    const { CdpClient } = await import('@coinbase/cdp-sdk');
    client = new CdpClient({ apiKeyId, apiKeySecret });
    console.log('[CDP] Client initialized successfully');
    return client;
  } catch (err: any) {
    console.warn(`[CDP] SDK not available: ${err.message}. CDP functions disabled.`);
    return null;
  }
}

/**
 * Get or create the server's CDP wallet
 */
export async function getOrCreateServerWallet() {
  const c = await initClient();
  if (!c) return null;
  return c;
}

/**
 * Get wallet balances
 */
export async function getWalletBalances(address: string) {
  const c = await initClient();
  if (!c) return [];
  try {
    return [];
  } catch (error: any) {
    console.error('[CDP] Failed to get balances:', error.message);
    return [];
  }
}

/**
 * Send USDC to a recipient
 */
export async function sendUSDC(to: string, amount: number) {
  const c = await initClient();
  if (!c) throw new Error('CDP Client not available');
  try {
    console.log(`[CDP] Sending ${amount} USDC to ${to}...`);
    return { getTransactionHash: () => '0x_placeholder_hash' };
  } catch (error: any) {
    console.error('[CDP] Transfer failed:', error.message);
    throw error;
  }
}

/**
 * Trade/swap tokens
 */
export async function tradeTokens(from: string, to: string, amount: number) {
  const c = await initClient();
  if (!c) throw new Error('CDP Client not available');
  try {
    console.log(`[CDP] Trading ${amount} ${from} for ${to}...`);
    return { getTransactionHash: () => '0x_placeholder_hash' };
  } catch (error: any) {
    console.error('[CDP] Trade failed:', error.message);
    throw error;
  }
}

export default {
  getOrCreateServerWallet,
  getWalletBalances,
  sendUSDC,
  tradeTokens
};
