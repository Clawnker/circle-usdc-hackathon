# Hivemind Protocol — V3 Scope

> **Status:** Draft — scoped for implementation starting Feb 12, 2026
> **Baseline:** v0.6.0 (V2 Phase 3 complete, V2 Phase 4 partially started)
> **Goal:** Transform Hivemind from a working hackathon demo into a product someone would actually pay to use.

---

## What V3 Is NOT

V3 is **not** mainnet, scaling, or ecosystem. That's V4+.

V3 is about **quality**. Right now the demo works but the output is mid. Routing sometimes misroutes, specialist responses are generic, multi-hop queries time out, and the UX has rough edges. V3 fixes all of that.

---

## The Three Pillars

### 1. Specialist Quality Overhaul
### 2. Routing Intelligence v2
### 3. UX That Doesn't Suck

---

## Pillar 1: Specialist Quality Overhaul

**Problem:** Specialists return surface-level answers. Magos gives you a price and a generic "analysis." Aura does keyword counting instead of real sentiment. Bankr can't actually execute swaps. Scribe and Seeker are thin wrappers.

### 1a. Magos Rewrite — Real Market Intelligence
**Current state:** CoinGecko price fetch + LLM summary. Predictions are vibes.
**V3 target:** Data-backed analysis that a trader would find useful.

- [ ] **Multi-source price aggregation** — CoinGecko + Jupiter + DexScreener + Pyth
- [ ] **On-chain data integration** — Holder distribution, whale movements, DEX volume (via Helius/Birdeye)
- [ ] **Technical analysis** — Moving averages, RSI, support/resistance from price history
- [ ] **Structured output format** — Consistent JSON schema: `{ price, change24h, volume, sentiment, technicals, prediction, confidence, sources }`
- [ ] **Prediction tracking** — Log predictions, compare to actuals after 4h/24h, feed back into reputation
- [ ] **Polymarket integration** — Real odds for political/macro events, not mocked data

**Effort:** 4-6 hours
**Files:** `backend/src/specialists/magos.ts`, `backend/src/specialists/tools/coingecko.ts`, new `tools/dexscreener.ts`

### 1b. Aura Rewrite — Real Sentiment Engine
**Current state:** Brave Search + BULLISH_WORDS/BEARISH_WORDS word counting. Embarrassingly simple.
**V3 target:** LLM-powered sentiment analysis on real social data.

- [ ] **LLM-based sentiment scoring** — Feed search results to Gemini Flash for actual sentiment analysis (not word counting)
- [ ] **Source diversity** — Brave Search + Reddit API (free tier) + RSS feeds for crypto news
- [ ] **Entity extraction** — Identify which tokens/projects are mentioned, sentiment per entity
- [ ] **Trend detection** — Volume spike detection (compare current mentions vs 7-day average)
- [ ] **Structured output** — `{ topic, overallSentiment, score, sources[], entities[], trendDirection, volume }`
- [ ] **Kill the word lists** — Replace BULLISH_WORDS/BEARISH_WORDS with LLM classification

**Effort:** 3-4 hours
**Files:** `backend/src/specialists/aura.ts`, `backend/src/specialists/tools/brave-search.ts`

### 1c. Bankr — Transaction Simulation
**Current state:** Parses swap/transfer intents but can't execute. Returns "would execute" placeholders.
**V3 target:** Real transaction simulation with accurate quotes.

- [ ] **Jupiter quote integration** — Real swap quotes with slippage, price impact, route info
- [ ] **Balance verification** — Check actual on-chain balances before suggesting transactions
- [ ] **Gas estimation** — Accurate fee estimates for Base/Solana
- [ ] **Transaction builder** — Generate unsigned transactions that the frontend can sign
- [ ] **DCA support** — Generate DCA parameters (not just "here's a plan")

**Effort:** 4-5 hours
**Files:** `backend/src/specialists/bankr.ts`, new `backend/src/specialists/tools/jupiter.ts`

### 1d. Seeker — Deep Research Mode
**Current state:** Single Brave Search call + LLM summary.
**V3 target:** Multi-query research with source triangulation.

- [ ] **Multi-query expansion** — LLM generates 3-5 search queries from one prompt
- [ ] **Source ranking** — Score and deduplicate results across queries
- [ ] **Follow-up extraction** — Identify URLs worth fetching for deeper content
- [ ] **Citation format** — Numbered citations in output with source URLs
- [ ] **Recency filtering** — Prioritize recent results for time-sensitive queries

**Effort:** 2-3 hours
**Files:** `backend/src/specialists/seeker.ts`, `backend/src/specialists/tools/brave-search.ts`

### 1e. Scribe — Structured Output Templates
**Current state:** Generic LLM wrapper that could be any chatbot.
**V3 target:** Specialized synthesis that adds value over raw ChatGPT.

- [ ] **Multi-source synthesis** — When used in multi-hop, actually synthesize specialist outputs into coherent analysis
- [ ] **Report templates** — Market report, comparison report, risk assessment, research brief
- [ ] **Tone control** — Professional, casual, technical, executive summary
- [ ] **Markdown formatting** — Proper headers, tables, bullet points in output

**Effort:** 2 hours
**Files:** `backend/src/specialists/scribe.ts`

---

## Pillar 2: Routing Intelligence v2

**Problem:** Routing works for obvious queries but breaks on edge cases. Capability matcher embeddings sometimes misroute. DAG planner produces plans that time out. Fast-paths are fragile regex.

### 2a. Smarter Fast-Path Routing
**Current state:** Regex patterns for price→magos, sentiment→aura. Brittle, misses variations.
**V3 target:** LLM-classified intent with cached results.

- [ ] **Intent classifier** — Lightweight Gemini Flash call to classify intent into categories: `price | sentiment | trade | research | analysis | multi-hop`
- [ ] **Intent cache** — Cache classification results for similar queries (embedding similarity > 0.95)
- [ ] **Confidence threshold** — If classifier confidence < 0.7, fall through to capability matcher
- [ ] **Specialist override** — Honor `preferredSpecialist` field without LLM call

**Effort:** 3 hours
**Files:** `backend/src/dispatcher.ts`, new `backend/src/intent-classifier.ts`

### 2b. DAG Planner Reliability
**Current state:** LLM generates DAG plans that sometimes have circular deps, impossible variable references, or steps that time out.
**V3 target:** Validated, bounded DAG plans.

- [ ] **Plan validation** — Cycle detection, variable reference checking, step count limits (max 5 steps)
- [ ] **Timeout budget** — Total DAG timeout = 45s. Each step gets proportional share.
- [ ] **Streaming results** — Send partial results via WebSocket as each step completes (don't wait for full DAG)
- [ ] **Fallback to single-hop** — If DAG planning takes >3s, fall back to best single specialist
- [ ] **Plan caching** — Cache successful plans for similar queries (saves LLM call + latency)

**Effort:** 4 hours
**Files:** `backend/src/llm-planner.ts`, `backend/src/dag-executor.ts`, `backend/src/websocket.ts`

### 2c. External Agent Routing
**Current state:** External agents registered but never actually selected by the dispatcher unless explicitly named.
**V3 target:** External agents compete with internal specialists on equal footing.

- [ ] **Unified scoring** — External agents get capability embeddings on registration, scored same as internals
- [ ] **Health-gated routing** — Only route to externals that passed health check in last 5 minutes
- [ ] **Latency tracking** — Track external agent response times, penalize slow agents
- [ ] **Fallback to internal** — If external agent times out (10s), fall back to internal specialist

**Effort:** 3 hours
**Files:** `backend/src/dispatcher.ts`, `backend/src/external-agents.ts`, `backend/src/capability-matcher.ts`

---

## Pillar 3: UX That Doesn't Suck

**Problem:** Frontend works but feels like a hackathon project. Loading states are missing, errors are cryptic, mobile is janky, and the query flow has too many clicks.

### 3a. Query Flow Overhaul
**Current state:** Type query → wait → see result. No streaming, no progress, no intermediate feedback.
**V3 target:** Real-time query experience with streaming.

- [ ] **Streaming responses** — Server-Sent Events (SSE) for query results instead of polling
- [ ] **Step-by-step progress** — For multi-hop: show each step as it executes ("Asking Magos for price... Asking Aura for sentiment... Synthesizing...")
- [ ] **Error recovery UI** — Retry button, alternative query suggestions on failure
- [ ] **Query suggestions** — 3-4 contextual suggestions based on current market conditions
- [ ] **Keyboard shortcut** — Cmd+Enter to submit, Escape to clear

**Effort:** 4-5 hours
**Files:** `frontend/src/app/page.tsx`, `frontend/src/components/TaskInput.tsx`, `frontend/src/components/ResultDisplay.tsx`, `frontend/src/hooks/useWebSocket.ts`

### 3b. Result Cards Redesign
**Current state:** Raw JSON or plain text dump. No structure, no formatting.
**V3 target:** Beautiful, structured result cards per specialist.

- [ ] **Specialist-typed cards** — Different card layouts for price data vs sentiment vs research
- [ ] **Magos card** — Price chart mini-preview, key metrics (24h change, volume, market cap), confidence indicator
- [ ] **Aura card** — Sentiment gauge (bearish/neutral/bullish), source list, entity tags
- [ ] **Bankr card** — Transaction summary, fee breakdown, approve/reject buttons
- [ ] **Seeker card** — Citation list, key findings, source credibility indicators
- [ ] **Multi-hop card** — Step timeline showing flow between specialists

**Effort:** 5-6 hours
**Files:** `frontend/src/components/ResultCard.tsx`, new `frontend/src/components/cards/` directory

### 3c. Wallet & Payment UX
**Current state:** Delegation panel works but flow is confusing. Users don't understand approve→query→deduct.
**V3 target:** One-click payment experience.

- [ ] **Payment explainer** — Brief tooltip/modal explaining how x402 payments work
- [ ] **Balance display** — Show USDC balance and remaining delegation in header
- [ ] **Cost preview** — Show estimated cost before query execution
- [ ] **Receipt view** — After query, show payment receipt with tx hash link to BaseScan
- [ ] **Low balance warning** — Alert when delegation drops below $1

**Effort:** 3 hours
**Files:** `frontend/src/components/WalletPanel.tsx`, `frontend/src/components/DelegationPanel.tsx`, `frontend/src/components/PaymentFlow.tsx`

### 3d. Mobile Experience
**Current state:** Responsive-ish but navigation is cramped, graph doesn't resize, text overflows.
**V3 target:** Actually usable on a phone.

- [ ] **Bottom nav on mobile** — Move navigation to bottom sheet on small screens
- [ ] **Collapsible sidebar** — Swarm graph hidden by default on mobile, expandable
- [ ] **Touch-friendly inputs** — Larger tap targets, better keyboard handling
- [ ] **Result scroll** — Smooth scroll to results after query

**Effort:** 2-3 hours
**Files:** `frontend/src/app/page.tsx`, various components

---

## Implementation Order (Recommended)

**Day 1 — Morning (4h):**
1. **1b. Aura Rewrite** (3h) — Biggest embarrassment. Kill the word lists.
2. **1e. Scribe Templates** (1h) — Quick win for output quality.

**Day 1 — Afternoon (4h):**
3. **1a. Magos Rewrite** (4h) — Core product value. Multi-source data + structured output.

**Day 1 — Evening (3h):**
4. **2a. Smart Fast-Path** (2h) — Fixes misrouting without full rewrite.
5. **2b. DAG Reliability** (1h) — Just the validation + timeout budget. Streaming later.

**Day 2 — Morning (4h):**
6. **3a. Query Flow** (4h) — Streaming + progress indicators.

**Day 2 — Afternoon (4h):**
7. **3b. Result Cards** (4h) — Specialist-typed card layouts.

**Day 2 — Evening (3h):**
8. **1c. Bankr Simulation** (3h) — Real Jupiter quotes.
9. **1d. Seeker Deep Research** (2h) — Multi-query expansion.

**Day 3 — Polish (4h):**
10. **3c. Wallet UX** (2h) — Payment flow improvements.
11. **3d. Mobile** (2h) — Bottom nav + responsive fixes.
12. **2c. External Agent Routing** (if time) — Equal footing for externals.

**Total estimate:** ~38 hours across 3 days. Realistic for 2 agents working in parallel (Claw + sub-agent).

---

## Success Criteria

| Metric | Current | V3 Target |
|--------|---------|-----------|
| Simple query latency (p50) | ~3s | <2s |
| Multi-hop completion rate | ~60% | >90% |
| Magos response quality | Generic summary | Data-backed with sources |
| Aura sentiment accuracy | Word counting | LLM classification |
| Frontend load time | ~2s | <1.5s |
| Mobile usability | Cramped | Full-featured |
| User flow clicks (query → result) | 3-4 | 1-2 |

---

## What V3 Does NOT Include (Deferred to V4+)

- **Base Mainnet deployment** — Staying on Sepolia until quality is proven
- **Real money payments** — Demo USDC only
- **Database migration** — JSON files are fine at current scale
- **Agent SDK** — No external developer tooling yet
- **Horizontal scaling** — Single Render instance is fine for now
- **On-chain reputation** — Mock registries stay
- **Subscription model** — Per-query only

---

## Architecture Notes for Implementation

### Backend Changes
- New files: `intent-classifier.ts`, `tools/dexscreener.ts`, `tools/jupiter.ts`
- Modified: Every specialist file, `dispatcher.ts`, `llm-planner.ts`, `dag-executor.ts`
- No new dependencies needed (everything uses existing Gemini + fetch)

### Frontend Changes
- New directory: `components/cards/` (specialist-specific result cards)
- Modified: `page.tsx`, `TaskInput.tsx`, `ResultDisplay.tsx`, `WalletPanel.tsx`
- Consider: SSE hook replacing WebSocket for query streaming

### Testing Strategy
- Each specialist rewrite gets a manual test gauntlet (5 queries each)
- DAG planner gets unit tests for cycle detection + timeout
- Frontend: manual mobile testing on iPhone/Android viewport
- End-to-end: Full query → payment → result flow on staging

---

*Scoped by Claw 🦞 — Feb 12, 2026 00:40 EST*
