/**
 * CSN Dispatcher Core
 * Routes prompts to specialists and orchestrates multi-agent workflows
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Task,
  TaskStatus,
  SpecialistType,
  DispatchRequest,
  DispatchResponse,
  SpecialistResult,
} from './types';
import { x402Fetch, getBalances, logTransaction, createPaymentRecord } from './x402';
import magos from './specialists/magos';
import aura from './specialists/aura';
import bankr from './specialists/bankr';

// In-memory task store (would use Redis/DB in production)
const tasks: Map<string, Task> = new Map();

// Event emitter for real-time updates
type TaskUpdateCallback = (task: Task) => void;
const subscribers: Map<string, TaskUpdateCallback[]> = new Map();

/**
 * Subscribe to task updates
 */
export function subscribeToTask(taskId: string, callback: TaskUpdateCallback): () => void {
  const existing = subscribers.get(taskId) || [];
  existing.push(callback);
  subscribers.set(taskId, existing);
  
  return () => {
    const callbacks = subscribers.get(taskId) || [];
    subscribers.set(taskId, callbacks.filter(cb => cb !== callback));
  };
}

/**
 * Emit task update to subscribers
 */
function emitTaskUpdate(task: Task): void {
  const callbacks = subscribers.get(task.id) || [];
  callbacks.forEach(cb => cb(task));
}

/**
 * Add a message to the task
 */
function addMessage(task: Task, from: string, to: string, content: string): void {
  task.messages.push({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    from,
    to,
    content,
    timestamp: new Date().toISOString(),
  });
  emitTaskUpdate(task);
}

/**
 * Main dispatch function
 */
export async function dispatch(request: DispatchRequest): Promise<DispatchResponse> {
  const taskId = uuidv4();
  const specialist = request.preferredSpecialist || routePrompt(request.prompt);
  
  // Create task
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
    metadata: { dryRun: request.dryRun },
    callbackUrl: request.callbackUrl,
  };
  
  tasks.set(taskId, task);
  console.log(`[Dispatcher] Created task ${taskId} for specialist: ${specialist}`);
  
  // Small delay to allow WebSocket subscription before execution
  setTimeout(() => {
    executeTask(task, request.dryRun || false).catch(err => {
      console.error(`[Dispatcher] Task ${taskId} failed:`, err);
      updateTaskStatus(task, 'failed', { error: err.message });
    });
  }, 100);
  
  return {
    taskId,
    status: task.status,
    specialist,
  };
}

/**
 * Execute a task
 */
async function executeTask(task: Task, dryRun: boolean): Promise<void> {
  // Demo delay for visual effect
  await new Promise(resolve => setTimeout(resolve, 500));
  
  updateTaskStatus(task, 'routing');
  addMessage(task, 'dispatcher', task.specialist, `Routing task: "${task.prompt.slice(0, 80)}..."`);
  
  // Check if payment is required for this specialist
  const requiresPayment = await checkPaymentRequired(task.specialist);
  
  if (requiresPayment && !dryRun) {
    updateTaskStatus(task, 'awaiting_payment');
    addMessage(task, 'dispatcher', task.specialist, 'Checking x402 payment...');
    
    // Check balance
    const balances = await getBalances();
    console.log(`[Dispatcher] Wallet balances:`, balances);
    
    // For now, proceed anyway (would gate on balance in production)
  }
  
  updateTaskStatus(task, 'processing');
  addMessage(task, 'dispatcher', task.specialist, `Processing with ${task.specialist}...`);
  
  // Demo delay before calling specialist
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Call the specialist
  const result = await callSpecialist(task.specialist, task.prompt);
  
  // Add specialist response message
  const responseContent = extractResponseContent(result);
  addMessage(task, task.specialist, 'dispatcher', responseContent);
  
  // Log any payments
  if (result.cost) {
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
  
  // Update task with result
  task.result = result;
  updateTaskStatus(task, result.success ? 'completed' : 'failed');
  
  // Call webhook if provided
  if (task.callbackUrl) {
    try {
      const axios = require('axios');
      await axios.post(task.callbackUrl, {
        taskId: task.id,
        status: task.status,
        specialist: task.specialist,
        result: formatResultForCallback(result),
        messages: task.messages,
      });
      console.log(`[Dispatcher] Callback sent to ${task.callbackUrl}`);
    } catch (err: any) {
      console.error(`[Dispatcher] Callback failed:`, err.message);
    }
  }
  
  console.log(`[Dispatcher] Task ${task.id} ${task.status} in ${result.executionTimeMs}ms`);
}

/**
 * Extract human-readable content from specialist result
 */
function extractResponseContent(result: SpecialistResult): string {
  const data = result.data;
  if (data?.insight) return data.insight;
  if (data?.summary) return data.summary;
  if (data?.reasoning) return data.reasoning;
  if (data?.details?.response) {
    return typeof data.details.response === 'string' 
      ? data.details.response 
      : JSON.stringify(data.details.response).slice(0, 200);
  }
  if (data?.type) {
    return `${data.type} ${data.status || 'completed'}${data.txSignature ? ` (tx: ${data.txSignature.slice(0, 16)}...)` : ''}`;
  }
  return result.success ? 'Task completed' : 'Task failed';
}

/**
 * Format result for callback webhook (human-readable)
 */
function formatResultForCallback(result: SpecialistResult): { summary: string; data: any } {
  const data = result.data;
  let summary = '';
  
  if (data?.type === 'balance' && data?.details?.summary) {
    summary = `💰 **Balance**\n${data.details.summary}`;
  } else if (data?.type === 'transfer' && data?.status === 'confirmed') {
    summary = `✅ **Transfer Confirmed**\nSent ${data.details?.amount} to ${data.details?.to?.slice(0, 8)}...`;
  } else if (data?.type === 'swap') {
    summary = `🔄 **Swap ${data.status}**\n${data.details?.amount} ${data.details?.from} → ${data.details?.to}`;
  } else if (data?.insight) {
    summary = `📊 **Analysis**\n${data.insight}`;
  } else if (data?.tokens && Array.isArray(data.tokens)) {
    summary = `🔥 **Trending Tokens**\n${data.tokens.slice(0, 3).map((t: any) => `• ${t.symbol || t.name}`).join('\n')}`;
  } else {
    summary = extractResponseContent(result);
  }
  
  return { summary, data };
}

/**
 * Update task status and emit event
 */
function updateTaskStatus(task: Task, status: TaskStatus, extra?: Record<string, any>): void {
  task.status = status;
  task.updatedAt = new Date();
  if (extra) {
    task.metadata = { ...task.metadata, ...extra };
  }
  tasks.set(task.id, task);
  emitTaskUpdate(task);
}

/**
 * Route prompt to appropriate specialist using keyword analysis
 */
export function routePrompt(prompt: string): SpecialistType {
  const lower = prompt.toLowerCase();
  
  // Define routing rules with weights
  const rules: Array<{ specialist: SpecialistType; patterns: RegExp[]; weight: number }> = [
    {
      specialist: 'magos',
      patterns: [
        /predict|forecast|price\s+target|will\s+\w+\s+(go|reach|hit)/,
        /risk|danger|safe|analysis|analyze|technical/,
        /support|resistance|trend|pattern|chart/,
      ],
      weight: 1,
    },
    {
      specialist: 'aura',
      patterns: [
        /sentiment|vibe|mood|feeling|social/,
        /trending|hot|popular|alpha|gem/,
        /influencer|kol|whale\s+watch|twitter|x\s+/,
        /fomo|fud|hype|buzz/,
      ],
      weight: 1,
    },
    {
      specialist: 'bankr',
      patterns: [
        /swap|trade|buy|sell|exchange/,
        /transfer|send|withdraw|deposit/,
        /balance|wallet|holdings|portfolio/,
        /dca|dollar\s+cost|recurring|auto-buy/,
        /solana|sol|token|transaction|tx/,
      ],
      weight: 1,
    },
  ];
  
  // Score each specialist
  const scores: Record<SpecialistType, number> = {
    magos: 0,
    aura: 0,
    bankr: 0,
    general: 0,
  };
  
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(lower)) {
        scores[rule.specialist] += rule.weight;
      }
    }
  }
  
  // Find highest scoring specialist
  let bestSpecialist: SpecialistType = 'general';
  let bestScore = 0;
  
  for (const [specialist, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestSpecialist = specialist as SpecialistType;
    }
  }
  
  console.log(`[Router] Scores:`, scores, `-> ${bestSpecialist}`);
  return bestSpecialist;
}

/**
 * Check if specialist requires x402 payment
 */
async function checkPaymentRequired(specialist: SpecialistType): Promise<boolean> {
  // In production, this would check a registry or the specialist's x402 requirements
  const paidSpecialists: SpecialistType[] = ['magos']; // Magos predictions may require payment
  return paidSpecialists.includes(specialist);
}

/**
 * Call the appropriate specialist
 */
async function callSpecialist(specialist: SpecialistType, prompt: string): Promise<SpecialistResult> {
  const startTime = Date.now();
  
  switch (specialist) {
    case 'magos':
      return magos.handle(prompt);
    
    case 'aura':
      return aura.handle(prompt);
    
    case 'bankr':
      return bankr.handle(prompt);
    
    case 'general':
    default:
      // General fallback - combine insights from multiple specialists
      const [magosResult, auraResult] = await Promise.all([
        magos.handle(prompt),
        aura.handle(prompt),
      ]);
      
      return {
        success: true,
        data: {
          magos: magosResult.data,
          aura: auraResult.data,
          combined: `Analysis complete. Magos confidence: ${magosResult.confidence?.toFixed(2)}, Aura confidence: ${auraResult.confidence?.toFixed(2)}`,
        },
        confidence: ((magosResult.confidence || 0) + (auraResult.confidence || 0)) / 2,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
  }
}

/**
 * Get task by ID
 */
export function getTask(taskId: string): Task | undefined {
  return tasks.get(taskId);
}

/**
 * Get all tasks for a user
 */
export function getTasksByUser(userId: string): Task[] {
  return Array.from(tasks.values()).filter(t => t.userId === userId);
}

/**
 * Get recent tasks
 */
export function getRecentTasks(limit: number = 10): Task[] {
  return Array.from(tasks.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export default {
  dispatch,
  getTask,
  getTasksByUser,
  getRecentTasks,
  subscribeToTask,
  routePrompt,
};
