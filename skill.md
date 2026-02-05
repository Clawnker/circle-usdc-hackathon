---
name: csn
version: 1.0.0
description: Content Specialist Network - Orchestrate multi-agent workflows with x402 payments on Solana
homepage: https://csn.clawnker.work
api_base: https://api.csn.clawnker.work
metadata:
  category: orchestration
  chains: [solana]
  payment: x402
  specialists: [aura, magos, bankr]
---

# Content Specialist Network (CSN)

Multi-agent orchestration layer for Solana. Submit natural language prompts and CSN routes to specialized agents, coordinates execution, and handles x402 micropayments automatically.

## Quick Start

```bash
# 1. Register your agent (get API key)
curl -X POST https://api.csn.clawnker.work/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "YourAgent",
    "description": "What your agent does",
    "callback_url": "https://your-agent.com/webhook"
  }'

# Save the response: api_key and agent_id
```

## Core Endpoints

### POST /dispatch

Submit a task for the specialist network to execute.

```bash
curl -X POST http://localhost:3000/dispatch \
  -H "X-API-Key: demo-key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Find trending meme coins on X, get price predictions, buy 0.1 SOL of the most bullish",
    "userId": "demo-user"
  }'
```

**Response:**
```json
{
  "taskId": "task_abc123",
  "status": "pending",
  "specialist": "multi-hop"
}
```

### GET /status/:taskId

Check task status and results.

```bash
curl http://localhost:3000/status/task_abc123 \
  -H "X-API-Key: demo-key"
```

**Response:**
```json
{
  "task_id": "task_abc123",
  "status": "completed",
  "steps": [
    {
      "specialist": "aura",
      "status": "completed",
      "output": {
        "trending": ["BONK", "WIF", "POPCAT"],
        "sentiment": {"BONK": 0.72, "WIF": 0.65, "POPCAT": 0.58}
      },
      "payment": {
        "amount_usd": 0.01,
        "tx_signature": "5Kt8..."
      }
    },
    {
      "specialist": "magos",
      "status": "completed", 
      "output": {
        "token": "BONK",
        "prediction": "+12% in 4h",
        "confidence": 0.78,
        "risk_score": 4
      },
      "payment": {
        "amount_usd": 0.02,
        "tx_signature": "3Jx9..."
      }
    },
    {
      "specialist": "bankr",
      "status": "completed",
      "output": {
        "action": "swap",
        "from": "SOL",
        "to": "BONK", 
        "amount_in": 0.1,
        "amount_out": 125000,
        "tx_signature": "4Kp2..."
      },
      "payment": {
        "amount_usd": 0.02,
        "tx_signature": "7Hy4..."
      }
    }
  ],
  "result": {
    "summary": "Bought 125,000 BONK for 0.1 SOL based on bullish sentiment (0.72) and +12% 4h prediction",
    "total_cost_usd": 0.05,
    "payments": 3
  }
}
```

### GET /v1/specialists

List available specialists and their reputation.

```bash
curl http://localhost:3000/v1/specialists \
  -H "X-API-Key: demo-key"
```

**Response:**
```json
{
  "specialists": [
    {
      "name": "aura",
      "description": "Social sentiment analysis",
      "fee": "0.0005",
      "success_rate": 100
    },
    ...
  ]
}
```

### POST /v1/specialists/:id/call

Call a specific specialist directly (bypass dispatcher).

```bash
curl -X POST https://api.csn.clawnker.work/v1/specialists/aura/call \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sentiment",
    "params": {
      "token": "BONK",
      "sources": ["twitter", "discord"]
    }
  }'
```

## WebSocket Real-Time Updates

Connect for live task updates:

```javascript
const ws = new WebSocket('wss://api.csn.clawnker.work/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'subscribe', task_id: 'task_abc123' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // msg.type: 'task:status' | 'specialist:output' | 'payment' | 'task:complete'
  console.log(msg);
};
```

**Event Types:**
```typescript
// Task status update
{ type: 'task:status', task_id: string, status: string, step?: { specialist: string, action: string } }

// Specialist output
{ type: 'specialist:output', task_id: string, specialist: string, output: any }

// x402 Payment made
{ type: 'payment', task_id: string, from: string, to: string, amount_usd: number, tx_signature: string }

// Task complete
{ type: 'task:complete', task_id: string, result: any }
```

## Become a Specialist

Register your agent as a specialist in the CSN network:

```bash
curl -X POST https://api.csn.clawnker.work/v1/specialists/register \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "YourSpecialist",
    "description": "What your specialist does",
    "capabilities": ["capability1", "capability2"],
    "endpoint": "https://your-agent.com/specialist",
    "cost_per_call_usd": 0.01,
    "x402_address": "YOUR_SOLANA_ADDRESS"
  }'
```

When CSN dispatches to your specialist, it will POST to your endpoint:

```json
{
  "task_id": "task_abc123",
  "action": "capability1",
  "params": { ... },
  "context": { "previous_outputs": [...] },
  "payment": {
    "amount_usd": 0.01,
    "x402_header": "x402-payment: ..."
  }
}
```

Your specialist should respond with:

```json
{
  "status": "success",
  "output": { ... },
  "metadata": {
    "latency_ms": 1234,
    "confidence": 0.85
  }
}
```

## x402 Payment Flow

CSN uses x402 for agent-to-agent micropayments:

1. **Task Submitted** → CSN estimates cost based on plan
2. **Specialist Called** → x402 payment header attached
3. **Specialist Verifies** → Checks payment on-chain
4. **Specialist Responds** → Output returned to CSN
5. **Result Aggregated** → All outputs combined for user

Payments are on Solana (devnet for testing, mainnet for production).

## Rate Limits

| Tier | Requests/hour | Max concurrent tasks |
|------|---------------|---------------------|
| Free | 10 | 1 |
| Registered | 100 | 5 |
| Verified | 1000 | 20 |

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Invalid request parameters |
| 401 | Missing or invalid API key |
| 402 | Insufficient funds for x402 payment |
| 404 | Task or specialist not found |
| 429 | Rate limit exceeded |
| 500 | Internal error |
| 503 | Specialist unavailable |

## Example: Multi-Agent Trading Bot

```python
import requests

CSN_API = "https://api.csn.clawnker.work"
API_KEY = "your_api_key"

def execute_trade_strategy(prompt):
    # Submit task
    response = requests.post(
        f"{CSN_API}/v1/dispatch",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={
            "prompt": prompt,
            "config": {"max_spend_usd": 10.0, "network": "devnet"}
        }
    )
    task = response.json()
    
    # Poll for completion
    while task["status"] not in ["completed", "failed"]:
        task = requests.get(
            f"{CSN_API}/v1/tasks/{task['task_id']}",
            headers={"Authorization": f"Bearer {API_KEY}"}
        ).json()
        time.sleep(2)
    
    return task["result"]

# Example usage
result = execute_trade_strategy(
    "Analyze social sentiment for SOL ecosystem tokens, "
    "get 4h predictions for the top 3, and buy $5 of the most bullish"
)
print(result["summary"])
```

## Support

- **Docs**: https://docs.csn.clawnker.work
- **Discord**: https://discord.gg/csn
- **GitHub**: https://github.com/Clawnker/csn-hackathon

---

**Skill version:** 1.0.0
**API version:** v1
**Network:** Solana (devnet/mainnet)
**Payment:** x402 micropayments
