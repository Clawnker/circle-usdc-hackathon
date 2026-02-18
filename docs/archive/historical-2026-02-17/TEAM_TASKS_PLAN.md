# Team Tasks — V2 Development Pipeline Plan

> **Status:** Draft — ready to activate when V2 sprint begins
> **Skill:** `team-tasks` (DAG mode)
> **Created:** 2026-02-09

---

## Why

V1 was built with ad-hoc sub-agent spawns. It worked but had no state tracking, no dependency management, and no visibility into what was done vs. in-progress. V2 is bigger — we need coordination.

## Pipeline Agents

| Agent | Role | Session Target |
|-------|------|---------------|
| **Claw** 🦞 | Orchestrator — dispatches, reviews, merges | main session |
| **Codex** 🛠️ | Implementation — writes code, runs builds | `sessions_spawn` |
| **QA** 🧪 | Tests — writes/runs tests, validates behavior | `sessions_spawn` |
| **Docs** 📝 | Documentation — README, API docs, inline docs | `sessions_spawn` |

## V2 DAG Structure

```
Phase 2a: Capability Matching
├── spec-2a (Claw) ─── "Write technical spec for capability schema + vector matching"
├── impl-2a (Codex) ── "Implement capability-based matching" [depends: spec-2a]
├── test-2a (QA) ───── "Test capability matching against registry" [depends: impl-2a]
└── docs-2a (Docs) ─── "Document capability schema + registration" [depends: impl-2a]

Phase 2b: LLM Planner
├── spec-2b (Claw) ─── "Write tech spec for DAG planner upgrade"
├── impl-2b (Codex) ── "Upgrade llm-planner.ts to multi-step DAG" [depends: spec-2b, impl-2a]
├── test-2b (QA) ───── "Test DAG execution: parallel, sequential, mixed" [depends: impl-2b]
└── docs-2b (Docs) ─── "Document DAG planner API + plan format" [depends: impl-2b]

Phase 2c: Reputation Scoring
├── spec-2c (Claw) ─── "Write tech spec for reputation system"
├── impl-2c (Codex) ── "Implement reputation tracking + weighted routing" [depends: spec-2c, impl-2a]
├── test-2c (QA) ───── "Test reputation decay, score calculation, routing bias" [depends: impl-2c]
└── docs-2c (Docs) ─── "Document reputation system + scoring formula" [depends: impl-2c]

Phase 2d-2e: Price Routing + Fallbacks
├── spec-2de (Claw) ── "Write tech spec for price-aware routing + failover"
├── impl-2d (Codex) ── "Implement price-aware routing" [depends: spec-2de, impl-2c]
├── impl-2e (Codex) ── "Implement fallback chains" [depends: spec-2de, impl-2c]
├── test-2de (QA) ──── "Integration tests for routing + failover" [depends: impl-2d, impl-2e]
└── docs-2de (Docs) ── "Document routing algorithm + fallback behavior" [depends: impl-2d, impl-2e]
```

## Activation Commands

When ready to start:

```bash
SKILL_DIR="skills/team-tasks"
PROJECT_DIR="hackathon/circle-usdc-hackathon"

# 1. Init project in DAG mode
python3 $SKILL_DIR/scripts/task_manager.py init hivemind-v2 \
  -g "Hivemind Protocol V2: Intelligent dispatcher with capability matching, DAG planning, reputation scoring, price routing, and failover" \
  -m dag

# 2. Add Phase 2a tasks
python3 $SKILL_DIR/scripts/task_manager.py add hivemind-v2 spec-2a -a claw -d ""
python3 $SKILL_DIR/scripts/task_manager.py add hivemind-v2 impl-2a -a codex -d "spec-2a"
python3 $SKILL_DIR/scripts/task_manager.py add hivemind-v2 test-2a -a qa -d "impl-2a"
python3 $SKILL_DIR/scripts/task_manager.py add hivemind-v2 docs-2a -a docs -d "impl-2a"

# 3. Check what's ready to dispatch
python3 $SKILL_DIR/scripts/task_manager.py ready hivemind-v2

# 4. View dependency graph
python3 $SKILL_DIR/scripts/task_manager.py graph hivemind-v2
```

## Execution Pattern

For each dispatchable task:

1. `task_manager.py ready hivemind-v2` → get tasks with all deps met
2. `task_manager.py update hivemind-v2 <task> in-progress`
3. `sessions_spawn` with task description + relevant context files
4. Review output, save result: `task_manager.py result hivemind-v2 <task> "<summary>"`
5. `task_manager.py update hivemind-v2 <task> done`
6. Check `ready` again — newly unblocked tasks can dispatch in parallel

## Notes

- **Specs first:** Claw writes the tech spec before Codex touches code. No ambiguity.
- **Parallel wins:** 2a/2b/2c specs can be written simultaneously. Implementation gates on its own spec + prerequisite impl.
- **QA and Docs run in parallel** once implementation is done.
- **All work happens in** `hackathon/circle-usdc-hackathon/` repo — single source of truth.
