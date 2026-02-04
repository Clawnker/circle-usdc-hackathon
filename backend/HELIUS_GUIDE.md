# Helius RPC Setup Guide

To obtain a Helius API key programmatically:

1.  **Install Helius CLI**: `npm install -g helius-cli`
2.  **Generate Keypair**: `helius keygen` (Creates `~/.helius-cli/keypair.json`)
3.  **Fund Wallet**: Send 1 USDC and ~0.001 SOL to the address generated.
4.  **Signup**: `helius signup --json`
5.  **Extract Key**: The API key and RPC endpoints will be in the JSON response.

## Devnet RPC Access

Once you have an API key, you can access devnet via:
`https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY`
