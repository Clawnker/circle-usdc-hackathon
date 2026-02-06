/**
 * Hivemind Types
 * Core type definitions for the Hivemind Protocol
 */

export type SpecialistType = 'magos' | 'aura' | 'bankr' | 'general' | 'scribe' | 'seeker' | 'multi-hop';

export interface Task {
  id: string;
  prompt: string;
  userId?: string;
  status: TaskStatus;
  specialist: SpecialistType;
  createdAt: Date;
  updatedAt: Date;
  result?: SpecialistResult;
  payments: PaymentRecord[];
  messages: AgentMessage[];
  metadata?: Record<string, any>;
  callbackUrl?: string;  // Webhook to call on completion
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: string;
}

export type TaskStatus = 
  | 'pending'
  | 'routing'
  | 'processing'
  | 'awaiting_payment'
  | 'completed'
  | 'failed';

export interface SpecialistResult {
  success: boolean;
  data: any;
  confidence?: number;
  timestamp: Date;
  executionTimeMs: number;
  cost?: PaymentInfo;
}

export interface PaymentInfo {
  amount: string;
  currency: string;
  network: 'solana' | 'base' | 'ethereum';
  recipient: string;
}

export interface PaymentRecord extends PaymentInfo {
  txHash?: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: Date;
}

export interface DispatchRequest {
  prompt: string;
  userId?: string;
  preferredSpecialist?: SpecialistType;
  maxPayment?: PaymentInfo;
  dryRun?: boolean;
  previewOnly?: boolean;  // Return routing plan without executing
  callbackUrl?: string;  // Webhook URL to POST result on completion
  hiredAgents?: SpecialistType[];  // Only route to specialists in the user's swarm
  approvedAgent?: SpecialistType;  // User approved this agent (bypasses swarm check)
}

export interface DispatchResponse {
  taskId: string;
  status: TaskStatus;
  specialist: SpecialistType;
  result?: SpecialistResult;
  error?: string;
  // Preview mode fields
  requiresApproval?: boolean;  // True if specialist not in swarm
  specialistInfo?: {
    name: string;
    description: string;
    fee: string;
    feeCurrency: string;
    successRate?: number;
  };
}

// Specialist-specific types

export interface MagosPrediction {
  token: string;
  currentPrice: number;
  predictedPrice: number;
  timeHorizon: string;
  confidence: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  reasoning: string;
}

export interface AuraSentiment {
  topic: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'fomo' | 'fud';
  score: number; // -1 to 1
  volume: number;
  trending: boolean;
  sources: string[];
  summary: string;
}

export interface BankrAction {
  type: 'swap' | 'transfer' | 'balance' | 'dca' | 'monitor';
  status: 'executed' | 'pending' | 'simulated' | 'confirmed' | 'failed';
  txSignature?: string;
  details: Record<string, any>;
}

// WebSocket event types
export interface WSEvent {
  type: 'task_update' | 'payment' | 'specialist_response' | 'error';
  taskId: string;
  payload: any;
  timestamp: Date;
}

// x402 Protocol Types
export interface X402Request {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

export interface X402Response {
  status: number;
  headers: Record<string, string>;
  body: any;
  paymentRequired?: boolean;
  paymentDetails?: {
    amount: string;
    asset: string;
    payTo: string;
    network: string;
  };
}
