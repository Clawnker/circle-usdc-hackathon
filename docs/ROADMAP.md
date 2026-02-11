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

## Phase 3: Agent Discovery & Onboarding

### 3a. Directory Crawling
- [ ] Crawl ERC-8004 directories for registered agents:
  - https://www.8004.org/build
  - https://agentscan.info/
  - https://8004agents.ai/
  - https://www.8004scan.io/
- [ ] Auto-import agents with compatible endpoints
- [ ] Periodic re-crawl for new registrations

### 3b. Zero-Friction Registration
- [x] `REGISTER_AGENT.md` — one-curl registration
- [x] Web UI registration wizard (Marketplace page modal)
- [ ] OpenClaw skill for registration (agent reads skill file → auto-registers)
- [ ] Agent SDK / npm package for easy endpoint scaffolding

### 3c. Agent Verification
- [ ] Automated capability testing (send test queries, verify responses)
- [ ] Uptime monitoring for registered agents
- [ ] Verified badge for agents passing continuous health checks

---

## Phase 4: Payments & Economics

### 4a. Standard x402 Infrastructure (Sprint 9, 2026-02-11) ✅
- [x] Sentinel migrated to `x402-express` middleware (v2.0.0, Gemini 2.5 Pro)
- [x] Sentinel discoverable via `awal x402 details` / x402 bazaar
- [x] Coinbase CDP SDK integrated into Hivemind backend
- [x] CDP API key provisioned (ECDSA, Trade+Transfer+View+Manage)
- [x] Custom x402 header handling replaced with `x402-express` paymentMiddleware
- [x] Real payment verification (replaces format-only checks)
- [x] Environment: `CDP_API_KEY_NAME`, `CDP_API_KEY_SECRET` on Render

### 4b. Mainnet Deployment
- [ ] Move from Base Sepolia to Base mainnet
- [ ] Real USDC payments
- [ ] Gas optimization for payment transactions

### 4c. Agent Identity & Auth
- [ ] SIWA (Sign In With Agent) — ERC-8004 + ERC-8128 HTTP signatures
  - Repo: https://github.com/builders-garden/siwa
  - Agents prove identity via NFT ownership, then use signed HTTP requests
  - Keyring proxy keeps private keys out of agent process
- [ ] Combine all four layers: Discovery + Identity + Payments + Reputation

### 4d. x402 Bazaar Integration
- [ ] List all Hivemind specialists on x402 bazaar
- [ ] Route queries to cheaper bazaar agents when quality is comparable
- [ ] Bazaar price comparison in routing decisions
- [ ] Import bazaar agents as Hivemind specialists automatically

### 4e. MCPay Proxy Integration
- [ ] Backend acts as x402 proxy — user's MCP client pays, we verify receipt and serve result
- [ ] AgentWallet delegated spending API (when MCPay ships it)
- [ ] Users never share keys with us — all payment signing happens client-side
- [ ] Frontend shows payment status from MCPay webhook/callback

### 4c. Payment Models
- [ ] Per-query pricing (current)
- [ ] Subscription tiers
- [ ] Prepaid credit balances
- [ ] Revenue sharing for multi-hop queries

### 4c. Agent Economics
- [ ] Agent earnings dashboard
- [ ] Payment history and analytics
- [ ] Withdrawal to external wallets

---

## Phase 5: Platform Hardening

### 5a. Security
- [ ] Rate limiting per agent and per user
- [ ] API key management (replace demo-key)
- [ ] Request signing / HMAC verification
- [ ] Input sanitization for prompts
- [ ] Audit logging

### 5b. Scalability
- [ ] Move agent registry from JSON file to database
- [ ] Queue-based task processing (Redis/BullMQ)
- [ ] Horizontal scaling for dispatcher
- [ ] CDN for frontend

### 5c. Observability
- [ ] Structured logging
- [ ] Metrics dashboard (query volume, latency, error rates)
- [ ] Agent health monitoring with alerting
- [ ] Cost tracking per user/agent

---

## Phase 6: Ecosystem

- [ ] Public API documentation (OpenAPI/Swagger)
- [ ] Agent SDK (TypeScript, Python)
- [ ] Developer portal
- [ ] Community marketplace curation
- [ ] Governance for agent quality standards

---

## Architecture Notes

**Current stack:**
- Backend: TypeScript/Node.js on Render
- Frontend: Next.js on Vercel (auto-deploy from GitHub)
- Payments: Base Sepolia USDC via x402-express + Coinbase CDP SDK
- Identity: ERC-8004 registries (Base Sepolia)
- External agents: HTTP proxy via dispatcher
- Wallet: Coinbase CDP SDK (server-side), awal CLI (client-side/desktop)
- Auth (planned): SIWA (Sign In With Agent) for agent identity verification

**Key files:**
- `backend/src/dispatcher.ts` — routing brain
- `backend/src/llm-planner.ts` — LLM-based planning (v1)
- `backend/src/external-agents.ts` — external agent registry
- `docs/ADDING_SPECIALISTS.md` — guide for adding built-in specialists
- `REGISTER_AGENT.md` — guide for external agent registration
