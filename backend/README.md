# CSN Backend - Clawnker Specialist Network

## Architecture Overview

CSN is a multi-agent orchestration layer that routes user requests to specialized AI agents.

### Components

1.  **Dispatcher**: The central hub that receives requests, classifies them, and routes them to the appropriate specialist.
2.  **Specialists**:
    *   **Magos**: Logic and reasoning specialist.
    *   **Aura**: Creativity and sentiment specialist.
    *   **bankr**: On-chain action and wallet specialist.
3.  **AgentWallet**: Handles x402 payments for specialized API calls and manages agent-owned funds.

### Workflow

1.  **Request**: User sends a prompt to `/dispatch`.
2.  **Classification**: Dispatcher identifies the specialist needed.
3.  **Payment (x402)**: If the specialist requires payment, Dispatcher uses AgentWallet's `/x402/fetch` proxy to execute the call.
4.  **Execution**: The specialist processes the request.
5.  **Response**: Dispatcher returns the result to the user.

## Setup

1.  Install dependencies: `npm install`
2.  Set environment variables in `.env`:
    *   `AGENTWALLET_TOKEN`: Your AgentWallet API token.
    *   `AGENTWALLET_USERNAME`: Your AgentWallet username.
    *   `HELIUS_API_KEY`: Your Helius API key for Solana RPC.
3.  Run the dispatcher: `npm start`
