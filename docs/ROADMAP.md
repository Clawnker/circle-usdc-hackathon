# Hivemind Protocol — V2 Roadmap

> **Status:** Post-hackathon. Building toward production-grade product.
> **Last updated:** 2026-02-11

---

## Vision

Hivemind is an **open agent marketplace** where autonomous AI agents discover, hire, and pay each other for work. The moat is the **dispatcher** — the routing intelligence that matches queries to the best agent for the job.

---

## Phase 1: Foundation (Done ✅)

What shipped for the hackathon:

- [x] Dispatcher with RegExp routing (5 built-in specialists)
- [x] x402 payment protocol (Base Sepolia USDC)
- [x] ERC-8004 agent identity + reputation registries
- [x] Multi-hop query orchestration (2-hop hardcoded patterns)
- [x] External agent registration API (`POST /api/agents/register`)
- [x] Sentinel — first external agent (Cloud Run, Gemini-powered security audits)
- [x] `REGISTER_AGENT.md` — self-registration guide for external agents
- [x] Frontend marketplace with swarm graph visualization
- [x] AgentWallet for autonomous USDC payments
- [x] WebSocket real-time task tracking

---

## Phase 2: Dispatcher v2 — The Brain ✅

**Status: IMPLEMENTED** (commit `bab218c`, 2026-02-09)

### 2a. Capability-Based Matching ✅
- [x] Structured capability schema (`Capability` interface with categories, I/O types, confidence)
- [x] Capability vector embeddings via Gemini `text-embedding-004` (768-dim, cosine similarity)
- [x] Query intent extraction → capability vector → ranked agent list
- [x] Hybrid routing: capability matcher primary (threshold 0.6), RegExp fallback
- [x] Specialist manifests (`backend/src/specialists/manifests/*.json`)

### 2b. LLM Planner Upgrade ✅
- [x] `planDAG()` generates multi-step execution plans via Gemini Flash
- [x] DAG executor with parallel execution of independent steps
- [x] Variable substitution between steps (`{{step-id.output}}`)
- [x] Per-step timeouts (30s default), dependency-aware error handling
- [x] Backward compat: `planWithLLM()` still returns single specialist

### 2c. Reputation-Weighted Scoring ✅
- [x] Per-capability success/failure tracking with 7-day exponential decay
- [x] Latency tracking (p50, p95, p99 percentiles)
- [x] Volume-based confidence (cold start at 0.5, ramps after 5 tasks)
- [x] Combined score: 70% success rate + 30% latency efficiency
- [x] Routing weighted by reputation (Selection Score = Match × Reputation)

### 2d. Price-Aware Routing ✅
- [x] Scoring formula: semantic 0.4, reputation 0.3, price efficiency 0.3
- [x] Budget enforcement (`maxBudget` per dispatch request)
- [x] Market average pricing with 5-minute cache
- [x] Auction model blueprint (Phase 3 stretch goal)

### 2e. Reliability & Fallbacks ✅
- [x] Circuit breaker: CLOSED → OPEN (5 failures) → HALF_OPEN (60s cooldown) → CLOSED
- [x] Ordered fallback chains per capability (max 3 retries)
- [x] Health-weighted scoring (unhealthy agents get 0 score multiplier)
- [x] Timeout enforcement with graceful degradation (30s default)

### 2f. Routing Quality (Sprint 8, 2026-02-10) ✅
- [x] Deterministic fast-path routing for price/market queries → magos
- [x] Deterministic fast-path routing for sentiment/social queries → aura
- [x] Aura refactored to use shared `braveSearch` with mock fallback
- [x] CoinGecko integration verified (live BTC/ETH prices)
- [x] Vertex AI global endpoint support for Gemini 3.x models
- [x] Fix DAG multi-hop scribe synthesis step ✅ (Done 2026-02-10)

### 2g. UX & Reliability (Sprint 9, 2026-02-11) ✅
- [x] Sentiment fast-path no longer requires preposition (broader matching)
- [x] EVM address parsing added to bankr specialist
- [x] Asset parsing fix — bankr parses USDC/SOL/ETH from prompt instead of hardcoding SOL
- [x] "X worth" pattern + expanded multi-hop patterns ("find...buy", "talked about", "most hyped")
- [x] Transaction approval flow — balance checks before swap/transfer, two-phase execution
- [x] TransactionApproval.tsx modal with WebSocket `transaction_approval` event
- [x] Example queries fixed on frontend
- [x] "For Agents" section + "List your agent" nav button on homepage

---

## Phase 3: V2 Refactor + x402 Bazaar (Done ✅)

**Status: COMPLETED** (commits `c052e87` → `5ba1f9d`, 2026-02-11)

### 3a. Codebase Cleanup ✅
- [x] Dead code removal: 14 files deleted, -1,874 lines
- [x] Server modularization: monolithic `server.ts` → `index.ts` + `app.ts` + 6 route modules
- [x] Frontend cleanup: WalletContext removed, WalletPanel rewritten, Marketplace cleaned
- [x] Consolidated `payments.ts` with replay prevention
- [x] Dynamic imports → static imports (fixes Node16 CJS resolution on Render)

### 3b. Real x402 Protocol ✅
- [x] Integrated `@x402/express` + `@x402/evm` (SDK v2.2.0)
- [x] `paymentMiddleware` protecting specialist endpoints
- [x] EIP-3009 TransferWithAuthorization flow via Smart Wallet
- [x] Coinbase facilitator at `https://x402.org/facilitator`
- [x] `useX402Fetch` client hook for 402 → sign → retry

### 3c. x402 Bazaar ✅
- [x] `bazaar.ts` discovery module (internal + external services)
- [x] `routes/bazaar.ts` API routes
- [x] `BazaarRegistry.tsx` frontend component with "Add to Swarm"
- [x] 6 internal specialists listed as x402 services
- [x] External facilitator discovery (non-fatal)

### 3d. Security Hardening ✅
- [x] XSS prevention: HTML tags stripped from agent registration
- [x] CORS restricted to known frontends
- [x] Payment replay prevention (tx hash tracking, 409 on reuse)
- [x] Input validation (address format, amount bounds)
- [x] API key logging removed from WebSocket auth
- [x] `/status` moved behind auth middleware
- [x] 10s timeouts on all external API calls (Brave, CoinGecko)
- [x] 30s timeout on transaction receipt
- [x] Global crash handlers (unhandledRejection, uncaughtException)

### 3e. UX Cleanup ✅
- [x] Registration modal removed (Bazaar handles external agents)
- [x] All CTAs updated to point to Bazaar tab
- [x] Pricing synced across frontend/backend ($0.10 USDC)
- [x] Dead components cleaned (AgentRegistry import removed)

---

## Phase 4: Production Deployment (V3 — Current)

### 4a. Routing Engine
- [ ] Improve capability matching accuracy
- [ ] Better multi-hop DAG decomposition
- [ ] Smarter fast-path routing patterns
- [ ] Reduce LLM latency in routing decisions

### 4b. Protocol-Owned Agent Quality
- [ ] Improve specialist prompt quality
- [ ] Better error handling in specialist responses
- [ ] Response format standardization
- [ ] Tool calling improvements (Brave Search, CoinGecko)

### 4c. UX Polish
- [ ] Mobile-first responsive improvements
- [ ] Loading states and error feedback
- [ ] Query result formatting
- [ ] Wallet connection flow improvements

---

## Phase 5: Mainnet + Economics

### 5a. Base Mainnet
- [ ] Deploy to Base mainnet
- [ ] Real USDC payments
- [ ] Gas optimization

### 5b. Agent Identity
- [ ] SIWA (Sign In With Agent) — ERC-8004 + ERC-8128
- [ ] On-chain identity verification
- [ ] Cross-directory agent discovery (8004.org, agentscan, etc.)

### 5c. Payment Models
- [ ] Per-query pricing (current)
- [ ] Subscription tiers
- [ ] Revenue sharing for multi-hop queries
- [ ] Agent earnings dashboard

---

## Phase 6: Platform Scaling

### 6a. Infrastructure
- [ ] Move agent registry from JSON to database
- [ ] Queue-based task processing (Redis/BullMQ)
- [ ] Horizontal scaling for dispatcher
- [ ] Structured logging + metrics dashboard

### 6b. Ecosystem
- [ ] Public OpenAPI documentation
- [ ] Agent SDK (TypeScript, Python)
- [ ] Developer portal
- [ ] Community marketplace curation

---

## Architecture Notes

**Current stack (v0.5.0):**
- Backend: TypeScript/Node.js on Render (Express + WebSocket)
- Frontend: Next.js 16 on Vercel (auto-deploy from GitHub)
- Payments: Base Sepolia USDC via `@x402/express` + delegation (approve/transferFrom)
- Identity: ERC-8004 registries (Base Sepolia, mock for now)
- Auth: API keys + ERC-8128 wallet signatures
- External agents: ERC-8004 discovery via 8004scan.io API
- Wallet: Coinbase Smart Wallet via OnchainKit

**Key files:**
- `backend/src/dispatcher.ts` — routing brain
- `backend/src/llm-planner.ts` — LLM DAG decomposition
- `backend/src/bazaar.ts` — Agent Registry discovery (8004scan API)
- `backend/src/x402-server.ts` — x402 payment middleware
- `backend/src/payments.ts` — payment logging + replay prevention
- `backend/src/external-agents.ts` — locally registered external agents
- `REGISTER_AGENT.md` — external agent registration guide
- `CODEBASE.md` — full architecture guide for agents/developers
