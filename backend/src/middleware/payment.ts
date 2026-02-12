import { Request, Response, NextFunction } from 'express';
import config from '../config';

// Treasury wallet for receiving payments
const TREASURY_WALLET_EVM = '0x676fF3d546932dE6558a267887E58e39f405B135';
const BASE_USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC

// Manual 402 payment middleware (x402-express v2 API incompatible with simple use)
export const paymentMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Check if payment proof header exists
  const paymentHeader = req.headers['x-payment'] || req.headers['x-402-payment'];
  if (paymentHeader) {
    // User already paid — let through
    return next();
  }

  // Extract specialist from route
  const specialist = req.params?.id;
  const fee = specialist ? (config.fees as any)[specialist] : 0;
  
  if (!fee || fee <= 0) {
    return next(); // No fee required
  }

  // Return 402 with payment info
  res.status(402).json({
    error: 'Payment Required',
    accepts: [{
      scheme: 'exact',
      network: 'base-sepolia',
      maxAmountRequired: String(Math.round(fee * 1e6)), // USDC has 6 decimals
      resource: req.originalUrl,
      description: `Query the ${specialist} AI specialist via Hivemind Protocol`,
      mimeType: 'application/json',
      payTo: TREASURY_WALLET_EVM,
      maxTimeoutSeconds: 300,
      asset: BASE_USDC_ADDRESS,
    }],
    x402Version: 1,
  });
};
