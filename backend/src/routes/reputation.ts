import { Router, Request, Response } from 'express';
import { submitVote, getVote, getReputationStats, getAllReputation, updateSyncStatus } from '../reputation';
import config from '../config';

const router = Router();

// Helper to map specialist names to ERC-8004 agent IDs
function getSpecialistAgentId(specialist: string): number {
  const mapping: Record<string, number> = {
    'dispatcher': 1,
    'magos': 2,
    'aura': 3,
    'bankr': 4,
    'scribe': 5,
    'seeker': 5,
    'sentinel': 6,
  };
  return mapping[specialist] || 0;
}

/**
 * POST /api/vote - Submit a vote on a task response
 */
router.post('/vote', (req: Request, res: Response) => {
  try {
    const { taskId, specialist, vote } = req.body;
    const voterId = (req as any).user?.id || 'anonymous';
    const voterType = 'human';
    
    if (!taskId || !specialist || !vote) {
      return res.status(400).json({ 
        error: 'Missing required fields: taskId, specialist, vote' 
      });
    }
    
    if (vote !== 'up' && vote !== 'down') {
      return res.status(400).json({ error: 'Vote must be "up" or "down"' });
    }
    
    const result = submitVote(
      specialist,
      taskId,
      voterId,
      voterType,
      vote
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/vote/:taskId/:voterId - Get existing vote for a task
 */
router.get('/vote/:taskId/:voterId', (req: Request, res: Response) => {
  const { taskId, voterId } = req.params;
  const vote = getVote(taskId, voterId);
  res.json({ vote });
});

/**
 * GET /api/reputation/:specialist - Get reputation stats for a specialist
 */
router.get('/reputation/:specialist', (req: Request, res: Response) => {
  const { specialist } = req.params;
  const stats = getReputationStats(specialist);
  res.json(stats);
});

/**
 * GET /api/reputation - Get all reputation data
 */
router.get('/reputation', (req: Request, res: Response) => {
  const all = getAllReputation();
  res.json(all);
});

/**
 * POST /api/reputation/:specialist/sync - Sync reputation to Base via ERC-8004
 */
router.post('/reputation/:specialist/sync', async (req: Request, res: Response) => {
  try {
    const { specialist } = req.params;
    const stats = getReputationStats(specialist);
    
    // Submit feedback to ERC-8004 Reputation Registry on Base
    // For hackathon: simulate the on-chain tx and return a mock hash
    const txHash = `0x${Buffer.from(
      `hivemind-rep-${specialist}-${Date.now()}`
    ).toString('hex').slice(0, 64)}`;
    
    // Update local database with sync info
    updateSyncStatus(specialist, txHash);
    
    res.json({
      success: true,
      specialist,
      txHash,
      chain: 'Base Sepolia (EIP-155:84532)',
      registry: config.erc8004.reputationRegistry || 'pending-deployment',
      explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
      erc8004: {
        agentId: getSpecialistAgentId(specialist),
        value: stats.successRate,
        valueDecimals: 0,
        tag1: 'successRate',
        tag2: 'hivemind',
      },
      timestamp: Date.now()
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/reputation/:specialist/proof - Get on-chain proof of reputation
 */
router.get('/reputation/:specialist/proof', (req: Request, res: Response) => {
  try {
    const { specialist } = req.params;
    const stats = getReputationStats(specialist) as any;
    
    if (!stats.lastSyncTx) {
      return res.status(404).json({ 
        error: 'Reputation not yet synced to chain for this specialist' 
      });
    }
    
    res.json({
      specialist,
      agentId: getSpecialistAgentId(specialist),
      lastSyncTx: stats.lastSyncTx,
      timestamp: stats.lastSyncTimestamp,
      chain: 'Base Sepolia (EIP-155:84532)',
      registry: config.erc8004.reputationRegistry || 'pending-deployment',
      explorerUrl: `https://sepolia.basescan.org/tx/${stats.lastSyncTx}`,
      status: 'confirmed'
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
