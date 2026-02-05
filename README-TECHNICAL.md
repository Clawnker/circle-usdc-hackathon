# Hivemind Protocol - Technical Documentation

## 🏗️ Project Architecture

### Overview
Hivemind Protocol is a multi-agent orchestration system built on Solana that enables autonomous agents to discover, coordinate with, and pay each other using the x402 micropayment protocol.

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  • Real-time WebSocket connection                        │
│  • React Flow swarm visualization                        │
│  • Task submission & monitoring                          │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP + WebSocket
┌────────────────────▼────────────────────────────────────┐
│               Backend (Node.js/TypeScript)               │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Dispatcher Core                     │    │
│  │  • Intent detection & routing                   │    │
│  │  • Multi-hop workflow orchestration             │    │
│  │  • Payment coordination via x402                │    │
│  └──────┬──────────────────────────────────┬───────┘    │
│         │                                   │            │
│  ┌──────▼──────┐  ┌──────────┐  ┌─────────▼────────┐   │
│  │ Specialists │  │   x402    │  │  Helius RPC      │   │
│  │ • Magos     │  │ Payments  │  │  (Solana)        │   │
│  │ • Aura      │  └───────────┘  └──────────────────┘   │
│  │ • Bankr     │                                         │
│  │ • Scribe    │                                         │
│  │ • Seeker    │                                         │
│  └─────────────┘                                         │
└─────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
hackathon/
├── backend/                  # Node.js backend server
│   ├── src/
│   │   ├── server.ts        # Express + WebSocket server
│   │   ├── dispatcher.ts    # Core orchestration logic
│   │   ├── config.ts        # Configuration loader
│   │   ├── types.ts         # TypeScript type definitions
│   │   ├── x402.ts          # x402 payment integration
│   │   ├── x402-protocol.ts # x402 protocol implementation
│   │   ├── solana.ts        # Helius RPC wrapper
│   │   ├── reputation.ts    # Specialist reputation system
│   │   ├── middleware/
│   │   │   └── auth.ts      # API key authentication
│   │   └── specialists/
│   │       ├── index.ts     # Specialist registry
│   │       ├── magos.ts     # Market analysis specialist
│   │       ├── aura.ts      # Social sentiment specialist
│   │       ├── bankr.ts     # DeFi execution specialist
│   │       ├── scribe.ts    # Documentation specialist
│   │       └── seeker.ts    # Web research specialist
│   ├── data/                # Persistent data (JSON files)
│   │   ├── tasks.json       # Task history
│   │   ├── payments.json    # Payment log
│   │   └── reputation.json  # Specialist reputation scores
│   ├── tests/
│   │   ├── api.test.sh      # API integration tests
│   │   └── fixtures.json    # Test fixtures
│   ├── scripts/
│   │   └── test-connection.ts  # Connection test utility
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example         # Environment template
│
├── frontend/                # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx     # Main UI component
│   │   │   ├── layout.tsx   # Root layout
│   │   │   └── globals.css  # Global styles
│   │   ├── components/
│   │   │   ├── TaskInput.tsx           # Prompt input
│   │   │   ├── SwarmGraph.tsx          # Agent visualization
│   │   │   ├── WalletPanel.tsx         # Wallet balance display
│   │   │   ├── PaymentFeed.tsx         # Payment activity
│   │   │   ├── MessageLog.tsx          # Agent communication
│   │   │   ├── ResultDisplay.tsx       # Task results
│   │   │   ├── ResultCard.tsx          # Result summary
│   │   │   ├── Marketplace.tsx         # Agent marketplace
│   │   │   ├── AgentCard.tsx           # Agent profile card
│   │   │   ├── AgentBadge.tsx          # Agent status badge
│   │   │   ├── AgentDetailModal.tsx    # Agent details modal
│   │   │   ├── ActivityFeed.tsx        # System activity log
│   │   │   ├── QueryHistory.tsx        # Past query history
│   │   │   └── index.ts                # Component exports
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts         # WebSocket hook
│   │   └── types/
│   │       └── index.ts                # Frontend type definitions
│   ├── public/              # Static assets
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── docs/                    # Documentation
│   ├── PRD-v2.md           # Product Requirements Document
│   ├── PITCH.md            # Pitch deck content
│   ├── DEMO-SCRIPT.md      # Demo walkthrough
│   └── ROADMAP.md          # Development roadmap
│
├── agents/                  # Agent test results
│   └── qa/
│       ├── query-tests.md
│       └── test-results.md
│
├── skill.md                 # Agent-to-agent API spec (Skill format)
├── README.md                # Main project README
├── BRAND.md                 # Brand guidelines
├── MVP.md                   # MVP definition
└── PRD.md                   # Original PRD

```

## 🔧 Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Solana CLI (for wallet management)
- Access to AgentWallet API (for x402 payments)
- Helius API key (for Solana RPC)

### Backend Setup

1. **Install dependencies:**
   ```bash
   cd hackathon/backend
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Required environment variables:**
   ```env
   # Server
   PORT=3000
   NODE_ENV=development
   
   # AgentWallet (x402 payments)
   AGENTWALLET_API_URL=https://agentwallet.mcpay.tech/api
   AGENTWALLET_USERNAME=your_username
   AGENTWALLET_TOKEN=your_token
   
   # Helius (Solana RPC)
   HELIUS_API_KEY=your_helius_key
   
   # API Security
   API_KEYS=demo-key,your-api-key
   ENFORCE_PAYMENTS=false  # Set to true for production
   
   # External APIs (optional)
   MOLTX_API_KEY=your_moltx_key
   CLAWARENA_API_KEY=your_clawarena_key
   BANKR_API_KEY=your_bankr_key
   ```

4. **Test connections:**
   ```bash
   npm run test:connection
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

Server will run on `http://localhost:3000`

### Frontend Setup

1. **Install dependencies:**
   ```bash
   cd hackathon/frontend
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local
   ```

3. **Required environment variables:**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000
   NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
   NEXT_PUBLIC_API_KEY=demo-key
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

Frontend will run on `http://localhost:3001`

## 🎯 Key Features

### 1. Multi-Agent Orchestration
- **Intent Detection:** Analyzes user prompts to determine required specialists
- **Multi-Hop Workflows:** Chains multiple agents for complex tasks
- **Parallel Execution:** Coordinates multiple specialists simultaneously
- **Context Passing:** Shares outputs between agents in workflows

### 2. x402 Micropayments
- **Pay-per-call:** Each specialist call requires USDC payment
- **Automatic Settlement:** Payments executed on Solana devnet
- **Transparent Pricing:** Fixed fees displayed upfront
- **Payment Verification:** On-chain confirmation for all transactions

### 3. Real-Time Communication
- **WebSocket Updates:** Live task status and progress
- **Message Streaming:** Agent-to-agent communication visible to users
- **Payment Tracking:** Real-time payment confirmation
- **Activity Feed:** Complete audit trail of all actions

### 4. Specialist Network
- **Magos** (0.001 USDC): Market predictions & risk analysis
- **Aura** (0.0005 USDC): Social sentiment & trending detection
- **Bankr** (0.0001 USDC): Solana wallet operations & DeFi
- **Scribe** (0.0001 USDC): Documentation & general assistance
- **Seeker** (0.0001 USDC): Web research & information retrieval

## 🔄 API Workflow

### Task Submission Flow

```
1. User submits prompt
   POST /dispatch
   ↓
2. Dispatcher analyzes intent
   • Detects multi-hop if needed
   • Routes to specialist(s)
   ↓
3. Payment check
   • Verifies wallet balance
   • Checks x402 requirements
   ↓
4. Specialist execution
   • Calls specialist API
   • Executes x402 payment
   ↓
5. Result aggregation
   • Combines specialist outputs
   • Updates task status
   ↓
6. WebSocket broadcast
   • Pushes updates to client
   • Completes task
```

### Multi-Hop Example

**Prompt:** "Find trending meme coins and buy 0.1 SOL of the most bullish one"

**Execution:**
```
Step 1: Aura → Find trending coins
  Output: ["BONK", "WIF", "POPCAT"]
  Payment: 0.0005 USDC
  ↓
Step 2: Magos → Analyze sentiment
  Input: ["BONK", "WIF", "POPCAT"]
  Output: "BONK" (highest bullish score)
  Payment: 0.001 USDC
  ↓
Step 3: Bankr → Execute swap
  Input: "Buy 0.1 SOL of BONK"
  Output: Transaction signature
  Payment: 0.0001 USDC
  ↓
Total Cost: 0.0015 USDC + gas
```

## 🧪 Testing

### Backend Tests
```bash
cd hackathon/backend

# Test API endpoints
bash tests/api.test.sh

# Test specialist directly
curl -X POST http://localhost:3000/test/magos \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-key" \
  -d '{"prompt": "Predict SOL price for 24h"}'
```

### Frontend Testing
```bash
cd hackathon/frontend

# Run development server and test in browser
npm run dev

# Build for production
npm run build
```

## 🔐 Security

### Authentication
- API key required for all endpoints (except `/health`)
- Keys stored in `process.env.API_KEYS`
- Rate limiting recommended for production

### SSRF Protection
- Callback URL validation in dispatcher
- Blocks localhost, private IPs, and cloud metadata endpoints
- Only allows HTTP/HTTPS schemes

### Payment Security
- Balance checks before execution
- x402 payment verification on-chain
- Transaction signatures logged for audit

## 📊 Data Persistence

All data stored in JSON files in `backend/data/`:

- **tasks.json**: Complete task history with all metadata
- **payments.json**: Payment transaction log
- **reputation.json**: Specialist success/failure tracking

## 🐛 Common Issues & Solutions

### Backend won't start
- Check that port 3000 is available
- Verify `.env` configuration
- Ensure AgentWallet and Helius credentials are valid

### Frontend can't connect to backend
- Verify backend is running on correct port
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Ensure CORS is enabled in backend

### x402 payments failing
- Check AgentWallet balance (needs USDC)
- Verify `AGENTWALLET_TOKEN` is correct
- Review payment logs in `data/payments.json`

### WebSocket not connecting
- Check firewall settings
- Verify WebSocket path `/ws` is accessible
- Ensure no proxy blocking WebSocket upgrade

## 🚀 Deployment

### Backend (Production)
```bash
cd hackathon/backend
npm run build
npm start
```

### Frontend (Production)
```bash
cd hackathon/frontend
npm run build
npm run start
```

### Environment Recommendations
- Use PM2 or similar for process management
- Enable `ENFORCE_PAYMENTS=true` in production
- Set up reverse proxy (nginx) for SSL
- Configure rate limiting and monitoring

## 📚 Additional Resources

- [x402 Protocol Specification](https://x402.org)
- [Helius API Documentation](https://docs.helius.dev)
- [AgentWallet Integration Guide](https://agentwallet.mcpay.tech/docs)
- [Solana Web3.js Reference](https://solana-labs.github.io/solana-web3.js/)

## 🤝 Contributing

For hackathon participants:
1. Review existing specialists in `backend/src/specialists/`
2. Follow TypeScript types in `backend/src/types.ts`
3. Add tests for new features
4. Update documentation

## 📝 License

MIT License - Built for Colosseum Hackathon 2024
