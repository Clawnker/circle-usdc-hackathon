/**
 * x402 Middleware for Specialist API Endpoints
 * Uses official x402 SDK with x402.org testnet facilitator
 */

// @ts-ignore
import { paymentMiddleware, PaymentRequiredError } from '@x402/express';
// @ts-ignore
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
// @ts-ignore
import { registerExactEvmScheme } from '@x402/evm/exact/server';
// For Solana support (if available)
// import { registerExactSvmScheme } from '@x402/svm/exact/server';
import config from './config';

// Treasury wallet to receive all payments
const TREASURY_WALLET = process.env.WALLET_TREASURY || '5xUugg8ysgqpcGneM6qpM2AZ8ZGuMaH5TnGNWdCQC1Z1';

// Solana devnet network (CAIP-2 format)
const SOLANA_DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1' as `${string}:${string}`;
const BASE_SEPOLIA = 'eip155:84532' as `${string}:${string}`;

// Create facilitator client
export const facilitatorClient = new HTTPFacilitatorClient({
  url: 'https://x402.org/facilitator'
});

// Create x402 resource server
export const x402Server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(x402Server);
// registerExactSvmScheme(x402Server); // Add when Solana scheme is available

// Define specialist pricing routes
export const specialistRoutes: any = {
  'POST /api/specialist/aura': {
    accepts: [
      {
        scheme: 'exact',
        price: '$0.0005',
        network: SOLANA_DEVNET, // Use Base Sepolia for testnet
        payTo: TREASURY_WALLET,
      }
    ],
    description: 'Social Analyst Aura - Sentiment & trending analysis',
    mimeType: 'application/json',
  },
  'POST /api/specialist/magos': {
    accepts: [
      {
        scheme: 'exact',
        price: '$0.001',
        network: SOLANA_DEVNET,
        payTo: TREASURY_WALLET,
      }
    ],
    description: 'Market Oracle Magos - Predictions & risk analysis',
    mimeType: 'application/json',
  },
  'POST /api/specialist/bankr': {
    accepts: [
      {
        scheme: 'exact',
        price: '$0.0001',
        network: SOLANA_DEVNET,
        payTo: TREASURY_WALLET,
      }
    ],
    description: 'DeFi Specialist Bankr - Trading & wallet operations',
    mimeType: 'application/json',
  },
  'POST /api/specialist/seeker': {
    accepts: [
      {
        scheme: 'exact',
        price: '$0.0001',
        network: SOLANA_DEVNET,
        payTo: TREASURY_WALLET,
      }
    ],
    description: 'Web Research Seeker - Information lookup',
    mimeType: 'application/json',
  },
  'POST /api/specialist/scribe': {
    accepts: [
      {
        scheme: 'exact',
        price: '$0.0001',
        network: SOLANA_DEVNET,
        payTo: TREASURY_WALLET,
      }
    ],
    description: 'General Assistant Scribe - Writing & analysis',
    mimeType: 'application/json',
  },
};

// Create the payment middleware
export const x402PaymentMiddleware = paymentMiddleware(
  specialistRoutes,
  x402Server
);

// Export payment required response creator for custom handling
export function create402Response(specialistId: string) {
  const route = (specialistRoutes as any)[`POST /api/specialist/${specialistId}`];
  if (!route) {
    throw new Error(`Unknown specialist: ${specialistId}`);
  }
  
  return {
    status: 402,
    x402Version: 2,
    accepts: route.accepts,
    description: route.description,
    mimeType: route.mimeType,
  };
}
