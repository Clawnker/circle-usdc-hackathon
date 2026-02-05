# Security Audit Report: Hivemind Protocol
**Date:** February 4, 2026  
**Auditor:** Security Expert Agent  
**Scope:** Backend API, Authentication, Payment Security, Infrastructure

---

## Executive Summary

This audit identified **7 Critical**, **5 High**, **6 Medium**, and **4 Low** severity vulnerabilities across the Hivemind Protocol backend. Immediate remediation is required before production deployment.

**Critical Findings:**
- 🔴 **CRITICAL**: Hardcoded API keys and secrets committed to repository
- 🔴 **CRITICAL**: Private keypair exposed in repository
- 🔴 **CRITICAL**: No payment signature verification (x402 bypass)
- 🔴 **CRITICAL**: WebSocket connections bypass authentication
- 🔴 **CRITICAL**: CORS configured to allow all origins
- 🔴 **CRITICAL**: Missing rate limiting enables DoS attacks
- 🔴 **CRITICAL**: SSRF vulnerability in callback URL validation (partially mitigated)

---

## 1. Authentication & Authorization

### 🔴 CRITICAL: API Keys Exposed in .env File
**Location:** `backend/.env` (lines 4-24)  
**Finding:** Production API keys and secrets committed to the repository:
```
AGENTWALLET_FUND_TOKEN=mf_69df58eca5aab2d4a0897552f87e610d7c0eef78888a2b1cc5e49e69c9b7436b
HELIUS_API_KEY=ae7253e1-6ea2-45a2-a071-d3bbcd740164
CLAWARENA_API_KEY=claw_sk_1cotx5qs3mt782liywxhfmdg9hf4c2nn
MOLTX_API_KEY=moltx_sk_1280e4f8045a43f4976732d099a8716f130460651b2647058edca8cbc2bc54b1
BANKR_API_KEY=bk_SHV4FMGURSAWZ8MZYYNQXEK38YSN3AC4
```

**Impact:** Attackers can use these credentials to:
- Drain AgentWallet funds
- Consume Helius RPC quota
- Abuse third-party services (ClawArena, MoltX, Bankr)

**Remediation:**
1. **IMMEDIATE**: Rotate ALL exposed API keys
2. Remove `.env` from git history: `git filter-branch --force --index-filter "git rm --cached --ignore-unmatch backend/.env" HEAD`
3. Add `.env` to `.gitignore` (already present, but enforcement failed)
4. Use environment variables or secret management (AWS Secrets Manager, HashiCorp Vault, 1Password)
5. Never commit secrets again - use pre-commit hooks to scan for secrets

---

### 🔴 CRITICAL: Private Keypair Exposed
**Location:** `backend/devnet-keypair.json`  
**Finding:** Solana private key stored in plaintext and committed to repository:
```json
[231,148,171,40,34,202,119,12,250,50,12,239,210,104,82,212,...]
```

**Impact:**
- Anyone with access to the repository can control the wallet
- Funds can be stolen
- Unauthorized transactions can be executed

**Remediation:**
1. **IMMEDIATE**: Generate a new keypair and migrate funds
2. Remove file from git history
3. Store keypairs securely using:
   - Hardware wallets (Ledger, Trezor)
   - Key management systems (AWS KMS, Google Cloud KMS)
   - Encrypted local storage with proper key management
4. NEVER commit private keys to version control

---

### 🟠 HIGH: Weak API Key Authentication
**Location:** `backend/src/middleware/auth.ts` (lines 14-18)  
**Finding:** API key validation is overly simplistic:
```typescript
const validKeys = apiKeysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);
if (!apiKey || !validKeys.includes(apiKey)) {
  return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
}
```

**Issues:**
- No key rotation mechanism
- No per-key permissions/scopes
- No audit logging of key usage
- API keys transmitted in headers/query params (visible in logs)
- Using API key directly as user ID (`(req as any).user = { id: apiKey }`)

**Remediation:**
1. Implement JWT-based authentication with short expiry times
2. Add scopes/permissions per API key
3. Hash API keys before storage
4. Log all authentication attempts (success/failure)
5. Implement key rotation policy
6. Use API key hashing: `bcrypt.compare(providedKey, storedHashedKey)`

---

### 🔴 CRITICAL: WebSocket Authentication Bypass
**Location:** `backend/src/server.ts` (lines 340-362)  
**Finding:** WebSocket connections bypass authentication entirely:
```typescript
wss.on('connection', (ws: WebSocket) => {
  console.log('[WS] Client connected');
  // NO AUTHENTICATION CHECK
  wsClients.set(ws, new Set());
```

**Impact:**
- Anyone can connect to WebSocket endpoint
- Can subscribe to any task updates (data leakage)
- Can dispatch tasks without authentication
- Can bypass rate limiting

**Remediation:**
1. Require authentication token during WebSocket handshake:
```typescript
wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const token = new URL(req.url, 'ws://localhost').searchParams.get('token');
  if (!validateToken(token)) {
    ws.close(1008, 'Unauthorized');
    return;
  }
  // ... rest of connection logic
});
```
2. Validate user permissions before allowing subscriptions
3. Implement connection limits per user/IP

---

### 🟡 MEDIUM: Missing Authorization on Protected Routes
**Location:** `backend/src/server.ts` (lines 132-142)  
**Finding:** `/tasks` endpoint filters by user ID but doesn't validate ownership:
```typescript
app.get('/tasks', (req: Request, res: Response) => {
  const user = (req as any).user;
  const tasks = getRecentTasks(limit * 5).filter(t => t.userId === user.id).slice(0, limit);
```

**Issue:** User ID is the API key itself, which could be shared or leaked.

**Remediation:**
1. Use proper user authentication with unique user IDs
2. Validate task ownership on all task-related endpoints
3. Add audit logging for data access

---

## 2. Input Validation

### 🟠 HIGH: No Input Sanitization on User Prompts
**Location:** Multiple specialist handlers, dispatcher  
**Finding:** User-provided `prompt` field is not validated or sanitized:
```typescript
const { prompt } = req.body;
if (!prompt) {
  return res.status(400).json({ error: 'Prompt is required' });
}
// prompt used directly without sanitization
```

**Risks:**
- Prompt injection attacks against AI models
- XSS if prompts are displayed in frontend without escaping
- Log injection via malicious prompts
- Excessive token consumption (no length limit)

**Remediation:**
1. Add input validation:
```typescript
const MAX_PROMPT_LENGTH = 2000;
if (!prompt || typeof prompt !== 'string') {
  return res.status(400).json({ error: 'Prompt must be a string' });
}
if (prompt.length > MAX_PROMPT_LENGTH) {
  return res.status(400).json({ error: `Prompt too long (max ${MAX_PROMPT_LENGTH})` });
}
const sanitizedPrompt = prompt.trim();
```
2. Implement content filtering for malicious patterns
3. Rate limit by prompt complexity/length
4. HTML-escape prompts before display in frontend

---

### 🟡 MEDIUM: JSON Parsing Without Error Handling
**Location:** Multiple files (server.ts, config.ts, dispatcher.ts)  
**Finding:** JSON parsing can fail and crash the application:
```typescript
// server.ts:350
const message = JSON.parse(data.toString());
handleWSMessage(ws, message);
```

**Remediation:**
Use try-catch consistently:
```typescript
try {
  const message = JSON.parse(data.toString());
  handleWSMessage(ws, message);
} catch (error) {
  ws.send(JSON.stringify({ error: 'Invalid JSON' }));
}
```

Note: This is already implemented in WebSocket handler, but verify all JSON.parse() calls have error handling.

---

### 🟡 MEDIUM: Missing Validation on Specialist ID
**Location:** `backend/src/server.ts` (line 42)  
**Finding:** Specialist ID from URL params is not validated:
```typescript
const { id } = req.params;
const fee = (config.fees as any)[id] || 0.001;
```

**Risks:**
- Access to undefined specialists
- Type confusion attacks
- Could access internal properties via prototype pollution

**Remediation:**
```typescript
const VALID_SPECIALISTS = ['magos', 'aura', 'bankr', 'seeker', 'scribe'];
const { id } = req.params;
if (!VALID_SPECIALISTS.includes(id)) {
  return res.status(400).json({ error: 'Invalid specialist ID' });
}
```

---

## 3. Secrets Management

### 🔴 CRITICAL: Secrets Exposed in Git Repository
**Location:** `backend/.env`  
**Finding:** Comprehensive list of exposed credentials (see section 1).

**Additional Findings:**
- BASE_URL includes Cloudflare tunnel: `workshop-dont-franklin-turns.trycloudflare.com`
- All specialist wallets point to same treasury (fine for demo, risky for prod)

**Remediation:** See section 1 recommendations.

---

### 🟡 MEDIUM: Secrets Potentially Logged
**Location:** Multiple console.log statements throughout codebase  
**Finding:** 11 console.log/error statements in server.ts alone that could leak sensitive data:
```typescript
console.log(`[x402] Payment received for ${id}, signature: ${String(paymentSignature).slice(0, 20)}...`)
```

**Remediation:**
1. Implement structured logging with log levels
2. Sanitize logs to remove sensitive data
3. Use a logging library (Winston, Pino) with redaction:
```typescript
const logger = pino({
  redact: {
    paths: ['req.headers.authorization', 'req.headers["x-api-key"]'],
    remove: true
  }
});
```

---

### 🟢 LOW: Environment Variable Fallbacks Expose Defaults
**Location:** `backend/src/config.ts` (lines 56-84)  
**Finding:** Default values for sensitive config:
```typescript
username: agentWalletConfig?.username || process.env.AGENTWALLET_USERNAME || 'claw',
token: agentWalletConfig?.apiToken || process.env.AGENTWALLET_FUND_TOKEN || '',
```

**Recommendation:**
- Require critical environment variables to be set explicitly
- Fail fast on startup if missing:
```typescript
if (!token) {
  throw new Error('AGENTWALLET_TOKEN is required');
}
```

---

## 4. Payment Security (x402)

### 🔴 CRITICAL: No Payment Signature Verification
**Location:** `backend/src/server.ts` (lines 48-57)  
**Finding:** Payment signatures are accepted without any verification:
```typescript
const paymentSignature = req.headers['payment-signature'] || req.headers['x-payment'];
if (!paymentSignature) {
  // Return 402
}
console.log(`[x402] Payment received for ${id}, signature: ${String(paymentSignature).slice(0, 20)}...`);
// Payment verified - execute specialist
const result = await callSpecialist(id as SpecialistType, prompt);
```

**Impact:**
- **Complete payment bypass**: Attackers can send ANY string as payment signature
- Free access to paid specialists
- No on-chain verification of transactions
- Revenue loss

**Remediation:**
```typescript
// Verify the signature on-chain
import { Connection, PublicKey } from '@solana/web3.js';

async function verifyPayment(signature: string, expectedAmount: number, recipient: string): Promise<boolean> {
  const connection = new Connection(config.helius.devnet);
  
  try {
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });
    
    if (!tx || !tx.meta) {
      return false;
    }
    
    // Verify transaction is confirmed
    if (tx.meta.err) {
      return false;
    }
    
    // Verify recipient and amount
    // Parse transfer instruction to validate recipient and amount
    // Implementation depends on SPL token transfer parsing
    
    return true;
  } catch (error) {
    return false;
  }
}

// In handler:
if (!await verifyPayment(paymentSignature, fee, TREASURY_WALLET)) {
  return res.status(402).json({ error: 'Invalid payment signature' });
}
```

---

### 🟠 HIGH: No Replay Attack Protection
**Location:** `backend/src/server.ts` (specialist endpoint)  
**Finding:** No mechanism to prevent reusing the same payment signature:

**Impact:**
- Attacker makes one payment
- Reuses signature for unlimited requests

**Remediation:**
1. Track used signatures in database/cache:
```typescript
const usedSignatures = new Set<string>(); // Use Redis in production

if (usedSignatures.has(paymentSignature)) {
  return res.status(402).json({ error: 'Payment signature already used' });
}
usedSignatures.add(paymentSignature);
```
2. Add expiry time for signatures (e.g., 5 minutes)
3. Use nonce-based replay protection

---

### 🟡 MEDIUM: Payment Amount Not Verified
**Location:** `backend/src/server.ts`, `backend/src/dispatcher.ts`  
**Finding:** Even with signature verification, the amount is not checked:

**Remediation:**
Verify the transaction includes the correct amount:
```typescript
// In verifyPayment function:
const transferInstruction = parseTransferInstruction(tx);
if (transferInstruction.amount < expectedAmount * 1_000_000) { // USDC has 6 decimals
  return false;
}
```

---

### 🟢 LOW: No Payment Refund Mechanism
**Location:** Entire payment flow  
**Finding:** If specialist fails after payment, no refund is issued.

**Recommendation:**
- Implement escrow or conditional payments
- Add refund logic for failed requests
- Document refund policy

---

## 5. Infrastructure

### 🔴 CRITICAL: CORS Allows All Origins
**Location:** `backend/src/server.ts` (line 21)  
**Finding:**
```typescript
app.use(cors());
```

**Impact:**
- Any website can make requests to your API
- CSRF attacks possible
- Data exfiltration from browser contexts

**Remediation:**
```typescript
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3001',
  'https://yourdomain.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  maxAge: 86400
}));
```

---

### 🔴 CRITICAL: No Rate Limiting
**Location:** Entire application  
**Finding:** No rate limiting on any endpoints.

**Impact:**
- DoS attacks (flood requests)
- Brute force API key attacks
- Quota exhaustion on third-party services
- Excessive costs

**Remediation:**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later'
});

app.use('/api/', limiter);

// Stricter limit for specialist endpoints
const specialistLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  keyGenerator: (req) => (req as any).user?.id || req.ip
});

app.use('/api/specialist/', specialistLimiter);
```

---

### 🟡 MEDIUM: Error Handling Leaks Internal Details
**Location:** Multiple locations  
**Finding:** Error messages expose internal state:
```typescript
res.status(500).json({ error: error.message });
```

**Risk:** Stack traces, file paths, or internal logic exposed to attackers.

**Remediation:**
```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error]', err); // Log full error internally
  
  // Only send generic error in production
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({ 
    error: isDev ? err.message : 'Internal server error',
    requestId: req.id // Add request tracking
  });
});
```

---

### 🟡 MEDIUM: SSRF Vulnerability (Partially Mitigated)
**Location:** `backend/src/dispatcher.ts` (lines 463-491)  
**Finding:** `validateCallbackUrl` function provides basic SSRF protection but has gaps:
```typescript
function validateCallbackUrl(urlStr: string): boolean {
  // Blocks localhost, 127.0.0.1, ::1, 10.x, 192.168.x, 169.254.x
  // BUT: Missing other private ranges and cloud metadata
}
```

**Gaps:**
- Missing 172.16.0.0/12 range (Docker networks)
- Missing fd00::/8 (IPv6 ULA)
- Missing fe80::/10 (IPv6 link-local)
- Missing cloud metadata IPs (169.254.169.254 already blocked)
- No DNS rebinding protection
- No redirect following protection

**Remediation:**
```typescript
import ipaddr from 'ipaddr.js';

function validateCallbackUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    
    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    // Resolve hostname to IP
    const addr = dns.lookup(url.hostname); // Synchronous or use async version
    
    // Use ipaddr.js to check if private
    const parsed = ipaddr.parse(addr);
    if (parsed.range() !== 'unicast') {
      return false; // Blocks private, loopback, link-local, etc.
    }

    // Explicitly block cloud metadata
    if (addr === '169.254.169.254') {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}
```

---

### 🟢 LOW: No Request Size Limits
**Location:** `backend/src/server.ts` (line 22)  
**Finding:**
```typescript
app.use(express.json());
```

**Risk:** Large payloads can cause DoS via memory exhaustion.

**Remediation:**
```typescript
app.use(express.json({ limit: '100kb' }));
```

---

### 🟢 LOW: No HTTPS Enforcement
**Location:** Server configuration  
**Finding:** No redirect from HTTP to HTTPS, no HSTS header.

**Remediation:**
```typescript
// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});

// Add security headers
import helmet from 'helmet';
app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## 6. Additional Recommendations

### 🟡 MEDIUM: Missing Security Headers
**Recommendation:** Add comprehensive security headers using Helmet:
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  frameguard: { action: 'deny' },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'no-referrer' }
}));
```

---

### 🟢 LOW: Add Request Logging and Monitoring
**Recommendation:**
```typescript
import morgan from 'morgan';

app.use(morgan('combined', {
  skip: (req) => req.path === '/health'
}));

// Add request ID tracking
import { v4 as uuidv4 } from 'uuid';
app.use((req, res, next) => {
  (req as any).id = uuidv4();
  res.setHeader('X-Request-ID', (req as any).id);
  next();
});
```

---

### 🟢 LOW: Add Health Check Security
**Location:** `backend/src/server.ts` (line 11)  
**Finding:** Health check endpoint bypasses auth but exposes no sensitive data.

**Recommendation:** Consider adding minimal auth or moving to separate port for internal monitoring.

---

## Summary of Vulnerabilities

| Severity | Count | Immediate Action Required |
|----------|-------|---------------------------|
| 🔴 Critical | 7 | ✅ YES - Before production |
| 🟠 High | 5 | ✅ YES - Within 1 week |
| 🟡 Medium | 6 | ⚠️ Recommended - Within 1 month |
| 🟢 Low | 4 | ℹ️ Optional - Enhancement |

---

## Immediate Action Plan (Before Production)

1. **Rotate all exposed API keys and secrets** (AgentWallet, Helius, ClawArena, MoltX, Bankr)
2. **Remove secrets from git history** using `git filter-branch` or BFG Repo-Cleaner
3. **Implement payment signature verification** with on-chain validation
4. **Add WebSocket authentication**
5. **Configure CORS with allowed origins**
6. **Implement rate limiting**
7. **Add input validation on all user inputs**

---

## Timeline Recommendations

- **Week 1 (Critical):** Address all 🔴 Critical issues
- **Week 2-3 (High):** Address all 🟠 High issues
- **Week 4+ (Medium/Low):** Address 🟡 Medium and 🟢 Low issues

---

## Testing Recommendations

1. **Security Testing:**
   - Penetration testing before production launch
   - Automated security scanning (Snyk, SonarQube)
   - OWASP ZAP for web vulnerabilities

2. **Payment Testing:**
   - Verify signature validation on devnet
   - Test replay attack protection
   - Test amount verification

3. **Load Testing:**
   - Test rate limiting under load
   - Test DoS resistance
   - Test WebSocket connection limits

---

## Compliance Notes

If handling user funds or financial data:
- Consider SOC 2 Type II compliance
- Implement audit logging for all financial transactions
- Add user consent and terms of service
- Implement data retention and deletion policies

---

**End of Report**

For questions or clarification, contact the security team.
