/**
 * Hivemind Dispatcher Core
 * Routes prompts to specialists and orchestrates multi-agent workflows
 */

import { v4 as uuidv4 } from 'uuid';
import * as dns from 'dns';
import { promisify } from 'util';
import {
  Task,
  TaskStatus,
  SpecialistType,
  DispatchRequest,
  DispatchResponse,
  SpecialistResult,
  StepExecutor,
  DAGPlan,
} from './types';
import config from './config';
import { logTransaction, createPaymentRecord, getTreasuryBalance } from './payments';
import { recordSuccess, recordFailure, recordLatency, getReputationScore } from './reputation';
import { planDAG } from './llm-planner';
import { executeDAG, resolveVariables } from './dag-executor';
import { fallbackChain } from './fallback-chain';
import { circuitBreaker } from './circuit-breaker';
import { priceRouter } from './price-router';
import { processingIdempotencyStore } from './reliability/idempotency-store';
import { getNetworkConfig } from './utils/network-config';
import { normalizeClientNetworkMode, type ClientNetworkMode } from './utils/client-network';
import { upsertTask, getTask, getTasksByUser, getRecentTasks } from './task-store';
import { addMessage, emitTaskUpdate, subscribeToTask } from './task-events';
import {
  isComplexQuery,
  detectMultiHop,
  buildRoutingPlanFromDAG,
  buildRoutingPlanFromLegacyMultiHop,
  buildRoutingPlanFromSpecialist,
  resolveAgentFee,
  routePrompt,
  getSpecialistDisplayName,
  getSpecialistPreviewInfo,
  getSpecialistPricing,
  getSpecialists,
} from './routing';
import {
  callSpecialist,
  callSpecialistGated,
  extractResponseContent,
} from './specialist-gateway';

const lookup = promisify(dns.lookup);

export {
  callSpecialist,
  callSpecialistGated,
  extractResponseContent,
  getTask,
  getTasksByUser,
  getRecentTasks,
  getSpecialistPricing,
  getSpecialists,
  isComplexQuery,
  routePrompt,
  subscribeToTask,
};

function extractTokensFromResult(result: string): string[] {
  const tokens = result.match(/\b(SOL|BONK|WIF|PEPE|DOGE|SHIB|FOMO)\b/gi) || [];
  return [...new Set(tokens.map((token) => token.toUpperCase()))];
}

function resolveTaskNetworkMode(input?: unknown): ClientNetworkMode {
  return normalizeClientNetworkMode(input);
}

/**
 * Main dispatch function
 */
export async function dispatch(request: DispatchRequest): Promise<DispatchResponse> {
  const taskId = uuidv4();
  const networkMode = resolveTaskNetworkMode(request.networkMode);
  const network = getNetworkConfig(networkMode);

  const isSecurityAuditQuery = /\b(audit|security|vulnerabilit|exploit|scan|review)\b/i.test(request.prompt) &&
    (/0x[a-fA-F0-9]{40}/.test(request.prompt) || /\b(contract|function|mapping|pragma|solidity|modifier|require)\b/i.test(request.prompt));

  const isComplex = isSecurityAuditQuery ? false : isComplexQuery(request.prompt);

  let dagPlan: DAGPlan;
  let isMultiStep = false;

  if (isComplex) {
    dagPlan = await planDAG(request.prompt);
    isMultiStep = dagPlan.steps.length > 1;
  } else {
    dagPlan = {
      planId: `simple-${Date.now()}`,
      query: request.prompt,
      steps: [],
      totalEstimatedCost: 0,
      reasoning: isSecurityAuditQuery
        ? 'Security audit query - fast-path to audit specialist.'
        : 'Simple query detected, skipping LLM planning.',
    };
  }

  let bestSpecialist = request.preferredSpecialist || (isMultiStep ? 'multi-hop' as SpecialistType : await routePrompt(request.prompt, request.hiredAgents, networkMode));

  const legacyHops = (isMultiStep || isSecurityAuditQuery) ? null : detectMultiHop(request.prompt);
  if (legacyHops && !request.preferredSpecialist) {
    bestSpecialist = 'multi-hop';
  }

  const finalHops = isMultiStep ? dagPlan.steps.map((step) => step.specialist) : legacyHops;
  const isActuallyMultiStep = isMultiStep || !!legacyHops;
  const routingPlan = isMultiStep
    ? buildRoutingPlanFromDAG(dagPlan, networkMode, {
      selectedSpecialist: bestSpecialist,
      metadata: {
        routeNetwork: network.routeLabel,
        hiredAgents: request.hiredAgents,
      },
    })
    : legacyHops && legacyHops.length > 0
      ? buildRoutingPlanFromLegacyMultiHop(request.prompt, legacyHops, networkMode, {
        selectedSpecialist: bestSpecialist,
        metadata: {
          routeNetwork: network.routeLabel,
          hiredAgents: request.hiredAgents,
        },
      })
      : buildRoutingPlanFromSpecialist(request.prompt, bestSpecialist, networkMode, {
        metadata: {
          routeNetwork: network.routeLabel,
          hiredAgents: request.hiredAgents,
        },
      });

  let taskFallbackChain: string[] | undefined;
  if (!isMultiStep && bestSpecialist !== 'multi-hop') {
    const isFastPath = isSecurityAuditQuery ||
      /\b(price|value|worth|cost|how much)\b/i.test(request.prompt) ||
      /\b(sentiment|vibe|mood|social\s+analysis)\b/i.test(request.prompt);

    if (isFastPath) {
      taskFallbackChain = [bestSpecialist, 'scribe'];
    } else {
      try {
        const chain = await fallbackChain.buildFallbackChain(request.prompt, [], networkMode);
        taskFallbackChain = chain.map((candidate) => candidate.agentId);
        if (taskFallbackChain.length > 0 && taskFallbackChain[0] !== bestSpecialist && taskFallbackChain.includes(bestSpecialist)) {
          taskFallbackChain = [bestSpecialist, ...taskFallbackChain.filter((id) => id !== bestSpecialist)];
        } else if (!taskFallbackChain.includes(bestSpecialist)) {
          taskFallbackChain = [bestSpecialist, ...taskFallbackChain];
        }
      } catch (error) {
        console.error('[Dispatcher] Error building fallback chain:', error);
        taskFallbackChain = [bestSpecialist];
      }
    }
  }

  if (request.maxBudget !== undefined) {
    const budgetCheck = priceRouter.checkBudget(dagPlan, request.maxBudget);
    const singleStepFee = !isMultiStep ? resolveAgentFee(bestSpecialist, undefined, networkMode) : 0;
    const finalEstimatedCost = Math.max(budgetCheck.totalCost, singleStepFee);

    if (finalEstimatedCost > request.maxBudget) {
      console.log(`[Dispatcher] Rejecting request: Estimated cost (${finalEstimatedCost} USDC) exceeds budget (${request.maxBudget} USDC)`);
      return {
        taskId: '',
        status: 'failed',
        specialist: bestSpecialist,
        routingPlan,
        error: `Estimated cost (${finalEstimatedCost.toFixed(2)} USDC) exceeds your budget limit of ${request.maxBudget.toFixed(2)} USDC.`,
      };
    }
  }

  const isApproved = request.approvedAgent === bestSpecialist;
  const isInSwarm = !request.hiredAgents || request.hiredAgents.includes(bestSpecialist);
  const requiresApproval = !isInSwarm && !isApproved && bestSpecialist !== 'general' && bestSpecialist !== 'scribe' && bestSpecialist !== 'multi-hop';

  console.log('[Dispatcher] Routing decision (DAG):', {
    bestSpecialist,
    isMultiStep,
    isActuallyMultiStep,
    stepCount: dagPlan.steps.length,
    requiresApproval,
  });

  if (request.previewOnly || requiresApproval) {
    const pricing = getSpecialistPreviewInfo(bestSpecialist, networkMode);
    const reputationScore = getReputationScore(bestSpecialist);

    const displayName = isActuallyMultiStep && finalHops
      ? finalHops.map((hop) => getSpecialistDisplayName(hop as SpecialistType)).join(' -> ')
      : getSpecialistDisplayName(bestSpecialist);

    const approvalSpecialist = isActuallyMultiStep && finalHops
      ? finalHops[0] as SpecialistType
      : bestSpecialist;

    return {
      taskId: '',
      status: 'pending',
      specialist: approvalSpecialist,
      routingPlan,
      requiresApproval,
      specialistInfo: {
        name: displayName,
        description: isActuallyMultiStep
          ? `Multi-agent workflow: ${finalHops?.join(' -> ')}`
          : pricing.description,
        fee: isMultiStep ? String(dagPlan.totalEstimatedCost) : pricing.fee,
        feeCurrency: 'USDC',
        successRate: Math.round(reputationScore * 100),
      },
    };
  }

  const specialist = bestSpecialist;
  const task: Task = {
    id: taskId,
    prompt: request.prompt,
    userId: request.userId,
    status: 'pending',
    specialist,
    createdAt: new Date(),
    updatedAt: new Date(),
    payments: [],
    messages: [],
    metadata: {
      dryRun: request.dryRun,
      hops: finalHops || undefined,
      hiredAgents: request.hiredAgents,
      wasApproved: isApproved,
      intent: (bestSpecialist as any).intent || undefined,
      networkMode,
      routeNetwork: network.routeLabel,
    },
    dagPlan,
    routingPlan,
    fallbackChain: taskFallbackChain,
    callbackUrl: request.callbackUrl,
  };

  upsertTask(task);
  console.log(`[Dispatcher] Created task ${taskId} for specialist: ${specialist} (${isMultiStep ? 'DAG' : 'Single'})`);

  setTimeout(() => {
    executeTask(task, request.dryRun || false, request.paymentProof).catch((error) => {
      console.error(`[Dispatcher] Task ${taskId} failed:`, error);
      updateTaskStatus(task, 'failed', { error: error.message });
    });
  }, 100);

  return {
    taskId,
    status: task.status,
    specialist,
    routingPlan,
  };
}

/**
 * Execute a task
 */
export async function executeTask(task: Task, dryRun: boolean, paymentProof?: string): Promise<void> {
  const processingKey = `task:${task.id}:execute`;
  const processingFingerprint = `${task.id}:${task.updatedAt.toISOString()}`;
  const networkMode = resolveTaskNetworkMode(task.metadata?.networkMode);
  const network = getNetworkConfig(networkMode);
  const processingReservation = processingIdempotencyStore.reserve(processingKey, processingFingerprint, task.id);
  if (processingReservation.duplicate && processingReservation.record.status === 'in_progress') {
    console.log(`[Dispatcher] Skipping duplicate executeTask for ${task.id} (already in progress)`);
    return;
  }

  if (task.status === 'completed' || task.status === 'failed') {
    console.log(`[Dispatcher] Skipping executeTask for ${task.id} (terminal status: ${task.status})`);
    processingIdempotencyStore.complete(processingKey, { status: task.status }, task.id);
    return;
  }

  if (task.dagPlan && task.dagPlan.steps.length > 1) {
    updateTaskStatus(task, 'processing');
    addMessage(task, 'dispatcher', 'multi-hop', `Executing dynamic DAG plan: ${task.dagPlan.planId}`);

    const stepExecutor: StepExecutor = async (step, context) => {
      const resolvedPrompt = resolveVariables(step.promptTemplate, context);

      addMessage(task, 'dispatcher', step.specialist, `[Step ${step.id}] Routing to ${step.specialist}...`);

      const result = await callSpecialistGated(step.specialist, resolvedPrompt, task);
      const responseContent = extractResponseContent(result);
      addMessage(task, step.specialist, 'dispatcher', responseContent);

      const fee = step.estimatedCost || (config.fees as any)[step.specialist] || 0;
      if (fee > 0 && !dryRun && !paymentProof) {
        const feeRecord = createPaymentRecord(String(fee), 'USDC', network.routeLabel, step.specialist, undefined, 'pending');
        task.payments.push(feeRecord);
        logTransaction(feeRecord);
        addMessage(task, 'x402', 'dispatcher', `Fee: ${fee} USDC -> ${step.specialist}`);
      }

      return {
        stepId: step.id,
        specialist: step.specialist,
        output: result.data,
        summary: responseContent,
        success: result.success,
      };
    };

    try {
      const dagResult = await executeDAG(task.dagPlan, stepExecutor);
      const successfulSteps = Object.values(dagResult.results).filter((result) => result.success);
      const failedSteps = Object.values(dagResult.results).filter((result) => !result.success);
      const lastSuccessful = successfulSteps.length > 0
        ? successfulSteps[successfulSteps.length - 1]
        : null;
      const topLevelSummary = lastSuccessful?.summary ||
        successfulSteps.map((step) => step.summary).filter(Boolean).join('\n\n') ||
        'No results available.';

      task.result = {
        success: successfulSteps.length > 0,
        data: {
          isDAG: true,
          summary: topLevelSummary,
          planId: dagResult.planId,
          steps: Object.values(dagResult.results).map((result) => ({
            specialist: result.specialist,
            summary: result.summary,
            success: result.success,
          })),
          details: dagResult.results,
          ...(failedSteps.length > 0 ? {
            partialFailure: `${failedSteps.length}/${Object.keys(dagResult.results).length} steps failed`,
          } : {}),
        },
        timestamp: new Date(),
        executionTimeMs: dagResult.executionTimeMs,
        cost: {
          amount: String(dagResult.totalCost || task.dagPlan?.totalEstimatedCost || 0),
          currency: 'USDC',
          network: network.routeLabel,
          recipient: 'multi-agent-workflow',
        },
      };

      const status = dagResult.success ? 'completed' : (successfulSteps.length > 0 ? 'completed' : 'failed');
      updateTaskStatus(task, status);
      console.log(`[Dispatcher] DAG task ${task.id} ${status} (${successfulSteps.length}/${Object.keys(dagResult.results).length} steps OK)`);
      return;
    } catch (error: any) {
      console.error('[Dispatcher] DAG execution error:', error.message);
      updateTaskStatus(task, 'failed', { error: error.message });
      return;
    }
  }

  const hops = task.metadata?.hops as SpecialistType[] | undefined;

  if (hops && hops.length > 1) {
    updateTaskStatus(task, 'processing');
    addMessage(task, 'dispatcher', 'multi-hop', `Executing multi-hop workflow: ${hops.join(' -> ')}`);

    let currentContext = task.prompt;
    const multiResults: Array<{ specialist: SpecialistType; result: SpecialistResult }> = [];

    for (let index = 0; index < hops.length; index++) {
      const specialist = hops[index];
      const step = index + 1;

      updateTaskStatus(task, 'processing', {
        currentStep: step,
        totalSteps: hops.length,
        activeSpecialist: specialist,
      });
      addMessage(task, 'dispatcher', specialist, `[Step ${step}/${hops.length}] Routing to ${specialist}...`);

      const result = await callSpecialistGated(specialist, currentContext, task);
      multiResults.push({ specialist, result });

      const responseContent = extractResponseContent(result);
      addMessage(task, specialist, 'dispatcher', responseContent);

      const specialistFee = (config.fees as any)[specialist] || 0;
      if (specialistFee > 0 && !dryRun && !paymentProof) {
        const feeRecord = createPaymentRecord(String(specialistFee), 'USDC', network.routeLabel, specialist, undefined, 'pending');
        task.payments.push(feeRecord);
        logTransaction(feeRecord);
        addMessage(task, 'x402', 'dispatcher', `Fee: ${specialistFee} USDC -> ${specialist}`);
      }

      if (index < hops.length - 1) {
        const nextHop = hops[index + 1];
        if (nextHop === 'scribe') {
          currentContext = `Synthesize the following research results into a clear, concise summary for the user's original query: "${task.prompt}"\n\n${responseContent}`;
        } else if (specialist === 'aura' && result.success) {
          const tokens = extractTokensFromResult(responseContent);
          if (tokens.length > 0) {
            currentContext = `Buy 0.1 SOL of ${tokens[0]}`;
            addMessage(task, 'dispatcher', 'system', `Next step: ${currentContext}`);
          }
        } else if ((specialist === 'magos' || specialist === 'seeker') && result.success) {
          const tokens = extractTokensFromResult(responseContent);
          if (tokens.length > 0 && nextHop === 'bankr') {
            currentContext = `Buy 0.1 SOL of ${tokens[0]}`;
            addMessage(task, 'dispatcher', 'system', `Next step: ${currentContext}`);
          } else {
            currentContext = responseContent;
          }
        }
      }

      if (index < hops.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    const lastResult = multiResults[multiResults.length - 1].result;
    task.result = {
      ...lastResult,
      data: {
        ...lastResult.data,
        isMultiHop: true,
        hops,
        steps: multiResults.map((entry) => ({
          specialist: entry.specialist,
          summary: extractResponseContent(entry.result),
        })),
      },
    };

    updateTaskStatus(task, 'completed');
    console.log(`[Dispatcher] Multi-hop task ${task.id} completed`);
    return;
  }

  updateTaskStatus(task, 'routing');
  addMessage(task, 'dispatcher', task.specialist, `Routing task: "${task.prompt.slice(0, 80)}..."`);

  const requiresPayment = await checkPaymentRequired(task.specialist);

  if (requiresPayment && !dryRun && !paymentProof) {
    updateTaskStatus(task, 'awaiting_payment');
    addMessage(task, 'dispatcher', task.specialist, 'Checking x402 payment...');

    const balances = await getTreasuryBalance(networkMode);
    console.log('[Dispatcher] Treasury balance:', balances);

    const fee = resolveAgentFee(task.specialist, undefined, networkMode);
    const usdcBalance = balances.usdc;

    if (config.enforcePayments && usdcBalance < fee) {
      const errorMsg = `Insufficient balance: ${usdcBalance} USDC < ${fee} USDC required for ${task.specialist}`;
      addMessage(task, 'x402', 'dispatcher', `ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  updateTaskStatus(task, 'processing');

  const fee = resolveAgentFee(task.specialist, undefined, networkMode);
  addMessage(task, 'dispatcher', task.specialist, `Processing with ${task.specialist}... (fee: ${fee} USDC)`);

  let result: SpecialistResult;

  if (task.fallbackChain && task.fallbackChain.length > 1) {
    const chain = task.fallbackChain.map((id) => ({ agentId: id, score: 1, confidence: 1, reasoning: 'Fallback' }));
    result = await fallbackChain.executeWithFallback(
      chain,
      task.prompt,
      async (agentId, prompt) => {
        if (agentId !== task.specialist) {
          addMessage(task, 'dispatcher', agentId, `Switching to fallback agent: ${agentId}`);
          updateTaskStatus(task, 'processing', { activeSpecialist: agentId });
        }
        return callSpecialistGated(agentId, prompt);
      },
      { maxRetries: task.fallbackChain.length - 1, timeoutMs: 30000 }
    );

    if (result.success && (result.data as any).agentId) {
      task.specialist = (result.data as any).agentId as SpecialistType;
    }
  } else {
    if (!circuitBreaker.canCall(task.specialist)) {
      result = {
        success: false,
        data: { error: `Circuit breaker is OPEN for ${task.specialist}` },
        timestamp: new Date(),
        executionTimeMs: 0,
      };
    } else {
      circuitBreaker.recordCall(task.specialist);
      result = await callSpecialistGated(task.specialist, task.prompt, task);

      if (result.data?.requiresApproval) {
        console.log(`[Dispatcher] Task ${task.id} requires transaction approval`);
        updateTaskStatus(task, 'pending', {
          requiresTransactionApproval: true,
          transactionDetails: result.data.details,
        });
        return;
      }

      if (result.success) {
        circuitBreaker.recordSuccess(task.specialist);
      } else {
        circuitBreaker.recordFailure(task.specialist);
      }
    }
  }

  const responseContent = extractResponseContent(result);
  addMessage(task, task.specialist, 'dispatcher', responseContent);

  if (fee > 0 && !dryRun && !paymentProof) {
    addMessage(task, 'x402', 'dispatcher', `Processing ${fee} USDC payment via x402...`);

    const feeRecord = createPaymentRecord(String(fee), 'USDC', network.routeLabel, task.specialist, undefined, 'pending');
    task.payments.push(feeRecord);
    logTransaction(feeRecord);
    addMessage(task, 'x402', 'dispatcher', `Fee: ${fee} USDC -> ${task.specialist}`);
  }

  if (result.cost && fee === 0) {
    const record = createPaymentRecord(
      result.cost.amount,
      result.cost.currency,
      result.cost.network,
      result.cost.recipient
    );
    task.payments.push(record);
    logTransaction(record);
    addMessage(task, 'x402', 'dispatcher', `Payment: ${result.cost.amount} ${result.cost.currency}`);
  }

  task.result = result;
  updateTaskStatus(task, result.success ? 'completed' : 'failed');

  const capabilityId = task.metadata?.intent?.category || 'generic';
  recordLatency(task.specialist, capabilityId, result.executionTimeMs);

  if (result.success) {
    recordSuccess(task.specialist, capabilityId);
  } else {
    recordFailure(task.specialist, capabilityId);
  }

  if (task.callbackUrl) {
    const isValid = await validateCallbackUrl(task.callbackUrl);
    if (!isValid) {
      console.error(`[Dispatcher] Blocked potentially malicious callbackUrl: ${task.callbackUrl}`);
      addMessage(task, 'system', 'dispatcher', 'Security: Blocked invalid callbackUrl (SSRF protection)');
    } else {
      try {
        const axios = require('axios');
        const callbackStillValid = await validateCallbackUrl(task.callbackUrl);
        if (callbackStillValid) {
          await axios.post(task.callbackUrl, {
            taskId: task.id,
            status: task.status,
            specialist: task.specialist,
            result: formatResultForCallback(result),
            messages: task.messages,
          }, { timeout: 5000 });
          console.log(`[Dispatcher] Callback sent to ${task.callbackUrl}`);
        }
      } catch (error: any) {
        console.error('[Dispatcher] Callback failed:', error.message);
      }
    }
  }

  console.log(`[Dispatcher] Task ${task.id} ${task.status} in ${result.executionTimeMs}ms`);
}

/**
 * Validates a callback URL to prevent SSRF attacks.
 * Blocks localhost, private IP ranges, and cloud metadata services.
 * Resolves hostnames to IPs to prevent DNS rebinding.
 */
async function validateCallbackUrl(urlStr: string): Promise<boolean> {
  try {
    const url = new URL(urlStr);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    let ip = hostname;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && !hostname.includes(':')) {
      try {
        const result = await lookup(hostname);
        ip = result.address;
      } catch {
        return false;
      }
    }

    if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') {
      return false;
    }

    if (/^10\./.test(ip)) return false;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return false;
    if (/^192\.168\./.test(ip)) return false;
    if (/^169\.254\./.test(ip)) return false;

    return true;
  } catch {
    return false;
  }
}

function formatResultForCallback(result: SpecialistResult): { summary: string; data: any } {
  const data = result.data;
  let summary = '';

  if (data?.type === 'balance' && data?.details?.summary) {
    summary = `**Balance**\n${data.details.summary}`;
  } else if (data?.type === 'transfer' && data?.status === 'confirmed') {
    summary = `**Transfer Confirmed**\nSent ${data.details?.amount} to ${data.details?.to?.slice(0, 8)}...`;
  } else if (data?.type === 'swap') {
    summary = `**Swap ${data.status}**\n${data.details?.amount} ${data.details?.from} -> ${data.details?.to}`;
  } else if (data?.insight) {
    summary = `**Analysis**\n${data.insight}`;
  } else if (data?.tokens && Array.isArray(data.tokens)) {
    summary = `**Trending Tokens**\n${data.tokens.slice(0, 3).map((token: any) => `- ${token.symbol || token.name}`).join('\n')}`;
  } else {
    summary = extractResponseContent(result);
  }

  return { summary, data };
}

/**
 * Update task status and emit event
 */
export function updateTaskStatus(task: Task, status: TaskStatus, extra?: Record<string, any>): void {
  task.status = status;
  task.updatedAt = new Date();
  if (extra) {
    task.metadata = { ...task.metadata, ...extra };
  }

  upsertTask(task);

  if (status === 'completed' || status === 'failed') {
    processingIdempotencyStore.complete(`task:${task.id}:execute`, { status, updatedAt: task.updatedAt.toISOString() }, task.id);
  }

  emitTaskUpdate(task);
}

async function checkPaymentRequired(specialist: SpecialistType): Promise<boolean> {
  const fee = (config.fees as any)[specialist] || 0;
  return fee > 0;
}

export default {
  dispatch,
  executeTask,
  updateTaskStatus,
  getTask,
  getTasksByUser,
  getRecentTasks,
  getSpecialistPricing,
  getSpecialists,
  subscribeToTask,
  routePrompt,
  isComplexQuery,
  callSpecialist,
  callSpecialistGated,
  extractResponseContent,
};
