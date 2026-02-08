export interface Payment {
  id?: string;
  specialist?: string;
  amount: number;
  currency?: string;
  token?: string;
  from?: string;
  to?: string;
  status?: string;
  txSignature?: string;
  createdAt?: string;
  timestamp?: string;
}

export interface TransactionDetails {
  type: 'swap' | 'transfer';
  inputToken?: string;
  outputToken?: string;
  inputAmount?: number;
  outputAmount?: number;
  recipient?: string;
  txHash?: string;
}

export interface QueryHistoryItem {
  id: string;
  prompt: string;
  specialist: string;
  cost: number;
  status: 'success' | 'failed';
  timestamp: Date;
  result?: string;
  payments?: Payment[];
  transactions?: TransactionDetails[];
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  payload?: any;
  content?: string;
  timestamp: string;
}

export type SpecialistType = 
  | 'bankr' 
  | 'magos' 
  | 'aura' 
  | 'scribe' 
  | 'seeker' 
  | 'general' 
  | 'dispatcher' 
  | 'alphahunter' 
  | 'riskbot' 
  | 'newsdigest' 
  | 'whalespy';

export interface SpecialistPricing {
  fee: string;
  token: string;
  description?: string;
}

export type TaskStatus = 
  | 'idle'
  | 'routing'
  | 'awaiting_payment'
  | 'processing'
  | 'executing'
  | 'planning'
  | 'completed'
  | 'failed';

export interface WalletBalance {
  address: string;
  ETH: number;
  USDC: number;
}
