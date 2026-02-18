import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import dispatcher, { dispatch, getTask, getRecentTasks, executeTask, updateTaskStatus, routePrompt, isComplexQuery } from '../dispatcher';
import { DispatchRequest, SpecialistType } from '../types';
import config from '../config';
import { planDAG } from '../llm-planner';
import { validateAndConsumePaymentProof } from '../payments';
import { getExternalAgent } from '../external-agents';
import { parseEnvelopeV1 } from '../hivemind/envelope';
import { applyLedgerTransitionV1, createLedgerStateV1, LedgerTransitionPayload } from '../hivemind/ledger';
import { dispatchIdempotencyStore } from '../reliability/idempotency-store';
import { evaluateDispatchRollout } from '../reliability/rollout-guard';
import { recordDispatchSlo } from '../reliability/slo';
import { dispatchGuardMiddleware } from '../middleware/dispatch-guard';
import {
  getReliabilityAuditView,
  getReliabilityDlqView,
  getReliabilityReplayWorkerView,
  getReliabilitySloView,
  requestReliabilityDlqReplay,
} from '../reliability/orchestrator';
import { isExecutionSupportedForMode, normalizeClientNetworkMode, toRouteNetworkLabel } from '../utils/client-network';
import { getReliabilityConfig } from '../reliability/config';
import {
  auditReliabilityOpsAction,
  reliabilityOpsRateLimitMiddleware,
  requireReliabilityOpsAccess,
} from '../reliability/ops-safety';

const router = Router();

router.use(['/dispatch', '/query', '/transactions/approve', '/transactions/reject'], dispatchGuardMiddleware);

function computeDispatchFingerprint(input: Record<string, any>): string {
  const normalized = JSON.stringify({
    prompt: String(input.prompt || '').trim(),
    userId: input.userId || 'anonymous',
    preferredSpecialist: input.preferredSpecialist || null,
    dryRun: Boolean(input.dryRun),
    hiredAgents: Array.isArray(input.hiredAgents) ? [...input.hiredAgents].sort() : [],
    approvedAgent: input.approvedAgent || null,
    previewOnly: Boolean(input.previewOnly),
    networkMode: input.networkMode || 'testnet',
  });
  return createHash('sha256').update(normalized).digest('hex');
}

function resolveIdempotencyKey(req: Request, fallbackFingerprint: string): string {
  const headerKey = req.header('x-idempotency-key');
  const envelopeMessageId = req.body?.hivemindEnvelope?.messageId;
  return String(headerKey || envelopeMessageId || `dispatch:${fallbackFingerprint}`);
}

/**
 * Route preview — returns specialist + fee without executing.
 * Uses fast-path routing first, falls back to DAG planning for complex queries.
 */
router.post('/route-preview', async (req: Request, res: Response) => {
  try {
    const { prompt, hiredAgents, networkMode } = req.body;
    const mode = normalizeClientNetworkMode(networkMode);
    const routeNetwork = toRouteNetworkLabel(mode);
    const executionSupported = isExecutionSupportedForMode(mode);
    if (!prompt || (typeof prompt === 'string' && prompt.trim().length === 0)) {
      return res.status(400).json({ error: 'prompt required' });
    }
    
    // Fast-path: check complexity first
    const isComplex = isComplexQuery(prompt);
    
    if (isComplex) {
      // Complex query — use DAG planning for accurate multi-step cost
      const dagPlan = await planDAG(prompt);
      
      if (dagPlan.steps.length > 1) {
        const totalFee = dagPlan.totalEstimatedCost || dagPlan.steps.reduce((sum, s) => sum + (s.estimatedCost || 0), 0);
        const specialists = dagPlan.steps.map(s => s.specialist);
        return res.json({ 
          specialist: specialists.join(' → '), 
          specialists,
          fee: totalFee, 
          currency: 'USDC', 
          network: routeNetwork,
          networkMode: mode,
          executionSupported,
          isMultiStep: true,
          steps: dagPlan.steps.length,
          showEstimate: true // Complex plan usually has a reasonably accurate estimate sum
        });
      }
    }
    
    // Simple query — use routing with swarm context
    const specialist = await routePrompt(prompt, hiredAgents);
    
    // Determine fee and estimation confidence
    let fee = 0;
    let showEstimate = false;

    // Check internal pricing first
    if ((config.fees as any)[specialist]) {
      fee = Number((config.fees as any)[specialist]);
      showEstimate = true; // Internal agents have fixed pricing
    } else {
      // Check external agent registry
      const externalAgent = getExternalAgent(specialist);
      if (externalAgent) {
        // Use generic pricing or fallback to 0.10
        fee = externalAgent.pricing?.generic || 0.10;
        showEstimate = true;
      } else {
        // Fallback for unknown agents (shouldn't happen often if routed correctly)
        fee = 0.10;
        showEstimate = false; // Unsure about this agent
      }
    }

    res.json({ specialist, fee, currency: 'USDC', network: routeNetwork, networkMode: mode, executionSupported, showEstimate });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Submit a task to the dispatcher
 * POST /dispatch or /query
 */
const dispatchHandler = async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const { prompt, userId, preferredSpecialist, dryRun, callbackUrl, hiredAgents, approvedAgent, previewOnly, networkMode } = req.body as DispatchRequest;
    const mode = normalizeClientNetworkMode(networkMode);

    if (!isExecutionSupportedForMode(mode)) {
      return res.status(409).json({
        error: 'Mainnet execution is disabled by release guard',
        networkMode: mode,
        hint: 'Use testnet mode or set ENABLE_MAINNET_DISPATCH=true after rollout verification.',
      });
    }

    if (!prompt || (typeof prompt === 'string' && prompt.trim().length === 0)) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Cap prompt length to prevent abuse (10k chars max)
    if (typeof prompt === 'string' && prompt.length > 10000) {
      return res.status(400).json({ error: 'Prompt too long (max 10,000 characters)' });
    }

    // Optional lightweight Hivemind envelope+ledger validation path for Sprint 1 rollout.
    // No-op unless caller explicitly requests validation.
    if (req.body?.validateHivemindEnvelope === true && req.body?.hivemindEnvelope) {
      try {
        const envelope = parseEnvelopeV1<LedgerTransitionPayload>(req.body.hivemindEnvelope);
        if (envelope.type === 'ledger.transition') {
          applyLedgerTransitionV1(createLedgerStateV1(), envelope);
        }
      } catch (e: any) {
        return res.status(400).json({
          error: 'Invalid hivemindEnvelope',
          detail: e?.message || 'Envelope validation failed',
        });
      }
    }

    const effectiveUserId = userId || (req as any).user?.id || 'anonymous';

    const rolloutDecision = evaluateDispatchRollout(String(effectiveUserId));
    if (!rolloutDecision.allowed) {
      return res.status(503).json({
        error: 'Dispatch temporarily unavailable during controlled rollout',
        reason: rolloutDecision.reason,
      });
    }

    const fingerprint = computeDispatchFingerprint({
      prompt,
      userId: effectiveUserId,
      preferredSpecialist,
      dryRun,
      hiredAgents,
      approvedAgent,
      previewOnly,
      networkMode: mode,
    });
    const idempotencyKey = resolveIdempotencyKey(req, fingerprint);

    const idempotencyEnabled = getReliabilityConfig().featureFlags.enableIdempotency;
    if (idempotencyEnabled) {
      const reservation = dispatchIdempotencyStore.reserve(idempotencyKey, fingerprint);
      if (reservation.duplicate) {
        const existing = reservation.record;
        if (existing.response) {
          return res.status(202).json(existing.response);
        }
        return res.status(202).json({
          taskId: existing.taskId || '',
          status: existing.status === 'failed' ? 'failed' : 'pending',
          specialist: req.body?.preferredSpecialist || 'general',
          idempotentReplay: true,
        });
      }
    }

    const paymentProof = req.headers['x-payment-proof'] as string | undefined;
    
    // Validate payment proof format (must be a valid tx hash if provided)
    if (paymentProof && !/^0x[a-fA-F0-9]{64}$/.test(paymentProof)) {
      return res.status(400).json({ error: 'Invalid payment proof format (expected 0x-prefixed tx hash)' });
    }

    // Prevent payment replay — each tx hash can only be used once
    if (paymentProof && !validateAndConsumePaymentProof(paymentProof)) {
      return res.status(409).json({ error: 'Payment proof already used (replay detected)' });
    }
    
    const result = await dispatch({
      prompt,
      userId: effectiveUserId,
      preferredSpecialist,
      dryRun,
      callbackUrl,
      hiredAgents,
      approvedAgent,
      previewOnly,
      paymentProof,  // Skip internal payment if user already paid via delegation
      networkMode: mode,
    });

    if (idempotencyEnabled) {
      dispatchIdempotencyStore.complete(idempotencyKey, result, result.taskId);
    }

    recordDispatchSlo('success', Date.now() - startedAt);
    res.status(202).json(result);
  } catch (error: any) {
    recordDispatchSlo('failure', Date.now() - startedAt);
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

    const actorId = (req as any).user?.id;
    if (actorId && actorId !== 'demo-user' && task.userId !== actorId) {
      return res.status(403).json({ error: 'Access denied: cannot approve another user task' });
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

    const actorId = (req as any).user?.id;
    if (actorId && actorId !== 'demo-user' && task.userId !== actorId) {
      return res.status(403).json({ error: 'Access denied: cannot reject another user task' });
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

/**
 * Operator reliability surface (authenticated)
 */
router.use('/ops/reliability', reliabilityOpsRateLimitMiddleware);

router.get('/ops/reliability/slo', (req: Request, res: Response, next) =>
  requireReliabilityOpsAccess(req, res, next, 'read'), (req: Request, res: Response) => {
    auditReliabilityOpsAction(req, { action: 'slo_read', statusCode: 200, outcome: 'allowed' });
    res.json(getReliabilitySloView());
  }
);

router.get('/ops/reliability/dlq', (req: Request, res: Response, next) =>
  requireReliabilityOpsAccess(req, res, next, 'read'), (req: Request, res: Response) => {
    const limit = parseInt(String(req.query.limit || '50'), 10) || 50;
    auditReliabilityOpsAction(req, { action: 'dlq_read', statusCode: 200, outcome: 'allowed' });
    res.json(getReliabilityDlqView(limit));
  }
);

router.post('/ops/reliability/dlq/replay', (req: Request, res: Response, next) =>
  requireReliabilityOpsAccess(req, res, next, 'write'), (req: Request, res: Response) => {
    const id = String(req.body?.id || '');
    if (!id) {
      auditReliabilityOpsAction(req, {
        action: 'dlq_replay_request',
        statusCode: 400,
        outcome: 'error',
        detail: 'id required',
      });
      return res.status(400).json({ error: 'id required' });
    }

    const replay = requestReliabilityDlqReplay(id, Boolean(req.body?.dryRun));
    if (!replay) {
      auditReliabilityOpsAction(req, {
        action: 'dlq_replay_request',
        statusCode: 404,
        outcome: 'error',
        detail: `missing record: ${id}`,
      });
      return res.status(404).json({ error: 'DLQ record not found' });
    }

    auditReliabilityOpsAction(req, {
      action: 'dlq_replay_request',
      statusCode: 200,
      outcome: 'allowed',
      detail: `dryRun=${replay.dryRun}; id=${id}`,
    });

    res.json({
      success: true,
      replay,
      note: replay.dryRun
        ? 'Dry-run only. No state mutation was performed.'
        : 'Replay requested. Worker will process request with configured guardrails and observability metrics.',
    });
  }
);

router.get('/ops/reliability/dlq/replay-worker', (req: Request, res: Response, next) =>
  requireReliabilityOpsAccess(req, res, next, 'read'), (req: Request, res: Response) => {
    auditReliabilityOpsAction(req, { action: 'dlq_replay_worker_read', statusCode: 200, outcome: 'allowed' });
    res.json(getReliabilityReplayWorkerView());
  }
);

router.get('/ops/reliability/audit', (req: Request, res: Response, next) =>
  requireReliabilityOpsAccess(req, res, next, 'read'), (req: Request, res: Response) => {
    const limit = parseInt(String(req.query.limit || '50'), 10) || 50;
    res.json(getReliabilityAuditView(limit));
  }
);

export default router;
