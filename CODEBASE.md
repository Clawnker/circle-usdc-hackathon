# Hivemind Protocol — Codebase Guide

Reference map for contributors working in this repo.

## Repo layout

```
circle-usdc-hackathon/
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── index.ts
│   │   ├── dispatcher.ts
│   │   ├── capability-matcher.ts
│   │   ├── llm-planner.ts
│   │   ├── dag-executor.ts
│   │   ├── external-agents.ts
│   │   ├── payments.ts
│   │   ├── reputation.ts
│   │   ├── websocket.ts
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── specialists/
│   │   └── __tests__/
│   ├── .env.example
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── providers/
│   └── README.md
├── contracts/
├── agents/
│   └── registrations.json
├── docs/
│   ├── README.md
│   ├── RELEASE_NOTES_2026-02-17.md
│   ├── ADDING_SPECIALISTS.md
│   ├── CAPABILITY_MATCHING.md
│   ├── DAG_PLANNER.md
│   ├── ROUTING_RESILIENCE.md
│   ├── SYSTEM_MAP.md
│   ├── REPUTATION_SYSTEM.md
│   ├── ROADMAP.md
│   └── specs/
├── tests/
│   └── scripts/
│       ├── run_qa.sh
│       ├── test-e2e.sh
│       └── test_routing.js
├── README.md
├── REGISTER_AGENT.md
└── skill.md
```

## Private/Internal material

Some operational docs and QA artifacts are intentionally kept out of the public repo surface.
- Internal files live under local `.private/` (gitignored)
- Public docs are listed in `docs/README.md`
- Guard script: `tests/scripts/check_private_surface.sh`

## Backend quick notes

- Auth: API keys and ERC-8128
- Payments: delegation + x402
- Routing: capability matching + DAG planning + fallback chain
- Reliability: idempotency, retry/DLQ, SLO + alert hooks

Main files to start with:
- `backend/src/dispatcher.ts`
- `backend/src/routes/dispatch.ts`
- `backend/src/specialists/`
- `backend/src/hooks/useWebSocket.ts` (frontend consumer side is `frontend/src/hooks/useWebSocket.ts`)

## Frontend quick notes

Main UI and payment/routing behavior:
- `frontend/src/app/page.tsx`
- `frontend/src/hooks/useWebSocket.ts`
- `frontend/src/components/ResultCard.tsx`
- `frontend/src/components/cards/`

## Testing

Backend:
```bash
cd backend
npm test
npm run build
```

Frontend:
```bash
cd frontend
npm run build
```

Repo scripts:
```bash
bash tests/scripts/run_qa.sh
bash tests/scripts/test-e2e.sh
node tests/scripts/test_routing.js
```
