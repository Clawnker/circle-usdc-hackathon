/**
 * CSN Dispatcher Core
 * Routes prompts to specialists and orchestrates multi-agent workflows
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
  Task,
  TaskStatus,
  SpecialistType,
  DispatchRequest,
  DispatchResponse,
  SpecialistResult,
} from './types';
import config from './config';
import { x402Fetch, getBalances, logTransaction, createPaymentRecord, executePayment } from './x402';
import { recordSuccess, recordFailure, getSuccessRate } from './reputation';
import magos from './specialists/magos';
import aura from './specialists/aura';
import bankr from './specialists/bankr';
import scribe from './specialists/scribe';
import seeker from './specialists/seeker';

// Persistence settings
const DATA_DIR = path.join(__dirname, '../data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

// In-memory task store
const tasks: Map<string, Task> = new Map();

/**
 * Load tasks from disk
 */
function loadTasks(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    if (fs.existsSync(TASKS_FILE)) {
      const data = fs.readFileSync(TASKS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      
      // Convert dates back to Date objects
      Object.values(parsed).forEach((task: any) => {
        task.createdAt = new Date(task.createdAt);
        task.updatedAt = new Date(task.updatedAt);
        if (task.result?.timestamp) {
          task.result.timestamp = new Date(task.result.timestamp);
        }
        task.payments?.forEach((p: any) => {
          p.timestamp = new Date(p.timestamp);
        });
        tasks.set(task.id, task);
      });
      
      console.log(`[Dispatcher] Loaded ${tasks.size} tasks from persistence`);
    }
  } catch (error: any) {
    console.error(`[Dispatcher] Failed to load tasks:`, error.message);
  }
}

/**
 * Save tasks to disk
 */
function saveTasks(): void {
  try {
    const data = JSON.stringify(Object.fromEntries(tasks), null, 2);
    fs.writeFileSync(TASKS_FILE, data, 'utf8');
  } catch (error: any) {
    console.error(`[Dispatcher] Failed to save tasks:`, error.message);
  }
}

// Initial load
loadTasks();

// Specialist pricing (x402 fees in USDC)
const SPECIALIST_PRICING: Record<SpecialistType, { fee: string; description: string }> = {
  magos: { fee: '0.001', description: 'Market analysis & predictions' },
  aura: { fee: '0.0005', description: 'Social sentiment analysis' },
  bankr: { fee: '0.0001', description: 'Wallet operations' },
  scribe: { fee: '0.0001', description: 'General assistant & fallback' },
  seeker: { fee: '0.0001', description: 'Web research & search' },
  general: { fee: '0', description: 'General queries' },
  'multi-hop': { fee: '0', description: 'Orchestrated multi-agent workflow' },
};

/**
 * Detect multi-hop patterns
 */
function detectMultiHop(prompt: string): SpecialistType[] | null {
  const lower = prompt.toLowerCase();
  
  // Pattern: "buy" + "trending" = aura → bankr
  if (lower.includes('buy') && (lower.includes('trending') || lower.includes('popular') || lower.includes('hot'))) {
    return ['aura', 'bankr'];
  }
  
  // Pattern: "analyze" + "buy" = magos → bankr  
  if ((lower.includes('analyze') || lower.includes('research')) && lower.includes('buy')) {
    return ['magos', 'bankr'];
  }
  
  return null; // Single-hop
}

/**
 * Helper to extract tokens from Aura's result
 */
function extractTokensFromResult(result: string): string[] {
  // Parse Aura's trending response
  // Look for token symbols like SOL, BONK, WIF
  const tokens = result.match(/\b(SOL|BONK|WIF|PEPE|DOGE|SHIB|FOMO)\b/gi) || [];
  return [...new Set(tokens.map(t => t.toUpperCase()))];
}

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
  const hops = detectMultiHop(request.prompt);
  const specialist = request.preferredSpecialist || (hops ? 'multi-hop' : routePrompt(request.prompt));
  
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
    metadata: { 
      dryRun: request.dryRun,
      hops: hops || undefined 
    },
    callbackUrl: request.callbackUrl,
  };
  
  tasks.set(taskId, task);
  saveTasks();
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
  
  const hops = task.metadata?.hops as SpecialistType[] | undefined;
  
  if (hops && hops.length > 1) {
    updateTaskStatus(task, 'processing');
    addMessage(task, 'dispatcher', 'multi-hop', `Executing multi-hop workflow: ${hops.join(' → ')}`);
    
    let currentContext = task.prompt;
    const multiResults: any[] = [];
    
    for (let i = 0; i < hops.length; i++) {
      const specialist = hops[i];
      const step = i + 1;
      
      updateTaskStatus(task, 'processing', { currentStep: step, totalSteps: hops.length });
      addMessage(task, 'dispatcher', specialist, `[Step ${step}/${hops.length}] Routing to ${specialist}...`);
      
      // Call the specialist
      const result = await callSpecialist(specialist, currentContext);
      multiResults.push({ specialist, result });
      
      // Add specialist response message
      const responseContent = extractResponseContent(result);
      addMessage(task, specialist, 'dispatcher', responseContent);
      
      // Execute x402 payment for this hop
      const pricing = SPECIALIST_PRICING[specialist];
      const specialistFee = parseFloat(pricing.fee);
      if (specialistFee > 0 && !dryRun) {
        const recipient = config.specialistWallets[specialist] || specialist;
        const paymentResult = await executePayment(
          config.agentWallet.solanaAddress,
          recipient,
          specialistFee
        );

        if (paymentResult.success && paymentResult.txSignature) {
          const feeRecord = createPaymentRecord(
            pricing.fee,
            'USDC',
            'solana',
            recipient,
            paymentResult.txSignature
          );
          task.payments.push(feeRecord);
          addMessage(task, 'x402', 'dispatcher', `💰 x402 Fee: ${pricing.fee} USDC → ${specialist}`);
        } else {
          const feeRecord = createPaymentRecord(pricing.fee, 'USDC', 'solana', specialist);
          task.payments.push(feeRecord);
          logTransaction(feeRecord);
          addMessage(task, 'x402', 'dispatcher', `💰 x402 Fee (Mock): ${pricing.fee} USDC → ${specialist}`);
        }
      }
      
      // Update context for next hop
      if (specialist === 'aura' && result.success) {
        const tokens = extractTokensFromResult(responseContent);
        if (tokens.length > 0) {
          currentContext = `Buy 0.1 SOL of ${tokens[0]}`;
          addMessage(task, 'dispatcher', 'system', `Next step: ${currentContext}`);
        }
      } else if ((specialist === 'magos' || specialist === 'seeker') && result.success) {
        const tokens = extractTokensFromResult(responseContent);
        if (tokens.length > 0) {
          currentContext = `Buy 0.1 SOL of ${tokens[0]}`;
          addMessage(task, 'dispatcher', 'system', `Next step: ${currentContext}`);
        }
      }
      
      // Delay between hops
      if (i < hops.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
    
    // Final result aggregation
    const lastResult = multiResults[multiResults.length - 1].result;
    task.result = {
      ...lastResult,
      data: {
        ...lastResult.data,
        isMultiHop: true,
        hops: hops,
        steps: multiResults.map(r => ({
          specialist: r.specialist,
          summary: extractResponseContent(r.result)
        }))
      }
    };
    
    updateTaskStatus(task, 'completed');
    console.log(`[Dispatcher] Multi-hop task ${task.id} completed`);
    return;
  }

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
    
    // Enforce payment if config flag is set
    const pricing = SPECIALIST_PRICING[task.specialist];
    const fee = parseFloat(pricing.fee);
    const usdcBalance = balances.solana.usdc; // Magos is on Solana

    if (config.enforcePayments && usdcBalance < fee) {
      const errorMsg = `Insufficient balance: ${usdcBalance} USDC < ${fee} USDC required for ${task.specialist}`;
      addMessage(task, 'x402', 'dispatcher', `❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
  
  updateTaskStatus(task, 'processing');
  
  // Get specialist fee
  const pricing = SPECIALIST_PRICING[task.specialist];
  addMessage(task, 'dispatcher', task.specialist, `Processing with ${task.specialist}... (fee: ${pricing.fee} USDC)`);
  
  // Demo delay before calling specialist
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Call the specialist
  const result = await callSpecialist(task.specialist, task.prompt);
  
  // Add specialist response message
  const responseContent = extractResponseContent(result);
  addMessage(task, task.specialist, 'dispatcher', responseContent);
  
  // Execute real x402 payment
  const specialistFee = parseFloat(pricing.fee);
  if (specialistFee > 0 && !dryRun) {
    const recipient = config.specialistWallets[task.specialist] || task.specialist;
    const paymentResult = await executePayment(
      config.agentWallet.solanaAddress,
      recipient,
      specialistFee
    );

    if (paymentResult.success && paymentResult.txSignature) {
      const feeRecord = createPaymentRecord(
        pricing.fee,
        'USDC',
        'solana',
        recipient,
        paymentResult.txSignature
      );
      task.payments.push(feeRecord);
      addMessage(task, 'x402', 'dispatcher', `💰 x402 Fee: ${pricing.fee} USDC → ${task.specialist}`);
    } else {
      console.warn(`[Dispatcher] Payment failed for ${task.specialist}, logging mock record`);
      const feeRecord = createPaymentRecord(
        pricing.fee,
        'USDC',
        'solana',
        task.specialist
      );
      task.payments.push(feeRecord);
      logTransaction(feeRecord);
      addMessage(task, 'x402', 'dispatcher', `💰 x402 Fee (Mock): ${pricing.fee} USDC → ${task.specialist}`);
    }
  }
  
  // Log any additional payments from the specialist result
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
  
  // Record reputation
  if (result.success) {
    recordSuccess(task.specialist);
  } else {
    recordFailure(task.specialist);
  }
  
  // Call webhook if provided
  if (task.callbackUrl) {
    if (!validateCallbackUrl(task.callbackUrl)) {
      console.error(`[Dispatcher] Blocked potentially malicious callbackUrl: ${task.callbackUrl}`);
      addMessage(task, 'system', 'dispatcher', `Security: Blocked invalid callbackUrl (SSRF protection)`);
    } else {
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
  }
  
  console.log(`[Dispatcher] Task ${task.id} ${task.status} in ${result.executionTimeMs}ms`);
}

/**
 * Validates a callback URL to prevent SSRF attacks.
 * Blocks localhost, private IP ranges, and cloud metadata services.
 */
function validateCallbackUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    
    // Only allow http:// and https:// schemes
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    
    // Block localhost, 127.0.0.1, ::1
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }

    // Block private IP ranges
    // 10.x.x.x
    if (hostname.startsWith('10.')) return false;
    // 192.168.x.x
    if (hostname.startsWith('192.168.')) return false;
    // 169.254.x.x (Cloud metadata)
    if (hostname.startsWith('169.254.')) return false;

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Extract human-readable content from specialist result
 */
function extractResponseContent(result: SpecialistResult): string {
  const data = result.data;
  if (data?.combined) return data.combined;
  if (data?.insight) return data.insight;
  if (data?.summary) return data.summary;
  if (data?.reasoning) return data.reasoning;
  if (data?.details?.summary) return data.details.summary;
  if (data?.details?.response) {
    return typeof data.details.response === 'string' 
      ? data.details.response 
      : JSON.stringify(data.details.response).slice(0, 200);
  }
  
  // Specialist specific fallbacks
  if (data?.trending && Array.isArray(data.trending)) {
    return `🔥 **Trending Topics**:\n${data.trending.slice(0, 3).map((t: any) => `• ${t.topic || t.name}`).join('\n')}`;
  }
  
  if (data?.type) {
    return `${data.type} ${data.status || 'completed'}${data.txSignature ? ` (tx: ${data.txSignature.slice(0, 16)}...)` : ''}`;
  }
  return result.success 
    ? "I'm not sure how to help with that. Try asking about wallet balances, market analysis, or social sentiment." 
    : 'Task failed';
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
  saveTasks();
  emitTaskUpdate(task);
}

/**
 * Route prompt to appropriate specialist using keyword analysis
 */
export function routePrompt(prompt: string): SpecialistType {
  const lower = prompt.toLowerCase();
  
  // Specific intent detection for common mis-routings
  if (lower.includes('good buy') || lower.includes('should i') || lower.includes('recommend') || /is \w+ a good/.test(lower)) {
    return 'magos';
  }
  
  if (lower.includes('talking about') || lower.includes('mentions') || lower.includes('discussing')) {
    return 'aura';
  }

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
        /solana|sol|transaction|tx/,
      ],
      weight: 1,
    },
    {
      specialist: 'seeker',
      patterns: [
        /search|find|lookup|what is|who is|where is|news about|latest on/,
        /research|google|brave|internet|web|look up/,
      ],
      weight: 1.2,
    },
    {
      specialist: 'scribe',
      patterns: [
        /summarize|explain|write|draft|document/,
        /help|question|how to|what can you/,
      ],
      weight: 0.5,
    },
  ];
  
  // Score each specialist
  const scores: Record<SpecialistType, number> = {
    magos: 0,
    aura: 0,
    bankr: 0,
    scribe: 0,
    seeker: 0,
    general: 0,
    'multi-hop': 0,
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
  // Specialists with non-zero fees require payment
  const pricing = SPECIALIST_PRICING[specialist];
  return pricing && parseFloat(pricing.fee) > 0;
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
    
    case 'scribe':
      return scribe.handle(prompt);
    
    case 'seeker':
      return seeker.handle(prompt);
    
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
          combined: "I'm not sure how to help with that. Try asking about wallet balances, market analysis, or social sentiment.",
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

/**
 * Get specialist pricing with reputation
 */
export function getSpecialistPricing(): Record<SpecialistType, { fee: string; description: string; success_rate: number }> {
  const pricingWithRep: any = {};
  for (const [key, value] of Object.entries(SPECIALIST_PRICING)) {
    pricingWithRep[key] = {
      ...value,
      success_rate: getSuccessRate(key as SpecialistType)
    };
  }
  return pricingWithRep;
}

/**
 * Get full specialist list with reputation data
 */
export function getSpecialists(): any[] {
  return Object.entries(SPECIALIST_PRICING).map(([name, info]) => ({
    name,
    description: info.description,
    fee: info.fee,
    success_rate: getSuccessRate(name as SpecialistType)
  }));
}

export default {
  dispatch,
  getTask,
  getTasksByUser,
  getRecentTasks,
  getSpecialistPricing,
  getSpecialists,
  subscribeToTask,
  routePrompt,
};
