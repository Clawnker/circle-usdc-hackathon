/**
 * On-Chain Payment Executor
 * Sends real USDC micro-transfers on Base Sepolia when tasks are dispatched.
 * Uses a dedicated demo wallet funded with testnet USDC + ETH for gas.
 */

import { ethers } from 'ethers';
import { createPaymentRecord, logTransaction } from './x402';

// Base Sepolia config
const RPC_URL = 'https://sepolia.base.org';
const CHAIN_ID = 84532;
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const USDC_DECIMALS = 6;

// Demo wallet — private key loaded from env
const DEMO_WALLET_KEY = process.env.DEMO_WALLET_PRIVATE_KEY || '';

// ERC-20 transfer ABI
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
];

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
const DEFAULT_RECIPIENT = '0x676fF3d546932dE6558a267887E58e39f405B135';

let provider: ethers.JsonRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;
let usdcContract: ethers.Contract | null = null;

/**
 * Initialize the on-chain payment system
 */
function init(): boolean {
  if (wallet) return true;

  if (!DEMO_WALLET_KEY) {
    console.warn('[OnChain] DEMO_WALLET_PRIVATE_KEY not set — on-chain payments disabled');
    return false;
  }

  try {
    provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
    wallet = new ethers.Wallet(DEMO_WALLET_KEY, provider);
    usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
    console.log(`[OnChain] Initialized wallet: ${wallet.address} on Base Sepolia`);
    return true;
  } catch (err: any) {
    console.error('[OnChain] Failed to initialize:', err.message);
    return false;
  }
}

/**
 * Send a real USDC payment on Base Sepolia
 * @param specialist - Agent name (magos, aura, etc.)
 * @param amountUsdc - Amount in USDC (e.g. "0.001")
 * @returns Payment record with real tx hash, or null on failure
 */
export async function sendOnChainPayment(
  specialist: string,
  amountUsdc: string
): Promise<{ txHash: string; amount: string } | null> {
  if (!init()) return null;

  const recipient = DEFAULT_RECIPIENT; // Send to treasury so funds stay recoverable
  const amountWei = ethers.parseUnits(amountUsdc, USDC_DECIMALS);

  try {
    // Check balance first
    const balance = await usdcContract!.balanceOf(wallet!.address);
    if (balance < amountWei) {
      console.warn(`[OnChain] Insufficient USDC: ${ethers.formatUnits(balance, USDC_DECIMALS)} < ${amountUsdc}`);
      return null;
    }

    console.log(`[OnChain] Sending ${amountUsdc} USDC to treasury for ${specialist}...`);

    const tx = await usdcContract!.transfer(recipient, amountWei);
    console.log(`[OnChain] Tx submitted: ${tx.hash}`);

    // Wait for confirmation (1 block)
    const receipt = await tx.wait(1);
    console.log(`[OnChain] Confirmed in block ${receipt?.blockNumber}, gas used: ${receipt?.gasUsed}`);

    // Log the payment
    const record = createPaymentRecord(
      amountUsdc,
      'USDC',
      'base-sepolia' as any,
      specialist,
      tx.hash
    );
    logTransaction(record);

    return { txHash: tx.hash, amount: amountUsdc };
  } catch (err: any) {
    console.error(`[OnChain] Payment failed:`, err.message);
    return null;
  }
}

/**
 * Check demo wallet balances
 */
export async function getDemoWalletBalances(): Promise<{ eth: string; usdc: string; address: string } | null> {
  if (!init()) return null;

  try {
    const [ethBal, usdcBal] = await Promise.all([
      provider!.getBalance(wallet!.address),
      usdcContract!.balanceOf(wallet!.address),
    ]);

    return {
      eth: ethers.formatEther(ethBal),
      usdc: ethers.formatUnits(usdcBal, USDC_DECIMALS),
      address: wallet!.address,
    };
  } catch (err: any) {
    console.error('[OnChain] Balance check failed:', err.message);
    return null;
  }
}

export default { sendOnChainPayment, getDemoWalletBalances };
