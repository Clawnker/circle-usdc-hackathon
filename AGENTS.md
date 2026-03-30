# AGENTS.md

Guidance for coding agents working in this repository.

## Mission

- Keep Hivemind usable on both `testnet` and `mainnet`.
- Preserve the dispatch, payment, and routing flow unless the task explicitly changes behavior.
- Prefer behavior-preserving refactors before feature rewrites.

## Start here

- Product overview: `README.md`
- Contributor map: `CODEBASE.md`
- Backend entry points:
  - `backend/src/app.ts`
  - `backend/src/routes/dispatch.ts`
  - `backend/src/dispatcher.ts`
  - `backend/src/routing.ts`
- Frontend entry points:
  - `frontend/src/app/page.tsx`
  - `frontend/src/hooks/useCommandCenter.ts`
  - `frontend/src/hooks/useWebSocket.ts`
  - `frontend/src/lib/networkMode.ts`

## Working rules

- Use `rg` for search.
- Prefer small focused patches over broad rewrites.
- Treat `backend/data/` as generated runtime state unless the task is explicitly about fixtures or persistence shape.
- When updating routing behavior, add or update backend tests in `backend/src/__tests__/`.
- When updating network toggle behavior in the UI, add or update Playwright coverage in `frontend/tests/ui/`.
- Keep docs in sync when changing architecture, test commands, or operator workflow.

## Verification

Fast repo verification:

```bash
npm run ci
```

Frontend browser verification:

```bash
cd frontend
npx playwright install chromium
npm run test:ui
```

Backend-focused verification:

```bash
cd backend
npm run typecheck
npm run test:ci
npm run build
```

## Current architecture notes

- Backend orchestration is split across `dispatcher.ts`, `routing.ts`, `specialist-gateway.ts`, `task-store.ts`, and `task-events.ts`.
- Frontend orchestration is centered in `useCommandCenter.ts`; `page.tsx` should stay mostly compositional.
- Network mode is first-class and must flow through route preview, dispatch, payments, and registry/discovery behavior.
- The Playwright suite is intentionally mock-backed at the HTTP boundary so UI behavior stays deterministic in CI.
