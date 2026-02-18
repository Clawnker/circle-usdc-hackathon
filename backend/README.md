# Hivemind Backend

Backend service for Hivemind Protocol.

## What this service does
- Accepts authenticated dispatch/query requests
- Routes tasks to the best available specialist(s)
- Enforces payment and delegation checks
- Streams task updates via WebSocket
- Tracks reliability, retries, and replay safety controls

## Run locally
```bash
cp .env.example .env
npm install
npm run dev
```

## Build + test
```bash
npm run build
npm test
```

## Notes
Operational/internal runbooks and postmortems are intentionally kept outside the public repo surface.
