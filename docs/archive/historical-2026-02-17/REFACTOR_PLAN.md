# V2 Refactor Plan

## Phase 1: Delete Dead Code

### Files to DELETE entirely:
- `backend/src/solana.ts` — 190 lines of Solana RPC. We're Base-only.
- `backend/src/solana-reputation.ts` — 39 lines of mock Solana tx signatures.
- `backend/src/cdp-wallet.ts` — 89 lines of stub code. Every function returns placeholder.
- `backend/src/onchain-payments.ts` — 82 lines wrapping cdp-wallet. Uses dead specialist addresses (0x000...001).
- `backend/src/x402-protocol.ts` — 66 lines generating fake "user-pay-*" tracking IDs. Not real x402.
- `frontend/src/contexts/WalletContext.tsx` — 96 lines of AgentWallet/mcpay.tech legacy. Replaced by OnchainKit.

### Imports to clean after deletion:
- `server.ts` imports `solana`, `syncReputationToChain`, `getSimulatedBalances`
- `dispatcher.ts` imports `executeDemoPayment`, `checkPaymentCost`, `sendOnChainPayment`
- `reputation.ts` imports `syncReputationToChain`
- `page.tsx` or providers may reference `WalletContext`

## Phase 2: Consolidate Payment Module

### Current state (4 overlapping files):
1. `x402.ts` — Transaction log + AgentWallet balance check (keep log, remove AW)
2. `x402-protocol.ts` — Fake payment records (DELETE)
3. `onchain-payments.ts` — CDP SDK wrapper (DELETE)
4. `cdp-wallet.ts` — Stub functions (DELETE)

### Target: Single `payments.ts` module
```
payments.ts
├── logTransaction() — Transaction audit trail (from x402.ts)
├── getTransactionLog() — Read log (from x402.ts)
├── getTreasuryBalance() — Read on-chain USDC/ETH balance via viem
├── delegatePayment() — transferFrom via demo wallet (from server.ts delegate-pay)
└── Types: PaymentRecord
```

## Phase 3: Split server.ts (1244 → ~4 files)

### Current server.ts has:
- Express setup + middleware
- Rate limiting
- Route preview
- Delegate pay
- Health check
- LLM costs
- ERC-8128 auth verification
- Agent registry CRUD (7 endpoints)
- Wallet lookup proxy
- Specialist endpoints (direct query + x402)
- Dispatch endpoint
- WebSocket server
- Reputation endpoints (5 endpoints)
- Static file serving
- Payment history
- Pricing endpoint

### Target structure:
```
server.ts          — Express app, middleware, server.listen() (~100 lines)
routes/
├── health.ts      — /health, /v1/costs
├── dispatch.ts    — /dispatch, /api/route-preview, /api/delegate-pay
├── agents.ts      — /api/agents CRUD, /api/agents/register, external agent proxy
├── payments.ts    — /api/payments, /api/wallet/*, pricing
├── reputation.ts  — /api/reputation/*
├── specialists.ts — /api/specialist/:id (x402-protected individual specialist routes)
└── auth.ts        — /api/auth/verify (ERC-8128)
websocket.ts       — WebSocket server setup + event broadcasting
```

## Phase 4: Refactor dispatcher.ts (1464 → ~3 files)

### Current dispatcher.ts has:
- Task management (create, get, update, subscribe)
- Routing (routePrompt, deterministic fast-paths, capability matcher)
- Single-step execution
- Multi-hop (legacy) execution
- DAG execution
- Payment handling (executeDemoPayment calls scattered everywhere)
- Message/event broadcasting
- Specialist calling
- External agent proxying

### Target structure:
```
dispatcher/
├── index.ts       — Public API: dispatch(), getTask(), getSpecialists() (~100 lines)
├── router.ts      — routePrompt(), deterministic routing, capability matching
├── executor.ts    — executeTask() for single, multi-hop, and DAG paths
├── tasks.ts       — Task CRUD, subscription, status management
└── types.ts       — (existing types.ts, keep as-is)
```

## Phase 5: Clean config.ts

### Remove:
- `specialistWallets` — All fake Solana addresses
- `agentWallet` section — mcpay.tech is deprecated
- `helius` section — Solana RPC, not needed for Base
- `specialists.clawarena` — Unused
- `specialists.moltx` — Unused
- `x402.solanaNetwork` — Base-only

### Keep:
- `port`, `nodeEnv`
- `fees` (specialist pricing)
- `x402.facilitator`, `x402.network` (Base Sepolia)
- `erc8004` (identity/reputation registries)
- `base` (RPC, USDC address, chainId)
- `jupiter` (for bankr specialist, if kept)

## Phase 6: Clean frontend page.tsx (1247 → hooks + components)

### Extract from page.tsx:
- `useDispatch` hook — query submission, payment flow, WebSocket subscription
- `useRoutePreview` hook — fee estimation
- `useDelegation` hook — delegation state management
- `useQueryHistory` hook — localStorage history
- Result rendering logic → existing ResultCard (extend it)

### Remove from frontend:
- `WalletContext.tsx` — DELETE (OnchainKit handles wallet)
- `SPECIALIST_FEES` hardcoded object — fetch from `/api/pricing` endpoint
- Any references to `useWallet()` from WalletContext

## Phase 7: Clean up specialists

### bankr.ts (1076 lines):
- Mostly simulated responses and Bankr API wrapper
- Keep if Bankr API works. Remove simulated/mock functions.
- `getSimulatedBalances` — used in server.ts, but it's fake data. Remove.

### Config mismatches:
- Backend `config.fees` has all specialists at 0.10 USDC
- Frontend `SPECIALIST_FEES` is hardcoded separately
- Fix: single source of truth from `/api/pricing`

## Execution Order

1. Delete dead files (solana.ts, solana-reputation.ts, cdp-wallet.ts, onchain-payments.ts, x402-protocol.ts, WalletContext.tsx)
2. Fix all broken imports from deletions
3. Create `payments.ts` from x402.ts (remove AgentWallet code)
4. Split server.ts into route modules
5. Split dispatcher.ts into dispatcher/
6. Clean config.ts
7. Extract frontend hooks from page.tsx
8. Remove hardcoded SPECIALIST_FEES, fetch from API
9. Build + test everything
10. Push
