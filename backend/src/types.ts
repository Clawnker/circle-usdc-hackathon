/**
 * CSN Types
 * Core type definitions for the Clawnker Specialist Network
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
  callbackUrl?: string;  // Webhook URL to POST result on completion
}

export interface DispatchResponse {
  taskId: string;
  status: TaskStatus;
  specialist: SpecialistType;
  result?: SpecialistResult;
  error?: string;
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

// x402 Payment types
export interface X402Request {
  url: string;
  method: 'GET' | 'POST';
  body?: any;
  headers?: Record<string, string>;
  dryRun?: boolean;
}

export interface X402Response {
  success: boolean;
  data?: any;
  payment?: {
    amount: string;
    currency: string;
    txHash?: string;
  };
  error?: string;
}

// WebSocket event types
export interface WSEvent {
  type: 'task_update' | 'payment' | 'specialist_response' | 'error';
  taskId: string;
  payload: any;
  timestamp: Date;
}
