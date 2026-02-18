# Hivemind V2 Completion Checklist

This checklist synthesizes the Dispatcher Audit, Agent Quality Review, and UX Review into a definitive roadmap for the V2 launch.

## MUST-HAVE (Blocking V2 Launch)
*Items that are broken, fake, or compromise the "intelligent" nature of the network.*

- [ ] **Fix Routing Regex Precedence**
  - **Description**: Resolve the bug where queries containing "price", "value", or "worth" are aggressively routed to Magos, bypassing multi-hop detection and other specialists.
  - **Component**: Dispatcher (Core)
  - **Effort**: S
  - **Target**: `backend/src/dispatcher.ts`

- [ ] **Real-World Social Search (Aura)**
  - **Description**: Replace `Math.random()` sentiment scores with actual data. Integrate Brave Search "social" filters or MoltX API to fetch live sentiment.
  - **Component**: Aura Agent
  - **Effort**: M
  - **Target**: `backend/src/specialists/aura.ts`

- [ ] **Live Market Data Integration (Magos)**
  - **Description**: Replace synthetic/randomized price targets with live market data from Jupiter API or CoinGecko.
  - **Component**: Magos Agent
  - **Effort**: M
  - **Target**: `backend/src/specialists/magos.ts`

- [ ] **Token Alias Recognition**
  - **Description**: Implement a mapping layer or LLM entity extraction so agents recognize "Bitcoin" as BTC and "Solana" as SOL, rather than defaulting to SOL analysis for everything.
  - **Component**: Intent Parsing
  - **Effort**: S
  - **Target**: `backend/src/specialists/magos.ts` / `backend/src/dispatcher.ts`

- [ ] **Restore DAG Planning (LLM-Planner)**
  - **Description**: Fix environment configuration for `GEMINI_API_KEY` and ensure the system defaults to DAG planning for complex queries instead of single-step fallbacks.
  - **Component**: Orchestration
  - **Effort**: S
  - **Target**: `backend/src/llm-planner.ts`

## SHOULD-HAVE (Important, Next Sprint)
*Items that significantly improve the quality of output and user trust.*

- [ ] **Upgrade Scribe to LLM-Synthesis**
  - **Description**: Replace the hardcoded "explanations" dictionary with a dynamic LLM call to provide contextual summaries and knowledge.
  - **Component**: Scribe Agent
  - **Effort**: S
  - **Target**: `backend/src/specialists/scribe.ts`

- [ ] **External Agent Reliability Fix (Sentinel)**
  - **Description**: Debug why Sentinel returns `null` results and implement a health check/validation layer for data returned by external agents.
  - **Component**: External Integration
  - **Effort**: M
  - **Target**: `backend/src/dispatcher.ts` (or External Specialist Handler)

- [ ] **Semantic Multi-Hop Triggering**
  - **Description**: Automatically trigger a DAG plan if the Capability Matcher identifies multiple high-confidence categories (e.g., `security` + `valuation`).
  - **Component**: Dispatcher
  - **Effort**: M
  - **Target**: `backend/src/dispatcher.ts`

- [ ] **Dynamic Response Synthesis**
  - **Description**: Use the Scribe agent to synthesize final answers from multi-agent results, replacing the "I'm not sure" hardcoded general fallback.
  - **Component**: Orchestration
  - **Effort**: S
  - **Target**: `backend/src/dispatcher.ts`

## NICE-TO-HAVE (Future)
*Polish, ecosystem expansion, and stretch goals.*

- [ ] **Native Base/EVM Support in Bankr**
  - **Description**: Expand `bankr` logic to handle Base/EVM token balances and contract interactions as natively as it handles Solana.
  - **Component**: Bankr Agent
  - **Effort**: L
  - **Target**: `backend/src/specialists/bankr.ts`

- [ ] **Niche Data Specialists**
  - **Description**: Introduce new specialists for betting odds, sports data, or political analysis to broaden the network's utility.
  - **Component**: Marketplace
  - **Effort**: L
  - **Target**: New Specialist Files

- [ ] **Advanced State/Context Handoff**
  - **Description**: Implement a structured "Context Object" that travels through the DAG, allowing agents to see previous results without re-parsing text.
  - **Component**: Orchestration
  - **Effort**: L
  - **Target**: `backend/src/llm-planner.ts`
