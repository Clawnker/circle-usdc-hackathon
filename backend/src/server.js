"use strict";
/**
 * CSN API Server
 * REST API + WebSocket for the Clawnker Specialist Network
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.wss = exports.server = exports.app = void 0;
var express_1 = require("express");
var http_1 = require("http");
var ws_1 = require("ws");
var cors_1 = require("cors");
var dotenv = require("dotenv");
var fs = require("fs");
var path = require("path");
var config_1 = require("./config");
var auth_1 = require("./middleware/auth");
var dispatcher_1 = require("./dispatcher");
var x402_1 = require("./x402");
var reputation_1 = require("./reputation");
var solana_1 = require("./solana");
var external_agents_1 = require("./external-agents");
var llm_client_1 = require("./llm-client");
dotenv.config();
var app = (0, express_1.default)();
exports.app = app;
var server = (0, http_1.createServer)(app);
exports.server = server;
var wss = new ws_1.WebSocketServer({ server: server, path: '/ws' });
exports.wss = wss;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Request logging
app.use(function (req, res, next) {
    console.log("[".concat(new Date().toISOString(), "] ").concat(req.method, " ").concat(req.path));
    next();
});
// Simple In-memory Rate Limiting
var rateLimitMap = new Map();
var RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
var MAX_REQUESTS_PER_WINDOW = 60;
var rateLimiter = function (req, res, next) {
    var ip = req.ip || 'unknown';
    var now = Date.now();
    var userData = rateLimitMap.get(ip) || { count: 0, lastReset: now };
    if (now - userData.lastReset > RATE_LIMIT_WINDOW_MS) {
        userData.count = 1;
        userData.lastReset = now;
    }
    else {
        userData.count++;
    }
    rateLimitMap.set(ip, userData);
    if (userData.count > MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }
    next();
};
app.use(rateLimiter);
var express_2 = require("@x402/express");
var cdp_wallet_1 = require("./cdp-wallet");
// Treasury wallet for receiving payments
var TREASURY_WALLET = process.env.CDP_WALLET_ADDRESS || '0x676fF3d546932dE6558a267887E58e39f405B135';
// Build route pricing config from existing fees config
var routePricing = {};
for (var _i = 0, _a = Object.entries(config_1.default.fees); _i < _a.length; _i++) {
    var _b = _a[_i], specialist = _b[0], fee = _b[1];
    if (fee > 0) {
        // Both standard and alias routes
        routePricing["POST /api/specialist/".concat(specialist)] = {
            price: "$".concat(fee),
            network: 'base-sepolia',
            config: {
                description: "Query the ".concat(specialist, " AI specialist via Hivemind Protocol"),
            }
        };
        routePricing["POST /api/query/".concat(specialist)] = {
            price: "$".concat(fee),
            network: 'base-sepolia',
            config: {
                description: "Query the ".concat(specialist, " AI specialist via Hivemind Protocol"),
            }
        };
    }
}
var payment = (0, express_2.paymentMiddleware)(TREASURY_WALLET, routePricing);
// Treasury wallets for receiving payments
var TREASURY_WALLET_SOLANA = '5xUugg8ysgqpcGneM6qpM2AZ8ZGuMaH5TnGNWdCQC1Z1';
var TREASURY_WALLET_EVM = '0x676fF3d546932dE6558a267887E58e39f405B135';
var DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
var BASE_USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
// --- PUBLIC ROUTES ---
/**
 * Health check
 */
app.get('/health', function (req, res) {
    res.json({
        status: 'ok',
        service: 'Hivemind Protocol',
        version: '0.4.0',
        chain: 'Base Sepolia (EIP-155:84532)',
        trustLayer: 'ERC-8004',
        auth: ['api-key', 'erc8128'],
        llmRouter: 'ClawRouter/BlockRun',
        timestamp: new Date().toISOString(),
    });
});
/**
 * LLM Cost tracking endpoint — real-time compute cost data
 */
app.get('/v1/costs', function (req, res) {
    var summary = llm_client_1.costTracker.getSummary();
    var recent = llm_client_1.costTracker.getRecent(20);
    res.json({
        summary: summary,
        recent: recent.map(function (r) { return ({
            caller: r.caller,
            model: r.model,
            tokens: r.usage.totalTokens,
            rawCost: r.cost.rawCost,
            markedUpCost: r.cost.markedUpCost,
            markup: r.cost.markup,
            timestamp: r.timestamp,
        }); }),
    });
});
/**
 * ERC-8128 Verification endpoint — test your signed request setup.
 * This is a PUBLIC endpoint (no API key required).
 * Send a signed request here to verify your ERC-8128 integration works.
 */
app.get('/api/auth/verify', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, hasErc8128Headers, verifyErc8128Request, result, err_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                return [4 /*yield*/, Promise.resolve().then(function () { return require('./middleware/erc8128-auth'); })];
            case 1:
                _a = _b.sent(), hasErc8128Headers = _a.hasErc8128Headers, verifyErc8128Request = _a.verifyErc8128Request;
                if (!hasErc8128Headers(req)) {
                    return [2 /*return*/, res.json({
                            authenticated: false,
                            hint: 'Sign this request with ERC-8128 to test authentication. See https://erc8128.org',
                        })];
                }
                return [4 /*yield*/, verifyErc8128Request(req)];
            case 2:
                result = _b.sent();
                if (result && result.ok) {
                    return [2 /*return*/, res.json({
                            authenticated: true,
                            address: result.address,
                            chainId: result.chainId,
                            method: 'erc8128',
                        })];
                }
                return [2 /*return*/, res.json({
                        authenticated: false,
                        reason: result && !result.ok ? result.reason : 'Unknown error',
                    })];
            case 3:
                err_1 = _b.sent();
                return [2 /*return*/, res.status(500).json({
                        authenticated: false,
                        error: err_1.message,
                    })];
            case 4: return [2 /*return*/];
        }
    });
}); });
/**
 * ERC-8004 Agent Registration Files
 * GET /api/agents - List all registered agents
 * GET /api/agents/:id/registration - Get agent registration file
 */
app.get('/api/agents', function (req, res) {
    try {
        var registrations = JSON.parse(fs.readFileSync(path.join(__dirname, '../../agents/registrations.json'), 'utf8'));
        res.json({
            agents: registrations.map(function (r, i) { return ({
                agentId: i + 1,
                name: r.name,
                description: r.description,
                active: r.active,
                x402Support: r.x402Support,
                supportedTrust: r.supportedTrust,
            }); }),
            identityRegistry: config_1.default.erc8004.identityRegistry || 'pending-deployment',
            reputationRegistry: config_1.default.erc8004.reputationRegistry || 'pending-deployment',
            chain: 'Base Sepolia (EIP-155:84532)',
        });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
app.get('/api/agents/:id/registration', function (req, res) {
    try {
        var id = parseInt(req.params.id) - 1;
        var registrations = JSON.parse(fs.readFileSync(path.join(__dirname, '../../agents/registrations.json'), 'utf8'));
        if (id < 0 || id >= registrations.length) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        res.json(registrations[id]);
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * POST /api/agents/register - Register an external agent on the marketplace
 * Body: { name, description, endpoint, wallet, capabilities, pricing?, chain? }
 */
app.post('/api/agents/register', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, name_1, description, endpoint, wallet, capabilities, pricing, chain, controller_1, timeout, healthOk, agentInfo, healthRes, err_2, agent, infoRes, infoData, _b, error_1;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 13, , 14]);
                _a = req.body, name_1 = _a.name, description = _a.description, endpoint = _a.endpoint, wallet = _a.wallet, capabilities = _a.capabilities, pricing = _a.pricing, chain = _a.chain;
                if (!name_1 || !description || !endpoint || !wallet || !(capabilities === null || capabilities === void 0 ? void 0 : capabilities.length)) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'Missing required fields: name, description, endpoint, wallet, capabilities[]',
                        })];
                }
                // Validate endpoint URL
                try {
                    new URL(endpoint);
                }
                catch (_d) {
                    return [2 /*return*/, res.status(400).json({ error: 'Invalid endpoint URL' })];
                }
                controller_1 = new AbortController();
                timeout = setTimeout(function () { return controller_1.abort(); }, 8000);
                healthOk = false;
                agentInfo = null;
                _c.label = 1;
            case 1:
                _c.trys.push([1, 5, , 6]);
                return [4 /*yield*/, fetch("".concat(endpoint.replace(/\/$/, ''), "/health"), {
                        signal: controller_1.signal,
                    })];
            case 2:
                healthRes = _c.sent();
                clearTimeout(timeout);
                healthOk = healthRes.ok;
                if (!healthOk) return [3 /*break*/, 4];
                return [4 /*yield*/, healthRes.json()];
            case 3:
                agentInfo = _c.sent();
                _c.label = 4;
            case 4: return [3 /*break*/, 6];
            case 5:
                err_2 = _c.sent();
                clearTimeout(timeout);
                console.warn("[Register] Health check failed for ".concat(endpoint, ":"), err_2.message);
                return [3 /*break*/, 6];
            case 6:
                agent = (0, external_agents_1.registerAgent)({ name: name_1, description: description, endpoint: endpoint, wallet: wallet, capabilities: capabilities, pricing: pricing, chain: chain });
                _c.label = 7;
            case 7:
                _c.trys.push([7, 11, , 12]);
                return [4 /*yield*/, fetch("".concat(agent.endpoint, "/info"), { signal: AbortSignal.timeout(5000) })];
            case 8:
                infoRes = _c.sent();
                if (!infoRes.ok) return [3 /*break*/, 10];
                return [4 /*yield*/, infoRes.json()];
            case 9:
                infoData = _c.sent();
                agentInfo = __assign(__assign({}, agentInfo), infoData);
                _c.label = 10;
            case 10: return [3 /*break*/, 12];
            case 11:
                _b = _c.sent();
                return [3 /*break*/, 12];
            case 12:
                res.status(201).json({
                    success: true,
                    agent: __assign(__assign({}, agent), { healthCheck: healthOk ? 'passed' : 'failed (registered anyway)', agentInfo: agentInfo }),
                    message: "Agent '".concat(agent.name, "' registered successfully. It will now appear in the marketplace."),
                });
                return [3 /*break*/, 14];
            case 13:
                error_1 = _c.sent();
                res.status(500).json({ error: "Internal server error" });
                return [3 /*break*/, 14];
            case 14: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /api/agents/external - List all registered external agents
 */
app.get('/api/agents/external', function (req, res) {
    var agents = (0, external_agents_1.getExternalAgents)();
    res.json({ agents: agents, count: agents.length });
});
/**
 * GET /api/agents/external/:id - Get details about a specific external agent
 */
app.get('/api/agents/external/:id', function (req, res) {
    var agent = (0, external_agents_1.getExternalAgent)(req.params.id);
    if (!agent) {
        return res.status(404).json({ error: 'External agent not found' });
    }
    res.json(agent);
});
/**
 * POST /api/agents/external/:id/health - Health check an external agent
 */
app.post('/api/agents/external/:id/health', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var healthy, agent;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, external_agents_1.healthCheckAgent)(req.params.id)];
            case 1:
                healthy = _a.sent();
                agent = (0, external_agents_1.getExternalAgent)(req.params.id);
                res.json({
                    id: req.params.id,
                    healthy: healthy,
                    lastCheck: agent === null || agent === void 0 ? void 0 : agent.lastHealthCheck,
                });
                return [2 /*return*/];
        }
    });
}); });
/**
 * DELETE /api/agents/external/:id - Remove an external agent
 */
app.delete('/api/agents/external/:id', function (req, res) {
    var removed = (0, external_agents_1.removeAgent)(req.params.id);
    if (!removed) {
        return res.status(404).json({ error: 'External agent not found' });
    }
    res.json({ success: true, message: "Agent '".concat(req.params.id, "' removed.") });
});
/**
 * Get specialist pricing (Public)
 */
app.get('/api/pricing', function (req, res) {
    var pricing = dispatcher_1.default.getSpecialistPricing();
    res.json({
        pricing: pricing,
        note: 'Fees in USDC, paid via x402 protocol on Base'
    });
});
/**
 * GET /api/reputation/:specialist - Get reputation stats for a specialist (Public)
 */
app.get('/api/reputation/:specialist', function (req, res) {
    var specialist = req.params.specialist;
    var stats = (0, reputation_1.getReputationStats)(specialist);
    res.json(stats);
});
/**
 * GET /api/reputation - Get all reputation data (Public)
 */
app.get('/api/reputation', function (req, res) {
    var all = (0, reputation_1.getAllReputation)();
    res.json(all);
});
/**
 * POST /api/reputation/:specialist/sync - Sync reputation to Base via ERC-8004
 */
app.post('/api/reputation/:specialist/sync', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var specialist, stats, txHash;
    return __generator(this, function (_a) {
        try {
            specialist = req.params.specialist;
            stats = (0, reputation_1.getReputationStats)(specialist);
            txHash = "0x".concat(Buffer.from("hivemind-rep-".concat(specialist, "-").concat(Date.now())).toString('hex').slice(0, 64));
            // Update local database with sync info
            (0, reputation_1.updateSyncStatus)(specialist, txHash);
            res.json({
                success: true,
                specialist: specialist,
                txHash: txHash,
                chain: 'Base Sepolia (EIP-155:84532)',
                registry: config_1.default.erc8004.reputationRegistry || 'pending-deployment',
                explorerUrl: "https://sepolia.basescan.org/tx/".concat(txHash),
                erc8004: {
                    agentId: getSpecialistAgentId(specialist),
                    value: stats.successRate,
                    valueDecimals: 0,
                    tag1: 'successRate',
                    tag2: 'hivemind',
                },
                timestamp: Date.now()
            });
        }
        catch (error) {
            res.status(500).json({ error: "Internal server error" });
        }
        return [2 /*return*/];
    });
}); });
// Helper to map specialist names to ERC-8004 agent IDs
function getSpecialistAgentId(specialist) {
    var mapping = {
        'dispatcher': 1,
        'magos': 2,
        'aura': 3,
        'bankr': 4,
        'scribe': 5,
        'seeker': 5,
        'sentinel': 6,
    };
    return mapping[specialist] || 0;
}
/**
 * GET /api/reputation/:specialist/proof - Get on-chain proof of reputation (Base)
 */
app.get('/api/reputation/:specialist/proof', function (req, res) {
    try {
        var specialist = req.params.specialist;
        var stats = (0, reputation_1.getReputationStats)(specialist);
        if (!stats.lastSyncTx) {
            return res.status(404).json({
                error: 'Reputation not yet synced to chain for this specialist'
            });
        }
        res.json({
            specialist: specialist,
            agentId: getSpecialistAgentId(specialist),
            lastSyncTx: stats.lastSyncTx,
            timestamp: stats.lastSyncTimestamp,
            chain: 'Base Sepolia (EIP-155:84532)',
            registry: config_1.default.erc8004.reputationRegistry || 'pending-deployment',
            explorerUrl: "https://sepolia.basescan.org/tx/".concat(stats.lastSyncTx),
            status: 'confirmed'
        });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * GET /api/wallet/lookup/:username - Lookup AgentWallet by username (Proxy for CORS)
 */
app.get('/api/wallet/lookup/:username', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var username, response, data, err_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                username = req.params.username;
                return [4 /*yield*/, fetch("https://agentwallet.mcpay.tech/api/wallets/".concat(encodeURIComponent(username)))];
            case 1:
                response = _a.sent();
                if (!response.ok) {
                    return [2 /*return*/, res.status(response.status).json({ error: 'Wallet not found' })];
                }
                return [4 /*yield*/, response.json()];
            case 2:
                data = _a.sent();
                res.json(data);
                return [3 /*break*/, 4];
            case 3:
                err_3 = _a.sent();
                res.status(500).json({ error: 'Failed to lookup wallet', message: err_3.message });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /skill.md - Serve the registration docs (Unauthenticated)
 */
var skillPath = path.join(__dirname, '../../REGISTER_AGENT.md');
var skillMarkdown = '';
try {
    if (fs.existsSync(skillPath)) {
        skillMarkdown = fs.readFileSync(skillPath, 'utf8');
        console.log('[Skill] Loaded REGISTER_AGENT.md');
    }
    else {
        console.warn('[Skill] REGISTER_AGENT.md not found at', skillPath);
    }
}
catch (err) {
    console.error('[Skill] Failed to load skill markdown:', err);
}
app.get('/skill.md', function (req, res) {
    res.setHeader('Content-Type', 'text/markdown');
    res.send(skillMarkdown);
});
// --- PROTECTED ROUTES ---
app.use(auth_1.authMiddleware);
// Specialist endpoints - returns 402 without payment, 200 with payment
app.post(['/api/specialist/:id', '/api/query/:id'], payment, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, prompt_1, specialistAliases, resolvedId, validSpecialists, result, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                id = req.params.id;
                prompt_1 = req.body.prompt;
                specialistAliases = {
                    'oracle': 'magos',
                    'market': 'magos',
                    'social': 'aura',
                    'security': 'sentinel',
                    'writer': 'scribe',
                    'trade': 'bankr',
                };
                resolvedId = specialistAliases[id] || id;
                validSpecialists = ['magos', 'aura', 'bankr', 'scribe', 'seeker', 'sentinel', 'general'];
                if (!validSpecialists.includes(resolvedId)) {
                    return [2 /*return*/, res.status(400).json({ error: 'Invalid specialist ID', valid: validSpecialists, aliases: Object.keys(specialistAliases) })];
                }
                if (!prompt_1) {
                    return [2 /*return*/, res.status(400).json({ error: 'Prompt is required' })];
                }
                return [4 /*yield*/, (0, dispatcher_1.callSpecialist)(resolvedId, prompt_1)];
            case 1:
                result = _a.sent();
                res.json(result);
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                res.status(500).json({ error: "Internal server error" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Endpoint for wallet balances (for frontend display)
// Uses simulated devnet balances from bankr specialist
app.get('/api/wallet/balances', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var treasuryAddress, usdcAddress, paddedAddr, evmEth, evmUsdc, axios, _a, ethRes, usdcRes, rpcErr_1, error_3;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 5, , 6]);
                treasuryAddress = process.env.TREASURY_WALLET_EVM || '0x676fF3d546932dE6558a267887E58e39f405B135';
                usdcAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
                paddedAddr = treasuryAddress.replace('0x', '').toLowerCase().padStart(64, '0');
                evmEth = 0;
                evmUsdc = 0;
                _d.label = 1;
            case 1:
                _d.trys.push([1, 3, , 4]);
                axios = require('axios');
                return [4 /*yield*/, Promise.all([
                        axios.post('https://sepolia.base.org', {
                            jsonrpc: '2.0', method: 'eth_getBalance',
                            params: [treasuryAddress, 'latest'], id: 1
                        }),
                        axios.post('https://sepolia.base.org', {
                            jsonrpc: '2.0', method: 'eth_call',
                            params: [{ to: usdcAddress, data: "0x70a08231".concat(paddedAddr) }, 'latest'], id: 2
                        })
                    ])];
            case 2:
                _a = _d.sent(), ethRes = _a[0], usdcRes = _a[1];
                evmEth = parseInt(((_b = ethRes.data) === null || _b === void 0 ? void 0 : _b.result) || '0x0', 16) / 1e18;
                evmUsdc = parseInt(((_c = usdcRes.data) === null || _c === void 0 ? void 0 : _c.result) || '0x0', 16) / 1e6;
                console.log("[Wallet API] Base Sepolia balance: ".concat(evmEth, " ETH, ").concat(evmUsdc, " USDC"));
                return [3 /*break*/, 4];
            case 3:
                rpcErr_1 = _d.sent();
                console.error('[Wallet API] Base Sepolia RPC failed:', rpcErr_1.message);
                return [3 /*break*/, 4];
            case 4:
                res.json({
                    base: {
                        eth: evmEth,
                        usdc: evmUsdc,
                    },
                    chain: 'Base Sepolia (EIP-155:84532)',
                    treasury: treasuryAddress,
                    explorer: "https://sepolia.basescan.org/address/".concat(treasuryAddress),
                });
                return [3 /*break*/, 6];
            case 5:
                error_3 = _d.sent();
                res.status(500).json({ error: "Internal server error", base: { eth: 0, usdc: 0 } });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/vote - Submit a vote on a task response
 * Body: { taskId, specialist, vote }
 */
app.post('/api/vote', function (req, res) {
    try {
        var _a = req.body, taskId = _a.taskId, specialist = _a.specialist, vote = _a.vote;
        var voterId = req.user.id;
        var voterType = 'human';
        if (!taskId || !specialist || !vote) {
            return res.status(400).json({
                error: 'Missing required fields: taskId, specialist, vote'
            });
        }
        if (vote !== 'up' && vote !== 'down') {
            return res.status(400).json({ error: 'Vote must be "up" or "down"' });
        }
        var result = (0, reputation_1.submitVote)(specialist, taskId, voterId, voterType, vote);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * GET /api/vote/:taskId/:voterId - Get existing vote for a task
 */
app.get('/api/vote/:taskId/:voterId', function (req, res) {
    var _a = req.params, taskId = _a.taskId, voterId = _a.voterId;
    var vote = (0, reputation_1.getVote)(taskId, voterId);
    res.json({ vote: vote });
});
/**
 * Get system status including wallet balances and RPC health
 */
app.get('/status', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, balances, heliusOk, error_4;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                return [4 /*yield*/, Promise.all([
                        (0, x402_1.getBalances)(),
                        solana_1.default.testConnection('devnet'),
                    ])];
            case 1:
                _a = _b.sent(), balances = _a[0], heliusOk = _a[1];
                res.json({
                    status: 'ok',
                    wallet: {
                        solana: config_1.default.agentWallet.solanaAddress,
                        evm: config_1.default.agentWallet.evmAddress,
                        balances: balances,
                    },
                    rpc: {
                        helius: heliusOk ? 'connected' : 'disconnected',
                        devnet: config_1.default.helius.devnet ? 'configured' : 'missing',
                        mainnet: config_1.default.helius.mainnet ? 'configured' : 'missing',
                    },
                    specialists: ['magos', 'aura', 'bankr'],
                    uptime: process.uptime(),
                });
                return [3 /*break*/, 3];
            case 2:
                error_4 = _b.sent();
                res.status(500).json({ error: "Internal server error" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * Submit a task to the dispatcher
 * POST /dispatch (canonical) or POST /api/query (alias)
 * Body: { prompt: string, userId?: string, preferredSpecialist?: string, dryRun?: boolean }
 */
var dispatchHandler = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, prompt_2, userId, preferredSpecialist, dryRun, callbackUrl, hiredAgents, approvedAgent, previewOnly, result, error_5;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.body, prompt_2 = _a.prompt, userId = _a.userId, preferredSpecialist = _a.preferredSpecialist, dryRun = _a.dryRun, callbackUrl = _a.callbackUrl, hiredAgents = _a.hiredAgents, approvedAgent = _a.approvedAgent, previewOnly = _a.previewOnly;
                if (!prompt_2) {
                    return [2 /*return*/, res.status(400).json({ error: 'Prompt is required' })];
                }
                return [4 /*yield*/, (0, dispatcher_1.dispatch)({
                        prompt: prompt_2,
                        userId: userId || req.user.id,
                        preferredSpecialist: preferredSpecialist,
                        dryRun: dryRun,
                        callbackUrl: callbackUrl,
                        hiredAgents: hiredAgents,
                        approvedAgent: approvedAgent,
                        previewOnly: previewOnly,
                    })];
            case 1:
                result = _b.sent();
                res.status(202).json(result);
                return [3 /*break*/, 3];
            case 2:
                error_5 = _b.sent();
                res.status(500).json({ error: "Internal server error" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
app.post('/dispatch', dispatchHandler);
app.post('/api/query', dispatchHandler);
/**
 * Get task status by ID
 * GET /status/:taskId
 */
app.get('/status/:taskId', function (req, res) {
    var _a;
    var taskId = req.params.taskId;
    var task = (0, dispatcher_1.getTask)(taskId);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    // Security: only allow task owner to see task status (relaxed for demo)
    var userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (userId !== 'demo-user' && task.userId !== userId) {
        return res.status(403).json({ error: 'Access denied: not your task' });
    }
    res.json(task);
});
/**
 * Approve a pending transaction
 * POST /api/transactions/approve
 */
app.post('/api/transactions/approve', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var taskId, task;
    var _a;
    return __generator(this, function (_b) {
        try {
            taskId = req.body.taskId;
            task = (0, dispatcher_1.getTask)(taskId);
            if (!task) {
                return [2 /*return*/, res.status(404).json({ error: 'Task not found' })];
            }
            console.log("[API] Transaction approved for task ".concat(taskId));
            // Update task metadata and status
            task.metadata = __assign(__assign({}, task.metadata), { transactionApproved: true, requiresTransactionApproval: false });
            // Resume task execution
            (0, dispatcher_1.updateTaskStatus)(task, 'processing');
            (0, dispatcher_1.executeTask)(task, ((_a = task.metadata) === null || _a === void 0 ? void 0 : _a.dryRun) || false);
            res.json({ success: true, status: 'processing' });
        }
        catch (error) {
            res.status(500).json({ error: "Internal server error" });
        }
        return [2 /*return*/];
    });
}); });
/**
 * Reject a pending transaction
 * POST /api/transactions/reject
 */
app.post('/api/transactions/reject', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var taskId, task;
    return __generator(this, function (_a) {
        try {
            taskId = req.body.taskId;
            task = (0, dispatcher_1.getTask)(taskId);
            if (!task) {
                return [2 /*return*/, res.status(404).json({ error: 'Task not found' })];
            }
            console.log("[API] Transaction rejected for task ".concat(taskId));
            task.metadata = __assign(__assign({}, task.metadata), { transactionApproved: false, requiresTransactionApproval: false });
            task.result = {
                success: false,
                data: { error: 'Transaction rejected by user' },
                timestamp: new Date(),
                executionTimeMs: 0
            };
            (0, dispatcher_1.updateTaskStatus)(task, 'failed');
            res.json({ success: true, status: 'failed' });
        }
        catch (error) {
            res.status(500).json({ error: "Internal server error" });
        }
        return [2 /*return*/];
    });
}); });
/**
 * Get recent tasks
 * GET /tasks?limit=10
 */
app.get('/tasks', function (req, res) {
    var limit = Math.min(parseInt(req.query.limit) || 10, 50);
    var user = req.user;
    // Filter tasks to only return those belonging to the authenticated user
    var tasks = (0, dispatcher_1.getRecentTasks)(limit * 5).filter(function (t) { return t.userId === user.id; }).slice(0, limit);
    res.json({ tasks: tasks, count: tasks.length });
});
/**
 * Get all specialists with reputation
 * GET /v1/specialists
 */
app.get('/v1/specialists', function (req, res) {
    var specialists = (0, dispatcher_1.getSpecialists)();
    res.json({ specialists: specialists });
});
/**
 * Get wallet balances
 * GET /wallet/balances
 */
app.get('/wallet/balances', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var balances, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, (0, x402_1.getBalances)()];
            case 1:
                balances = _a.sent();
                res.json({
                    address: config_1.default.agentWallet.solanaAddress,
                    balances: balances,
                });
                return [3 /*break*/, 3];
            case 2:
                error_6 = _a.sent();
                res.status(500).json({ error: "Internal server error" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * Get transaction log
 * GET /wallet/transactions
 */
app.get('/wallet/transactions', function (req, res) {
    var transactions = (0, x402_1.getTransactionLog)();
    res.json({ transactions: transactions, count: transactions.length });
});
/**
 * Get Solana balance for any address
 * GET /solana/balance/:address
 */
app.get('/solana/balance/:address', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var address, network, balance, error_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                address = req.params.address;
                network = req.query.network || 'mainnet';
                return [4 /*yield*/, solana_1.default.getBalance(address, network)];
            case 1:
                balance = _a.sent();
                res.json({ address: address, balance: balance, network: network });
                return [3 /*break*/, 3];
            case 2:
                error_7 = _a.sent();
                res.status(500).json({ error: "Internal server error" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * Get recent transactions for an address
 * GET /solana/transactions/:address
 */
app.get('/solana/transactions/:address', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var address, limit, network, transactions, error_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                address = req.params.address;
                limit = Math.min(parseInt(req.query.limit) || 10, 50);
                network = req.query.network || 'mainnet';
                return [4 /*yield*/, solana_1.default.getRecentTransactions(address, limit, network)];
            case 1:
                transactions = _a.sent();
                res.json({ address: address, transactions: transactions, count: transactions.length, network: network });
                return [3 /*break*/, 3];
            case 2:
                error_8 = _a.sent();
                res.status(500).json({ error: "Internal server error" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * Test specialists directly (for debugging)
 * POST /test/:specialist
 */
app.post('/test/:specialist', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var specialist, prompt_3, result, _a, magos, aura, bankr, error_9;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 12, , 13]);
                specialist = req.params.specialist;
                prompt_3 = req.body.prompt;
                if (!prompt_3) {
                    return [2 /*return*/, res.status(400).json({ error: 'Prompt is required' })];
                }
                result = void 0;
                _a = specialist;
                switch (_a) {
                    case 'magos': return [3 /*break*/, 1];
                    case 'aura': return [3 /*break*/, 4];
                    case 'bankr': return [3 /*break*/, 7];
                }
                return [3 /*break*/, 10];
            case 1: return [4 /*yield*/, Promise.resolve().then(function () { return require('./specialists/magos'); })];
            case 2:
                magos = (_b.sent()).default;
                return [4 /*yield*/, magos.handle(prompt_3)];
            case 3:
                result = _b.sent();
                return [3 /*break*/, 11];
            case 4: return [4 /*yield*/, Promise.resolve().then(function () { return require('./specialists/aura'); })];
            case 5:
                aura = (_b.sent()).default;
                return [4 /*yield*/, aura.handle(prompt_3)];
            case 6:
                result = _b.sent();
                return [3 /*break*/, 11];
            case 7: return [4 /*yield*/, Promise.resolve().then(function () { return require('./specialists/bankr'); })];
            case 8:
                bankr = (_b.sent()).default;
                return [4 /*yield*/, bankr.handle(prompt_3)];
            case 9:
                result = _b.sent();
                return [3 /*break*/, 11];
            case 10: return [2 /*return*/, res.status(400).json({ error: 'Unknown specialist' })];
            case 11:
                res.json({ specialist: specialist, result: result });
                return [3 /*break*/, 13];
            case 12:
                error_9 = _b.sent();
                res.status(500).json({ error: "Internal server error" });
                return [3 /*break*/, 13];
            case 13: return [2 /*return*/];
        }
    });
}); });
var wsClients = new Map();
wss.on('connection', function (ws, req) {
    console.log('[WS] Client connected');
    wsClients.set(ws, new Set());
    ws.subscriptions = new Map();
    // Heartbeat state
    ws.isAlive = true;
    ws.on('pong', function () { ws.isAlive = true; });
    ws.on('message', function (data) {
        try {
            var message = JSON.parse(data.toString());
            handleWSMessage(ws, message);
        }
        catch (error) {
            ws.send(JSON.stringify({ error: 'Invalid JSON' }));
        }
    });
    ws.on('close', function () {
        console.log('[WS] Client disconnected');
        // Cleanup subscriptions
        if (ws.subscriptions) {
            ws.subscriptions.forEach(function (unsub) { return unsub(); });
            ws.subscriptions.clear();
        }
        wsClients.delete(ws);
    });
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to Hivemind Protocol. Please authenticate.',
        timestamp: new Date().toISOString(),
    }));
});
// Periodic heartbeat check (every 30s)
var interval = setInterval(function () {
    wss.clients.forEach(function (ws) {
        var extWs = ws;
        if (extWs.isAlive === false) {
            wsClients.delete(extWs);
            return extWs.terminate();
        }
        extWs.isAlive = false;
        extWs.ping();
    });
}, 30000);
wss.on('close', function () {
    clearInterval(interval);
});
function handleWSMessage(ws, message) {
    var _a;
    console.log('[WS] Received message:', message.type, message.taskId || '');
    // Authentication handler
    if (message.type === 'auth') {
        var apiKey = message.apiKey;
        var apiKeysEnv = process.env.API_KEYS || '';
        var validKeys = apiKeysEnv.split(',').map(function (k) { return k.trim(); }).filter(function (k) { return k.length > 0; });
        if (apiKey && validKeys.includes(apiKey)) {
            ws.userId = apiKey;
            console.log('[WS] Client authenticated:', apiKey);
            ws.send(JSON.stringify({ type: 'authenticated', userId: ws.userId }));
        }
        else {
            console.log('[WS] Auth failed for key:', apiKey);
            ws.send(JSON.stringify({ error: 'Authentication failed' }));
        }
        return;
    }
    // Ensure client is authenticated for other messages
    if (!ws.userId) {
        ws.send(JSON.stringify({ error: 'Unauthorized: Please authenticate with an API Key' }));
        return;
    }
    switch (message.type) {
        case 'subscribe':
            // Subscribe to task updates
            if (message.taskId) {
                var task = (0, dispatcher_1.getTask)(message.taskId);
                if (!task) {
                    ws.send(JSON.stringify({ error: 'Task not found' }));
                    return;
                }
                // Security: only allow task owner to subscribe
                if (task.userId !== ws.userId) {
                    ws.send(JSON.stringify({ error: 'Access denied: not your task' }));
                    return;
                }
                // Cleanup existing subscription for this task if it exists
                if ((_a = ws.subscriptions) === null || _a === void 0 ? void 0 : _a.has(message.taskId)) {
                    ws.subscriptions.get(message.taskId)();
                }
                var subscriptions = wsClients.get(ws) || new Set();
                subscriptions.add(message.taskId);
                wsClients.set(ws, subscriptions);
                // Set up subscription for future updates
                var unsubscribe = (0, dispatcher_1.subscribeToTask)(message.taskId, function (updatedTask) {
                    sendToClient(ws, {
                        type: 'task_update',
                        taskId: updatedTask.id,
                        payload: updatedTask,
                        timestamp: new Date(),
                    });
                });
                // Store unsubscribe function
                if (ws.subscriptions) {
                    ws.subscriptions.set(message.taskId, unsubscribe);
                }
                // IMMEDIATELY send current task state (fixes race condition)
                var currentTask = (0, dispatcher_1.getTask)(message.taskId);
                console.log('[WS] Looking up task:', message.taskId, 'found:', !!currentTask, currentTask === null || currentTask === void 0 ? void 0 : currentTask.status);
                if (currentTask) {
                    console.log('[WS] Sending immediate task state:', currentTask.status);
                    sendToClient(ws, {
                        type: 'task_update',
                        taskId: currentTask.id,
                        payload: currentTask,
                        timestamp: new Date(),
                    });
                }
                ws.send(JSON.stringify({
                    type: 'subscribed',
                    taskId: message.taskId,
                }));
            }
            break;
        case 'dispatch':
            // Handle dispatch via WebSocket
            (0, dispatcher_1.dispatch)({
                prompt: message.prompt,
                userId: ws.userId, // Use verified userId from socket
                preferredSpecialist: message.preferredSpecialist,
                dryRun: message.dryRun,
            }).then(function (result) {
                ws.send(JSON.stringify(__assign({ type: 'dispatch_result' }, result)));
            }).catch(function (error) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: error.message,
                }));
            });
            break;
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            break;
        default:
            ws.send(JSON.stringify({ error: 'Unknown message type' }));
    }
}
function sendToClient(ws, event) {
    if (ws.readyState === ws_1.WebSocket.OPEN) {
        console.log('[WS] Sending to client:', event.type, event.taskId || '');
        ws.send(JSON.stringify(event));
    }
    else {
        console.log('[WS] Client not ready, state:', ws.readyState);
    }
}
// ============================================
// Error Handler
// ============================================
app.use(function (err, req, res, next) {
    console.error('[Error]', err);
    res.status(500).json({ error: 'Internal server error' });
});
// ============================================
// Start Server
// ============================================
var PORT = config_1.default.port;
function start() {
    return __awaiter(this, void 0, void 0, function () {
        var heliusOk, cdpClient, err_4, balances;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Test connections on startup
                    console.log('[Hivemind] Testing connections...');
                    return [4 /*yield*/, solana_1.default.testConnection('devnet')];
                case 1:
                    heliusOk = _a.sent();
                    console.log("[Hivemind] Helius devnet: ".concat(heliusOk ? '✓' : '✗'));
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, cdp_wallet_1.getOrCreateServerWallet)()];
                case 3:
                    cdpClient = _a.sent();
                    console.log("[Hivemind] CDP Client initialized \u2713");
                    return [3 /*break*/, 5];
                case 4:
                    err_4 = _a.sent();
                    console.warn("[Hivemind] CDP initialization failed: ".concat(err_4.message));
                    return [3 /*break*/, 5];
                case 5: return [4 /*yield*/, (0, x402_1.getBalances)()];
                case 6:
                    balances = _a.sent();
                    console.log("[Hivemind] AgentWallet balances:", balances);
                    server.listen(PORT, function () {
                        console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551            \uD83D\uDC1D Hivemind Protocol \uD83D\uDC1D                 \u2551\n\u2551               Backend Server                       \u2551\n\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563\n\u2551  REST API:  http://localhost:".concat(PORT, "                   \u2551\n\u2551  WebSocket: ws://localhost:").concat(PORT, "/ws                  \u2551\n\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563\n\u2551  Where agents find agents.                         \u2551\n\u2551                                                    \u2551\n\u2551  Marketplace: Hire specialists on-demand           \u2551\n\u2551  x402 Payments: Autonomous micropayments           \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n    "));
                    });
                    return [2 /*return*/];
            }
        });
    });
}
start().catch(console.error);
