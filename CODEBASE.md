# Hivemind Protocol — Codebase Guide

> **For AI agents and developers.** This file describes the architecture, conventions, and key files so you can navigate and modify the codebase efficiently.

## What Is This?

Hivemind Protocol is a **multi-agent orchestration platform** where AI specialists can be discovered, hired, and paid autonomously using **x402 micropayments on Base (USDC)**.

Think of it as a marketplace: a user submits a natural-language query → the dispatcher routes it to the right specialist(s) → the specialist responds → the user pays per-query in USDC.

## Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| **Frontend** | Next.js 16 (Turbopack), React 19, TailwindCSS, Framer Motion | `frontend/` dir |
| **Backend** | Express 4, TypeScript, WebSocket (ws) | `backend/` dir |
| **Chain** | Base Sepolia (testnet, chain ID 84532) | USDC at `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| **Wallet** | Coinbase Smart Wallet via OnchainKit + wagmi/viem | ERC-20 approve/transferFrom delegation |
| **Identity** | ERC-8004 (on-chain agent identity + reputation) | Mock registry for now |
| **Auth** | API keys + ERC-8128 signed requests | `middleware/auth.ts`, `middleware/erc8128-auth.ts` |
| **Payments** | x402 protocol (HTTP 402 → pay → retry) | `middleware/payment.ts` |
| **Deploy** | Vercel (frontend), Render (backend) | Auto-deploy from `main` branch |

## Directory Structure

```
hackathon/circle-usdc-hackathon/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Entry point — creates server, starts listening
│   │   ├── app.ts                # Express app — mounts middleware + routes
│   │   ├── websocket.ts          # WebSocket handler (task subscriptions, dispatch)
│   │   ├── config.ts             # Centralized config (env vars, fees, addresses)
│   │   ├── dispatcher.ts         # Core routing engine — routes queries to specialists
│   │   ├── llm-client.ts         # LLM abstraction (Google Gemini via BlockRun)
│   │   ├── llm-planner.ts        # DAG planner — decomposes complex queries into steps
│   │   ├── payments.ts           # Payment logging + treasury balance checks
│   │   ├── reputation.ts         # Specialist reputation tracking (votes, stats)
│   │   ├── external-agents.ts    # Runtime agent registration + health checks
│   │   ├── types.ts              # Shared TypeScript interfaces
│   │   ├── middleware/
│   │   │   ├── auth.ts           # API key + ERC-8128 authentication
│   │   │   ├── erc8128-auth.ts   # ERC-8128 signed request verification
│   │   │   ├── payment.ts        # x402 payment middleware (402 responses)
│   │   │   └── rate-limit.ts     # Simple in-memory rate limiter
│   │   ├── routes/
│   │   │   ├── agents.ts         # /api/agents — registry, registration, external agents
│   │   │   ├── dispatch.ts       # /api/dispatch, /api/query, /api/tasks, /api/pricing
│   │   │   ├── payments.ts       # /api/delegate-pay, /api/wallet/*
│   │   │   ├── reputation.ts     # /api/reputation, /api/vote
│   │   │   └── general.ts        # /health, /status, /v1/costs, /api/specialist/:id
│   │   └── specialists/
│   │       ├── magos.ts          # Market analysis specialist (Polymarket, crypto)
│   │       ├── aura.ts           # Social/sentiment specialist (X, Reddit, news)
│   │       ├── bankr.ts          # DeFi/trading specialist (swaps, transfers, DCA)
│   │       ├── scribe.ts         # Writing/summarization specialist
│   │       └── seeker.ts         # Web research specialist (Brave Search)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Main UI — query input, specialist panel, chat
│   │   │   ├── providers.tsx     # OnchainKit provider wrapper
│   │   │   ├── layout.tsx        # Root layout + metadata
│   │   │   └── globals.css       # Global styles + CSS variables
│   │   ├── components/
│   │   │   ├── WalletPanel.tsx    # Treasury balance display + wallet connection
│   │   │   ├── DelegationPanel.tsx # USDC delegation (approve/revoke/track spend)
│   │   │   ├── PaymentFeed.tsx   # Real-time payment activity feed
│   │   │   ├── SwarmGraph.tsx    # Animated agent network visualization
│   │   │   ├── ReputationPanel.tsx # Specialist reputation + voting UI
│   │   │   └── ...               # Other UI components
│   │   └── providers/
│   │       └── OnchainProviders.tsx # wagmi + OnchainKit config (Base Sepolia)
│   └── package.json
├── agents/
│   └── registrations.json        # ERC-8004 agent registration records
├── docs/
│   ├── V2_SPEC.md                # V2 product specification (x402 Bazaar integration)
│   └── REFACTOR_PLAN.md          # Phase 1 refactor plan (this work)
└── REGISTER_AGENT.md             # Public agent self-registration guide
```

## Key Concepts

### The Dispatcher (`dispatcher.ts`)
The brain of the system. Given a natural-language prompt, it:
1. Calls `llm-planner.ts` to decompose into a DAG of specialist steps
2. Executes steps (sequential or parallel depending on dependencies)
3. Logs payments for each step
4. Returns aggregated results via REST or WebSocket

### Specialists
Each specialist is a module in `specialists/` that exports `{ handle(prompt): Promise<SpecialistResult> }`. They use `llm-client.ts` (Gemini via BlockRun) plus domain-specific APIs:
- **magos**: Polymarket API, crypto price feeds
- **aura**: Brave Search for social/news sentiment
- **bankr**: DeFi operations (simulated for testnet)
- **seeker**: General web research via Brave
- **scribe**: Pure LLM writing/summarization

### Payment Flow
1. User connects Coinbase Smart Wallet (OnchainKit)
2. User approves delegation: `USDC.approve(delegateAddr, amount)`
3. On each query, backend calls `transferFrom(user, treasury, fee)` via demo wallet's private key
4. Alternative: direct x402 — specialist returns 402, client pays, retries with proof header

### External Agents
Any agent can register via `POST /api/agents/register` with an endpoint URL. The dispatcher can route to external agents, health-checking them periodically.

## Environment Variables (Backend)

| Var | Purpose |
|-----|---------|
| `API_KEYS` | Comma-separated valid API keys |
| `DEMO_WALLET_PRIVATE_KEY` | Private key for delegation `transferFrom` calls |
| `BRAVE_API_KEY` | Brave Search API (seeker + aura) |
| `GOOGLE_API_KEY` | Gemini LLM via BlockRun |
| `HELIUS_API_KEY` | (Legacy, unused — was Solana RPC) |
| `BASE_URL` | Backend public URL for self-referencing |
| `PORT` | Server port (default 3001) |

## Conventions

- **No Solana.** All chain interactions are Base (EVM). Solana code was removed in V2 Phase 1.
- **No AgentWallet.** Legacy wallet context removed. Use OnchainKit + wagmi for wallet connection.
- **Treasury address:** `0x676fF3d546932dE6558a267887E58e39f405B135`
- **USDC address:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Base Sepolia)
- **Delegate wallet:** `0x4a9948159B7e6c19301ebc388E72B1EdFf87187B`
- **Error handling:** Always catch, log, return `{ error: "Internal server error" }` — never leak stack traces.
- **Types:** All shared interfaces in `types.ts`. Specialist-specific types stay local.

## Common Tasks

### Add a new specialist
1. Create `backend/src/specialists/myspec.ts` exporting `{ handle(prompt): Promise<SpecialistResult> }`
2. Register in `dispatcher.ts` specialist map
3. Add fee in `config.ts` under `fees`
4. Add to `validSpecialists` array in `routes/general.ts`

### Add a new API route
1. Create or extend a file in `backend/src/routes/`
2. Mount it in `app.ts` (public or after `authMiddleware`)

### Deploy
- Push to `main` → Vercel auto-deploys frontend, Render auto-deploys backend
- Manual: `vercel deploy --prod` / Render API trigger

## V2 Roadmap (Current)
See `docs/V2_SPEC.md` for full spec. Summary:
- **Phase 1** ✅ Cleanup — remove dead code, consolidate payments, modularize server
- **Phase 2** 🔜 Real x402 protocol — wire `@x402/express` paymentMiddleware
- **Phase 3** Bazaar integration — Registry tab as x402 Bazaar browser
- **Phase 4** Testing gauntlet

## x402 Payment Protocol (V2)

The backend uses the real x402 SDK (`@x402/express` + `@x402/evm`) for payment-gated specialist endpoints.

### How it works:
1. `x402-server.ts` creates the middleware using `paymentMiddleware()` from `@x402/express`
2. Routes are auto-generated from `config.fees` — each specialist with fee > 0 gets an x402 route
3. The Coinbase-hosted facilitator (`x402.org`) handles payment verification and on-chain settlement
4. Network: Base Sepolia (`eip155:84532`), USDC payments
5. Treasury receives all payments at `0x676fF3d546932dE6558a267887E58e39f405B135`

### Client flow:
```
Client → POST /api/specialist/magos {prompt: "..."}
       ← 402 Payment Required + PAYMENT-REQUIRED header
Client → Signs EIP-3009 TransferWithAuthorization via Smart Wallet
       → Re-sends with PAYMENT header
Server → Facilitator verifies signature + balance
       → Facilitator settles USDC on-chain (transferWithAuthorization)
       → Specialist executes and returns result
```

### Key files:
- `src/x402-server.ts` — x402 middleware factory, route config builder
- `src/middleware/payment.ts` — Manual 402 fallback (legacy, used if x402 SDK init fails)
- `src/app.ts` — Mounts x402 middleware before all routes
