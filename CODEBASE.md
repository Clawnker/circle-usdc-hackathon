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
| **Payments** | x402 protocol (`@x402/express` + `@x402/evm`) | `x402-server.ts` |
| **Bazaar** | x402 service discovery + external agent browser | `bazaar.ts`, `routes/bazaar.ts` |
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
│   │   ├── capability-matcher.ts # Semantic matching via Gemini text-embedding-004
│   │   ├── dag-executor.ts       # Parallel/sequential DAG step execution
│   │   ├── price-router.ts       # Budget-aware agent selection
│   │   ├── circuit-breaker.ts    # Failure tracking + fallback routing
│   │   ├── fallback-chain.ts     # Fallback agent chains
│   │   ├── payments.ts           # Payment logging, replay prevention, treasury checks
│   │   ├── reputation.ts         # Specialist reputation tracking (votes, decay)
│   │   ├── bazaar.ts             # x402 Bazaar discovery module
│   │   ├── external-agents.ts    # Runtime agent registration + health checks
│   │   ├── x402-server.ts        # x402 payment middleware factory
│   │   ├── types.ts              # Shared TypeScript interfaces
│   │   ├── utils/
│   │   │   └── errors.ts         # Error handling utilities
│   │   ├── middleware/
│   │   │   ├── auth.ts           # API key + ERC-8128 authentication
│   │   │   ├── erc8128-auth.ts   # ERC-8128 signed request verification
│   │   │   ├── payment.ts        # Manual x402 fallback (if SDK init fails)
│   │   │   └── rate-limit.ts     # Simple in-memory rate limiter
│   │   ├── routes/
│   │   │   ├── agents.ts         # /api/agents — registry, registration, external agents
│   │   │   ├── bazaar.ts         # /api/bazaar — x402 Bazaar discovery + management
│   │   │   ├── dispatch.ts       # /dispatch, /api/query, /api/route-preview, /api/tasks
│   │   │   ├── payments.ts       # /api/delegate-pay, /api/wallet/*
│   │   │   ├── reputation.ts     # /api/reputation, /api/vote
│   │   │   └── general.ts        # /health, /status, /v1/costs, /api/specialist/:id
│   │   ├── specialists/
│   │   │   ├── index.ts          # Specialist registry + exports
│   │   │   ├── magos.ts          # Market analysis (Polymarket, crypto prices)
│   │   │   ├── aura.ts           # Social/sentiment (X, Reddit, news)
│   │   │   ├── bankr.ts          # DeFi/trading (swaps, transfers, DCA)
│   │   │   ├── scribe.ts         # Writing/summarization
│   │   │   ├── seeker.ts         # Web research (Brave Search)
│   │   │   └── tools/
│   │   │       ├── index.ts      # Tool registry
│   │   │       ├── brave-search.ts # Brave Search API wrapper (10s timeout)
│   │   │       ├── coingecko.ts  # CoinGecko API wrapper (10s timeout)
│   │   │       └── mcp-client.ts # MCP tool client
│   │   └── __tests__/            # Test files (capability matcher, DAG, integration)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Main UI — query input, tabs, chat
│   │   │   ├── providers.tsx     # OnchainKit provider wrapper
│   │   │   ├── layout.tsx        # Root layout + metadata
│   │   │   └── globals.css       # Global styles + CSS variables
│   │   ├── components/
│   │   │   ├── WalletPanel.tsx    # Treasury balance + wallet connection
│   │   │   ├── DelegationPanel.tsx # USDC delegation (approve/revoke/track)
│   │   │   ├── PaymentFeed.tsx   # Real-time payment activity feed
│   │   │   ├── BazaarRegistry.tsx # x402 Bazaar browser + "Add to Swarm"
│   │   │   ├── Marketplace.tsx   # Internal agent marketplace
│   │   │   ├── SwarmGraph.tsx    # Animated agent network visualization
│   │   │   ├── ReputationPanel.tsx # Specialist reputation + voting
│   │   │   ├── QueryHistory.tsx  # Query history with reports
│   │   │   ├── MessageLog.tsx    # Inter-agent message log
│   │   │   ├── AgentCard.tsx     # Agent card component
│   │   │   ├── AgentDetailModal.tsx # Agent detail popup
│   │   │   ├── TaskInput.tsx     # Query input component
│   │   │   ├── ResultDisplay.tsx # Query result rendering
│   │   │   ├── ResultCard.tsx    # Individual result card
│   │   │   ├── WalletConnect.tsx # Wallet connection button
│   │   │   └── index.ts         # Component barrel exports
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts   # WebSocket connection + event handling
│   │   │   └── useX402Fetch.ts   # x402 payment-aware fetch hook
│   │   └── providers/
│   │       └── OnchainProviders.tsx # wagmi + OnchainKit config (Base Sepolia)
│   └── package.json
├── contracts/src/                 # Solidity contracts (ERC-8004)
├── agents/
│   └── registrations.json        # ERC-8004 agent registration records
├── docs/
│   ├── V2_SPEC.md                # V2 product specification
│   ├── ROADMAP.md                # Product roadmap
│   └── V2_TEST_REPORT.md         # Test results
├── README.md                     # Public project README
├── REGISTER_AGENT.md             # Public agent self-registration guide
├── CODEBASE.md                   # This file
└── skill.md                      # Agent-readable skill manifest
```

## Key Concepts

### The Dispatcher (`dispatcher.ts`)
The brain of the system. Given a natural-language prompt, it:
1. Uses `capability-matcher.ts` for semantic routing (Gemini embeddings)
2. Calls `llm-planner.ts` to decompose complex queries into a DAG
3. Executes steps via `dag-executor.ts` (parallel or sequential)
4. Applies `price-router.ts` for budget-aware selection
5. Uses `circuit-breaker.ts` + `fallback-chain.ts` for resilience
6. Logs payments via `payments.ts` (with replay prevention)
7. Returns results via REST or WebSocket

### Specialists
Each specialist is a module in `specialists/` that exports `{ handle(prompt): Promise<SpecialistResult> }`. They use `llm-client.ts` (Gemini via BlockRun) plus domain-specific APIs:
- **magos**: CoinGecko, Polymarket for crypto/market analysis
- **aura**: Brave Search for social/news sentiment
- **bankr**: DeFi operations (simulated for testnet)
- **seeker**: General web research via Brave Search
- **scribe**: Pure LLM writing/summarization

### Payment Flows
Two payment mechanisms:

**1. Delegation (approve/transferFrom):**
1. User connects Coinbase Smart Wallet (OnchainKit)
2. User approves delegation: `USDC.approve(delegateAddr, amount)`
3. On each query, backend calls `transferFrom(user, treasury, fee)` via delegate wallet
4. Frontend tracks individual payments with amounts, specialists, and tx hashes

**2. x402 Protocol (HTTP 402):**
1. Client hits `/api/specialist/:id` → gets 402 with payment requirements
2. Client signs EIP-3009 TransferWithAuthorization via wallet
3. Client re-sends with `X-PAYMENT` header
4. x402 facilitator (x402.org) verifies signature + settles USDC on-chain
5. Specialist executes and returns result

### Bazaar (`bazaar.ts`)
The x402 Bazaar module provides:
- Discovery of internal specialists as x402-compatible services
- External service discovery via x402.org facilitator (non-fatal)
- Frontend browser (BazaarRegistry.tsx) for browsing and adding agents to swarm

### External Agents
Any agent can register via `POST /api/agents/register` with an endpoint URL, wallet, and capabilities. The dispatcher can route to external agents, health-checking them periodically. See `REGISTER_AGENT.md`.

### Security
- **CORS**: Restricted to known frontends (Vercel, hivemindprotocol.ai, localhost)
- **XSS**: HTML tags stripped from agent registration inputs
- **Replay prevention**: TX hashes tracked in-memory, 409 on reuse
- **Input validation**: Address format, amount bounds, prompt length
- **Auth**: API keys or ERC-8128 wallet signatures
- **Rate limiting**: In-memory per-IP rate limiter
- **Crash handlers**: Global `unhandledRejection`/`uncaughtException` handlers

## Route Architecture

Routes are mounted in `app.ts` in this order:
1. **CORS** (restricted origins)
2. **x402 payment middleware** (protects specialist endpoints)
3. **Public routes** (health, agents, bazaar, reputation, wallet, etc.)
4. **Auth middleware** (API key or ERC-8128)
5. **Protected routes** (dispatch, query, status, tasks)

### Public Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + version |
| GET | `/api/agents` | List registered agents |
| GET | `/api/agents/external` | List external agents |
| GET | `/api/bazaar/discovery` | x402 Bazaar service discovery |
| GET | `/api/reputation` | All reputation stats |
| GET | `/api/reputation/:id` | Single specialist reputation |
| GET | `/api/pricing` | Specialist USDC pricing |
| GET | `/api/wallet/lookup/:username` | Wallet balance proxy |
| POST | `/api/delegate-pay` | Delegation payment (transferFrom) |
| POST | `/api/agents/register` | Self-register external agent |
| GET | `/skill.md` | Agent-readable skill manifest |

### Protected Endpoints (require `X-API-Key` or ERC-8128)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/dispatch` | Multi-agent orchestration |
| POST | `/api/query` | Alias for dispatch |
| POST | `/api/route-preview` | Preview routing (specialist + fee) |
| GET | `/status` | Detailed system status |
| GET | `/api/tasks/:taskId` | Task status by ID |
| POST | `/api/vote` | Submit reputation vote |

## Environment Variables (Backend)

| Var | Purpose |
|-----|---------|
| `API_KEYS` | Comma-separated valid API keys |
| `DEMO_WALLET_PRIVATE_KEY` | Private key for delegation `transferFrom` calls |
| `BRAVE_API_KEY` | Brave Search API (seeker + aura) |
| `GOOGLE_API_KEY` | Gemini LLM via BlockRun |
| `BASE_URL` | Backend public URL |
| `AGENTWALLET_TOKEN` | AgentWallet API token |
| `AGENTWALLET_USERNAME` | AgentWallet username |
| `PORT` | Server port (default 3001) |

## Conventions

- **No Solana.** All chain interactions are Base (EVM). Solana code was removed in V2 Phase 1.
- **Static imports only.** No dynamic `await import()` — causes issues with Node16 module resolution on Render.
- **Treasury address:** `0x676fF3d546932dE6558a267887E58e39f405B135`
- **USDC address:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Base Sepolia)
- **Delegate wallet:** `0x4a9948159B7e6c19301ebc388E72B1EdFf87187B`
- **Error handling:** Always catch, log, return `{ error: "..." }` — never leak stack traces.
- **Types:** All shared interfaces in `types.ts`. Specialist-specific types stay local.
- **Timeouts:** All external API calls must have explicit timeouts (10s for Brave/CoinGecko, 30s for on-chain tx receipts).

## Common Tasks

### Add a new specialist
1. Create `backend/src/specialists/myspec.ts` exporting `{ handle(prompt): Promise<SpecialistResult> }`
2. Register in `specialists/index.ts`
3. Add fee in `config.ts` under `fees`
4. Add to `validSpecialists` array in `routes/general.ts`
5. Specialist will auto-appear in Bazaar discovery

### Add a new API route
1. Create or extend a file in `backend/src/routes/`
2. Mount it in `app.ts` (before `authMiddleware` for public, after for protected)

### Deploy
- Push to `main` → Vercel auto-deploys frontend
- Backend: trigger via Render API (`POST /v1/services/srv-d64ci8vfte5s7384jq9g/deploys`)
- Manual frontend: `vercel deploy --prod`

## x402 Payment Protocol

The backend uses the real x402 SDK (`@x402/express` + `@x402/evm`) for payment-gated specialist endpoints.

### How it works:
1. `x402-server.ts` creates middleware using `paymentMiddleware()` from `@x402/express`
2. Routes are auto-generated from `config.fees` — each specialist with fee > 0 gets an x402 route
3. The Coinbase-hosted facilitator (`https://x402.org/facilitator`) handles payment verification
4. Network: Base Sepolia (`eip155:84532`), USDC payments
5. Treasury receives all payments at `0x676fF3d546932dE6558a267887E58e39f405B135`

### Key constraint:
`paymentMiddleware` 5th arg MUST be `false` (sync-on-start disabled). Sync fires an async facilitator call that crashes the server if unreachable. Use lazy mode instead. Entire `createX402Middleware()` is wrapped in try/catch returning no-op middleware on failure.

### Client flow:
```
Client → POST /api/specialist/magos {prompt: "..."}
       ← 402 Payment Required + x402 payment details
Client → Signs EIP-3009 TransferWithAuthorization via Smart Wallet
       → Re-sends with X-PAYMENT header
Server → Facilitator verifies signature + balance
       → Facilitator settles USDC on-chain
       → Specialist executes and returns result
```

## Version History
- **v0.5.0** (current) — V2 complete: x402, Bazaar, security hardening, UX cleanup
- **v0.4.0** — V2 Phases 1-3 (refactor + x402 + Bazaar)
- **v0.3.0** — V1 with ERC-8004 + delegation payments
