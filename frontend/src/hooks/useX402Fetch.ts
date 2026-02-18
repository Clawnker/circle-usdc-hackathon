/**
 * x402 Client Hook for Browser
 * 
 * Handles the 402 → sign → retry flow for x402-protected endpoints.
 * Uses wagmi/viem for Smart Wallet EIP-712 signing.
 */

import { useCallback } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';

// EIP-3009 TransferWithAuthorization types
const AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

interface PaymentRequirements {
  scheme: string;
  network: string;
  payTo: string;
  amount: string;
  asset: string;
  maxTimeoutSeconds: number;
  extra?: {
    name: string;
    version: string;
  };
}

function ensurePaymentRequirements(input: any): PaymentRequirements {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid payment requirements payload');
  }

  const requiredFields = ['network', 'payTo', 'amount', 'asset'];
  for (const field of requiredFields) {
    if (!input[field]) {
      throw new Error(`Payment requirements missing field: ${field}`);
    }
  }

  return {
    scheme: input.scheme || 'exact',
    network: input.network,
    payTo: input.payTo,
    amount: input.amount,
    asset: input.asset,
    maxTimeoutSeconds: input.maxTimeoutSeconds || 300,
    extra: input.extra,
  };
}

async function parseJsonSafe(response: Response): Promise<any | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

interface X402FetchResult {
  response: Response;
  data: any;
  paid: boolean;
  txHash?: string;
}

/**
 * Hook that wraps fetch with x402 payment handling.
 * If a request returns 402, it prompts the user's Smart Wallet
 * to sign an EIP-3009 TransferWithAuthorization, then retries.
 */
export function useX402Fetch() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const x402Fetch = useCallback(async (
    url: string,
    options: RequestInit = {},
  ): Promise<X402FetchResult> => {
    const timeoutMs = 25000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // First attempt — may return 402
    const firstResponse = await fetch(url, { ...options, signal: options.signal || controller.signal });
    clearTimeout(timeoutId);

    if (firstResponse.status !== 402) {
      // Not a paid endpoint, return as-is
      const data = await parseJsonSafe(firstResponse);
      return { response: firstResponse, data, paid: false };
    }

    if (!address) {
      throw new Error('Wallet not connected — cannot sign x402 payment');
    }

    // Parse payment requirements from 402 response
    const paymentRequired = await parseJsonSafe(firstResponse);
    
    // x402 v2: requirements in header; v1: in body
    let requirements: PaymentRequirements;
    const headerPayment = firstResponse.headers.get('payment-required');
    if (headerPayment) {
      // v2 format
      const parsed = JSON.parse(headerPayment);
      requirements = ensurePaymentRequirements(Array.isArray(parsed) ? parsed[0] : parsed);
    } else if (paymentRequired?.accepts) {
      // v1 format (our fallback)
      const candidate = Array.isArray(paymentRequired.accepts)
        ? paymentRequired.accepts[0]
        : paymentRequired.accepts;
      requirements = ensurePaymentRequirements(candidate);
    } else {
      throw new Error('No valid payment requirements in 402 response');
    }

    console.log('[x402] Payment required:', requirements);

    // Generate nonce
    const nonce = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('') as `0x${string}`;

    const now = Math.floor(Date.now() / 1000);
    const chainId = parseInt(requirements.network.split(':')[1] || '84532');

    // Build the EIP-712 authorization
    const authorization = {
      from: address,
      to: requirements.payTo as `0x${string}`,
      value: BigInt(requirements.amount),
      validAfter: BigInt(now - 600), // 10 min ago
      validBefore: BigInt(now + (requirements.maxTimeoutSeconds || 300)),
      nonce,
    };

    // Sign with Smart Wallet
    const signature = await signTypedDataAsync({
      domain: {
        name: requirements.extra?.name || 'USD Coin',
        version: requirements.extra?.version || '2',
        chainId,
        verifyingContract: requirements.asset as `0x${string}`,
      },
      types: AUTHORIZATION_TYPES,
      primaryType: 'TransferWithAuthorization',
      message: authorization,
    });

    console.log('[x402] Payment signed:', signature.slice(0, 20) + '...');

    // Build payment payload
    const paymentPayload = {
      x402Version: 2,
      payload: {
        authorization: {
          from: authorization.from,
          to: authorization.to,
          value: authorization.value.toString(),
          validAfter: authorization.validAfter.toString(),
          validBefore: authorization.validBefore.toString(),
          nonce,
        },
        signature,
      },
    };

    // Retry with payment header
    const encodedPayment = btoa(JSON.stringify(paymentPayload));
    const retryResponse = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'X-PAYMENT': encodedPayment,
      },
    });

    const data = await parseJsonSafe(retryResponse);

    return {
      response: retryResponse,
      data,
      paid: true,
    };
  }, [address, signTypedDataAsync]);

  return { x402Fetch };
}
