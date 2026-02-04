# Technical Spike Results: CSN Backend

## 1. AgentWallet Integration
- **Status**: ✅ **Verified**
- **Wallet Balances**:
    - Solana (`5xUugg8...`): 0 SOL
    - EVM (`0x676fF3...`): 0 ETH/USDC
- **x402 Payment Flow**: Verified via `dryRun`.
    - Example cost: 0.01 USDC on Base for `enrichx402` API.
    - Endpoint: `POST https://agentwallet.mcpay.tech/api/wallets/{username}/actions/x402/fetch`
- **Required API Endpoints**:
    - `GET /api/wallets/{username}/balances` - Check funds before dispatch.
    - `POST /api/wallets/{username}/actions/x402/fetch` - Execute paid specialist calls.

## 2. Helius RPC Setup
- **Status**: ⚠️ **Pending Funding**
- **Findings**:
    - Programmatic key creation is possible via `helius-cli`.
    - Cost: **1 USDC** (mainnet) + SOL for transaction fees.
    - `bankr` wallet (`Bq48Paxt...`) currently has ~0.97 SOL but **0 USDC**.
- **Connection Details**:
    - Endpoints will follow the format: `https://devnet.helius-rpc.com/?api-key=...`
- **Action**: Need to swap 0.05 SOL for 1 USDC in `bankr` wallet to complete Helius signup.

## 3. Recommended Architecture: Multi-Agent Dispatcher
- **Flow**:
    1. **Ingest**: Receive user prompt.
    2. **Classify**: Use a lightweight LLM (or regex for now) to route to `Magos`, `Aura`, or `bankr`.
    3. **Pre-flight**: Check if the specialist requires an x402 payment.
    4. **Execute**:
        - If free: Call specialist logic directly.
        - If paid: Use AgentWallet `/x402/fetch` proxy.
    5. **Aggregated Response**: Deliver final answer.

## 4. Backend Scaffold
- Created `hackathon/backend/` with:
    - `package.json`: Core dependencies defined.
    - `src/dispatcher.ts`: Skeleton for routing logic.
    - `src/specialists/`: Individual modules for specialists.
    - `README.md`: System documentation.

## What Works
- AgentWallet API communication and balance checking.
- x402 signing logic (via dryRun).
- Basic dispatcher routing logic.

## What Doesn't (Yet)
- Live Helius RPC (requires 1 USDC payment).
- Real specialist implementations (currently stubs).

## Blockers or Concerns
- **USDC Balance**: `bankr` needs 1 USDC to unlock Helius.
- **Agent Orchestration**: We need a strategy for parallel specialist calls if multiple are needed.

## Next Steps
1. Fund `bankr` with 1 USDC and run `helius signup`.
2. Implement real logic in `src/specialists/bankr.ts` using `@solana/web3.js`.
3. Integrate an LLM for smarter prompt classification in `dispatcher.ts`.
