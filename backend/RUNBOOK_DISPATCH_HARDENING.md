# Dispatch Production Hardening Runbook (Sprint 4 operability update)

## Scope
- authN/authZ guardrails on dispatch surface
- request integrity + replay resistance
- canary rollout + rollback controls
- persisted reliability telemetry + DLQ operator controls
- DLQ replay worker automation with guardrails + observability
- ops safety/auditability controls for reliability endpoints (Sprint 6)
- reliability alert routing hooks for SLO degradation + replay failures (Sprint 7)

## Controls
All reliability controls are parsed/validated at startup; invalid ranges/types fail fast before server listen.
- `DISPATCH_REQUIRE_AUTH` (default `false`)
- `DISPATCH_HMAC_SECRET` (unset => integrity checks off)
- `DISPATCH_MAX_SKEW_MS` (default `300000`)
- `DISPATCH_NONCE_TTL_MS` (default `600000`)
- `DISPATCH_MAX_NONCES` (default `50000`)
- `DISPATCH_ROLLOUT_MODE` (`off|canary|disabled`)
- `DISPATCH_CANARY_PERCENT` (default `100`)
- `DISPATCH_CANARY_ALLOWLIST`
- `DISPATCH_KILL_SWITCH`
- `SLO_MAX_ERROR_RATE`, `SLO_MAX_P95_MS`, `SLO_ALERT_MIN_SAMPLES`, `SLO_ALERT_COOLDOWN_MS`
- `SLO_PERSISTENCE_ENABLED` (default `true`)
- `SLO_MAX_PERSISTED_SAMPLES` (default `5000`)
- `RELIABILITY_ENABLE_RETRY` (default `true`)
- `RELIABILITY_ENABLE_IDEMPOTENCY` (default `true`)
- `RETRY_MAX_ATTEMPTS` (default `3`)
- `RETRY_BASE_DELAY_MS` (default `250`)
- `RETRY_MAX_DELAY_MS` (default `2000`)
- `RELIABILITY_DLQ_REPLAY_WORKER_ENABLED` (default `false`)
- `RELIABILITY_DLQ_REPLAY_INTERVAL_MS` (default `15000`)
- `RELIABILITY_DLQ_REPLAY_BATCH_SIZE` (default `5`)
- `RELIABILITY_DLQ_REPLAY_MAX_COUNT` (default `3`)
- `RELIABILITY_DLQ_REPLAY_MIN_AGE_MS` (default `15000`)
- `RELIABILITY_DLQ_REPLAY_MIN_RETRY_INTERVAL_MS` (default `10000`)
- `RELIABILITY_DLQ_REPLAY_REQUIRE_TRANSIENT` (default `true`)
- `RELIABILITY_OPS_REQUIRE_OPERATOR_KEY` (default `false`)
- `RELIABILITY_OPS_KEYS` (comma-separated `x-ops-key` values)
- `RELIABILITY_OPS_REQUIRE_NON_PUBLIC_AUTH` (default `false`)
- `RELIABILITY_OPS_ALLOW_DEMO_WRITE` (default `true`)
- `RELIABILITY_OPS_RATE_WINDOW_MS` (default `60000`)
- `RELIABILITY_OPS_RATE_MAX` (default `120`)
- `RELIABILITY_OPS_AUDIT_MAX_IN_MEMORY` (default `1000`)
- `RELIABILITY_ALERTS_ENABLED` (default `false`)
- `RELIABILITY_ALERTS_CONSOLE` (default `true`)
- `RELIABILITY_ALERTS_WEBHOOK_URL` (optional)
- `RELIABILITY_ALERTS_WEBHOOK_TIMEOUT_MS` (default `3000`)
- `RELIABILITY_ALERTS_WEBHOOK_SECRET` (optional SHA-256 signature seed)

## Operator endpoints (authenticated)
- `GET /api/ops/reliability/slo`
  - Returns SLO snapshot + thresholds + rollout recommendation
- `GET /api/ops/reliability/dlq?limit=50`
  - Returns DLQ stats + recent records
- `POST /api/ops/reliability/dlq/replay`
  - Body: `{ "id": "dlq-...", "dryRun": true|false }`
  - Dry-run previews replay payload without mutating state
  - Non-dry-run sets status=`replay_requested` for worker processing
- `GET /api/ops/reliability/dlq/replay-worker`
  - Returns worker health + counters (`totalClaimed`, `totalSucceeded`, `totalFailed`, `totalGuardrailSkipped`)
- `GET /api/ops/reliability/audit?limit=50`
  - Returns latest reliability ops audit events (also persisted to `data/reliability-ops-audit.jsonl`)

## Alert routing hooks (Sprint 7)
- Structured events are emitted with versioned schema payloads (`schemaVersion: "v1"`) for:
  - `dispatch_slo_degraded` when error-rate and/or p95 budgets are breached after min sample + cooldown checks
  - `dlq_replay_failed` when replay worker attempts fail (handler error/exception)
- Webhook adapter posts JSON to `RELIABILITY_ALERTS_WEBHOOK_URL` with headers:
  - `x-reliability-event-type`
  - `x-reliability-signature` (when `RELIABILITY_ALERTS_WEBHOOK_SECRET` is configured)
- Failure behavior is fail-open: webhook delivery issues are logged but do not block dispatch or replay paths.

## Rollout sequence
1. Observe-only (all hardening flags off, monitor SLO + DLQ endpoints)
2. Canary auth (`DISPATCH_ROLLOUT_MODE=canary`, small %)
3. Canary integrity (`DISPATCH_HMAC_SECRET` for upgraded clients)
4. Expand to 100%

## Rollback recommendations (when SLO degrades)
1. Immediate: `DISPATCH_KILL_SWITCH=true`
2. Soft rollback: `DISPATCH_ROLLOUT_MODE=off`, unset `DISPATCH_HMAC_SECRET`
3. Validate idempotency behavior for retries and duplicate submissions
4. Inspect DLQ backlog and request targeted replay for transient failures
5. Capture impacted request IDs and open incident follow-up

## Close checklist
- [ ] SLO endpoint healthy and returning current window metrics
- [ ] DLQ backlog reviewed (`queued` and `replay_requested`)
- [ ] Replay worker state verified (`/api/ops/reliability/dlq/replay-worker`)
- [ ] Any replay requests either executed (`replayed`) or explicitly deferred with reason
- [ ] Reliability ops authz posture verified (`RELIABILITY_OPS_*` flags + operator key rotation state)
- [ ] Reliability ops audit trail sampled (`/api/ops/reliability/audit`) and persisted to disk
- [ ] Alert routing validated (console + webhook if enabled) for `dispatch_slo_degraded`/`dlq_replay_failed`
- [ ] Canary/kill-switch state recorded in incident notes
- [ ] Post-incident action items tracked
