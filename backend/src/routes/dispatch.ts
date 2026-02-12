import { Router, Request, Response } from 'express';
import dispatcher, { dispatch, getTask, getRecentTasks, executeTask, updateTaskStatus } from '../dispatcher';
import { DispatchRequest, SpecialistType } from '../types';
import config from '../config';

const router = Router();

/**
 * Route preview — returns specialist + fee without executing.
 * For multi-step DAG queries, returns total cost across all steps.
 */
router.post('/route-preview', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });
    
    // Try DAG planning first to get accurate multi-step cost
    const { planDAG } = await import('../llm-planner');
    const dagPlan = await planDAG(prompt);
    
    if (dagPlan.steps.length > 1) {
      // Multi-step: return total cost and first specialist
      const totalFee = dagPlan.totalEstimatedCost || dagPlan.steps.reduce((sum, s) => sum + (s.estimatedCost || 0), 0);
      const specialists = dagPlan.steps.map(s => s.specialist);
      res.json({ 
        specialist: specialists.join(' → '), 
        specialists,
        fee: totalFee, 
        currency: 'USDC', 
        network: 'base-sepolia',
        isMultiStep: true,
        steps: dagPlan.steps.length,
      });
    } else {
      // Single step
      const specialist = dagPlan.steps[0]?.specialist || 'scribe';
      const fee = dagPlan.steps[0]?.estimatedCost || (config.fees as any)[specialist] || 0;
      res.json({ specialist, fee, currency: 'USDC', network: 'base-sepolia' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Submit a task to the dispatcher
 * POST /dispatch or /query
 */
const dispatchHandler = async (req: Request, res: Response) => {
  try {
    const { prompt, userId, preferredSpecialist, dryRun, callbackUrl, hiredAgents, approvedAgent, previewOnly } = req.body as DispatchRequest;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const paymentProof = req.headers['x-payment-proof'] as string | undefined;
    
    const result = await dispatch({
      prompt,
      userId: userId || (req as any).user?.id || 'anonymous',
      preferredSpecialist,
      dryRun,
      callbackUrl,
      hiredAgents,
      approvedAgent,
      previewOnly,
      paymentProof,  // Skip internal payment if user already paid via delegation
    });

    res.status(202).json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
};

router.post('/dispatch', dispatchHandler);
router.post('/query', dispatchHandler);

/**
 * Get task status by ID
 * GET /status/:taskId
 */
router.get('/status/:taskId', (req: Request, res: Response) => {
  const { taskId } = req.params;
  const task = getTask(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Security: only allow task owner to see task status (relaxed for demo)
  const userId = (req as any).user?.id;
  if (userId && userId !== 'demo-user' && task.userId !== userId) {
    return res.status(403).json({ error: 'Access denied: not your task' });
  }

  res.json(task);
});

/**
 * Approve a pending transaction
 * POST /transactions/approve
 */
router.post('/transactions/approve', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;
    const task = getTask(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.log(`[API] Transaction approved for task ${taskId}`);
    
    // Update task metadata and status
    task.metadata = { 
      ...task.metadata, 
      transactionApproved: true,
      requiresTransactionApproval: false 
    };
    
    // Resume task execution
    updateTaskStatus(task, 'processing');
    executeTask(task, task.metadata?.dryRun || false);

    res.json({ success: true, status: 'processing' });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Reject a pending transaction
 * POST /transactions/reject
 */
router.post('/transactions/reject', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;
    const task = getTask(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.log(`[API] Transaction rejected for task ${taskId}`);
    
    task.metadata = { 
      ...task.metadata, 
      transactionApproved: false,
      requiresTransactionApproval: false 
    };
    
    task.result = {
      success: false,
      data: { error: 'Transaction rejected by user' },
      timestamp: new Date(),
      executionTimeMs: 0
    };
    
    updateTaskStatus(task, 'failed');

    res.json({ success: true, status: 'failed' });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Get recent tasks
 * GET /tasks?limit=10
 */
router.get('/tasks', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const user = (req as any).user;
  
  // Filter tasks to only return those belonging to the authenticated user
  const tasks = getRecentTasks(limit * 5)
    .filter(t => !user || t.userId === user.id)
    .slice(0, limit);
  res.json({ tasks, count: tasks.length });
});

/**
 * Get specialist pricing
 */
router.get('/pricing', (req: Request, res: Response) => {
  const pricing = dispatcher.getSpecialistPricing();
  res.json({ 
    pricing,
    note: 'Fees in USDC, paid via x402 protocol on Base'
  });
});

export default router;
