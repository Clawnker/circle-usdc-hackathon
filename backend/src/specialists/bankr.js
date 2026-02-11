"use strict";
/**
 * bankr Specialist - AgentWallet Devnet Integration with Jupiter Routing
 * Uses Jupiter API for quotes/routing visualization
 * Uses Helius for accurate devnet balance
 * Maintains simulated balance state for swap demonstrations
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.bankr = void 0;
exports.getSimulatedBalances = getSimulatedBalances;
var axios_1 = require("axios");
var fs = require("fs");
var path = require("path");
var config_1 = require("../config");
var solana_1 = require("../solana");
var AGENTWALLET_API = config_1.default.agentWallet.apiUrl;
var AGENTWALLET_USERNAME = config_1.default.agentWallet.username;
var AGENTWALLET_TOKEN = config_1.default.agentWallet.token;
// AgentWallet Solana address (devnet)
var SOLANA_ADDRESS = config_1.default.agentWallet.solanaAddress || '5xUugg8ysgqpcGneM6qpM2AZ8ZGuMaH5TnGNWdCQC1Z1';
// Jupiter API for quotes (with API key for authenticated access)
var JUPITER_API = ((_a = config_1.default.jupiter) === null || _a === void 0 ? void 0 : _a.baseUrl) || 'https://api.jup.ag';
var JUPITER_ULTRA_API = ((_b = config_1.default.jupiter) === null || _b === void 0 ? void 0 : _b.ultraUrl) || 'https://api.jup.ag/ultra';
var JUPITER_API_KEY = ((_c = config_1.default.jupiter) === null || _c === void 0 ? void 0 : _c.apiKey) || '';
// Well-known token mints
var TOKEN_MINTS = {
    'SOL': 'So11111111111111111111111111111111111111112',
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    'PYTH': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
};
// Simulated balance state file
var SIMULATED_STATE_PATH = path.join(__dirname, '../../data/simulated-balances.json');
/**
 * Load simulated balance state
 */
function loadSimulatedState() {
    try {
        if (fs.existsSync(SIMULATED_STATE_PATH)) {
            return JSON.parse(fs.readFileSync(SIMULATED_STATE_PATH, 'utf-8'));
        }
    }
    catch (e) {
        console.log('[bankr] Could not load simulated state, creating new');
    }
    return {
        lastRealBalanceCheck: 0,
        realSOL: 0,
        balances: { SOL: 0, USDC: 0 },
        transactions: [],
    };
}
/**
 * Save simulated balance state
 */
function saveSimulatedState(state) {
    try {
        var dir = path.dirname(SIMULATED_STATE_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(SIMULATED_STATE_PATH, JSON.stringify(state, null, 2));
    }
    catch (e) {
        console.error('[bankr] Could not save simulated state:', e);
    }
}
/**
 * Sync simulated state with real devnet balance
 */
function syncWithRealBalance() {
    return __awaiter(this, void 0, void 0, function () {
        var state, now, realBalance;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    state = loadSimulatedState();
                    now = Date.now();
                    if (!(now - state.lastRealBalanceCheck > 5 * 60 * 1000 || state.realSOL === 0)) return [3 /*break*/, 2];
                    console.log('[bankr] Syncing with real devnet balance via Helius...');
                    return [4 /*yield*/, solana_1.default.getBalance(SOLANA_ADDRESS, 'devnet')];
                case 1:
                    realBalance = _a.sent();
                    // If this is first sync or balance changed externally, update simulated SOL
                    if (state.realSOL === 0 || Math.abs(realBalance - state.realSOL) > 0.001) {
                        console.log("[bankr] Real balance: ".concat(realBalance, " SOL (was ").concat(state.realSOL, ")"));
                        state.realSOL = realBalance;
                        state.balances.SOL = realBalance;
                    }
                    state.lastRealBalanceCheck = now;
                    saveSimulatedState(state);
                    _a.label = 2;
                case 2: return [2 /*return*/, state];
            }
        });
    });
}
/**
 * Apply a simulated swap to balances
 */
function applySimulatedSwap(state, from, to, amountIn, amountOut, route) {
    var fromToken = from.toUpperCase();
    var toToken = to.toUpperCase();
    // Initialize balances if needed
    if (state.balances[fromToken] === undefined)
        state.balances[fromToken] = 0;
    if (state.balances[toToken] === undefined)
        state.balances[toToken] = 0;
    // Check if we have enough balance
    if (state.balances[fromToken] < amountIn) {
        console.log("[bankr] Insufficient ".concat(fromToken, ": have ").concat(state.balances[fromToken], ", need ").concat(amountIn));
        return state;
    }
    // Apply swap
    state.balances[fromToken] -= amountIn;
    state.balances[toToken] += amountOut;
    // Record transaction
    state.transactions.push({
        type: 'swap',
        from: fromToken,
        to: toToken,
        amountIn: amountIn,
        amountOut: amountOut,
        timestamp: Date.now(),
        route: route,
    });
    // Keep only last 50 transactions
    if (state.transactions.length > 50) {
        state.transactions = state.transactions.slice(-50);
    }
    saveSimulatedState(state);
    return state;
}
/**
 * Get Jupiter quote for swap routing visualization
 */
function getJupiterQuote(inputMint_1, outputMint_1, amount_1) {
    return __awaiter(this, arguments, void 0, function (inputMint, outputMint, amount, decimals) {
        var amountInSmallestUnit, headers, response, error_1;
        var _a, _b;
        if (decimals === void 0) { decimals = 9; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString();
                    console.log("[bankr] Jupiter quote: ".concat(amount, " (").concat(amountInSmallestUnit, " lamports) ").concat(inputMint.slice(0, 8), "... -> ").concat(outputMint.slice(0, 8), "..."));
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    headers = {
                        'Content-Type': 'application/json',
                    };
                    // Add API key if available
                    if (JUPITER_API_KEY) {
                        headers['x-api-key'] = JUPITER_API_KEY;
                    }
                    return [4 /*yield*/, axios_1.default.get("".concat(JUPITER_API, "/swap/v1/quote"), {
                            params: {
                                inputMint: inputMint,
                                outputMint: outputMint,
                                amount: amountInSmallestUnit,
                                slippageBps: 100, // 1% slippage
                                restrictIntermediateTokens: true,
                            },
                            headers: headers,
                            timeout: 10000,
                        })];
                case 2:
                    response = _c.sent();
                    console.log("[bankr] Jupiter quote received: ".concat(response.data.outAmount, " output"));
                    return [2 /*return*/, response.data];
                case 3:
                    error_1 = _c.sent();
                    console.log("[bankr] Jupiter API error: ".concat(((_a = error_1.response) === null || _a === void 0 ? void 0 : _a.status) || error_1.message));
                    if ((_b = error_1.response) === null || _b === void 0 ? void 0 : _b.data) {
                        console.log("[bankr] Jupiter error details:", error_1.response.data);
                    }
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Format Jupiter route plan for display
 */
function formatRoutePlan(quote) {
    var _a;
    if (!((_a = quote === null || quote === void 0 ? void 0 : quote.routePlan) === null || _a === void 0 ? void 0 : _a.length)) {
        return { route: 'Direct swap', hops: [] };
    }
    var hops = quote.routePlan.map(function (step) {
        var _a, _b, _c, _d, _e, _f, _g;
        return ({
            dex: ((_a = step.swapInfo) === null || _a === void 0 ? void 0 : _a.label) || 'Unknown DEX',
            inputMint: ((_c = (_b = step.swapInfo) === null || _b === void 0 ? void 0 : _b.inputMint) === null || _c === void 0 ? void 0 : _c.slice(0, 8)) + '...',
            outputMint: ((_e = (_d = step.swapInfo) === null || _d === void 0 ? void 0 : _d.outputMint) === null || _e === void 0 ? void 0 : _e.slice(0, 8)) + '...',
            inAmount: (_f = step.swapInfo) === null || _f === void 0 ? void 0 : _f.inAmount,
            outAmount: (_g = step.swapInfo) === null || _g === void 0 ? void 0 : _g.outAmount,
            percent: step.percent,
        });
    });
    var route = hops.map(function (h) { return h.dex; }).join(' → ');
    return { route: route, hops: hops };
}
/**
 * Execute Solana transfer via AgentWallet (devnet)
 */
function executeAgentWalletTransfer(to_1, amount_1) {
    return __awaiter(this, arguments, void 0, function (to, amount, asset) {
        var decimals, amountInSmallestUnit, response;
        if (asset === void 0) { asset = 'sol'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[bankr] AgentWallet devnet transfer: ".concat(amount, " ").concat(asset, " to ").concat(to));
                    decimals = asset === 'sol' ? 9 : 6;
                    amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString();
                    return [4 /*yield*/, axios_1.default.post("".concat(AGENTWALLET_API, "/wallets/").concat(AGENTWALLET_USERNAME, "/actions/transfer-solana"), {
                            to: to,
                            amount: amountInSmallestUnit,
                            asset: asset,
                            network: 'devnet',
                        }, {
                            headers: {
                                'Authorization': "Bearer ".concat(AGENTWALLET_TOKEN),
                                'Content-Type': 'application/json',
                            },
                        })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.data];
            }
        });
    });
}
/**
 * Execute swap via Jupiter (simulation with real routing and balance tracking)
 */
function executeJupiterSwap(from, to, amount) {
    return __awaiter(this, void 0, void 0, function () {
        var inputMint, outputMint, decimals, state_1, state, amountIn, currentBalance, quote, _a, route, hops, outputDecimals, outAmount, outAmountStr, mockOutput;
        var _b, _c, _d, _e;
        var _f, _g, _h, _j, _k, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    console.log("[bankr] Jupiter swap: ".concat(amount, " ").concat(from, " -> ").concat(to));
                    inputMint = TOKEN_MINTS[from.toUpperCase()] || from;
                    outputMint = TOKEN_MINTS[to.toUpperCase()] || to;
                    decimals = from.toUpperCase() === 'SOL' ? 9 : 6;
                    if (!(inputMint === outputMint)) return [3 /*break*/, 2];
                    return [4 /*yield*/, syncWithRealBalance()];
                case 1:
                    state_1 = _m.sent();
                    return [2 /*return*/, {
                            type: 'swap',
                            status: 'executed',
                            details: {
                                from: from,
                                to: to,
                                amount: amount,
                                inputMint: inputMint,
                                outputMint: outputMint,
                                estimatedOutput: amount,
                                route: 'Direct (same token)',
                                network: 'devnet (simulated)',
                                balancesAfter: (_b = {},
                                    _b[from] = ((_f = state_1.balances[from.toUpperCase()]) === null || _f === void 0 ? void 0 : _f.toFixed(4)) || '0',
                                    _b[to] = ((_g = state_1.balances[to.toUpperCase()]) === null || _g === void 0 ? void 0 : _g.toFixed(4)) || '0',
                                    _b),
                            },
                        }];
                case 2: return [4 /*yield*/, syncWithRealBalance()];
                case 3:
                    state = _m.sent();
                    amountIn = parseFloat(amount);
                    currentBalance = state.balances[from.toUpperCase()] || 0;
                    if (currentBalance < amountIn) {
                        return [2 /*return*/, {
                                type: 'swap',
                                status: 'failed',
                                details: {
                                    error: "Insufficient ".concat(from, " balance"),
                                    available: currentBalance.toFixed(4),
                                    required: amountIn.toFixed(4),
                                },
                            }];
                    }
                    return [4 /*yield*/, getJupiterQuote(inputMint, outputMint, amount, decimals)];
                case 4:
                    quote = _m.sent();
                    if (quote && quote.outAmount) {
                        _a = formatRoutePlan(quote), route = _a.route, hops = _a.hops;
                        outputDecimals = to.toUpperCase() === 'SOL' ? 9 : 6;
                        outAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);
                        outAmountStr = outAmount.toFixed(6);
                        console.log("[bankr] Jupiter route: ".concat(route));
                        console.log("[bankr] Expected output: ".concat(outAmountStr, " ").concat(to));
                        // Apply simulated swap to balance state
                        state = applySimulatedSwap(state, from, to, amountIn, outAmount, route);
                        // Build response with updated balances
                        return [2 /*return*/, {
                                type: 'swap',
                                status: 'executed',
                                details: {
                                    from: from,
                                    to: to,
                                    amount: amount,
                                    inputMint: inputMint,
                                    outputMint: outputMint,
                                    estimatedOutput: outAmountStr,
                                    priceImpact: quote.priceImpactPct || '0',
                                    slippageBps: quote.slippageBps,
                                    route: route,
                                    routePlan: hops,
                                    network: 'devnet (simulated)',
                                    // Include updated balances
                                    balancesBefore: (_c = {},
                                        _c[from] = (currentBalance).toFixed(4),
                                        _c[to] = ((state.balances[to.toUpperCase()] || 0) - outAmount).toFixed(4),
                                        _c),
                                    balancesAfter: (_d = {},
                                        _d[from] = ((_h = state.balances[from.toUpperCase()]) === null || _h === void 0 ? void 0 : _h.toFixed(4)) || '0',
                                        _d[to] = ((_j = state.balances[to.toUpperCase()]) === null || _j === void 0 ? void 0 : _j.toFixed(4)) || '0',
                                        _d),
                                },
                            }];
                    }
                    mockOutput = parseFloat(estimateOutput(from, to, amount));
                    state = applySimulatedSwap(state, from, to, amountIn, mockOutput, 'Mock');
                    return [2 /*return*/, {
                            type: 'swap',
                            status: 'executed',
                            details: {
                                from: from,
                                to: to,
                                amount: amount,
                                estimatedOutput: mockOutput.toFixed(6),
                                route: 'Mock routing (Jupiter API unavailable)',
                                network: 'devnet (simulated)',
                                balancesAfter: (_e = {},
                                    _e[from] = ((_k = state.balances[from.toUpperCase()]) === null || _k === void 0 ? void 0 : _k.toFixed(4)) || '0',
                                    _e[to] = ((_l = state.balances[to.toUpperCase()]) === null || _l === void 0 ? void 0 : _l.toFixed(4)) || '0',
                                    _e),
                            },
                        }];
            }
        });
    });
}
/**
 * Estimate swap output based on mock rates (fallback)
 */
function estimateOutput(from, to, amount) {
    var rates = {
        'SOL_USDC': 170.00,
        'USDC_SOL': 0.00588,
        'SOL_BONK': 3500000,
        'BONK_SOL': 0.000000286,
        'SOL_WIF': 85,
        'WIF_SOL': 0.0118,
        'SOL_JUP': 200,
        'JUP_SOL': 0.005,
    };
    var key = "".concat(from.toUpperCase(), "_").concat(to.toUpperCase());
    var rate = rates[key] || 1;
    return (parseFloat(amount) * rate * 0.995).toFixed(6); // 0.5% slippage
}
/**
 * Parse compound intents - handles "buy X and send to Y" patterns
 * Returns array of sequential actions
 */
function parseCompoundIntent(prompt) {
    var lower = prompt.toLowerCase();
    var actions = [];
    // Pattern: "buy X SOL worth of BONK and send/transfer to <address>"
    var buyAndSendMatch = prompt.match(/buy\s+([\d.]+)\s+(\w+)\s+(?:worth\s+)?of\s+(\w+)\s+(?:and|then)\s+(?:send|transfer)\s+(?:it\s+)?to\s+([1-9A-HJ-NP-Za-km-z]{32,44})/i);
    if (buyAndSendMatch) {
        var inputAmount = buyAndSendMatch[1];
        var inputToken = buyAndSendMatch[2].toUpperCase();
        var outputToken = buyAndSendMatch[3].toUpperCase();
        var address = buyAndSendMatch[4];
        // First action: swap
        actions.push({
            type: 'swap',
            amount: inputAmount,
            from: inputToken,
            to: outputToken,
        });
        // Second action: transfer the output (use 'ALL' as special marker)
        actions.push({
            type: 'transfer',
            token: outputToken,
            amount: 'ALL', // Will use the output from swap
            address: address,
        });
        return actions;
    }
    // Pattern: "swap X for Y and send to <address>"
    var swapAndSendMatch = prompt.match(/(?:swap|trade)\s+([\d.]+)\s+(\w+)\s+(?:for|to)\s+(\w+)\s+(?:and|then)\s+(?:send|transfer)\s+(?:it\s+)?to\s+([1-9A-HJ-NP-Za-km-z]{32,44})/i);
    if (swapAndSendMatch) {
        var inputAmount = swapAndSendMatch[1];
        var inputToken = swapAndSendMatch[2].toUpperCase();
        var outputToken = swapAndSendMatch[3].toUpperCase();
        var address = swapAndSendMatch[4];
        actions.push({
            type: 'swap',
            amount: inputAmount,
            from: inputToken,
            to: outputToken,
        });
        actions.push({
            type: 'transfer',
            token: outputToken,
            amount: 'ALL',
            address: address,
        });
        return actions;
    }
    return actions;
}
/**
 * Parse user intent from prompt - supports compound actions
 * e.g., "buy 1 sol worth of BONK and send it to <address>"
 */
function parseIntent(prompt) {
    var _a;
    // First check for compound "buy X and send to Y" pattern
    var compound = parseCompoundIntent(prompt);
    if (compound.length > 0) {
        // Return first action - we'll handle compound in the handler
        return compound[0];
    }
    var lower = prompt.toLowerCase();
    // Extract amount - also match "X worth" pattern like "buy 5 usdc worth"
    var amountMatch = prompt.match(/([\d.]+)\s*(SOL|USDC|USDT|ETH|BONK|WIF|JUP|RAY)/i);
    var worthMatch = prompt.match(/([\d.]+)\s*(SOL|USDC|USDT|ETH)\s*worth/i);
    var amount = amountMatch ? amountMatch[1] : worthMatch ? worthMatch[1] : '0.1';
    // Detect intent
    var isAdvice = lower.includes('good') || lower.includes('should') || lower.includes('recommend');
    if (!isAdvice && (lower.includes('swap') || lower.includes('buy') || lower.includes('sell') || lower.includes('trade') || lower.includes('exchange'))) {
        // Pattern: "swap/buy/trade 0.1 SOL for/to/with BONK"
        var swapMatch = prompt.match(/(?:swap|buy|trade|sell|exchange)\s+(?:([\d.]+)\s+)?(\w+)\s+(?:for|to|with)\s+(\w+)/i);
        if (swapMatch) {
            var from = swapMatch[2].toUpperCase();
            var to = swapMatch[3].toUpperCase();
            var amt = swapMatch[1] || amount;
            if (lower.includes('with') && lower.indexOf('with') > lower.indexOf(swapMatch[2].toLowerCase())) {
                _a = [to, from], from = _a[0], to = _a[1];
            }
            return { type: 'swap', amount: amt, from: from, to: to };
        }
        // Pattern: "buy 0.1 SOL of BONK" means use 0.1 SOL to buy BONK
        var buyOfMatch = prompt.match(/buy\s+([\d.]+)\s+(\w+)\s+of\s+(\w+)/i);
        if (buyOfMatch) {
            var inputAmount = buyOfMatch[1];
            var inputToken = buyOfMatch[2].toUpperCase();
            var outputToken = buyOfMatch[3].toUpperCase();
            return { type: 'swap', amount: inputAmount, from: inputToken, to: outputToken };
        }
        // Pattern: "buy BONK with 0.1 SOL"
        var buyWithMatch = prompt.match(/buy\s+(\w+)\s+with\s+([\d.]+)\s+(\w+)/i);
        if (buyWithMatch) {
            var outputToken = buyWithMatch[1].toUpperCase();
            var inputAmount = buyWithMatch[2];
            var inputToken = buyWithMatch[3].toUpperCase();
            return { type: 'swap', amount: inputAmount, from: inputToken, to: outputToken };
        }
        if (amountMatch) {
            var token = amountMatch[2].toUpperCase();
            if (lower.includes('sell')) {
                return { type: 'swap', from: token, to: 'USDC', amount: amount };
            }
            else {
                return { type: 'swap', from: 'SOL', to: token === 'SOL' ? 'USDC' : token, amount: amount };
            }
        }
        return { type: 'swap', from: 'SOL', to: 'USDC', amount: amount };
    }
    if (lower.includes('transfer') || lower.includes('send') || lower.includes('pay')) {
        var solAddressMatch = prompt.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
        var evmAddressMatch = prompt.match(/0x[a-fA-F0-9]{40}/);
        // Parse asset: "send 5 USDC" or "send 5 SOL" or "transfer 0.1 ETH"
        var assetMatch = prompt.match(/[\d.]+\s*(SOL|USDC|USDT|ETH|BONK|WIF|JUP|RAY)/i);
        var asset = assetMatch ? assetMatch[1].toUpperCase() : 'SOL';
        return {
            type: 'transfer',
            address: solAddressMatch ? solAddressMatch[0] : evmAddressMatch ? evmAddressMatch[0] : undefined,
            amount: amount,
            asset: asset,
        };
    }
    return { type: 'balance' };
}
/**
 * Reset simulated balances to real devnet state
 */
function resetSimulatedBalances() {
    return __awaiter(this, void 0, void 0, function () {
        var realBalance, state;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, solana_1.default.getBalance(SOLANA_ADDRESS, 'devnet')];
                case 1:
                    realBalance = _a.sent();
                    state = {
                        lastRealBalanceCheck: Date.now(),
                        realSOL: realBalance,
                        balances: { SOL: realBalance, USDC: 0 },
                        transactions: [],
                    };
                    saveSimulatedState(state);
                    return [2 /*return*/, state];
            }
        });
    });
}
/**
 * Get current simulated balances (for wallet display)
 */
function getSimulatedBalances() {
    return __awaiter(this, void 0, void 0, function () {
        var state;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, syncWithRealBalance()];
                case 1:
                    state = _a.sent();
                    return [2 /*return*/, {
                            sol: state.balances.SOL || 0,
                            usdc: state.balances.USDC || 0,
                            bonk: state.balances.BONK || 0,
                            transactions: state.transactions || [],
                        }];
            }
        });
    });
}
/**
 * bankr specialist handler
 */
exports.bankr = {
    name: 'bankr',
    description: 'DeFi specialist using Jupiter routing and AgentWallet for transactions',
    handle: function (prompt, context) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, compoundActions, intent, state, fromToken, amount, currentBalance, isApproved, estimatedOutput, route, feeEstimate, inputMint, outputMint, decimals, quote, outputDecimals, state, data, txSignature, _a, routeInfo, transferAsset, isSolTransfer, result, transferError_1, state, balanceLines, recentTxs, txLines, error_2;
            var _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        startTime = Date.now();
                        _h.label = 1;
                    case 1:
                        _h.trys.push([1, 24, , 25]);
                        compoundActions = parseCompoundIntent(prompt);
                        if (!(compoundActions.length > 1)) return [3 /*break*/, 3];
                        console.log("[bankr] Compound intent detected: ".concat(compoundActions.length, " actions"));
                        return [4 /*yield*/, this.handleCompoundActions(prompt, compoundActions, startTime, context)];
                    case 2: return [2 /*return*/, _h.sent()];
                    case 3:
                        intent = parseIntent(prompt);
                        console.log("[bankr] Intent: ".concat(intent.type), intent);
                        if (!(intent.type === 'swap' || intent.type === 'transfer')) return [3 /*break*/, 7];
                        return [4 /*yield*/, syncWithRealBalance()];
                    case 4:
                        state = _h.sent();
                        fromToken = intent.type === 'swap' ? intent.from : (intent.asset || 'SOL');
                        amount = parseFloat(intent.amount || '0');
                        currentBalance = state.balances[fromToken.toUpperCase()] || 0;
                        // 1. Check Balance
                        if (currentBalance < amount) {
                            return [2 /*return*/, {
                                    success: false,
                                    data: {
                                        type: intent.type,
                                        status: 'failed',
                                        details: {
                                            error: 'Insufficient balance',
                                            available: currentBalance.toFixed(4),
                                            required: amount.toFixed(4),
                                            asset: fromToken.toUpperCase()
                                        }
                                    },
                                    timestamp: new Date(),
                                    executionTimeMs: Date.now() - startTime,
                                }];
                        }
                        isApproved = ((_b = context === null || context === void 0 ? void 0 : context.metadata) === null || _b === void 0 ? void 0 : _b.transactionApproved) === true;
                        if (!!isApproved) return [3 /*break*/, 7];
                        console.log("[bankr] Transaction requires approval: ".concat(intent.type, " ").concat(amount, " ").concat(fromToken));
                        estimatedOutput = '0';
                        route = 'Direct';
                        feeEstimate = '0.000005 SOL';
                        if (!(intent.type === 'swap')) return [3 /*break*/, 6];
                        inputMint = TOKEN_MINTS[intent.from.toUpperCase()] || intent.from;
                        outputMint = TOKEN_MINTS[intent.to.toUpperCase()] || intent.to;
                        decimals = intent.from.toUpperCase() === 'SOL' ? 9 : 6;
                        return [4 /*yield*/, getJupiterQuote(inputMint, outputMint, intent.amount, decimals)];
                    case 5:
                        quote = _h.sent();
                        if (quote && quote.outAmount) {
                            outputDecimals = intent.to.toUpperCase() === 'SOL' ? 9 : 6;
                            estimatedOutput = (parseInt(quote.outAmount) / Math.pow(10, outputDecimals)).toFixed(6);
                            route = formatRoutePlan(quote).route;
                        }
                        else {
                            estimatedOutput = estimateOutput(intent.from, intent.to, intent.amount);
                            route = 'Mock (Quote Unavailable)';
                        }
                        _h.label = 6;
                    case 6: return [2 /*return*/, {
                            success: true,
                            data: {
                                type: intent.type,
                                requiresApproval: true,
                                details: {
                                    type: intent.type,
                                    amount: intent.amount,
                                    from: intent.from,
                                    to: intent.to || intent.address,
                                    asset: fromToken.toUpperCase(),
                                    estimatedOutput: intent.type === 'swap' ? estimatedOutput : undefined,
                                    route: intent.type === 'swap' ? route : undefined,
                                    feeEstimate: feeEstimate,
                                    currentBalance: currentBalance.toFixed(4),
                                }
                            },
                            timestamp: new Date(),
                            executionTimeMs: Date.now() - startTime,
                        }];
                    case 7:
                        if (!(prompt.toLowerCase().includes('reset balance') || prompt.toLowerCase().includes('sync balance'))) return [3 /*break*/, 9];
                        return [4 /*yield*/, resetSimulatedBalances()];
                    case 8:
                        state = _h.sent();
                        return [2 /*return*/, {
                                success: true,
                                data: {
                                    type: 'balance',
                                    status: 'reset',
                                    details: {
                                        message: 'Balances reset to real devnet state',
                                        balances: state.balances,
                                    },
                                },
                                timestamp: new Date(),
                                executionTimeMs: Date.now() - startTime,
                            }];
                    case 9:
                        data = void 0;
                        txSignature = void 0;
                        _a = intent.type;
                        switch (_a) {
                            case 'swap': return [3 /*break*/, 10];
                            case 'transfer': return [3 /*break*/, 12];
                            case 'balance': return [3 /*break*/, 21];
                        }
                        return [3 /*break*/, 21];
                    case 10: return [4 /*yield*/, executeJupiterSwap(intent.from, intent.to, intent.amount)];
                    case 11:
                        data = _h.sent();
                        if (data.status === 'failed') {
                            data.summary = "\u274C **Swap Failed**\n\u2022 ".concat(data.details.error, "\n\u2022 Available: ").concat(data.details.available, " ").concat(intent.from, "\n\u2022 Required: ").concat(data.details.required, " ").concat(intent.from);
                        }
                        else {
                            routeInfo = data.details.route || 'Direct';
                            data.summary = "\uD83D\uDD04 **Swap Executed via Jupiter**\n" +
                                "\u2022 Input: ".concat(intent.amount, " ").concat(intent.from, "\n") +
                                "\u2022 Output: ".concat(data.details.estimatedOutput, " ").concat(intent.to, "\n") +
                                "\u2022 Route: ".concat(routeInfo, "\n") +
                                "\u2022 Price Impact: ".concat(data.details.priceImpact || '<0.01', "%\n") +
                                "\n\uD83D\uDCCA **Updated Balances:**\n" +
                                "\u2022 ".concat(intent.from, ": ").concat(((_c = data.details.balancesAfter) === null || _c === void 0 ? void 0 : _c[intent.from]) || '0', "\n") +
                                "\u2022 ".concat(intent.to, ": ").concat(((_d = data.details.balancesAfter) === null || _d === void 0 ? void 0 : _d[intent.to]) || '0');
                        }
                        return [3 /*break*/, 23];
                    case 12:
                        if (!intent.address) return [3 /*break*/, 19];
                        transferAsset = intent.asset || 'SOL';
                        // Check if it's an EVM address (0x...)
                        if (intent.address.startsWith('0x')) {
                            data = {
                                type: 'transfer',
                                status: 'simulated',
                                details: {
                                    to: intent.address,
                                    amount: intent.amount || '5',
                                    asset: transferAsset,
                                    chain: 'Base',
                                    note: "Base ".concat(transferAsset, " transfer queued. In production, this would execute via x402 payment rail on Base."),
                                    explorer: "https://basescan.org/address/".concat(intent.address),
                                },
                            };
                            data.summary = "\uD83D\uDCCB **Base Transfer Queued**\n\u2022 Amount: ".concat(intent.amount || '5', " ").concat(transferAsset, "\n\u2022 To: ").concat(intent.address.slice(0, 6), "...").concat(intent.address.slice(-4), "\n\u2022 Chain: Base\n\u2022 Status: Simulated (production would settle on-chain via x402)");
                            return [3 /*break*/, 23];
                        }
                        isSolTransfer = transferAsset === 'SOL';
                        _h.label = 13;
                    case 13:
                        _h.trys.push([13, 17, , 18]);
                        if (!isSolTransfer) return [3 /*break*/, 15];
                        return [4 /*yield*/, executeAgentWalletTransfer(intent.address, intent.amount || '0.01', 'sol')];
                    case 14:
                        result = _h.sent();
                        txSignature = result.txHash;
                        data = {
                            type: 'transfer',
                            status: 'confirmed',
                            txSignature: txSignature,
                            details: {
                                to: intent.address,
                                amount: intent.amount,
                                asset: 'SOL',
                                explorer: result.explorer,
                                network: 'devnet',
                            },
                        };
                        data.summary = "\u2705 Successfully sent ".concat(intent.amount, " SOL to ").concat((_e = intent.address) === null || _e === void 0 ? void 0 : _e.slice(0, 8), "...");
                        return [3 /*break*/, 16];
                    case 15:
                        // SPL token transfer (USDC, etc.) — simulated for now
                        data = {
                            type: 'transfer',
                            status: 'simulated',
                            details: {
                                to: intent.address,
                                amount: intent.amount || '5',
                                asset: transferAsset,
                                chain: 'Solana',
                                note: "".concat(transferAsset, " SPL token transfer queued. In production, this would execute via AgentWallet SPL transfer."),
                                explorer: "https://explorer.solana.com/address/".concat(intent.address, "?cluster=devnet"),
                            },
                        };
                        data.summary = "\uD83D\uDCCB **Solana ".concat(transferAsset, " Transfer Queued**\n\u2022 Amount: ").concat(intent.amount || '5', " ").concat(transferAsset, "\n\u2022 To: ").concat(intent.address.slice(0, 8), "...\n\u2022 Chain: Solana Devnet\n\u2022 Status: Simulated (SPL token transfers coming soon)");
                        _h.label = 16;
                    case 16: return [3 /*break*/, 18];
                    case 17:
                        transferError_1 = _h.sent();
                        console.error('[bankr] Transfer execution failed:', transferError_1.message);
                        data = {
                            type: 'transfer',
                            status: 'failed',
                            details: {
                                error: ((_g = (_f = transferError_1.response) === null || _f === void 0 ? void 0 : _f.data) === null || _g === void 0 ? void 0 : _g.error) || transferError_1.message,
                                asset: transferAsset,
                                note: "Check if devnet wallet has sufficient ".concat(isSolTransfer ? 'SOL' : transferAsset, " for transfer")
                            },
                        };
                        data.summary = "\u274C Transfer failed: ".concat(transferError_1.message);
                        return [3 /*break*/, 18];
                    case 18: return [3 /*break*/, 20];
                    case 19:
                        data = {
                            type: 'transfer',
                            status: 'failed',
                            details: { error: 'No recipient address provided.' },
                        };
                        data.summary = "\u274C Transfer failed: No recipient address provided.";
                        _h.label = 20;
                    case 20: return [3 /*break*/, 23];
                    case 21: return [4 /*yield*/, syncWithRealBalance()];
                    case 22:
                        state = _h.sent();
                        balanceLines = Object.entries(state.balances)
                            .filter(function (_a) {
                            var _ = _a[0], v = _a[1];
                            return v > 0;
                        })
                            .map(function (_a) {
                            var token = _a[0], amount = _a[1];
                            return "\u2022 ".concat(token, ": ").concat(amount.toFixed(4));
                        })
                            .join('\n');
                        recentTxs = state.transactions.slice(-5).reverse();
                        txLines = recentTxs.length > 0
                            ? recentTxs.map(function (tx) {
                                return "\u2022 ".concat(tx.type, ": ").concat(tx.amountIn.toFixed(4), " ").concat(tx.from, " \u2192 ").concat(tx.amountOut.toFixed(4), " ").concat(tx.to);
                            }).join('\n')
                            : 'No recent transactions';
                        data = {
                            type: 'balance',
                            status: 'confirmed',
                            details: {
                                solanaAddress: SOLANA_ADDRESS,
                                network: 'devnet',
                                balances: state.balances,
                                realSOL: state.realSOL,
                                lastSync: new Date(state.lastRealBalanceCheck).toISOString(),
                                recentTransactions: recentTxs,
                            },
                        };
                        data.summary = "\uD83D\uDCB0 **Wallet Balance** (Devnet)\n" +
                            "\uD83D\uDCCD `".concat(SOLANA_ADDRESS.slice(0, 8), "...").concat(SOLANA_ADDRESS.slice(-4), "`\n\n") +
                            "**Balances:**\n".concat(balanceLines || '• No tokens', "\n\n") +
                            "**Recent Activity:**\n".concat(txLines);
                        return [3 /*break*/, 23];
                    case 23: return [2 /*return*/, {
                            success: true,
                            data: data,
                            confidence: 0.95,
                            timestamp: new Date(),
                            executionTimeMs: Date.now() - startTime,
                            cost: txSignature ? {
                                amount: '0.000005',
                                currency: 'SOL',
                                network: 'solana',
                                recipient: 'network',
                            } : undefined,
                        }];
                    case 24:
                        error_2 = _h.sent();
                        console.error('[bankr] Error:', error_2.message);
                        return [2 /*return*/, {
                                success: false,
                                data: {
                                    type: 'balance',
                                    status: 'failed',
                                    details: { error: 'An error occurred during wallet operations.' },
                                },
                                timestamp: new Date(),
                                executionTimeMs: Date.now() - startTime,
                            }];
                    case 25: return [2 /*return*/];
                }
            });
        });
    },
    /**
     * Handle compound/multi-step actions (e.g., buy BONK and send to address)
     */
    handleCompoundActions: function (prompt, actions, startTime, context) {
        return __awaiter(this, void 0, void 0, function () {
            var results, lastSwapOutput, state, isApproved, firstAction, fromToken, amount, currentBalance, i, action, swapResult, transferAmount, transferToken, currentBalance, sendAmount, error_3, allSuccess, swapStep, transferStep, summary;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        results = [];
                        lastSwapOutput = null;
                        return [4 /*yield*/, syncWithRealBalance()];
                    case 1:
                        state = _e.sent();
                        isApproved = ((_a = context === null || context === void 0 ? void 0 : context.metadata) === null || _a === void 0 ? void 0 : _a.transactionApproved) === true;
                        if (!isApproved) {
                            firstAction = actions[0];
                            if (firstAction.type === 'swap' || firstAction.type === 'transfer') {
                                fromToken = firstAction.type === 'swap' ? firstAction.from : (firstAction.token || 'SOL');
                                amount = parseFloat(firstAction.amount || '0');
                                currentBalance = state.balances[fromToken.toUpperCase()] || 0;
                                return [2 /*return*/, {
                                        success: true,
                                        data: {
                                            type: 'compound',
                                            requiresApproval: true,
                                            details: {
                                                type: 'compound',
                                                amount: firstAction.amount,
                                                from: firstAction.from,
                                                to: firstAction.address || 'Multiple steps',
                                                asset: fromToken.toUpperCase(),
                                                feeEstimate: '0.00001 SOL (estimated)',
                                                currentBalance: currentBalance.toFixed(4),
                                                note: "This multi-step transaction involves ".concat(actions.length, " actions.")
                                            }
                                        },
                                        timestamp: new Date(),
                                        executionTimeMs: Date.now() - startTime,
                                    }];
                            }
                        }
                        i = 0;
                        _e.label = 2;
                    case 2:
                        if (!(i < actions.length)) return [3 /*break*/, 10];
                        action = actions[i];
                        console.log("[bankr] Executing step ".concat(i + 1, "/").concat(actions.length, ": ").concat(action.type));
                        _e.label = 3;
                    case 3:
                        _e.trys.push([3, 8, , 9]);
                        if (!(action.type === 'swap')) return [3 /*break*/, 5];
                        return [4 /*yield*/, executeJupiterSwap(action.from, action.to, action.amount)];
                    case 4:
                        swapResult = _e.sent();
                        results.push({
                            step: i + 1,
                            type: 'swap',
                            status: swapResult.status,
                            from: action.from,
                            to: action.to,
                            input: action.amount,
                            output: swapResult.details.estimatedOutput,
                            route: swapResult.details.route,
                        });
                        if (swapResult.status === 'executed' || swapResult.status === 'simulated') {
                            lastSwapOutput = {
                                token: action.to,
                                amount: parseFloat(swapResult.details.estimatedOutput || '0'),
                            };
                        }
                        return [3 /*break*/, 7];
                    case 5:
                        if (!(action.type === 'transfer')) return [3 /*break*/, 7];
                        transferAmount = action.amount;
                        transferToken = action.token || 'SOL';
                        if (transferAmount === 'ALL' && lastSwapOutput) {
                            transferAmount = lastSwapOutput.amount.toFixed(6);
                            transferToken = lastSwapOutput.token;
                        }
                        return [4 /*yield*/, syncWithRealBalance()];
                    case 6:
                        // Simulate transfer for demo
                        state = _e.sent();
                        currentBalance = state.balances[transferToken] || 0;
                        sendAmount = parseFloat(transferAmount || '0');
                        if (currentBalance < sendAmount) {
                            results.push({
                                step: i + 1,
                                type: 'transfer',
                                status: 'failed',
                                error: "Insufficient ".concat(transferToken, " balance"),
                                available: currentBalance,
                                required: sendAmount,
                            });
                        }
                        else {
                            // Simulate the transfer (deduct from balance)
                            state.balances[transferToken] = currentBalance - sendAmount;
                            state.transactions.push({
                                type: 'transfer',
                                from: transferToken,
                                to: 'EXTERNAL',
                                amountIn: sendAmount,
                                amountOut: 0,
                                timestamp: Date.now(),
                                route: ((_b = action.address) === null || _b === void 0 ? void 0 : _b.slice(0, 8)) + '...',
                            });
                            saveSimulatedState(state);
                            results.push({
                                step: i + 1,
                                type: 'transfer',
                                status: 'simulated',
                                token: transferToken,
                                amount: sendAmount,
                                recipient: action.address,
                                txHash: "sim_".concat(Date.now().toString(36)),
                            });
                        }
                        _e.label = 7;
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        error_3 = _e.sent();
                        results.push({
                            step: i + 1,
                            type: action.type,
                            status: 'failed',
                            error: error_3.message,
                        });
                        return [3 /*break*/, 9];
                    case 9:
                        i++;
                        return [3 /*break*/, 2];
                    case 10:
                        allSuccess = results.every(function (r) { return r.status !== 'failed'; });
                        swapStep = results.find(function (r) { return r.type === 'swap'; });
                        transferStep = results.find(function (r) { return r.type === 'transfer'; });
                        summary = "\uD83D\uDCE6 **Multi-Step Transaction** (".concat(results.length, " steps)\n\n");
                        if (swapStep) {
                            summary += "**Step 1: Swap**\n";
                            summary += "\u2022 Input: ".concat(swapStep.input, " ").concat(swapStep.from, "\n");
                            summary += "\u2022 Output: ".concat(swapStep.output, " ").concat(swapStep.to, "\n");
                            summary += "\u2022 Route: ".concat(swapStep.route, "\n\n");
                        }
                        if (transferStep) {
                            summary += "**Step 2: Transfer**\n";
                            if (transferStep.status === 'failed') {
                                summary += "\u2022 \u274C ".concat(transferStep.error, "\n");
                            }
                            else {
                                summary += "\u2022 Amount: ".concat(transferStep.amount, " ").concat(transferStep.token, "\n");
                                summary += "\u2022 To: ".concat(transferStep.recipient, "\n");
                                summary += "\u2022 Status: Simulated \u2713\n";
                            }
                        }
                        summary += "\n\uD83D\uDCCA **Final Balances:**\n";
                        summary += "\u2022 SOL: ".concat(((_c = state.balances.SOL) === null || _c === void 0 ? void 0 : _c.toFixed(4)) || '0', "\n");
                        summary += "\u2022 USDC: ".concat(((_d = state.balances.USDC) === null || _d === void 0 ? void 0 : _d.toFixed(4)) || '0', "\n");
                        if (state.balances.BONK) {
                            summary += "\u2022 BONK: ".concat((state.balances.BONK / 1000).toFixed(1), "K\n");
                        }
                        return [2 /*return*/, {
                                success: allSuccess,
                                data: {
                                    type: 'compound',
                                    status: allSuccess ? 'success' : 'partial',
                                    steps: results,
                                    details: {
                                        response: summary,
                                        balancesAfter: state.balances,
                                    },
                                },
                                timestamp: new Date(),
                                executionTimeMs: Date.now() - startTime,
                            }];
                }
            });
        });
    },
};
exports.default = exports.bankr;
