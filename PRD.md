# Product Requirements Document (PRD)
## Clawnker Specialist Network (CSN)
### Colosseum Agent Hackathon - $100k USDC

**Version:** 1.0  
**Date:** February 4, 2026  
**Author:** Prism 📋 (Product Manager)  
**Deadline:** February 12, 2026 (8 days)

---

## Executive Summary

The Clawnker Specialist Network (CSN) is a decentralized orchestration layer that transforms isolated AI agents into a collaborative, economically-coordinated swarm on Solana. CSN provides the discovery, coordination, and settlement infrastructure for the emerging agent economy.

**Key Differentiators:**
- First multi-agent orchestration layer with native x402 payment integration
- Demonstrates real Agent-to-Agent (A2A) economic transactions on Solana
- Live integration with production-ready specialist agents (Magos, Aura, bankr)

---

## Table of Contents
1. [User Stories & Acceptance Criteria](#1-user-stories--acceptance-criteria)
2. [Technical Specifications](#2-technical-specifications)
3. [Sprint Plan](#3-sprint-plan-8-days)
4. [Demo Script](#4-demo-script)
5. [Risk Register](#5-risk-register)

---

## 1. User Stories & Acceptance Criteria

### 1.1 Multi-Agent Dispatcher

#### US-1.1: Natural Language Task Routing
> **As a** DeFi power user  
> **I want to** submit a natural language prompt like "Find trending coins on X and buy 0.1 SOL of the most bullish one"  
> **So that** I can execute complex multi-agent workflows without manual coordination

**Acceptance Criteria:**
- [ ] AC-1.1.1: System accepts POST to `/dispatch` with `{ prompt: string, userId: string }`
- [ ] AC-1.1.2: Dispatcher classifies prompt and identifies required specialists within 500ms
- [ ] AC-1.1.3: Dispatcher returns execution plan before starting (optimistic UI feedback)
- [ ] AC-1.1.4: Multi-step workflows execute sequentially with dependency resolution
- [ ] AC-1.1.5: Final response aggregates all specialist outputs into coherent summary

#### US-1.2: Specialist Chain Orchestration
> **As the** Dispatcher  
> **I want to** decompose complex prompts into specialist sub-tasks  
> **So that** each specialist handles only its domain of expertise

**Acceptance Criteria:**
- [ ] AC-1.2.1: 3+ agent chains execute successfully (e.g., Aura → Magos → bankr)
- [ ] AC-1.2.2: Specialist outputs are passed as context to downstream specialists
- [ ] AC-1.2.3: Parallel-compatible tasks execute concurrently (Promise.all)
- [ ] AC-1.2.4: Chain aborts gracefully if any specialist fails with clear error reporting

#### US-1.3: Specialist Health Monitoring
> **As the** Dispatcher  
> **I want to** know if a specialist is available before routing  
> **So that** I can provide immediate feedback or fallback behavior

**Acceptance Criteria:**
- [ ] AC-1.3.1: Health check endpoint `/health` returns status of all specialists
- [ ] AC-1.3.2: Unhealthy specialists are excluded from routing decisions
- [ ] AC-1.3.3: Circuit breaker pattern prevents cascade failures (3 failures = 30s cooldown)

---

### 1.2 Specialist Agents

#### US-1.4: Aura - Social Sentiment Analysis
> **As the** Dispatcher  
> **I want to** query Aura for social sentiment and trending alpha  
> **So that** I can make informed decisions based on market mood

**Acceptance Criteria:**
- [ ] AC-1.4.1: Aura accepts `{ query: string, sources?: string[] }`
- [ ] AC-1.4.2: Returns sentiment score (-1 to 1) with confidence level
- [ ] AC-1.4.3: Identifies trending tokens/topics from X (Twitter) data
- [ ] AC-1.4.4: Response includes source citations and timestamps
- [ ] AC-1.4.5: Latency < 5 seconds for standard queries

#### US-1.5: Magos - Prediction & Risk Assessment
> **As the** Dispatcher  
> **I want to** query Magos for price predictions and risk analysis  
> **So that** I can evaluate trade opportunities quantitatively

**Acceptance Criteria:**
- [ ] AC-1.5.1: Magos accepts `{ token: string, timeframe: string, context?: any }`
- [ ] AC-1.5.2: Returns prediction with confidence interval (e.g., "+15% ± 8% in 4h")
- [ ] AC-1.5.3: Includes risk score (1-10) with reasoning
- [ ] AC-1.5.4: Can incorporate Aura's sentiment as input context
- [ ] AC-1.5.5: Latency < 3 seconds for predictions

#### US-1.6: bankr - Solana Execution
> **As the** Dispatcher  
> **I want to** execute on-chain actions via bankr  
> **So that** I can trade, transfer, or query the Solana blockchain

**Acceptance Criteria:**
- [ ] AC-1.6.1: bankr accepts `{ action: 'swap'|'transfer'|'balance', params: object }`
- [ ] AC-1.6.2: Swap executes via Jupiter aggregator with slippage protection
- [ ] AC-1.6.3: Returns transaction signature for all write operations
- [ ] AC-1.6.4: Balance queries return SOL + top tokens with USD values
- [ ] AC-1.6.5: All transactions use Helius RPC (mainnet)

---

### 1.3 Economic Layer (x402)

#### US-1.7: Pay-Per-Call Specialist Pricing
> **As a** specialist agent (Magos/Aura)  
> **I want to** charge for my services via x402  
> **So that** I can monetize my capabilities autonomously

**Acceptance Criteria:**
- [ ] AC-1.7.1: Specialists can declare pricing in skill manifest (e.g., 0.01 USDC/call)
- [ ] AC-1.7.2: Dispatcher pre-checks user wallet balance before execution
- [ ] AC-1.7.3: Payment executes atomically with service delivery
- [ ] AC-1.7.4: Failed payments prevent specialist execution (no free rides)

#### US-1.8: AgentWallet Integration
> **As the** CSN system  
> **I want to** use AgentWallet for all payment operations  
> **So that** agents have financial sovereignty without custody

**Acceptance Criteria:**
- [ ] AC-1.8.1: Dispatcher uses AgentWallet API to check balances before routing
- [ ] AC-1.8.2: x402 payments execute via `/api/wallets/{user}/actions/x402/fetch`
- [ ] AC-1.8.3: Transaction receipts are logged with timestamps
- [ ] AC-1.8.4: Support for both SOL and USDC payments

#### US-1.9: Payment Visualization
> **As a** user  
> **I want to** see all x402 payments in the Command Center  
> **So that** I understand the economic activity of my agent swarm

**Acceptance Criteria:**
- [ ] AC-1.9.1: Payment events stream to UI in real-time via WebSocket
- [ ] AC-1.9.2: Each payment shows: from, to, amount, token, purpose, timestamp
- [ ] AC-1.9.3: Running total of session costs displayed
- [ ] AC-1.9.4: Transaction links to Solana explorer for verification

---

### 1.4 Command Center UI

#### US-1.10: Task Submission Interface
> **As a** user  
> **I want to** submit tasks through a clean web interface  
> **So that** I don't need to use CLI or API directly

**Acceptance Criteria:**
- [ ] AC-1.10.1: Text input with submit button prominently displayed
- [ ] AC-1.10.2: Example prompts shown as clickable suggestions
- [ ] AC-1.10.3: Input validation with helpful error messages
- [ ] AC-1.10.4: Loading state shown during task execution

#### US-1.11: Swarm Visualizer
> **As a** user  
> **I want to** see agents communicating in real-time  
> **So that** I understand how my request is being processed

**Acceptance Criteria:**
- [ ] AC-1.11.1: Visual graph shows Dispatcher → Specialist connections
- [ ] AC-1.11.2: Active communications pulse/animate
- [ ] AC-1.11.3: Message logs show inter-agent payloads (expandable)
- [ ] AC-1.11.4: Timeline view of task execution stages
- [ ] AC-1.11.5: Specialist status indicators (idle/active/error)

#### US-1.12: Wallet Dashboard
> **As a** user  
> **I want to** see my AgentWallet balance and transaction history  
> **So that** I can monitor my spending and fund my agents

**Acceptance Criteria:**
- [ ] AC-1.12.1: Display SOL and USDC balances (auto-refresh every 10s)
- [ ] AC-1.12.2: Recent transactions list with expandable details
- [ ] AC-1.12.3: Copy wallet address button
- [ ] AC-1.12.4: Link to fund wallet (Solana Pay or QR code)

---

## 2. Technical Specifications

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      COMMAND CENTER UI                          │
│  (Next.js / React)                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Task Input   │  │ Swarm Graph  │  │ Wallet View  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CSN BACKEND (Express.js)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      DISPATCHER                           │  │
│  │  • Prompt Classification (LLM/Rules)                     │  │
│  │  • Workflow Planning                                     │  │
│  │  • Specialist Routing                                    │  │
│  │  • Response Aggregation                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐            │
│         ▼                    ▼                    ▼            │
│  ┌────────────┐      ┌────────────┐       ┌────────────┐       │
│  │   AURA     │      │   MAGOS    │       │   BANKR    │       │
│  │ Sentiment  │      │ Prediction │       │ Execution  │       │
│  │ (x402 $)   │      │ (x402 $)   │       │ (Helius)   │       │
│  └────────────┘      └────────────┘       └────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ x402 / RPC
                              ▼
         ┌────────────────────┴────────────────────┐
         │           EXTERNAL SERVICES             │
         │  ┌─────────────┐  ┌─────────────────┐  │
         │  │ AgentWallet │  │  Helius RPC     │  │
         │  │ (x402 Proxy)│  │  (Solana)       │  │
         │  └─────────────┘  └─────────────────┘  │
         └─────────────────────────────────────────┘
```

### 2.2 API Specifications

#### 2.2.1 REST Endpoints

##### POST `/dispatch`
Main entry point for task submission.

**Request:**
```typescript
{
  prompt: string;           // Natural language task
  userId: string;           // User identifier
  options?: {
    maxBudget?: number;     // Max USDC to spend
    dryRun?: boolean;       // Plan only, don't execute
    timeout?: number;       // Max execution time (ms)
  }
}
```

**Response:**
```typescript
{
  taskId: string;           // UUID for tracking
  status: 'queued' | 'processing' | 'completed' | 'failed';
  plan: {
    steps: Array<{
      specialist: string;
      action: string;
      estimatedCost: number;
    }>;
    totalEstimatedCost: number;
  };
  result?: any;             // Final aggregated result
  payments: Array<{
    from: string;
    to: string;
    amount: number;
    token: string;
    txSignature: string;
  }>;
  executionTime: number;    // Total ms
}
```

##### GET `/health`
System health check.

**Response:**
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  specialists: {
    aura: { status: string; latency: number };
    magos: { status: string; latency: number };
    bankr: { status: string; latency: number };
  };
  wallet: {
    connected: boolean;
    balance: { SOL: number; USDC: number };
  };
  uptime: number;
}
```

##### GET `/tasks/:taskId`
Get task status and result.

**Response:** Same as `/dispatch` response.

##### GET `/wallet/balance`
Get AgentWallet balances.

**Response:**
```typescript
{
  solana: {
    address: string;
    SOL: number;
    USDC: number;
    tokens: Array<{ mint: string; symbol: string; balance: number }>;
  };
}
```

##### GET `/wallet/transactions`
Get recent transactions.

**Response:**
```typescript
{
  transactions: Array<{
    signature: string;
    type: 'payment' | 'receive' | 'swap';
    amount: number;
    token: string;
    counterparty: string;
    timestamp: string;
    purpose?: string;
  }>;
}
```

#### 2.2.2 WebSocket Events

**Connection:** `ws://localhost:3000/ws`

**Client → Server:**
```typescript
{ type: 'subscribe', taskId: string }
{ type: 'unsubscribe', taskId: string }
```

**Server → Client:**
```typescript
// Task status update
{
  type: 'task:status',
  taskId: string,
  status: string,
  step?: { specialist: string; action: string }
}

// Inter-agent message
{
  type: 'agent:message',
  taskId: string,
  from: string,
  to: string,
  payload: any,
  timestamp: string
}

// Payment event
{
  type: 'payment',
  taskId: string,
  from: string,
  to: string,
  amount: number,
  token: string,
  txSignature: string
}

// Task complete
{
  type: 'task:complete',
  taskId: string,
  result: any
}
```

### 2.3 Data Models

#### 2.3.1 Task
```typescript
interface Task {
  id: string;                    // UUID
  userId: string;
  prompt: string;
  status: 'queued' | 'planning' | 'executing' | 'completed' | 'failed';
  plan: WorkflowPlan;
  steps: TaskStep[];
  result?: any;
  error?: string;
  payments: Payment[];
  createdAt: Date;
  completedAt?: Date;
}

interface WorkflowPlan {
  steps: PlannedStep[];
  dependencies: Record<string, string[]>;  // stepId → [dependsOn]
  estimatedCost: number;
  estimatedTime: number;
}

interface PlannedStep {
  id: string;
  specialist: 'aura' | 'magos' | 'bankr';
  action: string;
  input: any;
  cost: number;
}

interface TaskStep {
  id: string;
  specialist: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: any;
  output?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}
```

#### 2.3.2 Specialist Manifest
```typescript
interface SpecialistManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  skills: string[];
  pricing: {
    model: 'per_call' | 'per_token' | 'free';
    amount?: number;
    token?: 'SOL' | 'USDC';
  };
  endpoints: {
    execute: string;
    health: string;
  };
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
}
```

#### 2.3.3 Payment
```typescript
interface Payment {
  id: string;
  taskId: string;
  from: string;          // Wallet address
  to: string;            // Wallet address
  amount: number;
  token: 'SOL' | 'USDC';
  purpose: string;       // e.g., "aura:sentiment_analysis"
  txSignature: string;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: Date;
}
```

### 2.4 Integration Points

#### 2.4.1 AgentWallet
- **Base URL:** `https://agentwallet.mcpay.tech/api`
- **Auth:** Bearer token in header
- **Key Endpoints:**
  - `GET /wallets/{username}/balances` - Check funds
  - `POST /wallets/{username}/actions/x402/fetch` - Execute paid API calls

**x402 Request Format:**
```typescript
POST /api/wallets/claw/actions/x402/fetch
{
  url: "https://specialist-api.example.com/execute",
  method: "POST",
  body: { ... },
  dryRun: false  // Set true to test without payment
}
```

#### 2.4.2 Helius RPC
- **Mainnet:** `https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY`
- **Devnet:** `https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY`
- **Credits:** 1,000,000 (sufficient for hackathon)

#### 2.4.3 Specialist Connections
| Specialist | Connection Type | Pricing |
|------------|-----------------|---------|
| Aura | x402 (external) | 0.01 USDC/call |
| Magos | x402 (external) | 0.02 USDC/call |
| bankr | Direct (Helius) | Gas only |

### 2.5 Dependencies

#### 2.5.1 Backend
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.16.0",
    "axios": "^1.6.5",
    "dotenv": "^16.3.1",
    "@solana/web3.js": "^1.89.1",
    "uuid": "^9.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/express": "^4.17.21",
    "@types/ws": "^8.5.10",
    "tsx": "^4.7.0"
  }
}
```

#### 2.5.2 Frontend
```json
{
  "dependencies": {
    "next": "^14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@xyflow/react": "^12.0.0",
    "lucide-react": "^0.312.0",
    "framer-motion": "^10.18.0",
    "socket.io-client": "^4.7.4"
  }
}
```

---

## 3. Sprint Plan (8 Days)

### Sprint 1: Days 1-2 (Feb 4-5)
**Theme: Foundation & Dispatcher Core**

| Priority | Task | Owner | Est. Hours | Deliverable |
|----------|------|-------|------------|-------------|
| P0 | Enhanced dispatcher with workflow planning | Backend | 4h | `dispatcher.ts` v2 |
| P0 | Specialist interface + stub implementations | Backend | 3h | `ISpecialist` interface |
| P0 | WebSocket server for real-time updates | Backend | 3h | `/ws` endpoint |
| P0 | Basic prompt classification (LLM integration) | Backend | 4h | `classifier.ts` |
| P1 | Task persistence (in-memory store) | Backend | 2h | `taskStore.ts` |
| P1 | Project setup: Next.js + React Flow | Frontend | 3h | Scaffolded UI |

**Exit Criteria:**
- [ ] `/dispatch` accepts prompts and returns mock execution plans
- [ ] WebSocket broadcasts task status updates
- [ ] Frontend scaffolded with placeholder components

**Risk:** LLM classification latency → Mitigation: Use fast model (GPT-3.5-turbo) or rule-based fallback

---

### Sprint 2: Days 3-4 (Feb 6-7)
**Theme: x402 Payment Integration & Real Specialists**

| Priority | Task | Owner | Est. Hours | Deliverable |
|----------|------|-------|------------|-------------|
| P0 | AgentWallet balance check integration | Backend | 2h | `wallet.ts` |
| P0 | x402 payment execution flow | Backend | 4h | `x402.ts` |
| P0 | Real Aura specialist (sentiment API) | Backend | 4h | `specialists/aura.ts` |
| P0 | Real Magos specialist (prediction API) | Backend | 4h | `specialists/magos.ts` |
| P0 | Real bankr specialist (Helius + Jupiter) | Backend | 6h | `specialists/bankr.ts` |
| P1 | Payment event broadcasting | Backend | 2h | WebSocket payments |

**Exit Criteria:**
- [ ] 3-agent chain executes end-to-end
- [ ] At least 3 x402 payments complete successfully
- [ ] All payments visible in logs with tx signatures

**Risk:** x402 API failures → Mitigation: Implement retry logic + dry-run testing first

---

### Sprint 3: Days 5-6 (Feb 8-9)
**Theme: Command Center UI & Visualization**

| Priority | Task | Owner | Est. Hours | Deliverable |
|----------|------|-------|------------|-------------|
| P0 | Task input component with suggestions | Frontend | 3h | `TaskInput.tsx` |
| P0 | Swarm graph visualization (React Flow) | Frontend | 6h | `SwarmGraph.tsx` |
| P0 | Real-time WebSocket integration | Frontend | 3h | `useWebSocket.ts` hook |
| P0 | Wallet balance display | Frontend | 2h | `WalletPanel.tsx` |
| P0 | Payment activity feed | Frontend | 3h | `PaymentFeed.tsx` |
| P1 | Message log viewer (expandable) | Frontend | 2h | `MessageLog.tsx` |
| P1 | Dark theme + animations | Frontend | 2h | Polished styling |

**Exit Criteria:**
- [ ] Full user flow works: submit task → see graph animate → view results
- [ ] Payments appear in real-time feed
- [ ] UI is demo-ready (no placeholder content)

**Risk:** React Flow learning curve → Mitigation: Use simple custom nodes, reference examples

---

### Sprint 4: Days 7-8 (Feb 10-11)
**Theme: Polish, Testing, Demo Prep, Submission**

| Priority | Task | Owner | Est. Hours | Deliverable |
|----------|------|-------|------------|-------------|
| P0 | End-to-end testing (happy path) | All | 4h | Test report |
| P0 | Demo script rehearsal | All | 2h | Recorded run-through |
| P0 | Bug fixes from testing | All | 4h | Stable build |
| P0 | README + documentation | PM | 3h | `README.md` |
| P0 | Video demo recording | PM | 2h | 2-min video |
| P0 | Forum submission | PM | 1h | Hackathon post |
| P1 | Error handling improvements | Backend | 2h | Better UX on failures |
| P1 | Performance optimization | Backend | 2h | <60s latency target |

**Exit Criteria:**
- [ ] Demo runs 3x without failure
- [ ] Video recorded and uploaded
- [ ] Submission complete on forum before deadline

**Day 8 Buffer (Feb 11):**
- Morning: Final testing and fixes
- Afternoon: Record final demo video
- Evening: Submit to Colosseum

---

## 4. Demo Script

### 2-Minute Demo Flow

#### Opening (0:00 - 0:15)
**[Screen: CSN Command Center - clean, dark UI with glowing agent nodes]**

> "What if AI agents could discover, hire, and pay each other—autonomously? 
> Today, I'm showing you the Clawnker Specialist Network: the orchestration layer for Solana's agent economy."

#### The Problem (0:15 - 0:30)
**[Screen: Simple slide showing isolated agent icons]**

> "Right now, AI agents on Solana work in silos. A trading bot can't ask a sentiment agent for advice. There's no discovery, no coordination, no payment rail. We're changing that."

#### Live Demo - Task Submission (0:30 - 0:50)
**[Screen: Command Center input field]**

> "Let me show you. I'll ask our network to..."

**[Type prompt:]** 
*"Find the hottest trending meme coin on X, get a 4-hour price prediction, and if bullish, buy 0.05 SOL worth"*

**[Click Submit]**

> "Watch what happens."

#### Orchestration in Action (0:50 - 1:20)
**[Screen: Swarm graph animates - Dispatcher lights up]**

> "The Dispatcher analyzes my intent and creates a plan."

**[Graph shows: Dispatcher → Aura (glows)]**

> "First, it hires Aura for social sentiment. Notice the x402 payment—0.01 USDC just moved on-chain."

**[Payment appears in feed: "$0.01 USDC → Aura"]**

**[Graph shows: Aura → Magos (glows)]**

> "Aura found a trending token. Now Magos gets hired for price prediction."

**[Payment: "$0.02 USDC → Magos"]**

> "Magos says 78% confidence on +12% in 4 hours—bullish."

**[Graph shows: Magos → bankr (glows)]**

> "So bankr executes the trade via Jupiter."

**[Transaction signature appears]**

#### Results (1:20 - 1:40)
**[Screen: Task complete with summary]**

> "In under 60 seconds, three AI agents discovered each other, negotiated, and executed—all with real on-chain payments. 

> The wallet panel shows: 3 x402 transactions, $0.03 in agent services, plus the trade itself. Every step is verifiable on Solana."

#### Closing (1:40 - 2:00)
**[Screen: Architecture diagram]**

> "CSN isn't just another agent—it's infrastructure. 

> Any specialized agent can plug in, set a price, and earn. Any developer can access the network through a single API.

> We're building the connective tissue for a thousand specialized agents to work as one swarm.

> The future of Solana isn't just DeFi. It's autonomous, coordinated intelligence. And it's paying for itself.

> Thank you."

---

## 5. Risk Register

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R1 | x402 API down or rate-limited | Medium | Critical | Implement caching + retry logic; have pre-recorded backup for demo | Backend |
| R2 | Helius RPC latency spikes | Low | High | Use priority endpoints; pre-test before demo; fallback to devnet if needed | Backend |
| R3 | Specialist LLM calls slow (>10s) | Medium | High | Use faster models (GPT-3.5); implement streaming responses; cache common queries | Backend |
| R4 | Jupiter swap fails during demo | Medium | Critical | Pre-fund with demo token; test exact path; have backup swap amount | Backend |
| R5 | WebSocket disconnects in demo | Low | Medium | Auto-reconnect logic; fallback to polling; pre-warm connection | Frontend |
| R6 | React Flow graph doesn't animate smoothly | Medium | Medium | Pre-render states; use CSS transitions; test on demo hardware | Frontend |
| R7 | Team velocity slower than planned | Medium | High | Daily standups at 10am; cut P1 items if behind; focus on demo path | PM |
| R8 | AgentWallet insufficient funds | Low | Critical | Pre-fund before demo; monitor balance; have backup wallet | All |
| R9 | Solana network congestion | Low | Medium | Use priority fees; demo on devnet as fallback | Backend |
| R10 | Demo machine issues | Low | High | Test on exact demo machine; have backup laptop ready | PM |

### Contingency Plans

#### Plan B: Recorded Demo
If live demo fails, we have a pre-recorded video showing successful execution.
- Record successful run on Day 7
- Keep as backup, only use if live fails

#### Plan C: Devnet Fallback  
If mainnet is problematic:
- All tests work on devnet first
- Demo can run on devnet with same UX
- Just note "devnet for reliability" if needed

#### Demo Rehearsal Schedule
- **Day 6 PM:** First full run-through
- **Day 7 AM:** Record backup video
- **Day 7 PM:** Final rehearsal
- **Day 8 AM:** Pre-demo checks (balances, health)

---

## Appendix A: Configuration

### Environment Variables
```bash
# Backend .env
PORT=3000
AGENTWALLET_TOKEN=mf_YOUR_TOKEN_HERE
AGENTWALLET_USERNAME=claw
HELIUS_API_KEY=YOUR_HELIUS_API_KEY
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY
OPENAI_API_KEY=<for classification>

# Frontend .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
```

### AgentWallet Details
```json
{
  "username": "claw",
  "solanaAddress": "5xUugg8ysgqpcGneM6qpM2AZ8ZGuMaH5TnGNWdCQC1Z1",
  "evmAddress": "0x676fF3d546932dE6558a267887E58e39f405B135"
}
```

---

## Appendix B: Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Multi-agent chain | 3+ agents | Aura → Magos → bankr executes |
| x402 transactions | 5+ during demo | Count from AgentWallet logs |
| End-to-end latency | <60 seconds | Timestamp diff: submit → complete |
| Demo reliability | 3/3 successful | Rehearsal runs without failure |
| Judge wow factor | High | Visible real payments + real trade |

---

**Document Status:** Complete  
**Next Review:** Daily standups  
**Approval:** Ready for team implementation

---

*"We're not building another agent. We're building the economy agents will use."*
