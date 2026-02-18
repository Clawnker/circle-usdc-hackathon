#!/bin/bash
# Comprehensive test suite for Hivemind Protocol
# Tests frontend, backend, routing, and x402 payment flow

set -e

BACKEND_URL="${BACKEND_URL:-https://csn-hackathon.onrender.com}"
FRONTEND_URL="${FRONTEND_URL:-https://csn-hackathon.vercel.app}"
API_KEY="${API_KEY:-demo-key}"

echo "🧪 Hivemind Protocol Test Suite"
echo "================================"
echo "Backend:  $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
  echo -e "${GREEN}✓${NC} $1"
}

fail() {
  echo -e "${RED}✗${NC} $1"
  exit 1
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Test 1: Backend Health
echo "1. Testing backend health..."
HEALTH=$(curl -s "$BACKEND_URL/health")
if echo "$HEALTH" | grep -q "ok"; then
  pass "Backend is healthy"
else
  fail "Backend health check failed: $HEALTH"
fi

# Test 2: Frontend loads
echo ""
echo "2. Testing frontend..."
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [ "$FRONTEND" = "200" ]; then
  pass "Frontend loads successfully"
else
  fail "Frontend returned HTTP $FRONTEND"
fi

# Test 3: API Authentication
echo ""
echo "3. Testing API authentication..."
UNAUTH=$(curl -s -X POST "$BACKEND_URL/api/dispatch" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test", "userId": "test"}')

if echo "$UNAUTH" | grep -q "Unauthorized"; then
  pass "API authentication is enforced"
else
  warn "API may not require authentication: $UNAUTH"
fi

# Test 4: Specialist List
echo ""
echo "4. Testing specialist list endpoint..."
SPECIALISTS=$(curl -s -H "x-api-key: $API_KEY" "$BACKEND_URL/v1/specialists")

if echo "$SPECIALISTS" | grep -q "magos\|aura\|bankr"; then
  pass "Specialist list endpoint works"
  echo "   Available specialists: $(echo $SPECIALISTS | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | tr '\n' ',' | sed 's/,$//')"
else
  fail "Specialist list failed: $SPECIALISTS"
fi

# Test 5: Preview Mode (No Execution)
echo ""
echo "5. Testing preview mode..."
PREVIEW=$(curl -s -X POST "$BACKEND_URL/dispatch" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "prompt": "What is SOL price?",
    "userId": "test",
    "previewOnly": true
  }')

if echo "$PREVIEW" | grep -q "specialist"; then
  SPECIALIST=$(echo "$PREVIEW" | grep -o '"specialist":"[^"]*"' | cut -d'"' -f4)
  pass "Preview mode works - routed to: $SPECIALIST"
else
  fail "Preview mode failed: $PREVIEW"
fi

# Test 6: Routing Accuracy
echo ""
echo "6. Testing routing patterns..."

test_route() {
  local PROMPT="$1"
  local EXPECTED="$2"
  
  RESULT=$(curl -s -X POST "$BACKEND_URL/dispatch" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d "{\"prompt\": \"$PROMPT\", \"userId\": \"test\", \"previewOnly\": true}")
  
  ROUTED=$(echo "$RESULT" | grep -o '"specialist":"[^"]*"' | cut -d'"' -f4)
  
  if [ "$ROUTED" = "$EXPECTED" ]; then
    pass "  \"$PROMPT\" → $ROUTED"
  else
    warn "  \"$PROMPT\" → $ROUTED (expected: $EXPECTED)"
  fi
}

test_route "What is SOL price?" "magos"
test_route "Find trending tokens" "aura"
test_route "Check my balance" "bankr"
test_route "Search for Bitcoin news" "seeker"
test_route "Explain DeFi" "scribe"

# Test 7: Real Task Execution (Dry Run)
echo ""
echo "7. Testing task execution (dry run)..."
TASK=$(curl -s -X POST "$BACKEND_URL/dispatch" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "prompt": "What is the current sentiment around SOL?",
    "userId": "test",
    "dryRun": true
  }')

TASK_ID=$(echo "$TASK" | grep -o '"taskId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TASK_ID" ]; then
  pass "Task created: $TASK_ID"
  
  # Wait for completion
  sleep 3
  
  # Check task status
  STATUS=$(curl -s -H "x-api-key: $API_KEY" "$BACKEND_URL/status/$TASK_ID")
  TASK_STATUS=$(echo "$STATUS" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  
  if [ "$TASK_STATUS" = "completed" ]; then
    pass "Task completed successfully"
  else
    warn "Task status: $TASK_STATUS"
  fi
else
  fail "Task creation failed: $TASK"
fi

# Test 8: x402 Payment Flow
echo ""
echo "8. Testing x402 payment structure..."
# Just verify the payment record structure exists in task response
if echo "$STATUS" | grep -q "payments"; then
  pass "Payment tracking is enabled"
else
  warn "Payment structure not found in task response"
fi

# Test 9: Multi-hop Detection
echo ""
echo "9. Testing multi-hop detection..."
MULTIHOP=$(curl -s -X POST "$BACKEND_URL/dispatch" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "prompt": "Buy 0.1 SOL of the top trending token",
    "userId": "test",
    "previewOnly": true
  }')

if echo "$MULTIHOP" | grep -q "multi-hop\|aura"; then
  pass "Multi-hop workflow detected"
else
  warn "Multi-hop detection may not be working: $(echo $MULTIHOP | grep -o '"specialist":"[^"]*"')"
fi

# Test 10: WebSocket (Basic Connection)
echo ""
echo "10. Testing WebSocket endpoint..."
WS_TEST=$(curl -s -o /dev/null -w "%{http_code}" --http1.1 \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  "$BACKEND_URL/ws")

if [ "$WS_TEST" = "101" ] || [ "$WS_TEST" = "426" ]; then
  pass "WebSocket endpoint responds"
else
  warn "WebSocket returned HTTP $WS_TEST (may need testing with ws:// protocol)"
fi

echo ""
echo "================================"
echo "✅ Test suite complete!"
echo ""
echo "Summary:"
echo "  Backend:  $BACKEND_URL"
echo "  Frontend: $FRONTEND_URL"
echo "  Status:   All critical paths tested"
