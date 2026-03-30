# Hivemind Protocol - Codebase Guide

Reference map for contributors working in this repo.

## Repo layout

```text
circle-usdc-hackathon/
|-- AGENTS.md
|-- backend/
|   |-- src/
|   |   |-- app.ts
|   |   |-- index.ts
|   |   |-- dispatcher.ts
|   |   |-- routing.ts
|   |   |-- specialist-gateway.ts
|   |   |-- task-store.ts
|   |   |-- task-events.ts
|   |   |-- external-agents.ts
|   |   |-- payments.ts
|   |   |-- reputation.ts
|   |   |-- websocket.ts
|   |   |-- routes/
|   |   |-- middleware/
|   |   |-- reliability/
|   |   |-- specialists/
|   |   `-- __tests__/
|   |-- data/
|   |-- .env.example
|   `-- README.md
|-- frontend/
|   |-- src/
|   |   |-- app/
|   |   |-- components/
|   |   |-- hooks/
|   |   |   |-- useCommandCenter.ts
|   |   |   `-- useWebSocket.ts
|   |   |-- lib/
|   |   |   |-- command-center.ts
|   |   |   |-- command-center-api.ts
|   |   |   |-- command-center-storage.ts
|   |   |   `-- networkMode.ts
|   |   `-- providers/
|   |-- tests/
|   |   `-- ui/
|   |-- playwright.config.ts
|   `-- README.md
|-- contracts/
|-- docs/
|-- tests/
|   `-- scripts/
|-- README.md
|-- REGISTER_AGENT.md
|-- package.json
`-- skill.md
```

## Backend quick notes

- `backend/src/app.ts` wires middleware and routes.
- `backend/src/routes/dispatch.ts` owns `/api/route-preview`, `/dispatch`, and query submission.
- `backend/src/dispatcher.ts` is the public facade used by routes.
- `backend/src/routing.ts` contains specialist selection and routing heuristics.
- `backend/src/specialist-gateway.ts` encapsulates specialist execution.
- `backend/src/task-store.ts` and `backend/src/task-events.ts` hold task persistence and fan-out concerns.
- `backend/src/reliability/` contains idempotency, DLQ, SLO, and replay controls.

## Frontend quick notes

- `frontend/src/app/page.tsx` is mostly page composition.
- `frontend/src/hooks/useCommandCenter.ts` owns dispatch, payment, history, and network-mode orchestration.
- `frontend/src/lib/networkMode.ts` is the frontend source of truth for `testnet` and `mainnet`.
- `frontend/src/components/NetworkModeToggle.tsx` and `frontend/src/components/TaskInput.tsx` are the main network-aware interaction points.
- `frontend/src/hooks/useWebSocket.ts` handles live task updates plus HTTP polling fallback.

## Network mode

- The app supports `testnet` and `mainnet`.
- Network mode is persisted in local storage and scoped into swarm metadata storage.
- Route preview, delegated payment, direct payment flow, registry additions, and dispatch all carry `networkMode`.

## Testing

Repo-level verification:

```bash
npm run ci
```

Frontend browser verification:

```bash
cd frontend
npx playwright install chromium
npm run test:ui
```

## Generated data

- `backend/data/` is persistence used during local runs and tests.
- Do not commit generated task, DLQ, SLO, or reputation churn unless the change is intentional.
