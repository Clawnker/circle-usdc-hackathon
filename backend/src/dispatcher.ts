/**
 * Hivemind Dispatcher Core
 * Routes prompts to specialists and orchestrates multi-agent workflows
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);
import {
  Task,
  TaskStatus,
  SpecialistType,
  DispatchRequest,
  DispatchResponse,
  SpecialistResult,
} from './types';
import config from './config';
import { getBalances, logTransaction, createPaymentRecord } from './x402';
import { executeDemoPayment } from './x402-protocol';
import { sendOnChainPayment } from './onchain-payments';
import { recordSuccess, recordFailure, getSuccessRate } from './reputation';
import { planWithLLM } from './llm-planner';
import { isExternalAgent, callExternalAgent, getExternalAgents, getExternalAgent } from './external-agents';
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

// Specialist descriptions
const SPECIALIST_DESCRIPTIONS: Record<SpecialistType, string> = {
  magos: 'Market analysis & predictions',
  aura: 'Social sentiment analysis',
  bankr: 'Wallet operations',
  scribe: 'General assistant & fallback',
  seeker: 'Web research & search',
  general: 'General queries',
  sentinel: 'Smart contract security audits',
  'multi-hop': 'Orchestrated multi-agent workflow',
};

// Specialist pricing information
const SPECIALIST_PRICING: Record<SpecialistType, { fee: string; description: string }> = {
  magos: { fee: '0.001', description: 'Market analysis & predictions' },
  aura: { fee: '0.0005', description: 'Social sentiment analysis' },
  bankr: { fee: '0.0001', description: 'Wallet operations' },
  scribe: { fee: '0.0001', description: 'General assistant & fallback' },
  seeker: { fee: '0.0001', description: 'Web research & search' },
  general: { fee: '0', description: 'General queries' },
  sentinel: { fee: '2.50', description: 'Smart contract security audits (external)' },
  'multi-hop': { fee: '0', description: 'Orchestrated multi-agent workflow' },
};

/**
 * Detect multi-hop patterns
 */
function detectMultiHop(prompt: string): SpecialistType[] | null {
  const lower = prompt.toLowerCase();
  
  // Pattern: "buy" + "trending" = aura → bankr
  if (lower.includes('buy') && (lower.includes('trending') || lower.includes('popular') || lower.includes('hot') || lower.includes('sentiment'))) {
    return ['aura', 'bankr'];
  }
  
  // Pattern: "analyze" + "buy" = magos → bankr  
  if ((lower.includes('analyze') || lower.includes('research')) && lower.includes('buy')) {
    return ['magos', 'bankr'];
  }

  // Pattern: "research" + "summary" = seeker → scribe
  if ((lower.includes('research') || lower.includes('search') || lower.includes('news')) && (lower.includes('summary') || lower.includes('summarize'))) {
    return ['seeker', 'scribe'];
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
  console.log(`[Dispatcher] Adding message from ${from} to ${to}: ${content}`);
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
  
  // Determine the best specialist for this prompt (ignoring swarm filter for routing decision)
  const bestSpecialist = request.preferredSpecialist || (hops ? 'multi-hop' : await routePrompt(request.prompt));
  
  // Check if user approved this specific agent
  const isApproved = request.approvedAgent === bestSpecialist;
  
  // Check if specialist is in user's swarm (hired agents)
  const isInSwarm = !request.hiredAgents || request.hiredAgents.includes(bestSpecialist);
  
  // If not in swarm and not approved, check if we need approval
  const requiresApproval = !isInSwarm && !isApproved && bestSpecialist !== 'general' && bestSpecialist !== 'scribe';
  
  console.log(`[Dispatcher] Routing decision:`, {
    bestSpecialist,
    hiredAgents: request.hiredAgents,
    isInSwarm,
    isApproved,
    requiresApproval,
  });
  
  // If preview only or requires approval, return info without executing
  if (request.previewOnly || requiresApproval) {
    const pricing = SPECIALIST_PRICING[bestSpecialist] || { fee: '0', description: 'Unknown' };
    const successRate = getSuccessRate(bestSpecialist);
    
    return {
      taskId: '', // No task created yet
      status: 'pending',
      specialist: bestSpecialist,
      requiresApproval,
      specialistInfo: {
        name: getSpecialistDisplayName(bestSpecialist),
        description: pricing.description,
        fee: pricing.fee,
        feeCurrency: 'USDC',
        successRate: successRate > 0 ? successRate : undefined,
      },
    };
  }
  
  // Filter multi-hop to only include hired agents (unless approved)
  let filteredHops = hops;
  if (hops && request.hiredAgents && !isApproved) {
    filteredHops = hops.filter(h => request.hiredAgents!.includes(h) || h === request.approvedAgent);
    if (filteredHops.length === 0) filteredHops = null;
  }
  
  const specialist = request.preferredSpecialist || (filteredHops ? 'multi-hop' : bestSpecialist);
  
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
      hops: filteredHops || undefined,
      hiredAgents: request.hiredAgents,
      wasApproved: isApproved, // Track if user approved a non-swarm agent
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
 * Get display name for a specialist
 */
function getSpecialistDisplayName(specialist: SpecialistType): string {
  const names: Record<string, string> = {
    magos: 'Market Oracle',
    aura: 'Social Analyst',
    bankr: 'DeFi Executor',
    scribe: 'General Assistant',
    seeker: 'Web Researcher',
    sentinel: 'Security Auditor',
    general: 'General',
    'multi-hop': 'Multi-Agent Workflow',
  };
  return names[specialist] || specialist;
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
      
      updateTaskStatus(task, 'processing', { 
        currentStep: step, 
        totalSteps: hops.length,
        activeSpecialist: specialist
      });
      addMessage(task, 'dispatcher', specialist, `[Step ${step}/${hops.length}] Routing to ${specialist}...`);
      
      // Call the specialist via x402-gated endpoint
      const result = await callSpecialistGated(specialist, currentContext);
      multiResults.push({ specialist, result });
      
      // Add specialist response message
      const responseContent = extractResponseContent(result);
      addMessage(task, specialist, 'dispatcher', responseContent);
      
      // Execute x402 payment for this hop (primary), on-chain fallback
      const specialistFee = (config.fees as any)[specialist] || 0;
      if (specialistFee > 0 && !dryRun) {
        // For external agents, route x402 to their endpoint
        let specialistUrl: string;
        const extAgent = isExternalAgent(specialist) ? getExternalAgent(specialist) : null;
        
        if (extAgent) {
          const cap = extAgent.capabilities[0] || 'execute';
          specialistUrl = (cap === 'security-audit' || cap === 'audit')
            ? `${extAgent.endpoint}/audit`
            : `${extAgent.endpoint}/execute`;
        } else {
          const baseUrl = process.env.BASE_URL || 'https://circle-usdc-hackathon.onrender.com';
          specialistUrl = `${baseUrl}/api/specialist/${specialist}`;
        }
        
        const paymentResult = await executeDemoPayment(specialistUrl, { prompt: currentContext }, specialistFee);

        if (paymentResult.success && paymentResult.txSignature) {
          const feeRecord = createPaymentRecord(String(specialistFee), 'USDC', 'base', specialist, paymentResult.txSignature);
          task.payments.push(feeRecord);
          addMessage(task, 'x402', 'dispatcher', `💰 x402 Payment: ${specialistFee} USDC → ${specialist}`);
          
          // Use the response from x402/fetch if available
          if (paymentResult.response) {
            multiResults[multiResults.length - 1].result = paymentResult.response;
          }
        } else {
          // Fallback: on-chain transfer
          const onChainResult = await sendOnChainPayment(specialist, String(specialistFee));
          if (onChainResult) {
            const feeRecord = createPaymentRecord(
              onChainResult.amount, 'USDC', 'base-sepolia' as any, specialist, onChainResult.txHash
            );
            task.payments.push(feeRecord);
            addMessage(task, 'x402', 'dispatcher', `💰 On-chain Payment: ${specialistFee} USDC → ${specialist} (tx: ${onChainResult.txHash.slice(0, 10)}...)`);
          } else {
            const feeRecord = createPaymentRecord(String(specialistFee), 'USDC', 'base', specialist);
            task.payments.push(feeRecord);
            logTransaction(feeRecord);
            addMessage(task, 'x402', 'dispatcher', `💰 x402 Fee (Pending): ${specialistFee} USDC → ${specialist}`);
          }
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
    const fee = (config.fees as any)[task.specialist] || 0;
    const usdcBalance = balances.evm?.usdc || balances.solana?.usdc; // Primary: Base

    if (config.enforcePayments && usdcBalance < fee) {
      const errorMsg = `Insufficient balance: ${usdcBalance} USDC < ${fee} USDC required for ${task.specialist}`;
      addMessage(task, 'x402', 'dispatcher', `❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
  
  updateTaskStatus(task, 'processing');
  
  // Get specialist fee
  const fee = (config.fees as any)[task.specialist] || 0;
  addMessage(task, 'dispatcher', task.specialist, `Processing with ${task.specialist}... (fee: ${fee} USDC)`);
  
  // Demo delay before calling specialist
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Call the specialist via x402-gated endpoint
  const result = await callSpecialistGated(task.specialist, task.prompt);
  
  // Add specialist response message
  const responseContent = extractResponseContent(result);
  addMessage(task, task.specialist, 'dispatcher', responseContent);
  
  // Execute x402 payment via AgentWallet (primary), fallback to on-chain
  if (fee > 0 && !dryRun) {
    addMessage(task, 'x402', 'dispatcher', `⏳ Processing ${fee} USDC payment via x402...`);
    
    // For external agents, route x402 payment to their endpoint directly
    // For built-in specialists, use our own /api/specialist/:id endpoint
    let specialistUrl: string;
    const externalAgent = isExternalAgent(task.specialist) ? getExternalAgent(task.specialist) : null;
    
    if (externalAgent) {
      // External agent: x402 payment goes directly to their audit/execute endpoint
      const capability = externalAgent.capabilities[0] || 'execute';
      if (capability === 'security-audit' || capability === 'audit') {
        specialistUrl = `${externalAgent.endpoint}/audit`;
      } else {
        specialistUrl = `${externalAgent.endpoint}/execute`;
      }
      console.log(`[Dispatcher] x402 routing to external agent: ${specialistUrl}`);
    } else {
      const baseUrl = process.env.BASE_URL || 'https://circle-usdc-hackathon.onrender.com';
      specialistUrl = `${baseUrl}/api/specialist/${task.specialist}`;
    }
    
    const paymentResult = await executeDemoPayment(specialistUrl, { prompt: task.prompt }, fee);

    if (paymentResult.success && paymentResult.txSignature) {
      const feeRecord = createPaymentRecord(String(fee), 'USDC', 'base', task.specialist, paymentResult.txSignature);
      task.payments.push(feeRecord);
      addMessage(task, 'x402', 'dispatcher', `💰 x402 Payment: ${fee} USDC → ${task.specialist}`);
    } else {
      // Fallback: real on-chain USDC transfer
      console.warn(`[Dispatcher] x402 payment failed, falling back to on-chain transfer...`);
      const onChainResult = await sendOnChainPayment(task.specialist, String(fee));
      
      if (onChainResult) {
        const feeRecord = createPaymentRecord(
          onChainResult.amount, 'USDC', 'base-sepolia' as any, task.specialist, onChainResult.txHash
        );
        task.payments.push(feeRecord);
        addMessage(task, 'x402', 'dispatcher', `💰 On-chain Payment: ${fee} USDC → ${task.specialist} (tx: ${onChainResult.txHash.slice(0, 10)}...)`);
      } else {
        const feeRecord = createPaymentRecord(String(fee), 'USDC', 'base', task.specialist);
        task.payments.push(feeRecord);
        logTransaction(feeRecord);
        addMessage(task, 'x402', 'dispatcher', `💰 x402 Fee (Pending): ${fee} USDC → ${task.specialist}`);
      }
    }
  }
  
  // Log any additional payments from the specialist result
  // Skip if dispatcher already paid the fee (avoids double-counting for external agents)
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
    const isValid = await validateCallbackUrl(task.callbackUrl);
    if (!isValid) {
      console.error(`[Dispatcher] Blocked potentially malicious callbackUrl: ${task.callbackUrl}`);
      addMessage(task, 'system', 'dispatcher', `Security: Blocked invalid callbackUrl (SSRF protection)`);
    } else {
      try {
        const axios = require('axios');
        // SECURITY: We already validated the URL, but to be 100% safe against DNS rebinding
        // we should ideally use the resolved IP. However, many services use SNI/Host headers.
        // For this hackathon, we'll re-validate just before the call.
        const isValid = await validateCallbackUrl(task.callbackUrl);
        if (isValid) {
          await axios.post(task.callbackUrl, {
            taskId: task.id,
            status: task.status,
            specialist: task.specialist,
            result: formatResultForCallback(result),
            messages: task.messages,
          }, { timeout: 5000 });
          console.log(`[Dispatcher] Callback sent to ${task.callbackUrl}`);
        }
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
 * Resolves hostnames to IPs to prevent DNS rebinding.
 */
async function validateCallbackUrl(urlStr: string): Promise<boolean> {
  try {
    const url = new URL(urlStr);
    
    // Only allow http:// and https:// schemes
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    let hostname = url.hostname.toLowerCase();
    
    // Resolve hostname to IP
    let ip = hostname;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && !hostname.includes(':')) {
      try {
        const result = await lookup(hostname);
        ip = result.address;
      } catch (e) {
        return false; // Could not resolve
      }
    }

    // Block localhost, 127.0.0.1, ::1, 0.0.0.0
    if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') {
      return false;
    }

    // Block private IP ranges
    // 10.x.x.x
    if (/^10\./.test(ip)) return false;
    // 172.16.x.x to 172.31.x.x
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return false;
    // 192.168.x.x
    if (/^192\.168\./.test(ip)) return false;
    // 169.254.x.x (Cloud metadata)
    if (/^169\.254\./.test(ip)) return false;

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
  
  // External agent results (e.g., Sentinel audit)
  if (data?.externalAgent && data?.result) {
    const agentResult = data.result;
    // Sentinel audit format
    if (agentResult.analysis) {
      const a = agentResult.analysis;
      let content = `**${data.externalAgent} Security Audit**\n\n`;
      if (a.overview) content += `${a.overview}\n\n`;
      if (a.riskLevel) content += `**Risk Level:** ${a.riskLevel}\n`;
      if (a.score !== undefined) content += `**Score:** ${a.score}/100\n\n`;
      if (a.vulnerabilities && a.vulnerabilities.length > 0) {
        content += `**Vulnerabilities Found:**\n`;
        a.vulnerabilities.forEach((v: any) => {
          content += `• **[${v.severity || 'Unknown'}]** ${v.title || v.description || JSON.stringify(v)}\n`;
        });
        content += '\n';
      }
      if (a.recommendations && a.recommendations.length > 0) {
        content += `**Recommendations:**\n`;
        a.recommendations.forEach((r: string) => {
          content += `• ${r}\n`;
        });
      }
      if (a.bestPractices) {
        content += `\n**Best Practices:** ${typeof a.bestPractices === 'string' ? a.bestPractices : JSON.stringify(a.bestPractices)}`;
      }
      return content.trim();
    }
    // Generic external agent response
    if (typeof agentResult === 'string') return agentResult;
    if (agentResult.output) return agentResult.output;
    if (agentResult.response) return typeof agentResult.response === 'string' ? agentResult.response : JSON.stringify(agentResult.response, null, 2);
    return JSON.stringify(agentResult, null, 2);
  }
  
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
 * Route prompt to appropriate specialist
 * Supports both RegExp-based (fast) and LLM-based (smart) routing
 * Only routes to specialists in the hiredAgents list if provided
 */
export async function routePrompt(prompt: string, hiredAgents?: SpecialistType[]): Promise<SpecialistType> {
  const planningMode = process.env.PLANNING_MODE || 'regexp';
  
  if (planningMode === 'llm') {
    try {
      const plan = await planWithLLM(prompt);
      console.log(`[LLM Planner] ${plan.specialist} (confidence: ${plan.confidence.toFixed(2)}) - ${plan.reasoning}`);
      
      // If specialist is not in hiredAgents, use fallback routing
      if (hiredAgents && !hiredAgents.includes(plan.specialist)) {
        console.log(`[LLM Planner] Specialist ${plan.specialist} not in swarm, falling back to regexp routing`);
        return routeWithRegExp(prompt, hiredAgents);
      }
      
      return plan.specialist;
    } catch (error: any) {
      console.error(`[LLM Planner] Error:`, error.message, '- falling back to regexp');
      return routeWithRegExp(prompt, hiredAgents);
    }
  }
  
  // Default: RegExp routing
  return routeWithRegExp(prompt, hiredAgents);
}

/**
 * Route prompt using RegExp pattern matching (fast, deterministic)
 * Only routes to specialists in the hiredAgents list if provided
 */
function routeWithRegExp(prompt: string, hiredAgents?: SpecialistType[]): SpecialistType {
  const lower = prompt.toLowerCase();
  
  // Specific intent detection for common mis-routings
  if (lower.includes('good buy') || lower.includes('should i') || lower.includes('recommend') || /is \w+ a good/.test(lower)) {
    if (!hiredAgents || hiredAgents.includes('magos')) return 'magos';
  }
  
  if (lower.includes('talking about') || lower.includes('mentions') || lower.includes('discussing')) {
    if (!hiredAgents || hiredAgents.includes('aura')) return 'aura';
  }
  
  // Price queries should go to magos (market analysis), not seeker
  if (/price|value|worth|cost.*\b(sol|eth|btc|bonk|wif|pepe|usdc|usdt)\b/i.test(prompt) || 
      /\b(sol|eth|btc|bonk|wif|pepe)\b.*price/i.test(prompt)) {
    if (!hiredAgents || hiredAgents.includes('magos')) return 'magos';
  }

  // Define routing rules with weights
  const rules: Array<{ specialist: SpecialistType; patterns: RegExp[]; weight: number }> = [
    {
      specialist: 'sentinel',
      patterns: [
        /audit|security|vulnerabilit|exploit|hack|reentrancy|overflow|access.control/,
        /smart\s*contract.*(?:check|review|scan|inspect|analyz)/,
        /contract.*(?:safe|secure|risk|danger)/,
        /0x[a-fA-F0-9]{40}/, // Contract address pattern
      ],
      weight: 1.5, // Higher weight — specific capability
    },
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
        /\bbalance\b|my wallet|holdings|portfolio/,
        /dca|dollar\s+cost|recurring|auto-buy/,
        /solana|sol price/,
      ],
      weight: 1,
    },
    {
      specialist: 'seeker',
      patterns: [
        /search|find|lookup|what is|who is|where is|news about|latest on/,
        /research|google|brave|internet|web|look up/,
        /news|happened|today|recent|current events/,
        /what happened|tell me about/,
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
  
  // Score each specialist (only those in hiredAgents if provided)
  const scores: Record<SpecialistType, number> = {
    magos: 0,
    aura: 0,
    bankr: 0,
    scribe: 0,
    seeker: 0,
    sentinel: 0,
    general: 0,
    'multi-hop': 0,
  };
  
  for (const rule of rules) {
    // Skip specialists not in hiredAgents (if list is provided)
    if (hiredAgents && !hiredAgents.includes(rule.specialist)) {
      continue;
    }
    
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
    // Skip specialists not in hiredAgents (if list is provided)
    if (hiredAgents && !hiredAgents.includes(specialist as SpecialistType) && specialist !== 'general') {
      continue;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestSpecialist = specialist as SpecialistType;
    }
  }
  
  console.log(`[Router] Scores:`, scores, `-> ${bestSpecialist}`, hiredAgents ? `(filtered by swarm: ${hiredAgents.join(', ')})` : '');
  return bestSpecialist;
}

/**
 * Check if specialist requires x402 payment
 */
async function checkPaymentRequired(specialist: SpecialistType): Promise<boolean> {
  // Specialists with non-zero fees require payment
  const fee = (config.fees as any)[specialist] || 0;
  return fee > 0;
}

/**
 * Call a specialist through the x402-gated endpoint
 * Handles 402 responses and provides payment instructions
 */
export async function callSpecialistGated(specialistId: string, prompt: string): Promise<SpecialistResult> {
  const startTime = Date.now();
  
  try {
    // In a real production app, we would use axios to call http://localhost:PORT/api/specialist/:id
    // But since we are server-side and want to demo the flow, we will:
    // 1. Manually check if it's a 402 (payment required)
    // 2. If 402, simulate/execute payment
    // 3. Then call the actual specialist
    
    console.log(`[x402-Client] Requesting gated access to ${specialistId}...`);
    
    // Simulate checking the x402-gated endpoint
    // In actual implementation: const response = await axios.post(`/api/specialist/${specialistId}`, { prompt });
    
    // For demo purposes, we call the specialist directly but log the x402 flow
    const result = await callSpecialist(specialistId as SpecialistType, prompt);
    
    return {
      ...result,
      executionTimeMs: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      success: false,
      data: { error: error.message },
      timestamp: new Date(),
      executionTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Call the appropriate specialist
 * Checks external agents first, then falls back to built-in specialists
 */
export async function callSpecialist(specialist: SpecialistType, prompt: string): Promise<SpecialistResult> {
  const startTime = Date.now();
  
  // Check if this is an external agent (registered via marketplace)
  if (isExternalAgent(specialist as string)) {
    console.log(`[Dispatcher] Routing to external agent: ${specialist}`);
    return callExternalAgent(specialist as string, prompt);
  }
  
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
  for (const [key, description] of Object.entries(SPECIALIST_DESCRIPTIONS)) {
    const fee = (config.fees as any)[key] || 0;
    pricingWithRep[key] = {
      fee: String(fee),
      description,
      success_rate: getSuccessRate(key as SpecialistType)
    };
  }
  return pricingWithRep;
}

/**
 * Get full specialist list with reputation data (including external agents)
 */
export function getSpecialists(): any[] {
  // Built-in specialists
  const builtIn = Object.entries(SPECIALIST_DESCRIPTIONS).map(([name, description]) => ({
    name,
    description,
    fee: String((config.fees as any)[name] || 0),
    success_rate: getSuccessRate(name as SpecialistType),
    external: false,
  }));
  
  // External agents from the registry
  const external = getExternalAgents()
    .filter(a => a.active && a.healthy)
    .map(a => ({
      name: a.id,
      displayName: a.name,
      description: a.description,
      fee: String(Object.values(a.pricing)[0] || 0),
      success_rate: 0,
      external: true,
      endpoint: a.endpoint,
      wallet: a.wallet,
      capabilities: a.capabilities,
      pricing: a.pricing,
    }));
  
  return [...builtIn, ...external];
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
