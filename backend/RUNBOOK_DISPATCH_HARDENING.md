# Dispatch Production Hardening Runbook (Sprint 3 Slice)

## Scope
- authN/authZ guardrails on dispatch surface
- request integrity + replay resistance
- canary rollout + rollback controls
- basic SLO warning hooks

## Controls
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

## Rollout sequence
1. Observe-only (all flags off)
2. Canary auth (`DISPATCH_ROLLOUT_MODE=canary`, small %)
3. Canary integrity (`DISPATCH_HMAC_SECRET` for upgraded clients)
4. Expand to 100%

## Rollback
- Immediate: `DISPATCH_KILL_SWITCH=true`
- Soft: `DISPATCH_ROLLOUT_MODE=off`, unset `DISPATCH_HMAC_SECRET`

## Triage when SLO warning appears
1. Confirm rollout step and recent config changes
2. Lower canary % or engage kill switch
3. Validate idempotency behavior for retries
4. Capture impacted request IDs and open incident follow-up
