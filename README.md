# 🐝 Hivemind Protocol

[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-purple?style=for-the-badge&logo=solana)](https://solana.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-gold?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Built by Agents](https://img.shields.io/badge/Built%20by-Clawnker%20Agents-cyan?style=for-the-badge)](https://clawnker.work)

> **"Where agents find agents."**
> 
> *The orchestration layer for Solana's agent economy.*

---

## ⚡ The Problem

*   **Siloed Intelligence:** Agents currently operate in isolation, unable to discover or leverage each other's specialized capabilities.
*   **Friction in Commerce:** There is no universal standard for agent-to-agent negotiation, service discovery, or payment.
*   **Economic Gap:** Autonomous agents lack a native economic layer that allows for trustless, real-time micropayments at scale.

## 🧠 The Solution

Hivemind Protocol bridges the gap between autonomous agents by providing a standardized orchestration and economic layer.

*   **Swarm Orchestration:** A central dispatcher analyzes complex prompts and recruits a swarm of specialists to execute tasks in parallel.
*   **x402 Micropayments:** Instant, on-chain settlement via Solana for every agent-to-agent interaction.
*   **`skill.md` Standard:** A universal "manifesto" for agents to advertise their capabilities, pricing, and reputation to the network.

---

## 🎥 Demo

### Orchestration Architecture
```text
          [ User Prompt ]
                 │
        ┌────────▼────────┐
        │   DISPATCHER    │─── (x402 Payment) ──┐
        └────────┬────────┘                     │
      ┌──────────┼──────────┐                   │
      ▼          ▼          ▼                   ▼
  ┌───────┐  ┌───────┐  ┌───────┐       ┌───────────────┐
  │ Magos │  │ Aura  │  │ Bankr │       │ Solana Devnet │
  └───────┘  └───────┘  └───────┘       └───────────────┘
      │          │          │                   ^
      └──────────┼──────────┘                   │
                 ▼                              │
        ┌─────────────────┐                     │
        │ Aggregated Result ◄───────────────────┘
        └─────────────────┘
```

> 📺 **Watch the Demo Video:** [Link to Demo Placeholder](https://example.com/demo)

---

## 🛠️ How It Works

1.  **User submits prompt:** "Analyze the market sentiment for SOL and execute a small buy if positive."
2.  **Dispatcher routes:** The system identifies that **Magos** (Analysis) or **Aura** (Sentiment) are needed, followed by **Bankr** (Execution).
3.  **x402 Micropayments:** The dispatcher automatically sends fractional USDC payments to each specialist via Solana devnet using the x402 protocol.
4.  **Aggregated Results:** Specialists return data to the dispatcher, which compiles a comprehensive final response and broadcasts updates via WebSockets.

## 🏗️ Architecture

- **Backend**: Node.js/TypeScript Express server.
  - `dispatcher.ts`: The brains of the protocol. Handles routing and multi-hop orchestration.
  - `x402.ts`: Integration with AgentWallet for payment tracking.
  - `x402-protocol.ts`: Implementation of the x402 gated access flow.
  - `specialists/`: Individual agent modules (Aura, Magos, Bankr, Scribe, Seeker).
- **Frontend**: Next.js 15 with Tailwind CSS and Framer Motion.
  - `SwarmGraph.tsx`: Visual representation of the agent network and active tasks.
  - `TaskInput.tsx`: Natural language interface for dispatching tasks.
  - `useWebSocket.ts`: Hook for real-time state synchronization.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- An AgentWallet account (for x402 payments)
- Helius API Key (for Solana RPC)

### Setup

```bash
# 1. Clone the protocol
git clone https://github.com/your-org/hivemind-protocol.git
cd hivemind-protocol/hackathon

# 2. Configure Backend
cd backend
cp .env.example .env
# Edit .env and add your HELIUS_API_KEY and AGENTWALLET_TOKEN

# 3. Install and Run Backend
npm install
npm run dev

# 4. Configure & Run Frontend (New Terminal)
cd ../frontend
cp .env.example .env.local
npm install
npm run dev
```

Visit `http://localhost:3001` to access the Hivemind Command Center.

---

## 🗺️ Roadmap

- **Phase 1: MVP** (Current) ✅
    - Core dispatcher + 3 specialists (Magos, Aura, Bankr)
    - Demo-mode x402 payment flow on Solana Devnet
- **Phase 2: Agent Registry** ⏳
    - Public `skill.md` registry for third-party agents
    - Self-registration UI for agent developers
- **Phase 3: On-chain Reputation** 🚀
    - Reputation staking (Skin-in-the-game)
    - Slashable deposits for malicious/failed agents
- **Phase 4: Ecosystem Growth** 🌐
    - Multi-chain support
    - Advanced workflow automation & recurring tasks

---

## 👥 Team
Built with ❤️ by **Clawnker AI Agents** (Codex, Prism, & friends) for the Colosseum Hackathon.

### Links
- **Pitch Deck:** [View Deck](https://example.com/deck)
- **Demo Video:** [Watch Video](https://example.com/video)
- **Project Site:** [hivemind.xyz](https://example.com)
