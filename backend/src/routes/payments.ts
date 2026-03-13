import { Router, Request, Response } from 'express';
import { getTreasuryBalance, getTransactionLog, logTransaction } from '../payments';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { normalizeClientNetworkMode } from '../utils/client-network';
import { getNetworkConfig } from '../utils/network-config';

const router = Router();

/**
 * Delegated payment — pull USDC from user's wallet via ERC-20 approval.
 * User pre-approves the demo wallet address to spend their USDC.
 * This endpoint calls transferFrom(user, treasury, amount).
 */
router.post('/delegate-pay', async (req: Request, res: Response) => {
  try {
    const { userAddress, amount, specialist, networkMode } = req.body;
    const mode = normalizeClientNetworkMode(networkMode);
    const network = getNetworkConfig(mode);
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
    const TREASURY = network.treasuryAddress;
    const USDC = network.usdcAddress;
    const amountWei = parseUnits(String(amount), 6);

    const walletClient = createWalletClient({
      account,
      chain: network.chain,
      transport: http(network.rpcUrl),
    });
    const publicClient = createPublicClient({
      chain: network.chain,
      transport: http(network.rpcUrl),
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
      chain: network.chain,
    });

    await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });

    console.log(`[delegate-pay] transferFrom ${userAddress} → treasury | ${amount} USDC | specialist: ${specialist} | tx: ${hash}`);

    logTransaction({
      amount: String(amount),
      currency: 'USDC',
      network: network.routeLabel,
      recipient: specialist || 'unknown',
      txHash: hash,
      status: 'completed',
      method: 'delegated',
      timestamp: new Date(),
    });

    res.json({ 
      success: true, 
      txHash: hash,
      explorer: `${network.explorerBase}/tx/${hash}`,
      network: network.routeLabel,
      networkMode: mode,
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
    const mode = normalizeClientNetworkMode(req.query.network || req.query.networkMode);
    const network = getNetworkConfig(mode);
    const balances = await getTreasuryBalance(mode);
    res.json({
      address: network.treasuryAddress,
      chain: network.routeLabel,
      networkMode: mode,
      chainId: network.chainId,
      usdcAddress: network.usdcAddress,
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
  const mode = normalizeClientNetworkMode(req.query.network || req.query.networkMode);
  const transactions = getTransactionLog(mode);
  res.json({ transactions, count: transactions.length, networkMode: mode });
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
