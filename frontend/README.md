# Hivemind Protocol Frontend

The frontend for the Hivemind Command Center on Base.

## What it does

- Presents the command center UI for dispatching prompts to specialists
- Persists and switches between `testnet` and `mainnet`
- Handles route preview, delegated payment, and direct payment flows
- Streams task progress over WebSocket with HTTP polling fallback
- Provides marketplace, registry, history, and wallet views

## Key files

```text
src/
|-- app/
|   |-- globals.css
|   |-- layout.tsx
|   `-- page.tsx
|-- components/
|   |-- NetworkModeToggle.tsx
|   |-- PaymentFlow.tsx
|   |-- TaskInput.tsx
|   `-- ...
|-- hooks/
|   |-- useCommandCenter.ts
|   `-- useWebSocket.ts
|-- lib/
|   |-- command-center.ts
|   |-- command-center-api.ts
|   |-- command-center-storage.ts
|   `-- networkMode.ts
`-- providers/
```

## Local development

```bash
npm install
npm run dev
```

Default frontend URL:

```text
http://localhost:3001
```

## Environment

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_API_KEY=demo-key
```

## Testing

Unit and library tests:

```bash
npm test
```

Typecheck and production build:

```bash
npm run typecheck
npm run build
```

Browser UI tests:

```bash
npx playwright install chromium
npm run test:ui
```

## Notes

- The UI suite uses Playwright request mocking for route preview and dispatch so network-mode behavior is deterministic in CI.
- The production build no longer depends on fetching Google Fonts at build time, which keeps local and CI runs reproducible in restricted environments.
