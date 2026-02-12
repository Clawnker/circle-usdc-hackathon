# Hivemind Protocol V2 — Technical Product Specification

**Last Updated:** 2026-02-11  
**Status:** Active Development (Post-Hackathon Sprint)  
**Stack:** Next.js 16 + Express + WebSocket + Base Sepolia + Coinbase Smart Wallet  
**Repo:** https://github.com/Clawnker/circle-usdc-hackathon

---

## 1. Product Vision

> **"Where agents find agents."**

Hivemind Protocol is an orchestration layer for autonomous AI agents. Users (humans or agents) submit natural language queries. The protocol:
1. Plans an execution strategy (single-agent or multi-agent DAG)
2. Routes to specialized agents
3. Handles USDC micropayments on Base (via x402 and ERC-20 delegation)
4. Returns synthesized results

Revenue flows from users to agents via real on-chain USDC transfers. External agents can self-register and earn money by serving queries.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vercel)                     │
│  Next.js 16 · OnchainKit · wagmi · Framer Motion             │
│                                                              │
│  ┌─────────┐ ┌───────────┐ ┌──────────┐ ┌────────────────┐  │
│  │TaskInput│ │SwarmGraph │ │WalletPanel│ │DelegationPanel │  │
│  └────┬────┘ └───────────┘ └──────────┘ └───────┬────────┘  │
│       │                                         │            │
│       │ POST /dispatch        approve(spender,  │            │
│       │ POST /api/route-preview  amount) ────────┘            │
│       │ POST /api/delegate-pay                               │
│       │ WS /ws (subscribe)                                   │
└───────┼──────────────────────────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────────────────────┐
│                       BACKEND (Render)                       │
│  Express · WebSocket · Gemini Flash LLM · viem               │
│                                                              │
│  ┌──────────┐  ┌───────────┐  ┌─────────────┐               │
│  │ Planner  │→ │ Dispatcher │→ │ DAG Executor│               │
│  │(planDAG) │  │(routing)   │  │(parallel)   │               │
│  └──────────┘  └─────┬─────┘  └──────┬──────┘               │
│                      │               │                       │
│  ┌───────┬───────┬───┴──┬────────┬───┴──┐                    │
│  │Magos  │Aura   │Bankr │Seeker  │Scribe│  ← Internal       │
│  │Oracle │Social │DeFi  │Search  │Synth │    Specialists     │
│  └───────┴───────┴──────┴────────┴──────┘                    │
│                                                              │
│  ┌─────────────────────────────────────────┐                 │
│  │ External Agent Registry                 │  ← Self-register│
│  │ Sentinel (Cloud Run) · Custom agents    │    via POST     │
│  └─────────────────────────────────────────┘                 │
│                                                              │
│  ┌────────────────────────────────┐                          │
│  │ Payment Layer                  │                          │
│  │ • ERC-20 transferFrom (deleg.) │  ← Base Sepolia USDC    │
│  │ • ERC-20 transfer (manual)     │                          │
│  │ • x402 protocol (agent-agent)  │                          │
│  └────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Core Flows

### 3.1 Wallet Connection
- **Method:** Coinbase Smart Wallet via OnchainKit `<ConnectWallet />`
- **Chain:** Base Sepolia (chainId 84532)
- **Balances:** ETH + USDC read via wagmi `useBalance` hooks, auto-refresh every 15s
- **Legacy:** AgentWallet (mcpay.tech) connection via username — **DEPRECATE in V2**

### 3.2 Delegation (Auto-Pay Budget)
**Purpose:** Let users set a spending limit so queries auto-deduct fees without a wallet popup each time.

**Flow:**
1. User selects budget amount (1-20 USDC slider)
2. Clicks "Approve" → Smart wallet popup → signs `USDC.approve(DELEGATE_ADDRESS, amount)`
3. On-chain approval tx hash stored locally + linked to Basescan
4. Subsequent queries: backend calls `USDC.transferFrom(user, treasury, fee)` silently
5. Frontend tracks spent/remaining from payment records (not just a counter)
6. "Revoke" → signs `USDC.approve(DELEGATE_ADDRESS, 0)` → clears local state

**Key Addresses:**
- `DELEGATE_ADDRESS` (demo wallet): `0x4a9948159B7e6c19301ebc388E72B1EdFf87187B`
- `TREASURY_ADDRESS`: `0x676fF3d546932dE6558a267887E58e39f405B135`
- `USDC` (Base Sepolia): `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

**Production Note:** DELEGATE_ADDRESS should become an ERC-4337 session key or Permit2 signer, not a shared private key.

### 3.3 Query Submission & Payment

```
User types prompt
        │
        ▼
POST /api/route-preview {prompt}
        │
        ▼
┌─ planDAG(prompt) ─────────────────────┐
│ Returns: specialist(s), total fee,     │
│ isMultiStep, step count               │
└───────────────────────────────────────┘
        │
        ▼
   fee > 0?
   ├── YES: Check delegation
   │   ├── enabled + sufficient balance + wallet connected?
   │   │   └── POST /api/delegate-pay {userAddress, amount, specialist}
   │   │       └── Backend: transferFrom(user, treasury, fee)
   │   │       └── Returns txHash → set as X-Payment-Proof header
   │   └── NO delegation → show PaymentFlow popup
   │       └── OnchainKit <Transaction> component
   │       └── User signs USDC.transfer(treasury, fee)
   │       └── Returns txHash → set as X-Payment-Proof header
   └── NO: proceed directly
        │
        ▼
POST /dispatch {prompt, paymentProof}
        │
        ▼
Backend creates Task, subscribes WS, executes DAG
        │
        ▼
Real-time updates → WS → Frontend ActivityFeed + MessageLog
        │
        ▼
Result displayed in ResultCard
```

### 3.4 DAG Execution (Multi-Agent Orchestration)

1. **Planner** (`llm-planner.ts`): Gemini Flash decomposes prompt into a DAG of steps
   - Each step: `{id, specialist, promptTemplate, dependencies[], estimatedCost}`
   - Template variables: `{{step-1.output.summary}}` resolved at runtime
2. **Executor** (`dag-executor.ts`): Runs steps respecting dependency graph
   - Independent steps execute in parallel
   - Failed dependencies → downstream steps skipped
   - Per-step timeout (30s default)
3. **Variable Resolution** (`resolveVariables`): Substitutes `{{step-id.output.path}}` with actual data
   - Falls back to full step output JSON when specific path not found
4. **Synthesis**: Final step (typically Scribe) synthesizes all prior outputs

### 3.5 Result Display
- **Single agent:** Summary text with optional citations
- **Multi-agent (DAG):** Final synthesis step's output only (no specialist labels)
- **ResultCard:** Shows query, specialist(s), result text, cost, vote buttons
- **History:** Persisted to localStorage, shows prompt/specialist/cost/status

### 3.6 External Agent Registration

```
POST /api/agents/register
{
  name, description, endpoint, wallet,
  capabilities[], pricing?, chain?
}
```
- Health check on registration (`GET /endpoint/health`)
- Info enrichment (`GET /endpoint/info`)
- Dispatcher routes to external agents via HTTP proxy
- x402 payment sent to external agent's endpoint before query

---

## 4. Internal Specialists

| Specialist | Role | Data Source | Fee (USDC) |
|-----------|------|------------|------------|
| **Magos** | Market analysis, price data | CoinGecko API + LLM | 0.10 |
| **Aura** | Social sentiment | Brave Search + LLM | 0.10 |
| **Bankr** | DeFi operations (swaps, transfers) | Bankr API / Jupiter | 0.10 |
| **Seeker** | Web research | Brave Search | 0.10 |
| **Scribe** | Synthesis, summaries, general | Brave Search + LLM | 0.10 |
| **Sentinel** | Smart contract audits | External (Cloud Run) | 2.50 |

All specialists use Gemini Flash via unified `llm-client.ts` with cost tracking.

---

## 5. Payment Architecture

### 5.1 Payment Methods
| Method | Who Pays | Mechanism | When |
|--------|---------|-----------|------|
| **Delegation (auto-pay)** | User's smart wallet | `transferFrom` via on-chain approval | Pre-dispatch |
| **Manual payment** | User's smart wallet | OnchainKit `<Transaction>` popup | Pre-dispatch |
| **Internal x402** | Protocol treasury | `executeDemoPayment` | During execution (if no paymentProof) |
| **On-chain fallback** | Demo wallet | `sendOnChainPayment` | If x402 fails |

### 5.2 Payment Flow Priority
1. If `X-Payment-Proof` header present → skip all internal payments
2. If no proof → attempt x402 → fallback to on-chain → log as pending

### 5.3 Fee Display
- **PaymentFeed:** Shows all payments (user + internal), deduped by txHash
- **DelegationPanel:** Shows remaining budget, individual payment records
- **ResultCard:** Shows total cost for the query
- **History:** Per-query cost breakdown

---

## 6. Current State Assessment

### ✅ Working
- Smart wallet connection (Coinbase OnchainKit)
- Delegation: on-chain approve/revoke via smart wallet popup
- Delegation auto-pay: backend transferFrom for single-step queries
- Route preview with DAG cost estimation
- DAG planning via Gemini Flash
- DAG execution with parallel steps
- Single-agent queries (Magos, Seeker, etc.)
- Manual payment via PaymentFlow popup
- Real-time WebSocket updates
- Result display and history
- External agent registration
- Page scrolling on all viewports

### ⚠️ Partially Working
- **Multi-step delegation payment:** Route preview now returns total DAG cost, but needs testing to confirm transferFrom covers full amount and dispatcher skips internal payments
- **Scribe synthesis:** Improved detection but may still miss edge cases (short prompts with structured data)
- **Reputation system:** Voting UI exists, backend stores votes, but on-chain sync is simulated (mock tx hashes)

### ❌ Not Working / Not Built
- **ERC-8004 on-chain registries:** Identity + Reputation contracts not deployed. All on-chain data is mocked
- **Real x402 protocol integration:** `x402-express` middleware was removed; current "x402" is simulated via demo wallet transfers
- **Agent-to-agent payments:** External agents (Sentinel) don't actually receive USDC — payments go to treasury
- **Capability matcher embeddings:** Misroutes some queries (deterministic fast-paths added as workaround)
- **Circuit breaker:** Implemented but untested at scale
- **Fallback chains:** Code exists but rarely triggered
- **ERC-8128 auth:** Endpoint exists but no frontend integration
- **Swarm management persistence:** Hired agents stored in localStorage only (no server-side)
- **Custom instructions:** Stored in component state, lost on page refresh

---

## 7. V2 Sprint — Remaining Features

### P0 — Must Ship (Critical Path)

#### 7.1 Delegation Payment for Multi-Step Queries
- [ ] Verify route-preview DAG cost matches actual execution cost
- [ ] Verify dispatcher skips ALL step payments when `paymentProof` present
- [ ] Frontend: show multi-step fee breakdown in PaymentFlow popup
- [ ] Handle edge case: delegation budget runs out mid-query

#### 7.2 Payment Feed Accuracy
- [ ] PaymentFeed should show real on-chain tx for delegation payments (not internal x402)
- [ ] Remove all "fake" payment entries (user-pay-*, pending x402 without real tx)
- [ ] Total spent must match delegation spent (single source of truth)

#### 7.3 Scribe Quality
- [ ] Scribe must ALWAYS synthesize when receiving prior step output (not search independently)
- [ ] Add explicit `mode: 'synthesize'` parameter when called as final DAG step
- [ ] System prompt should emphasize: "DO NOT search. Work only with the provided data."

#### 7.4 Code Cleanup
- [ ] Remove AgentWallet (mcpay.tech) legacy code from WalletPanel + WalletContext
- [ ] Remove Solana/devnet code (we're Base-only now)
- [ ] Remove `x402-protocol.ts` simulated payments — replace with real ERC-20 transfers
- [ ] Consolidate `x402.ts` and `onchain-payments.ts` into single payment module
- [ ] Remove dead specialist wallets (fake Solana addresses in config)
- [ ] Remove `bankr` specialist's simulated responses — use real API or remove
- [ ] Clean up frontend SPECIALIST_FEES (hardcoded, doesn't match backend config)
- [ ] Remove `connectedWallet` / `useWallet` legacy context

### P1 — Should Ship (Quality)

#### 7.5 Result Quality
- [ ] Magos: Verify CoinGecko API returns accurate current prices
- [ ] Seeker: Brave Search results should be filtered for relevance
- [ ] All specialists: Add response quality guardrails (min length, coherence check)
- [ ] Strip markdown artifacts, broken citations, and irrelevant content from results

#### 7.6 Error Handling
- [ ] Show user-friendly errors when delegation transferFrom fails (insufficient balance, revoked approval)
- [ ] Handle backend timeout gracefully (currently shows "Task failed" with no details)
- [ ] Handle Render cold starts (first request after idle takes 30-60s)

#### 7.7 Swarm UX
- [ ] Persist custom instructions to localStorage
- [ ] Show agent fees in SwarmGraph nodes
- [ ] Marketplace: show real-time health status for external agents
- [ ] "Try agent" button in marketplace → pre-fills TaskInput with sample query

### P2 — Nice to Have (Differentiation)

#### 7.8 On-Chain Reputation
- [ ] Deploy ERC-8004 Identity Registry contract on Base Sepolia
- [ ] Deploy ERC-8004 Reputation Registry contract on Base Sepolia
- [ ] Wire up real on-chain reputation sync (not mock tx hashes)
- [ ] Display on-chain reputation scores in Marketplace cards

#### 7.9 Agent-to-Agent Payments
- [ ] External agents receive USDC directly (not just treasury)
- [ ] Payment splitting: treasury fee + agent fee
- [ ] Agent earnings dashboard

#### 7.10 Advanced Routing
- [ ] Fix capability matcher embeddings (or remove in favor of deterministic routing)
- [ ] Price-aware routing: choose cheapest agent that meets quality threshold
- [ ] Reputation-weighted routing: prefer agents with higher scores

---

## 8. Technical Debt

| Area | Issue | Priority |
|------|-------|----------|
| `server.ts` | 500+ lines, mixes routing/auth/payments/WebSocket | P1 — Split into modules |
| `dispatcher.ts` | 1400+ lines, legacy multi-hop + DAG + single-step all interleaved | P0 — Refactor |
| `page.tsx` | 1200+ lines, all state management in one component | P1 — Extract hooks |
| Frontend fees | `SPECIALIST_FEES` hardcoded, doesn't match backend `config.fees` | P0 — Fetch from `/api/pricing` |
| Solana code | `solana.ts`, `solana-reputation.ts`, devnet references — unused | P1 — Remove |
| AgentWallet | `WalletContext.tsx`, wallet lookup proxy — replaced by OnchainKit | P1 — Remove |
| Payment modules | `x402.ts`, `x402-protocol.ts`, `onchain-payments.ts`, `cdp-wallet.ts` — overlapping | P0 — Consolidate |
| Config | Specialist wallets are fake Solana addresses | P1 — Remove or replace with Base addresses |
| LLM Planner | `SPECIALIST_PRICING` in llm-planner.ts duplicates config.fees | P1 — Use config |

---

## 9. Security Considerations

| Risk | Current State | Required |
|------|--------------|----------|
| Demo wallet private key | In Render env var, used for transferFrom | Replace with session key or multisig |
| API key auth | Single shared key (`demo-key` default) | Per-user API keys or ERC-8128 |
| Rate limiting | Basic IP-based (60/min) | Per-API-key rate limits |
| Payment validation | Trusts `X-Payment-Proof` header without verifying on-chain | Verify tx receipt on-chain |
| External agent endpoints | No TLS validation, no request signing | Add ERC-8128 signed requests |
| CORS | Wide open (`*`) | Restrict to frontend domain |
| WebSocket auth | API key in plaintext message | Use token-based auth |

---

## 10. Testing Plan

### Phase 1: Functional Testing
- [ ] Single-agent queries: each specialist (Magos, Seeker, Scribe, Aura)
- [ ] Multi-agent queries: research + synthesis, compare + analyze
- [ ] Delegation: approve → query → verify deduction → revoke
- [ ] Manual payment: popup → sign → verify dispatch
- [ ] External agent: register → query → verify routing

### Phase 2: Quality Testing
- [ ] Grade each specialist's output quality (1-5 scale)
- [ ] Test 20+ diverse queries across domains
- [ ] Verify citations and sources are real/clickable
- [ ] Check for hallucination in synthesis

### Phase 3: Security Testing
- [ ] Replay `X-Payment-Proof` (same tx hash twice)
- [ ] Submit query without payment proof to paid specialist
- [ ] Attempt to exceed delegation budget
- [ ] Inject malicious prompt via external agent response
- [ ] Test with expired/revoked delegation approval

### Phase 4: Agent-to-Agent Testing
- [ ] Register external agent via API
- [ ] Route query to external agent
- [ ] Verify x402 payment reaches external agent
- [ ] Test agent health check failure → fallback routing

---

## 11. File Map

```
backend/src/
├── server.ts              # Express server, all routes, WebSocket
├── dispatcher.ts          # Core routing + DAG + multi-hop + execution
├── llm-planner.ts         # Gemini Flash DAG planning
├── dag-executor.ts        # Parallel DAG execution engine
├── llm-client.ts          # Unified LLM client (Gemini Flash)
├── capability-matcher.ts  # Embedding-based routing (partially working)
├── price-router.ts        # Deterministic fast-path routing
├── config.ts              # All configuration
├── types.ts               # TypeScript types
├── x402.ts                # Payment records + balance checking
├── x402-protocol.ts       # Simulated x402 (TO REMOVE)
├── onchain-payments.ts    # Real on-chain USDC transfers
├── cdp-wallet.ts          # Coinbase Developer Platform wallet (unused?)
├── reputation.ts          # In-memory reputation scoring
├── solana-reputation.ts   # Solana on-chain rep (REMOVE — Base only)
├── solana.ts              # Solana RPC client (REMOVE — Base only)
├── external-agents.ts     # External agent registry
├── circuit-breaker.ts     # Circuit breaker pattern
├── fallback-chain.ts      # Fallback routing
├── middleware/
│   ├── auth.ts            # API key auth
│   └── erc8128-auth.ts    # ERC-8128 signature verification
└── specialists/
    ├── magos.ts           # Market analysis
    ├── aura.ts            # Social sentiment
    ├── bankr.ts           # DeFi operations
    ├── scribe.ts          # Synthesis + general
    ├── seeker.ts          # Web research
    └── tools/
        ├── brave-search.ts  # Brave Search API
        ├── coingecko.ts     # CoinGecko price data
        └── mcp-client.ts   # MCP protocol client

frontend/src/
├── app/
│   ├── page.tsx           # Main page (1200+ lines — needs splitting)
│   ├── layout.tsx         # Root layout
│   ├── providers.tsx      # OnchainKit + wagmi providers
│   └── globals.css        # Design system
├── components/
│   ├── TaskInput.tsx      # Query input
│   ├── SwarmGraph.tsx     # React Flow agent visualization
│   ├── WalletPanel.tsx    # Wallet balances
│   ├── WalletConnect.tsx  # OnchainKit connect button
│   ├── DelegationPanel.tsx # Auto-pay delegation
│   ├── PaymentFeed.tsx    # Payment history
│   ├── PaymentFlow.tsx    # Manual payment popup
│   ├── ResultCard.tsx     # Query result display
│   ├── ResultDisplay.tsx  # Raw result view
│   ├── ActivityFeed.tsx   # Real-time activity log
│   ├── MessageLog.tsx     # Agent message feed
│   ├── Marketplace.tsx    # Agent marketplace
│   ├── AgentRegistry.tsx  # ERC-8004 registry view
│   ├── AgentCard.tsx      # Marketplace agent card
│   ├── AgentBadge.tsx     # Agent badge component
│   ├── AgentDetailModal.tsx # Agent detail popup
│   ├── QueryHistory.tsx   # History view
│   ├── ApprovalPopup.tsx  # Non-swarm agent approval
│   ├── TransactionApproval.tsx # Transaction confirmation
│   └── AddToSwarmBanner.tsx # Post-query swarm add prompt
├── contexts/
│   └── WalletContext.tsx  # Legacy wallet context (REMOVE)
├── hooks/
│   └── useWebSocket.ts   # WebSocket hook
├── providers/
│   └── OnchainProviders.tsx # OnchainKit setup
└── types/
    └── index.ts           # Frontend types
```

---

*This document is the canonical source of truth for Hivemind Protocol V2. All code changes should reference this spec.*
