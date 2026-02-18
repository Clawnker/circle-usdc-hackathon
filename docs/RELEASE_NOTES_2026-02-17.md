# Release Notes — 2026-02-17

**Service:** Hivemind Protocol Backend (`circle-usdc-hackathon`)  
**Environment:** Production (Render)  
**Release commit:** `52fe38e`  
**Deployment status:** ✅ Live

---

## Highlights

This release completes the multi-sprint architecture hardening program (Sprints 1–8), focused on deterministic execution, reliability safety, operator controls, alert routing, and pre-prod refactor hygiene.

---

## Included changes

### Protocol + deterministic state
- Envelope normalization and parser improvements
- Deterministic ledger transition + invariants
- Envelope/ledger regression expansion

### Reliability foundations
- Idempotency and dedupe store wiring
- Ordering/causality metadata support
- Retry/backoff helper + DLQ foundation

### Security + rollout hardening
- Dispatch guard middleware for sensitive flows
- Optional strict auth and integrity checks
- Canary/kill-switch rollout controls
- SLO instrumentation with persistence

### Operator reliability surfaces
- `GET /api/ops/reliability/slo`
- `GET /api/ops/reliability/dlq`
- `POST /api/ops/reliability/dlq/replay`
- `GET /api/ops/reliability/dlq/replay-worker`
- `GET /api/ops/reliability/audit`

### Recovery automation
- Guardrailed DLQ replay worker
- Replay observability fields for operator debugging

### Ops safety + auditability
- Optional operator key enforcement (`x-ops-key`)
- Optional non-public auth enforcement
- Optional demo-user replay write lock
- Dedicated rate limiting for reliability ops routes
- Reliability ops audit trail with persisted JSONL

### Alert routing
- Structured reliability events:
  - `dispatch_slo_degraded`
  - `dlq_replay_failed`
- Optional webhook routing adapter (timeout + optional signature)
- Fail-open alert emission behavior

### Pre-prod refactor hardening
- Centralized reliability config parse/default/validation module
- Fail-fast startup validation for reliability env
- Reliability orchestration layer to reduce route glue
- Shared versioned event schema (`v1`) for alerts + audit events
- Test lifecycle cleanup and CI open-handle gate

---

## Validation performed

- `npm run test:ci` (`jest --runInBand --detectOpenHandles`) ✅
- `npm test -- --runInBand` ✅ (13 suites, 105 tests)
- `npm run build` ✅
- Post-deploy health check: `GET /health` ✅
- Ops endpoint auth behavior: unauthenticated request blocked as expected ✅

---

## Breaking changes

**None.**  
API contracts remain backward-compatible.

---

## Operational notes

- Reliability config is now strict/fail-fast by design; invalid reliability env values will block startup.
- Several controls are opt-in and remain disabled unless explicitly enabled.

---

## Recommended immediate next steps

1. Run staging/production smoke checks for reliability ops paths with intended auth posture.
2. Confirm alert webhook receiver signature verification if secret mode is enabled.
3. Rotate operator keys on deployment cadence and document owner/expiry.

---

## Patch addendum (Sprint 9 demo query fixes)

- Routing: social/trending meme queries now fast-path to **Aura** before lower-confidence fallback layers.
- Intent classifier: expanded fast-path patterns for meme/trending and "sentiment around" phrasing.
- Pricing correctness: Magos now only uses Jupiter fallback for Solana-native tokens/mints (prevents ETH/BTC mispricing when CoinGecko is unavailable).
- Aura fallback UX: removed raw "LLM analysis unavailable" phrasing in end-user summaries; now returns a completed neutral synthesis.
- Frontend rendering: improved multi-hop/external output formatting (markdown + readable JSON blocks).
- Transaction UX: removed non-actionable approval buttons from inline Bankr card; approval is handled in the dedicated transaction modal.
- Auto-pay gating: normalized fee math to numeric + epsilon-safe comparison to avoid false manual-payment prompts when delegation balance is sufficient.
