# Phase 4 Kanban Snapshot (2026-02-18)

## Todo
- Re-run prod release-gate after latest router changes are deployed to Render
- Tune/confirm latency budget realism for prod route-preview path (current 2500ms budget is tight)

## In Progress
- Post-deploy readability routing convergence (prevent summarize/rewrite prompts drifting to seeker in prod)
- Monitoring release-gate failure slices (routing + latency) per network mode

## Done (this cycle)
- Expanded Phase 4 eval dataset from 16 -> 44 prompts with mixed intent + noisy user phrasing
- Added readability-specific bucket coverage and assertions in routing eval tests
- Added bucket-level precision tracking with explicit thresholds
- Added low-risk router fix: early readability/summarization fast-path before capability matcher
- Backend tests: PASS (117/117)
- Frontend build: PASS
- Prod release-gate smoke executed for testnet + mainnet; artifacts refreshed:
  - `tests/artifacts/release-gate-smoke-testnet.json`
  - `tests/artifacts/release-gate-smoke-mainnet.json`
