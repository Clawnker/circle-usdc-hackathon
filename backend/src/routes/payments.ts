import { Router, Request, Response } from 'express';
import { getTreasuryBalance, getTransactionLog, logTransaction } from '../payments';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const router = Router();
const TREASURY_WALLET_EVM = '0x676fF3d546932dE6558a267887E58e39f405B135';

/**
 * Delegated payment — pull USDC from user's wallet via ERC-20 approval.
 * User pre-approves the demo wallet address to spend their USDC.
 * This endpoint calls transferFrom(user, treasury, amount).
 */
router.post('/delegate-pay', async (req: Request, res: Response) => {
  try {
    const { userAddress, amount, specialist } = req.body;
    if (!userAddress || !amount) {
      return res.status(400).json({ error: 'userAddress and amount required' });
    }

    // Validate inputs
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return res.status(400).json({ error: 'Invalid userAddress (expected 0x-prefixed EVM address)' });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100) {
      return res.status(400).json({ error: 'Invalid amount (must be 0 < amount <= 100)' });
    }
    
    const privateKey = process.env.DEMO_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({ error: 'Delegate wallet not configured' });
    }

    // viem imports are now static at top of file
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const TREASURY = TREASURY_WALLET_EVM as `0x${string}`;
    const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
    const amountWei = parseUnits(String(amount), 6);

    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(),
    });
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    // Pull USDC from user's wallet to treasury via their on-chain approval
    const hash = await walletClient.writeContract({
      account,
      address: USDC,
      abi: [{
        name: 'transferFrom',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
      }],
      functionName: 'transferFrom',
      args: [userAddress as `0x${string}`, TREASURY, amountWei],
      chain: baseSepolia,
    });

    await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });

    console.log(`[delegate-pay] transferFrom ${userAddress} → treasury | ${amount} USDC | specialist: ${specialist} | tx: ${hash}`);

    logTransaction({
      amount: String(amount),
      currency: 'USDC',
      network: 'base-sepolia',
      recipient: specialist || 'unknown',
      txHash: hash,
      status: 'completed',
      method: 'delegated',
      timestamp: new Date(),
    });

    res.json({ 
      success: true, 
      txHash: hash,
      explorer: `https://sepolia.basescan.org/tx/${hash}`,
    });
  } catch (err: any) {
    console.error('[delegate-pay] Failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get treasury wallet balances
 * GET /wallet/balances
 */
router.get('/wallet/balances', async (req: Request, res: Response) => {
  try {
    const balances = await getTreasuryBalance();
    res.json({
      address: TREASURY_WALLET_EVM,
      chain: 'base-sepolia',
      balances,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Get transaction log
 * GET /wallet/transactions
 */
router.get('/wallet/transactions', (req: Request, res: Response) => {
  const transactions = getTransactionLog();
  res.json({ transactions, count: transactions.length });
});

/**
 * GET /wallet/lookup/:username - Lookup AgentWallet by username (Proxy for CORS)
 */
router.get('/wallet/lookup/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const response = await fetch(`https://agentwallet.mcpay.tech/api/wallets/${encodeURIComponent(username)}`);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Wallet not found' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to lookup wallet', message: err.message });
  }
});

export default router;
