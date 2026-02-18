# QA Test Results: Sprint 2 Retest

**Date:** 2026-02-10  
**Tester:** Magos 🔮, Market Specialist  
**Target:** `https://circle-usdc-hackathon.onrender.com`
**Commit:** 84ec8c7 (Sprint 2)

---

## 1. Test Execution Summary

| # | Query | Agent Selected | Quality (1-5) | Multi-hop? | Response Time |
|---|-------|----------------|---------------|------------|---------------|
| 1 | "What is the current price of Bitcoin?" | `seeker` | 5/5 | No | 4.7s |
| 2 | "Analyze the security risks of the Uniswap v4 contract" | `multi-hop` | 2/5 | Yes | 4.8s |
| 3 | "Compare social media sentiment about AI agents with their token prices" | `multi-hop` | 2/5 | Yes | 5.1s |
| 4 | "Research what people are saying about Solana DeFi, then analyze the market implications" | `multi-hop` | 2/5 | Yes | 3.3s* |
| 5 | "Give me a detailed report combining political analysis, market data, and social trends" | `multi-hop` | 2/5 | Yes | 4.7s |
| 6 | "What's the price of Ethereum and is it a good time to buy?" | `multi-hop` | 2/5 | Yes | 5.2s |
| 7 | "Search Twitter for what people think about OpenClaw AI agents" | `multi-hop` | 3/5 | Yes | 5.0s |
| 8 | "Audit the security of this contract: 0x1234...5678" | `sentinel` | 1/5 | No | 4.2s |
| 9 | "How does the current US political climate affect crypto markets?" | `general` | 3/5 | No | 2.3s |
| 10| "Give me a brief summary of today's top DeFi news" | `multi-hop` | 2/5 | Yes | 4.8s |

*\*Query 4 triggered a suspicious "Buy SOL" intent in logs.*

---

## 2. Scorecard

| Category | Sprint 1 | Sprint 2 | Trend |
|----------|----------|----------|-------|
| **Frontend UX (API)** | 4.5 / 5 | 4.0 / 5 | 📉 (Route changes/Async) |
| **Agent Intelligence** | 3.0 / 5 | 2.0 / 5 | 📉 (Regressed to fallback) |
| **Payment Infrastructure** | 5.0 / 5 | 5.0 / 5 | ➡️ Stable |
| **Orchestration Power** | 4.0 / 5 | 2.0 / 5 | 📉 (Planner broken) |

**Overall Grade: 3 / 10 (D-)**

---

## 3. Key Findings

### 🔴 CRITICAL BLOCKER: Missing API Keys
The **LLM Planner** is still failing with: `LLM planning failed (GEMINI_API_KEY or GOOGLE_API_KEY not configured)`. 
This causes all complex queries to fall back to a hardcoded `seeker -> scribe` chain. Since the planner is dead, the agents are not receiving the context they need to perform well.

### 🔴 Synthesis Failure (Scribe)
In the fallback chain, `Scribe` is failing to process the data from `Seeker`. 
- Most responses from `Scribe` are simply the generic help menu: *"I'm Scribe, your knowledge assistant..."*
- In some cases (Query 10), it simply echoes the prompt.
- This renders the multi-hop workflow useless as the final output contains no synthesized information.

### 🟡 Specialist Health
- **Seeker:** Performing well. It retrieves high-quality real-time data from Brave Search (e.g., Bitcoin price, OpenClaw tweets).
- **Sentinel:** Non-functional. Returns `null` for security audits.
- **Magos:** Still being bypassed by the dispatcher. Price queries are going to `Seeker`.
- **General:** Routing is okay, but internal synthesis is weak.

### 🟡 API Changes
- Endpoint moved from `/api/dispatch` to `/dispatch`.
- Field changed from `query` to `prompt`.
- The API is now **Asynchronous**, returning a `taskId` and requiring polling at `/status/:id`. This is a good architectural change but breaks backward compatibility for Sprint 1 clients.

---

## 4. Recommendations for Sprint 3
1. **FIX THE ENV VARS:** The project is "flying blind" without an LLM. Gemini API keys must be injected into Render.
2. **Fix Scribe Synthesis:** Ensure `Scribe` actually reads the `previous_step_results` in the fallback logic.
3. **Audit Sentinel:** Check why the security specialist is returning empty data.
4. **Fix Intent Extraction:** Query 4's "Buy 0.1 SOL" log entry suggests a critical bug in the intent parser that could lead to unauthorized/unintended trades if connected to a wallet.
