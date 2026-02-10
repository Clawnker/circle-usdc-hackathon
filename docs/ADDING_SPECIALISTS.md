# Adding New Specialists to Hivemind Protocol

This guide walks you through creating a new specialist agent for the Hivemind Protocol.

## Overview

Specialists are modular agent implementations that handle specific types of tasks. Each specialist:
- Implements a standard interface
- Declares its capabilities via a **Capability Manifest** (V2)
- Can be called independently or as part of multi-hop workflows
- Charges micropayment fees via x402 protocol
- Has per-capability reputation and resilience (V2)

## File Structure

```
backend/src/specialists/
├── manifests/        # Capability Manifests (JSON)
│   ├── magos.json
│   ├── aura.json
│   └── your-specialist.json
├── magos.ts          # Market analysis specialist
├── aura.ts           # Social sentiment specialist
├── bankr.ts          # Wallet operations specialist
├── scribe.ts         # General assistant specialist
├── seeker.ts         # Web research specialist
└── your-specialist.ts # Your new specialist
```

## Step-by-Step Guide

### 1. Create the Specialist Module

Create a new file in `backend/src/specialists/` (e.g., `oracle.ts`):

```typescript
import { SpecialistResult } from '../types';

/**
 * Oracle Specialist
 * Provides on-chain data and smart contract insights
 */
class OracleSpecialist {
  /**
   * Handle a prompt and return result
   */
  async handle(prompt: string): Promise<SpecialistResult> {
    const startTime = Date.now();
    
    try {
      // Your specialist logic here
      const data = await this.processPrompt(prompt);
      
      return {
        success: true,
        data: {
          insight: data.summary,
          details: data,
        },
        confidence: 0.85,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        data: { error: error.message },
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Process the prompt and gather data
   */
  private async processPrompt(prompt: string): Promise<any> {
    // Implement your specialist's core logic
    // Examples:
    // - Call external APIs
    // - Query on-chain data
    // - Run analysis algorithms
    
    return {
      summary: "Your specialist response here",
      // ... additional data
    };
  }
}

export default new OracleSpecialist();
```

### 2. Create the Capability Manifest (V2)

In Hivemind V2, specialists must declare their capabilities in a JSON manifest file located in `backend/src/specialists/manifests/`. This manifest is used for semantic routing and discovery.

Create `backend/src/specialists/manifests/oracle.json`:

```json
[
  {
    "id": "security:contract-audit",
    "name": "Smart Contract Auditor",
    "description": "Analyzes smart contract source code for vulnerabilities, security flaws, and logic errors on Solana and EVM chains.",
    "category": "security",
    "subcategories": ["audit", "solidity", "rust"],
    "inputs": [{"type": "string", "description": "Contract address or source code"}],
    "outputs": {"type": "json", "description": "Vulnerability report with severity scores"},
    "confidenceScore": 0.9,
    "latencyEstimateMs": 5000
  },
  {
    "id": "defi:price-oracle",
    "name": "On-chain Price Oracle",
    "description": "Fetches real-time price data and liquidity metrics for any SPL or ERC-20 token directly from on-chain DEXs.",
    "category": "defi",
    "subcategories": ["price", "liquidity", "dex"],
    "inputs": [{"type": "string", "description": "Token symbol or mint address"}],
    "outputs": {"type": "json", "description": "Price data in USDC"},
    "confidenceScore": 0.98,
    "latencyEstimateMs": 1500
  }
]
```

Existing manifests in `backend/src/specialists/manifests/` can be used as references.

### 3. Capability Matching & Routing (V2)

Hivemind V2 uses **Semantic Vector Matching** for routing.
- The `description` fields in your manifest are used to generate embeddings.
- When a user submits a prompt, the Router performs a vector search against all registered capabilities.
- **Tip:** Better descriptions = better routing. Be specific about what your specialist can do.

For more details, see [docs/CAPABILITY_MATCHING.md](CAPABILITY_MATCHING.md).

### 4. Reputation & Resilience (V2)

Specialists are no longer just "on" or "off." The system tracks performance automatically:

- **Reputation Tracking**: V2 tracks per-capability reputation (success rate, accuracy, latency) with time decay. If your specialist starts failing or slowing down, its routing priority decreases. See [docs/REPUTATION_SYSTEM.md](REPUTATION_SYSTEM.md).
- **Fallback Chains**: If a specialist fails or its circuit breaker trips, the Router automatically engages the fallback system to try alternative specialists or a generic LLM fallback. See [docs/ROUTING_RESILIENCE.md](ROUTING_RESILIENCE.md).

### 5. Add to Type Definitions

Edit `backend/src/types.ts` and add your specialist to the `SpecialistType`:

```typescript
export type SpecialistType =
  | 'magos'
  | 'aura'
  | 'bankr'
  | 'scribe'
  | 'seeker'
  | 'oracle'  // Add your new specialist
  | 'general'
  | 'multi-hop';
```

### 6. Register in Dispatcher

Edit `backend/src/dispatcher.ts`:

#### Import the Specialist
```typescript
import oracle from './specialists/oracle';
```

#### Add Routing Rules (Legacy / Backup)
While V2 uses semantic matching, you can still add regex patterns in `routeWithRegExp()` for high-priority overrides:

```typescript
const rules: Array<{ specialist: SpecialistType; patterns: RegExp[]; weight: number }> = [
  // ... existing rules
  {
    specialist: 'oracle',
    patterns: [
      /on-chain|blockchain|smart contract|oracle/,
      /verify|proof|transaction|txn/,
    ],
    weight: 1,
  },
];
```

#### Add to Specialist Descriptions
```typescript
const SPECIALIST_DESCRIPTIONS: Record<SpecialistType, string> = {
  // ... existing descriptions
  oracle: 'On-chain data \u0026 smart contract insights',
};
```

#### Add Pricing
```typescript
const SPECIALIST_PRICING: Record<SpecialistType, { fee: string; description: string }> = {
  // ... existing pricing
  oracle: { fee: '0.0005', description: 'On-chain data \u0026 smart contract insights' },
};
```

#### Add to Call Handler
In the `callSpecialist()` function:

```typescript
export async function callSpecialist(specialist: SpecialistType, prompt: string): Promise<SpecialistResult> {
  const startTime = Date.now();
  
  switch (specialist) {
    case 'magos':
      return magos.handle(prompt);
    
    case 'aura':
      return aura.handle(prompt);
    
    case 'bankr':
      return bankr.handle(prompt);
    
    case 'scribe':
      return scribe.handle(prompt);
    
    case 'seeker':
      return seeker.handle(prompt);
    
    case 'oracle':
      return oracle.handle(prompt);  // Add your specialist
    
    // ... rest of function
  }
}
```

### 7. Configure Fees

Edit `backend/src/config.ts` to set the x402 fee:

```typescript
fees: {
  magos: 0.001,
  aura: 0.0005,
  bankr: 0.0001,
  scribe: 0.0001,
  seeker: 0.0001,
  oracle: 0.0005,  // Add your fee (in USDC)
},
```

### 8. Add Frontend Integration (Optional)

To add a visual node to the SwarmGraph:

Edit `frontend/src/components/SwarmGraph.tsx`:

```typescript
const agents = [
  // ... existing agents
  {
    id: 'oracle',
    name: 'Oracle',
    icon: Database,  // Import from lucide-react
    color: '#9333ea',  // Purple
    position: { x: 320, y: 50 },
    status: 'idle' as const,
  },
];
```

### 9. Test Your Specialist

#### Direct Call Test
```bash
curl -X POST http://localhost:3001/api/specialist/oracle \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Verify transaction 0x123..."}'
```

#### Routing Test
```bash
curl -X POST http://localhost:3001/api/dispatch \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Check on-chain data for SOL", "userId": "test"}'
```

#### Check Logs
Look for routing decision in backend logs:
```
[Router] Scores: { oracle: 1, ... } -> oracle
```

### 10. Document Your Specialist

Create a `skill.md` in the specialist directory (optional):

```markdown
# Oracle Specialist

**Capabilities:**
- On-chain data verification
- Smart contract analysis
- Transaction lookup

**Pricing:** 0.0005 USDC per query

**Example Queries:**
- "Verify transaction 0x123..."
- "Check smart contract 0xabc..."
```

## Best Practices

1. **Error Handling**: Always wrap external calls in try/catch
2. **Timeouts**: Set reasonable timeouts for API calls (5-10s)
3. **Validation**: Validate inputs before processing
4. **Logging**: Use `console.log` with `[SpecialistName]` prefix
5. **Confidence Scores**: Return realistic confidence values (0.0-1.0)
6. **Execution Time**: Track and return accurate execution times

## Common Patterns

### External API Call
```typescript
const response = await fetch('https://api.example.com/data', {
  timeout: 5000,
  headers: { 'Authorization': `Bearer ${process.env.API_KEY}` }
});
const data = await response.json();
```

### Caching Results
```typescript
private cache: Map<string, { data: any; expiry: number }> = new Map();

async getCachedData(key: string): Promise<any> {
  const cached = this.cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }
  // Fetch fresh data...
}
```

### Multi-Step Processing
```typescript
async handle(prompt: string): Promise<SpecialistResult> {
  const step1 = await this.fetchData(prompt);
  const step2 = await this.analyzeData(step1);
  const step3 = await this.formatResult(step2);
  
  return {
    success: true,
    data: step3,
    // ...
  };
}
```

## Troubleshooting

**Specialist not being routed:**
- Check routing patterns in `dispatcher.ts`
- Ensure your manifest JSON is valid and in the `manifests/` folder
- Test with explicit specialist call first

**Payment not working:**
- Verify fee is set in `config.ts`
- Check `BASE_URL` environment variable
- Ensure AgentWallet has sufficient balance

**Type errors:**
- Add specialist to `SpecialistType` in `types.ts`
- Ensure all switch/case statements are updated
- Run `npm run build` to check TypeScript errors

## Example: Complete Specialist

See `backend/src/specialists/magos.ts` for a full reference implementation with:
- External API integration (Jupiter)
- Error handling
- Result formatting
- Confidence scoring

---

**Need Help?**
- Review existing specialists for patterns
- Check the main [README.md](../README.md) for architecture overview
- See [QUICK_WINS.md](QUICK_WINS.md) for enhancement ideas
