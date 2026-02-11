"use strict";
/**
 * External Agent Registry
 * Manages registration and communication with external agents.
 * ERC-8128: Outgoing requests to compatible agents are signed with the Hivemind wallet.
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAgent = registerAgent;
exports.getExternalAgents = getExternalAgents;
exports.getExternalAgent = getExternalAgent;
exports.removeAgent = removeAgent;
exports.healthCheckAgent = healthCheckAgent;
exports.callExternalAgent = callExternalAgent;
exports.isExternalAgent = isExternalAgent;
var accounts_1 = require("viem/accounts");
var chains_1 = require("viem/chains");
var fs = require("fs");
var path = require("path");
// Use require to avoid tsc following @slicekit/erc8128's ox dependency types
var createSignerClient = require('@slicekit/erc8128').createSignerClient;
var DATA_DIR = path.join(__dirname, '../data');
var EXTERNAL_AGENTS_FILE = path.join(DATA_DIR, 'external-agents.json');
// ── ERC-8128 Signer (for outgoing requests) ───────────────────────────
var privateKey = process.env.DEMO_WALLET_PRIVATE_KEY;
var signerClient = null;
var signerAddress = null;
if (privateKey) {
    try {
        var account_1 = (0, accounts_1.privateKeyToAccount)(privateKey);
        signerAddress = account_1.address;
        signerClient = createSignerClient({
            chainId: chains_1.baseSepolia.id,
            address: account_1.address,
            signMessage: function (message) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, account_1.signMessage({ message: { raw: message } })];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            }); },
        });
        console.log("[ExternalAgents] ERC-8128 signer ready: ".concat(account_1.address));
    }
    catch (err) {
        console.error('[ExternalAgents] Failed to init ERC-8128 signer:', err);
    }
}
// In-memory store, persisted to disk
var externalAgents = new Map();
/**
 * Load external agents from disk
 */
function loadAgents() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (fs.existsSync(EXTERNAL_AGENTS_FILE)) {
            var data = JSON.parse(fs.readFileSync(EXTERNAL_AGENTS_FILE, 'utf8'));
            var _loop_1 = function (agent) {
                // Migration: ensure structuredCapabilities exist
                if (!agent.structuredCapabilities) {
                    agent.structuredCapabilities = agent.capabilities.map(function (cap) { return ({
                        id: "".concat(agent.id, ":").concat(cap),
                        name: cap,
                        description: "Capability ".concat(cap, " provided by ").concat(agent.name),
                        category: 'generic',
                        subcategories: [],
                        inputs: [],
                        outputs: { type: 'json' },
                        confidenceScore: 0.8,
                        latencyEstimateMs: 1000,
                    }); });
                }
                externalAgents.set(agent.id, agent);
            };
            for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
                var agent = data_1[_i];
                _loop_1(agent);
            }
            console.log("[ExternalAgents] Loaded ".concat(externalAgents.size, " external agents"));
        }
    }
    catch (err) {
        console.error('[ExternalAgents] Failed to load:', err);
    }
}
/**
 * Save external agents to disk
 */
function saveAgents() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        var data = Array.from(externalAgents.values());
        fs.writeFileSync(EXTERNAL_AGENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
    }
    catch (err) {
        console.error('[ExternalAgents] Failed to save:', err);
    }
}
// Load on startup
loadAgents();
/**
 * Register a new external agent
 */
function registerAgent(req) {
    // Generate a slug-style ID from the name
    var id = req.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // Ensure structured capabilities exist (backward compatibility)
    var structuredCapabilities = req.structuredCapabilities || req.capabilities.map(function (cap) { return ({
        id: "".concat(id, ":").concat(cap),
        name: cap,
        description: "Capability ".concat(cap, " provided by ").concat(req.name),
        category: 'generic',
        subcategories: [],
        inputs: [],
        outputs: { type: 'json' },
        confidenceScore: 0.8,
        latencyEstimateMs: 1000,
    }); });
    // Check if already registered
    if (externalAgents.has(id)) {
        // Update existing registration
        var existing = externalAgents.get(id);
        existing.description = req.description;
        existing.endpoint = req.endpoint;
        existing.wallet = req.wallet;
        existing.capabilities = req.capabilities;
        existing.structuredCapabilities = structuredCapabilities;
        existing.pricing = req.pricing || {};
        existing.chain = req.chain || 'base-sepolia';
        existing.active = true;
        saveAgents();
        console.log("[ExternalAgents] Updated registration: ".concat(id));
        return existing;
    }
    var agent = {
        id: id,
        name: req.name,
        description: req.description,
        endpoint: req.endpoint.replace(/\/$/, ''), // Remove trailing slash
        wallet: req.wallet,
        capabilities: req.capabilities,
        structuredCapabilities: structuredCapabilities,
        pricing: req.pricing || {},
        chain: req.chain || 'base-sepolia',
        x402Support: true,
        erc8128Support: req.erc8128Support || false,
        erc8004: { registered: true },
        registeredAt: new Date().toISOString(),
        healthy: true, // Assume healthy until proven otherwise
        active: true,
    };
    externalAgents.set(id, agent);
    saveAgents();
    // Trigger embedding sync (non-blocking)
    Promise.resolve().then(function () { return require('./capability-matcher'); }).then(function (_a) {
        var capabilityMatcher = _a.capabilityMatcher;
        capabilityMatcher.syncAgentEmbeddings(id, structuredCapabilities).catch(function (err) {
            console.error("[ExternalAgents] Failed to sync embeddings for ".concat(id, ":"), err);
        });
    });
    // Also update the registrations.json for the /api/agents endpoint
    updateRegistrationsJson(agent);
    console.log("[ExternalAgents] Registered new agent: ".concat(id, " -> ").concat(agent.endpoint));
    return agent;
}
/**
 * Append to the main registrations.json so it shows up in /api/agents
 */
function updateRegistrationsJson(agent) {
    try {
        var regFile = path.join(__dirname, '../../agents/registrations.json');
        var registrations = JSON.parse(fs.readFileSync(regFile, 'utf8'));
        // Check if agent already exists in registrations
        var existingIdx = registrations.findIndex(function (r) { return r.name === agent.name; });
        var registration = {
            type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
            name: agent.name,
            description: agent.description,
            image: "".concat(agent.endpoint, "/icon.png"),
            services: __spreadArray([
                {
                    name: "x402-endpoint",
                    endpoint: agent.endpoint,
                }
            ], (agent.capabilities.map(function (cap) { return ({
                name: cap,
                endpoint: "".concat(agent.endpoint, "/").concat(cap.replace('security-', '')),
            }); })), true),
            x402Support: agent.x402Support,
            erc8128Support: agent.erc8128Support,
            active: agent.active,
            registrations: [],
            supportedTrust: ["reputation"],
            external: true, // Mark as externally registered
            wallet: agent.wallet,
            capabilities: agent.capabilities,
            pricing: agent.pricing,
        };
        if (existingIdx >= 0) {
            registrations[existingIdx] = registration;
        }
        else {
            registrations.push(registration);
        }
        fs.writeFileSync(regFile, JSON.stringify(registrations, null, 2), 'utf8');
        console.log("[ExternalAgents] Updated registrations.json with ".concat(agent.name));
    }
    catch (err) {
        console.error('[ExternalAgents] Failed to update registrations.json:', err);
    }
}
/**
 * Get all external agents
 */
function getExternalAgents() {
    return Array.from(externalAgents.values());
}
/**
 * Get a specific external agent
 */
function getExternalAgent(id) {
    return externalAgents.get(id);
}
/**
 * Remove an external agent
 */
function removeAgent(id) {
    var existed = externalAgents.delete(id);
    if (existed)
        saveAgents();
    return existed;
}
/**
 * Health check an external agent
 */
function healthCheckAgent(id) {
    return __awaiter(this, void 0, void 0, function () {
        var agent, controller_1, timeout, res, healthy, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    agent = externalAgents.get(id);
                    if (!agent)
                        return [2 /*return*/, false];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    controller_1 = new AbortController();
                    timeout = setTimeout(function () { return controller_1.abort(); }, 5000);
                    return [4 /*yield*/, fetch("".concat(agent.endpoint, "/health"), {
                            signal: controller_1.signal,
                        })];
                case 2:
                    res = _a.sent();
                    clearTimeout(timeout);
                    healthy = res.ok;
                    agent.healthy = healthy;
                    agent.lastHealthCheck = new Date().toISOString();
                    saveAgents();
                    return [2 /*return*/, healthy];
                case 3:
                    err_1 = _a.sent();
                    agent.healthy = false;
                    agent.lastHealthCheck = new Date().toISOString();
                    saveAgents();
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Call an external agent with a prompt/task
 * Proxies the request to the agent's endpoint and returns the result
 */
function callExternalAgent(id, prompt, taskType) {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, agent, effectiveType, url, controller_2, timeout, requestBody, headers, signedRequest, newHeaders_1, err_2, res, paymentInfo, errorText, result, agentData, confidence, err_3;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    startTime = Date.now();
                    agent = externalAgents.get(id);
                    if (!agent) {
                        return [2 /*return*/, {
                                success: false,
                                data: { error: "External agent '".concat(id, "' not found") },
                                timestamp: new Date(),
                                executionTimeMs: Date.now() - startTime,
                            }];
                    }
                    if (!agent.active || !agent.healthy) {
                        return [2 /*return*/, {
                                success: false,
                                data: { error: "External agent '".concat(id, "' is ").concat(!agent.active ? 'inactive' : 'unhealthy') },
                                timestamp: new Date(),
                                executionTimeMs: Date.now() - startTime,
                            }];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 12, , 13]);
                    effectiveType = taskType || agent.capabilities[0] || 'execute';
                    url = void 0;
                    // Map task types to Sentinel-style endpoints
                    if (effectiveType === 'security-audit' || effectiveType === 'audit') {
                        url = "".concat(agent.endpoint, "/audit");
                    }
                    else {
                        url = "".concat(agent.endpoint, "/execute");
                    }
                    console.log("[ExternalAgents] Calling ".concat(agent.name, " at ").concat(url));
                    controller_2 = new AbortController();
                    timeout = setTimeout(function () { return controller_2.abort(); }, 30000);
                    requestBody = {
                        prompt: prompt,
                        taskType: effectiveType,
                        // For Sentinel-specific audit endpoint
                        contractAddress: extractContractAddress(prompt),
                        chain: 'base-sepolia',
                    };
                    console.log("[ExternalAgents] Calling ".concat(agent.name, " at ").concat(url, " with body:"), JSON.stringify(requestBody));
                    headers = {
                        'Content-Type': 'application/json',
                        'X-402-Payment': 'demo-payment-signature', // For x402 gating
                    };
                    if (!(agent.erc8128Support && signerClient)) return [3 /*break*/, 5];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, signerClient.signRequest(url, {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify(requestBody),
                        })];
                case 3:
                    signedRequest = _b.sent();
                    newHeaders_1 = {};
                    signedRequest.headers.forEach(function (v, k) {
                        newHeaders_1[k] = v;
                    });
                    headers = newHeaders_1;
                    console.log("[ExternalAgents] ERC-8128 signed request to ".concat(agent.name, " (from ").concat(signerAddress, ")"));
                    return [3 /*break*/, 5];
                case 4:
                    err_2 = _b.sent();
                    console.error("[ExternalAgents] ERC-8128 signing failed, using unsigned:", err_2);
                    return [3 /*break*/, 5];
                case 5: return [4 /*yield*/, fetch(url, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(requestBody),
                        signal: controller_2.signal,
                    })];
                case 6:
                    res = _b.sent();
                    clearTimeout(timeout);
                    if (!(res.status === 402)) return [3 /*break*/, 8];
                    return [4 /*yield*/, res.json()];
                case 7:
                    paymentInfo = _b.sent();
                    console.log("[ExternalAgents] ".concat(agent.name, " requested payment:"), paymentInfo);
                    return [2 /*return*/, {
                            success: false,
                            data: __assign(__assign({ paymentRequired: true }, paymentInfo), { agentName: agent.name, agentEndpoint: agent.endpoint }),
                            timestamp: new Date(),
                            executionTimeMs: Date.now() - startTime,
                            cost: {
                                amount: String(paymentInfo.price || agent.pricing[effectiveType] || 0),
                                currency: paymentInfo.currency || 'USDC',
                                network: 'base',
                                recipient: agent.wallet,
                            },
                        }];
                case 8:
                    if (!!res.ok) return [3 /*break*/, 10];
                    return [4 /*yield*/, res.text()];
                case 9:
                    errorText = _b.sent();
                    console.error("[ExternalAgents] ".concat(agent.name, " HTTP error ").concat(res.status, ":"), errorText);
                    throw new Error("Agent returned ".concat(res.status, ": ").concat(errorText));
                case 10: return [4 /*yield*/, res.json()];
                case 11:
                    result = _b.sent();
                    console.log("[ExternalAgents] ".concat(agent.name, " response received:"), JSON.stringify(result).slice(0, 500) + '...');
                    // Check for null data which indicates a failed or empty analysis
                    if (result === null || (result.data === null && !result.error)) {
                        console.warn("[ExternalAgents] ".concat(agent.name, " returned null data. This usually means contract address was missing."));
                        return [2 /*return*/, {
                                success: false,
                                data: {
                                    error: "External agent ".concat(agent.name, " returned no data. Please ensure your prompt includes a valid contract address (0x...) for auditing."),
                                    agentName: agent.name
                                },
                                timestamp: new Date(),
                                executionTimeMs: Date.now() - startTime,
                            }];
                    }
                    // Update health status
                    agent.healthy = true;
                    agent.lastHealthCheck = new Date().toISOString();
                    saveAgents();
                    agentData = result.data || result;
                    confidence = ((_a = agentData.analysis) === null || _a === void 0 ? void 0 : _a.score) ? agentData.analysis.score / 100 : 0.8;
                    return [2 /*return*/, {
                            success: true,
                            data: __assign(__assign({}, result), { externalAgent: agent.name, agentId: agent.id }),
                            confidence: confidence,
                            timestamp: new Date(),
                            executionTimeMs: Date.now() - startTime,
                            cost: {
                                amount: String(agent.pricing[effectiveType] || agent.pricing['generic'] || 0),
                                currency: 'USDC',
                                network: 'base',
                                recipient: agent.wallet,
                            },
                        }];
                case 12:
                    err_3 = _b.sent();
                    console.error("[ExternalAgents] Call to ".concat(agent.name, " failed:"), err_3.message);
                    // Mark as unhealthy if connection failed
                    if (err_3.name === 'AbortError' || err_3.code === 'ECONNREFUSED') {
                        agent.healthy = false;
                        saveAgents();
                    }
                    return [2 /*return*/, {
                            success: false,
                            data: { error: err_3.message, agentName: agent.name },
                            timestamp: new Date(),
                            executionTimeMs: Date.now() - startTime,
                        }];
                case 13: return [2 /*return*/];
            }
        });
    });
}
/**
 * Extract a contract address from a prompt string
 */
function extractContractAddress(prompt) {
    var match = prompt.match(/0x[a-fA-F0-9]{40}/);
    return match ? match[0] : undefined;
}
/**
 * Check if a specialist ID refers to an external agent
 */
function isExternalAgent(specialistId) {
    return externalAgents.has(specialistId);
}
exports.default = {
    registerAgent: registerAgent,
    getExternalAgents: getExternalAgents,
    getExternalAgent: getExternalAgent,
    removeAgent: removeAgent,
    healthCheckAgent: healthCheckAgent,
    callExternalAgent: callExternalAgent,
    isExternalAgent: isExternalAgent,
};
