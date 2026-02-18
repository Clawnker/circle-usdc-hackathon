# Phase 4 Sprint Execution — 2026-02-17

Status: In progress (Sprints 4.1–4.5 advanced; post-deploy tuning cycle run)
Owner: autonomous cycle

## Post-Phase4 autonomous tuning cycle (late 2026-02-17 / early 2026-02-18)

### What changed
- Expanded routing eval dataset from **16 → 44** prompts in `docs/phase4-query-eval-set.json`
  - Added noisy real-user phrasing, mixed intent, and edge cases
  - Added explicit readability bucket coverage (5 summarize/rewrite prompts)
- Upgraded `backend/src/__tests__/phase4-routing-eval.test.ts`
  - Reads eval set from docs JSON (single source of truth)
  - Enforces dataset size >= 40
  - Enforces readability coverage + readability routing expectation
  - Tracks bucket-level precision with bucket-specific thresholds
- Applied one low-risk routing/readability iteration in `backend/src/dispatcher.ts`
  - Added **early readability fast-path** (before capability matcher) to reduce false routing of summarize/rewrite prompts to seeker

### Metrics and outcomes
- Backend tests: **PASS (117/117)**
- Frontend build: **PASS** (`next build`)
- Eval quality gates (local test harness): **PASS**
  - Overall precision threshold >= 0.90: PASS
  - Bucket precision thresholds: PASS
  - Readability bucket strict expectation (scribe): PASS in test harness

### Release-gate smoke (prod)
Artifacts:
- `tests/artifacts/release-gate-smoke-testnet.json`
- `tests/artifacts/release-gate-smoke-mainnet.json`

Latest results:
- Testnet smoke: **FAIL**
  - health: pass
  - failure slices: latency=1, routing=1
  - p95 latency: 2525ms (budget 2500ms)
- Mainnet smoke: **FAIL**
  - health: pass
  - failure slices: latency=1, routing=1
  - p95 latency: 3335ms (budget 2500ms)

Observed failing prompt on prod:
- `"Summarize Base ecosystem opportunities in bullet points for this week"`
- routed to `seeker` on prod (expected readability-oriented: `scribe`/`general`/`multi-hop`)

Interpretation:
- Local routing logic has been hardened, but prod smoke still reflects an older deployed routing behavior and/or latency variability.
- This cycle produced actionable artifacts and a low-risk fix ready for deployment validation.

## Sprint checklist, status, and decisions

## Sprint 4.1 — Routing Accuracy + Eval Harness
- [x] Define broad eval set covering routing/sentiment/prices/transfer/approval/research/multi-hop/edge phrasing
- [x] Add automated routing precision test with measurable threshold
- [x] Tighten routing heuristics for observed misroutes
- [x] Acceptance criteria met

Acceptance criteria
- Routing precision >= 90% on curated eval set
- Bucket coverage includes all requested user-query categories

Evidence
- Added `backend/src/__tests__/phase4-routing-eval.test.ts`
- Eval set size: 16 prompts
- Result: 112/112 backend tests passing (includes routing eval)
- Route improvements implemented:
  - social “talking about/mentions/discussing” handling
  - transfer/approve/allowance intent support
  - multi-hop query protection from over-eager sentiment/price fast-paths
  - short-lived route cache for repeated prompt latency reduction

Decision notes
- Kept backward compatibility by extending existing fast-paths and fallback logic instead of replacing router architecture.

---

## Sprint 4.2 — Response Quality + Formatting
- [x] Reduce raw JSON dump risk in primary output summarization path
- [x] Add readability regression test
- [x] Acceptance criteria met

Acceptance criteria
- Primary fallback output should prefer human-readable bullet summaries over raw object dumps

Evidence
- Added exported formatter test target: `extractResponseContent`
- Added `backend/src/__tests__/response-quality.test.ts`
- Formatter now converts nested object payloads to concise bullet lines in fallback paths

Decision notes
- Preserved specialist-specific formatting precedence; only improved fallback layers.

---

## Sprint 4.3 — Wallet/Payment UX Reliability
- [x] Harden x402 fetch path for malformed/non-JSON 402 responses
- [x] Add stricter payment requirements validation
- [x] Improve client network timeout behavior
- [x] Acceptance criteria met (build + smoke)

Acceptance criteria
- x402 client should fail clearly when payment requirements are invalid/missing
- Non-JSON responses should not crash client parsing path

Evidence
- Updated `frontend/src/hooks/useX402Fetch.ts`
  - safe JSON parser
  - requirement validation helper
  - first-request timeout guard

Decision notes
- Kept payload and signature structure backward-compatible (`X-PAYMENT`, EIP-3009 flow unchanged).

---

## Sprint 4.4 — Network Mode UX
- [x] Added user-facing network-mode toggle (testnet/mainnet) in dispatch header
- [x] Added sticky network preference persistence (`localStorage`)
- [x] Added explicit network badges/labels in query and payment surfaces
- [x] Threaded selected network through route-preview/dispatch requests and result history metadata
- [x] Added guardrails: mainnet mode blocks risky payment intents in current rollout unless explicitly enabled (`ENABLE_MAINNET_DISPATCH`/`NEXT_PUBLIC_ENABLE_MAINNET_PAYMENTS`)
- [x] Acceptance criteria met

## Sprint 4.5 — Performance + Observability
- [x] Added lightweight release-gate smoke script with routing/readability/payment-preview checks
- [x] Added measurable latency budget check + p95 summary
- [x] Added failure-slice summary (http/latency/routing/payload)
- [x] Added local/prod artifact generation under `tests/artifacts/`
- [x] Acceptance criteria met (with explicit local/prod distinction)

---

## Query eval summary (this cycle)
- Dataset: 16 prompts (broad coverage by design)
- Automated pass criteria in test:
  - overall precision >= 0.90
  - per-bucket precision >= 0.75
- Outcome: PASS

Notable examples
- “What tokens are people talking about?” → aura (fixed historical misroute pattern)
- “Approve 100 USDC for router spending” → bankr
- “Find top trending token then buy $25 worth” → multi-hop
- “asdfghjkl random gibberish” → general

---

## Local vs prod verification

Local (this cycle)
- Backend tests: PASS (112/112)
- Backend build: PASS (`tsc --noCheck`)
- Frontend build: PASS (`next build`)

Prod checks (read-only/live)
- `GET https://circle-usdc-hackathon.onrender.com/health` → PASS
- `POST /api/route-preview` (sentiment phrasing): “What tokens are people talking about?” → aura
- `POST /api/route-preview` (approval phrasing): “Approve 100 USDC for router spending” → bankr

Notes
- Prod deploy status depends on separate CI/CD deployment of this branch state.
- Release-gate smoke artifacts generated:
  - `tests/artifacts/release-gate-smoke-local.json` (local backend unavailable in this run; expected fail slice for HTTP/routing/payload)
  - `tests/artifacts/release-gate-smoke-testnet.json` (prod testnet run; health pass, route+latency slices captured)
- Current prod smoke indicates latency budget/routing expectation misses on selected prompts; script now exposes these slices for release decisioning.
