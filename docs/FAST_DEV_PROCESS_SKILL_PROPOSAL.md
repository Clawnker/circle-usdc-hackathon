# Proposal: Skill for Fast Fleet Development Process

## Why this should exist

The sprint flow used here was unusually effective because it enforced:
- scoped slices
- explicit dispatch/verify stages
- artifacted handoffs
- hard verification gates before closure
- production-safe defaults

That pattern is reusable and should be codified as a skill to reduce setup friction and keep quality high under speed.

---

## Proposed skill

**Name:** `fleet-sprint-ship` (or `fast-fleet-dev`)  
**Goal:** Turn a user goal into an execution-safe multi-sprint pipeline with built-in verification and release hygiene.

---

## Core behavior

1. **Plan phase**
   - create sprint plan with prioritized slices
   - define acceptance criteria + non-breaking constraints

2. **Dispatch phase**
   - spawn implementation stage(s) to coding agent(s)
   - create canonical artifacts/task records

3. **Verify phase**
   - run mandatory gates (`test`, `build`, optional `test:ci`)
   - reject closure on red gates

4. **Close phase**
   - update fleet artifact with evidence
   - update task/operation state to closed

5. **Release phase (optional)**
   - generate release notes/post-mortem
   - trigger deployment and live health verification

---

## Inputs

- repo path
- objective
- constraints (backward compatibility, no API breakage, etc.)
- preferred sprint size (small/medium/large)
- deploy target (optional)

---

## Outputs

- sprint artifact(s)
- verification evidence block
- release notes draft
- post-mortem draft
- optional deploy result summary

---

## Guardrails

- no production deploy without green verify gates
- no sprint closure without artifact + evidence
- no mutation of canonical state outside declared files
- explicit handling for noisy-but-non-fatal warnings

---

## Suggested trigger phrases

- “run sprint hardening”
- “kick off next sprint and verify”
- “ship this in fleet mode”
- “fast dev pipeline for this feature”

---

## MVP checklist

- [ ] scaffold skill folder + `SKILL.md`
- [ ] codify stage templates (`plan/implement/verify/close/release`)
- [ ] include acceptance criteria rubric
- [ ] include standard verify command matrix
- [ ] include post-deploy smoke template

---

## Recommendation

Yes, build this skill. It will save time, reduce variance, and preserve the quality bar we hit in this cycle.
