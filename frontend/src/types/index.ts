// Task and Workflow Types
export interface Task {
  id: string;
  userId: string;
  prompt: string;
  status: TaskStatus;
  plan?: WorkflowPlan;
  steps: TaskStep[];
  result?: unknown;
  error?: string;
  payments: Payment[];
  createdAt: string;
  completedAt?: string;
}

export type TaskStatus = 'pending' | 'routing' | 'queued' | 'planning' | 'executing' | 'processing' | 'awaiting_payment' | 'completed' | 'failed';

export interface WorkflowPlan {
  steps: PlannedStep[];
  dependencies: Record<string, string[]>;
  estimatedCost: number;
  estimatedTime: number;
}

export interface PlannedStep {
  id: string;
  specialist: SpecialistType;
  action: string;
  input: unknown;
  cost: number;
}

export interface TaskStep {
  id: string;
  specialist: string;
  status: StepStatus;
  input: unknown;
  output?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

// Specialist Types
export type SpecialistType = 'dispatcher' | 'aura' | 'magos' | 'bankr';

export interface Specialist {
  id: SpecialistType;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: 'idle' | 'active' | 'error';
}

// Payment Types
export interface Payment {
  id: string;
  taskId?: string;
  from: string;
  to: string;
  amount: number;
  token: string;
  purpose?: string;
  txSignature?: string;
  status?: 'pending' | 'confirmed' | 'failed';
  createdAt?: string;
  timestamp?: string;
}

// Wallet Types
export interface WalletBalance {
  address: string;
  SOL: number;
  USDC: number;
  tokens?: TokenBalance[];
}

export interface TokenBalance {
  mint: string;
  symbol: string;
  balance: number;
}

// WebSocket Event Types
export interface WSTaskStatusEvent {
  type: 'task:status';
  taskId: string;
  status: TaskStatus;
  step?: {
    specialist: string;
    action: string;
  };
}

export interface WSAgentMessageEvent {
  type: 'agent:message';
  taskId: string;
  from: string;
  to: string;
  payload: unknown;
  timestamp: string;
}

export interface WSPaymentEvent {
  type: 'payment';
  taskId: string;
  from: string;
  to: string;
  amount: number;
  token: 'SOL' | 'USDC';
  txSignature: string;
}

export interface WSTaskCompleteEvent {
  type: 'task:complete';
  taskId: string;
  result: unknown;
}

export type WSEvent = WSTaskStatusEvent | WSAgentMessageEvent | WSPaymentEvent | WSTaskCompleteEvent;

// Agent Message for display
export interface AgentMessage {
  id: string;
  taskId?: string;
  from: string;
  to: string;
  content: string;
  payload?: unknown;
  timestamp: string;
}

// Graph Node Types for React Flow
export interface AgentNode {
  id: string;
  type: 'agent';
  position: { x: number; y: number };
  data: {
    specialist: Specialist;
    isActive: boolean;
    isCenter: boolean;
  };
}

export interface AgentEdge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  style?: React.CSSProperties;
}
