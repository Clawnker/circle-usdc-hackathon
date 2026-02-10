/**
 * Hivemind Types
 * Core type definitions for the Hivemind Protocol
 */

export type SpecialistType = 'magos' | 'aura' | 'bankr' | 'general' | 'scribe' | 'seeker' | 'multi-hop' | 'sentinel' | (string & {});

export interface PlanStep {
  id: string;               // Unique ID within the plan (e.g., "step-1")
  specialist: SpecialistType; // The specialist to call (e.g., "aura", "bankr")
  promptTemplate: string;   // The prompt for this agent. Supports variable substitution (e.g., "Analyze the sentiment for {{token}}")
  dependencies: string[];   // IDs of steps that must complete before this one starts
  estimatedCost: number;    // Estimated cost in USDC for this specific step
}

export interface DAGPlan {
  planId: string;
  query: string;            // Original user query
  steps: PlanStep[];
  totalEstimatedCost: number;
  reasoning: string;        // LLM reasoning for this plan
}

export interface PlanResult {
  stepId: string;
  specialist: SpecialistType;
  output: any;              // Raw data from the specialist
  summary: string;          // Human-readable summary
  success: boolean;
}

export interface DAGResult {
  planId: string;
  success: boolean;
  results: Record<string, PlanResult>; // stepId -> result
  totalCost: number;
  executionTimeMs: number;
}

export type StepExecutor = (step: PlanStep, context: Record<string, any>) => Promise<PlanResult>;

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
  dagPlan?: DAGPlan;     // Added for Phase 2b
  fallbackChain?: string[]; // Added for Phase 2e: ordered list of agent IDs
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
  method?: string;
}

export interface DispatchRequest {
  prompt: string;
  userId?: string;
  preferredSpecialist?: SpecialistType;
  maxPayment?: PaymentInfo;
  maxBudget?: number;      // Maximum USDC budget for the entire request
  dryRun?: boolean;
  previewOnly?: boolean;  // Return routing plan without executing
  callbackUrl?: string;  // Webhook URL to POST result on completion
  hiredAgents?: SpecialistType[];  // Only route to specialists in the user's swarm
  approvedAgent?: SpecialistType;  // User approved this agent (bypasses swarm check)
}

export interface BudgetBreakdown {
  agentId: string;
  capabilityId: string;
  estimatedCost: number;
}

export interface BudgetCheckResult {
  withinBudget: boolean;
  totalCost: number;
  breakdown: BudgetBreakdown[];
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

// Capability Matching Types
export interface CapabilityMetrics {
  capabilityId: string;
  
  // Success metrics (decayed)
  decayedUpvotes: number;
  decayedDownvotes: number;
  lastUpdateTimestamp: number;
  
  // Latency metrics (ms)
  latencySamples: number[]; // Circular buffer of last 100 samples
  p50: number;
  p95: number;
  p99: number;
  
  // Volume
  totalTasks: number;
  
  // Calculated Score (0.0 - 1.0)
  currentScore: number;
}

export interface SpecialistReputationV2 {
  agentId: string;
  address?: string;
  
  // Legacy counts (for backward compatibility)
  successCount: number;
  failureCount: number;
  
  // Overall stats
  upvotes: number;
  downvotes: number;
  globalScore: number;
  
  // Per-capability breakdown
  capabilities: Record<string, CapabilityMetrics>;
  
  // Individual vote records (kept for history/migration)
  votes: any[];
  
  // On-chain sync
  lastSyncTx?: string;
  lastSyncTimestamp?: number;
}

export interface Capability {
  id: string;                // Unique identifier (e.g., "solana:swap")
  name: string;              // Human-readable name
  description: string;       // Detailed description for embedding generation
  category: 'defi' | 'security' | 'social' | 'research' | 'dev' | 'generic';
  subcategories: string[];   // e.g., ["dex", "mev-protection"]
  
  // Data contract
  inputs: {
    type: 'string' | 'number' | 'address' | 'token' | 'object';
    required?: string[];      // Required fields if type is object
  }[];
  outputs: {
    type: 'string' | 'json' | 'transaction' | 'report';
  };

  // Performance metadata
  confidenceScore: number;   // Self-reported or reputation-derived confidence (0-1)
  latencyEstimateMs: number; // Expected response time
}

export interface UserIntent {
  category: string;
  requiredCapabilities: string[]; // Semantic descriptors
  constraints: {
    maxFee?: number;
    preferredNetwork?: string;
    minSuccessRate?: number;
  };
  entities: {
    tokens?: string[];
    addresses?: string[];
    protocols?: string[];
  };
}

export interface RankedAgent {
  agentId: string;
  score: number;
  confidence: number;
  reasoning: string;
}

// Circuit Breaker Types
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
  halfOpenMaxAttempts: number;
}

export interface CircuitBreakerStatus {
  agentId: string;
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime?: number;
  halfOpenAttempts: number;
}

// Fallback Chain Types
export interface FallbackConfig {
  maxRetries: number;
  timeoutMs: number;
}

// External Agent Registry Types
export interface ExternalAgent {
  id: string;                    // Unique agent ID (e.g. "sentinel")
  name: string;                  // Display name
  description: string;           // What this agent does
  endpoint: string;              // Base URL (e.g. https://sentinel-agent-xxx.run.app)
  wallet: string;                // Agent's payment wallet address
  capabilities: string[];        // Legacy e.g. ["security-audit", "compliance-check"]
  structuredCapabilities: Capability[]; // New structured format
  embeddingVectors?: number[][];        // One vector per structured capability
  pricing: Record<string, number>; // capability -> USDC fee
  chain: string;                 // Payment chain (e.g. "base-sepolia")
  x402Support: boolean;          // Does it support x402 payment headers?
  erc8004: {
    registered: boolean;
    identityHash?: string;
  };
  registeredAt: string;          // ISO timestamp
  lastHealthCheck?: string;      // ISO timestamp of last successful health check
  healthy: boolean;              // Is the agent currently reachable?
  active: boolean;               // Is the agent enabled for routing?
}

export interface RegisterRequest {
  name: string;
  description: string;
  endpoint: string;
  wallet: string;
  capabilities: string[];
  structuredCapabilities?: Capability[];
  pricing?: Record<string, number>;
  chain?: string;
}
