# Hivemind Protocol - Backend

> Multi-agent orchestration layer for Solana AI agents

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Test connections
npm run test:connection

# Start development server
npm run dev
```

Server runs at `http://localhost:3000`

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Hivemind Dispatcher                        │
│  Routes prompts → Specialists → Aggregates responses    │
└──────────────┬────────────────────────────┬─────────────┘
               │                            │
    ┌──────────▼──────────┐    ┌───────────▼───────────┐
    │   x402 Payment      │    │    Helius RPC         │
    │   (AgentWallet)     │    │    (Solana)           │
    └─────────────────────┘    └───────────────────────┘
               │
    ┌──────────▼──────────────────────────────────────────┐
    │                   Specialists                        │
    │  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
    │  │ Magos   │  │  Aura   │  │  bankr  │             │
    │  │(predict)│  │(social) │  │ (trade) │             │
    │  └─────────┘  └─────────┘  └─────────┘             │
    └─────────────────────────────────────────────────────┘
```

## API Endpoints

### Core

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/status` | System status with balances |
| POST | `/dispatch` | Submit a task |
| GET | `/status/:taskId` | Get task status |
| GET | `/tasks` | List recent tasks |

### Wallet

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wallet/balances` | Get AgentWallet balances |
| GET | `/wallet/transactions` | Get transaction log |

### Solana

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/solana/balance/:address` | Get SOL balance |
| GET | `/solana/transactions/:address` | Get recent transactions |

### Testing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/test/:specialist` | Test a specialist directly |

## WebSocket

Connect to `ws://localhost:3000/ws`

### Messages

```javascript
// Subscribe to task updates
{ "type": "subscribe", "taskId": "uuid" }

// Dispatch a task
{ "type": "dispatch", "prompt": "...", "userId": "..." }

// Ping
{ "type": "ping" }
```

## Specialists

### Magos 🔮
- Price predictions
- Risk analysis
- Technical analysis

```bash
curl -X POST http://localhost:3000/dispatch \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Predict SOL price for 24h"}'
```

### Aura ✨
- Social sentiment
- Trending topics
- Alpha detection

```bash
curl -X POST http://localhost:3000/dispatch \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the sentiment on BONK?"}'
```

### bankr 💰
- Wallet balances
- Swap simulation
- DCA setup
- Transaction monitoring

```bash
curl -X POST http://localhost:3000/dispatch \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Check my wallet balance"}'
```

## Configuration

Configuration is loaded from:
1. `~/.agentwallet/config.json` - AgentWallet credentials
2. `~/.config/helius/config.json` - Helius RPC endpoints
3. `.env` - Local overrides

## Production Hardening Controls (Sprint 3 kickoff)

Dispatch surface now supports optional hardening flags (disabled by default for backwards compatibility):

- `DISPATCH_REQUIRE_AUTH=true` → require non-public auth for `/dispatch`, `/query`, and transaction approval endpoints.
- `DISPATCH_HMAC_SECRET=...` → enforce signed request integrity headers:
  - `x-dispatch-timestamp` (epoch ms)
  - `x-dispatch-nonce`
  - `x-dispatch-signature` (HMAC-SHA256 over method/path/timestamp/nonce/body hash)
- `DISPATCH_ROLLOUT_MODE=canary` + `DISPATCH_CANARY_PERCENT=...` + `DISPATCH_CANARY_ALLOWLIST=...` → feature-flagged rollout guard.
- `DISPATCH_KILL_SWITCH=true` → emergency rollback block for new dispatches.
- SLO hooks: `SLO_MAX_ERROR_RATE`, `SLO_MAX_P95_MS`, `SLO_ALERT_MIN_SAMPLES`, `SLO_ALERT_COOLDOWN_MS`.
- Persisted SLO telemetry (on by default): `SLO_PERSISTENCE_ENABLED`, `SLO_MAX_PERSISTED_SAMPLES`.
- Operator reliability APIs (authenticated):
  - `GET /api/ops/reliability/slo`
  - `GET /api/ops/reliability/dlq?limit=50`
  - `POST /api/ops/reliability/dlq/replay` with `{ "id": "dlq-...", "dryRun": false }`
  - `GET /api/ops/reliability/dlq/replay-worker` (worker metrics/health)
- Sprint 5 DLQ replay automation (safe-by-default, opt-in):
  - `RELIABILITY_DLQ_REPLAY_WORKER_ENABLED=true` to enable background processing of `replay_requested` DLQ records.
  - Guardrails: max replay count, minimum record age, retry cooldown, and transient-only replay.
  - Observability: per-record replay outcome fields in DLQ + aggregate worker metrics endpoint.
- Sprint 6 reliability ops safety/auditability (backward-compatible defaults):
  - Optional operator key requirement: `RELIABILITY_OPS_REQUIRE_OPERATOR_KEY=true`, `RELIABILITY_OPS_KEYS=key1,key2`
  - Optional non-public auth enforcement: `RELIABILITY_OPS_REQUIRE_NON_PUBLIC_AUTH=true`
  - Optional demo-write lock: `RELIABILITY_OPS_ALLOW_DEMO_WRITE=false`
  - Dedicated reliability endpoint rate-limits: `RELIABILITY_OPS_RATE_WINDOW_MS`, `RELIABILITY_OPS_RATE_MAX`
  - Action audit trail persisted to `data/reliability-ops-audit.jsonl`
  - New endpoint: `GET /api/ops/reliability/audit?limit=50`
- Retry + idempotency reliability flags (backward-compatible defaults):
  - `RELIABILITY_ENABLE_RETRY=true`
  - `RELIABILITY_ENABLE_IDEMPOTENCY=true`
  - Retry tuning: `RETRY_MAX_ATTEMPTS`, `RETRY_BASE_DELAY_MS`, `RETRY_MAX_DELAY_MS`
- Sprint 7 reliability alert routing hooks (backward-compatible defaults):
  - `RELIABILITY_ALERTS_ENABLED=true` enables structured reliability events
  - Event schema is versioned (`schemaVersion: "v1"`) for both alert and ops-audit payloads
  - Event types: `dispatch_slo_degraded` and `dlq_replay_failed`
  - Optional webhook adapter: `RELIABILITY_ALERTS_WEBHOOK_URL` (+ timeout/secret env controls)
  - Console adapter is on by default (`RELIABILITY_ALERTS_CONSOLE=true`) for immediate operator visibility

Operational runbook: `RUNBOOK_DISPATCH_HARDENING.md`.

## Development

```bash
# Run with hot reload
npm run dev

# Build for production
npm run build

# CI test gate (serial + open-handle detection)
npm run test:ci

# Run production build
npm start
```

## Project Structure

```
src/
├── server.ts           # Express + WebSocket server
├── dispatcher.ts       # Task routing and orchestration
├── config.ts           # Configuration loader
├── types.ts            # TypeScript types
├── x402.ts             # x402 payment integration
├── solana.ts           # Helius RPC integration
└── specialists/
    ├── index.ts        # Specialist exports
    ├── magos.ts        # Predictions specialist
    ├── aura.ts         # Sentiment specialist
    └── bankr.ts        # Trading specialist
```

## x402 Payment Flow

The x402 protocol enables pay-per-call API access:

1. Dispatcher checks if specialist requires payment
2. Verifies AgentWallet balance
3. Calls `x402/fetch` endpoint with request
4. AgentWallet handles payment negotiation
5. Result returned to user

## Hackathon Notes

- **Helius RPC**: Configured with 1M credits
- **AgentWallet**: Username `claw` with Solana + EVM wallets
- **Devnet**: Use `?network=devnet` for testing
- **Dry Run**: Pass `dryRun: true` to simulate without payments
