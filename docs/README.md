# Docs Index

## Active docs in this repo

- `../README.md` - product overview, quick start, API surface
- `../CODEBASE.md` - contributor map and architecture entry points
- `../AGENTS.md` - repo-local instructions for coding agents
- `../REGISTER_AGENT.md` - external agent registration flow
- `ADDING_SPECIALISTS.md` - specialist integration notes
- `PHASE4_KANBAN.md` - current planning snapshot
- `PHASE4_SPRINT_EXECUTION_2026-02-17.md` - sprint execution notes
- `RELEASE_NOTES_2026-02-17.md` - release snapshot
- `ROADMAP.md` - roadmap and future work

## Public vs private

Internal postmortems, QA artifacts, and operational workflow proposals are intentionally excluded from the public repo surface.

## Testing references

- Repo verification: `npm run ci`
- Frontend browser verification: `cd ../frontend && npx playwright install chromium && npm run test:ui`
