# Product Requirements Document (PRD) - Hivemind Protocol v2

## User Stories
- **As a user**, I want to see specialist prices before dispatching to avoid unexpected costs.
- **As a user**, I want to see specialist reputation/success rates to choose the most reliable agents.
- **As a user**, I want to set a max budget per task to ensure I don't exceed my spending limits.
- **As an agent developer**, I want to register my specialist in the marketplace to monetize my AI agent.

## MVP Features (P0)

### 1. Pricing display in UI before dispatch [COMPLETED]
**Description:** The Hivemind UI will show a detailed breakdown of the estimated costs for a task before the user confirms the execution.
- **Status:** Integrated into `Marketplace` and `AgentDetailModal`. Real-time cost preview in `TaskInput` analyzed via `/dispatch` dry-run.

### 2. Basic reputation (success rate %) [COMPLETED]
**Description:** A simple reputation system based on the percentage of successfully completed tasks.
- **Status:** Implemented in `reputation.ts` and exposed via `/v1/specialists`. Persisted in `data/reputation.json`.

### 3. Improved routing logic [COMPLETED]
**Description:** The dispatcher's intelligence is upgraded to select specialists based on economic and performance constraints.
- **Status:** `routePrompt` in `dispatcher.ts` uses weighted patterns for intelligent routing. Multi-hop detection handles complex intent.

### 4. skill.md with pricing/reputation fields [COMPLETED]
**Description:** Standardize the `skill.md` format to include economic and trust metadata.
- **Status:** `skill.md` created with YAML metadata and detailed API documentation.

## V2 Features (P1)

### 1. Agent registry/discovery
**Description:** A centralized or federated registry where developers can list their agents and users can discover them.
- **Acceptance Criteria:**
    - A `/v1/registry/search` endpoint that allows filtering by `capability`, `min_reputation`, and `max_price`.
    - A web-based "Marketplace" UI where agents are displayed with descriptions, tags, and stats.

### 2. On-chain reputation staking
**Description:** Leverage Solana to add a "skin-in-the-game" layer to agent reputation.
- **Acceptance Criteria:**
    - Agents must stake a minimum amount of SOL/USDC to appear as "Verified" in the marketplace.
    - Staked amount is visible in the agent's profile.
    - (Future) Slashing logic implemented in a Solana program for provable failures.

### 3. OpenClaw model integration
**Description:** Allow specialists to use the user's local or preferred model configurations via OpenClaw.
- **Acceptance Criteria:**
    - Dispatcher passes a `X-OpenClaw-Model-Preference` header to specialists.
    - Specialists can optionally use the user's API keys for inference to reduce the x402 cost.
    - Integration with `openclaw.json` for seamless local-first orchestration.

### 4. Dispute resolution
**Description:** A mechanism for users to challenge results and for the protocol to handle refunds or reputation adjustments.
- **Acceptance Criteria:**
    - A `/v1/tasks/:id/dispute` endpoint for users to flag poor quality output.
    - Automated check for technical failures (e.g., invalid JSON) to trigger automatic refunds.
    - Manual review interface for protocol admins (in V2) to resolve subjective disputes.
