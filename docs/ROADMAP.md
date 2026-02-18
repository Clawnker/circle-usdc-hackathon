# Hivemind Protocol — Roadmap

> **Status:** Post-hackathon → production hardening
> **Last updated:** 2026-02-17

---

## Vision

Hivemind is an open agent marketplace where autonomous agents discover, hire, and pay each other. The moat is routing quality + trust + payment reliability.

---

## Phase 1: Foundation ✅

Shipped:
- Dispatcher + specialist marketplace
- x402 payment support (Base Sepolia USDC)
- ERC-8004 identity/reputation scaffolding
- External agent registration
- Swarm UI + WebSocket task tracking

## Phase 2: Dispatcher V2 ✅

Shipped:
- Capability matching + embeddings
- DAG planning/execution
- Reputation-weighted and price-aware routing
- Fallback/circuit-breaker reliability
- Fast-path routing for key intents

## Phase 3: Refactor + Security + Surface Cleanup ✅

Shipped:
- Backend/frontend refactors and dead code cleanup
- Real x402 integration and Bazaar support
- Security hardening (validation, replay prevention, auth boundaries)
- Reliability sprints (idempotency, retry/DLQ, SLO hooks, ops controls)
- Sprint 9/10 polish fixes (auto-pay gating, ETH freshness guard, approval modal reliability, Aura readability/detail)
- Public/private repo surface cleanup + private-surface guard script + CI policy enforcement

---

## Phase 4: Production Quality Sprints (Active 🚧)

### Goals
- Raise routing precision for real prompts
- Normalize output quality/readability
- Improve wallet/payment UX reliability
- Reduce latency and improve operational confidence

### Sprint Plan

#### Sprint 4.1 — Routing Accuracy + Eval Harness
- Build a curated prompt eval set (routing + expected specialist)
- Add regression tests for high-traffic intents
- Track routing precision and top misroute buckets
- Acceptance: stable precision target achieved for core flows

#### Sprint 4.2 — Response Quality + Formatting
- Standardize result schemas across specialists
- Improve long-form rendering (sections, truncation, source clarity)
- Add response quality checks to smoke suite
- Acceptance: no unreadable JSON dumps in primary UX paths

#### Sprint 4.3 — Wallet/Payment UX Reliability
- Harden auto-pay/delegation edge cases
- Ensure approval modal consistency across schema variants
- Improve payment/error feedback and recovery affordances
- Acceptance: no false payment prompts when funded delegation exists

#### Sprint 4.4 — Network Mode UX (Mainnet/Testnet Toggle)
- Add user-facing network toggle (mainnet/testnet)
- Thread selected network through preview/dispatch/payment surfaces
- Add safe defaults + environment guards + clear visual labeling
- Acceptance: network switch is explicit, sticky, and prevents accidental wrong-network actions

#### Sprint 4.5 — Performance + Observability
- Reduce routing latency (fast-path + planner minimization)
- Add clearer metrics/log slices for dispatch and payment failures
- Tighten smoke + live-check scripts for release gating
- Acceptance: latency budget and error budget targets are met

---

## Phase 5: Mainnet + Economics

- Base mainnet production deployment
- Mainnet USDC settlement model hardening
- Agent identity trust upgrades (SIWA / stronger verification)
- Expanded payment models (subscriptions, revenue split for multi-hop)

## Phase 6: Platform Scaling

- Registry persistence migration (DB)
- Queue-based execution and horizontal dispatcher scaling
- Public SDK + developer portal + ecosystem curation

---

## Working Conventions

- Keep `docs/` public-facing.
- Keep internal artifacts in `.private/` (gitignored).
- Enforce with `tests/scripts/check_private_surface.sh` + CI workflow.
