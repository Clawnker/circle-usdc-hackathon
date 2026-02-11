"use strict";
/**
 * Hivemind Dispatcher Core
 * Routes prompts to specialists and orchestrates multi-agent workflows
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
exports.subscribeToTask = subscribeToTask;
exports.dispatch = dispatch;
exports.executeTask = executeTask;
exports.updateTaskStatus = updateTaskStatus;
exports.routePrompt = routePrompt;
exports.callSpecialistGated = callSpecialistGated;
exports.callSpecialist = callSpecialist;
exports.getTask = getTask;
exports.getTasksByUser = getTasksByUser;
exports.getRecentTasks = getRecentTasks;
exports.getSpecialistPricing = getSpecialistPricing;
exports.getSpecialists = getSpecialists;
var uuid_1 = require("uuid");
var fs = require("fs");
var path = require("path");
var dns = require("dns");
var util_1 = require("util");
var lookup = (0, util_1.promisify)(dns.lookup);
var config_1 = require("./config");
var x402_1 = require("./x402");
var x402_protocol_1 = require("./x402-protocol");
var onchain_payments_1 = require("./onchain-payments");
var reputation_1 = require("./reputation");
var llm_planner_1 = require("./llm-planner");
var dag_executor_1 = require("./dag-executor");
var capability_matcher_1 = require("./capability-matcher");
var circuit_breaker_1 = require("./circuit-breaker");
var fallback_chain_1 = require("./fallback-chain");
var external_agents_1 = require("./external-agents");
var price_router_1 = require("./price-router");
var magos_1 = require("./specialists/magos");
var aura_1 = require("./specialists/aura");
var bankr_1 = require("./specialists/bankr");
var scribe_1 = require("./specialists/scribe");
var seeker_1 = require("./specialists/seeker");
// Persistence settings
var DATA_DIR = path.join(__dirname, '../data');
var TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
// In-memory task store
var tasks = new Map();
/**
 * Load tasks from disk
 */
function loadTasks() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (fs.existsSync(TASKS_FILE)) {
            var data = fs.readFileSync(TASKS_FILE, 'utf8');
            var parsed = JSON.parse(data);
            // Convert dates back to Date objects
            Object.values(parsed).forEach(function (task) {
                var _a, _b;
                task.createdAt = new Date(task.createdAt);
                task.updatedAt = new Date(task.updatedAt);
                if ((_a = task.result) === null || _a === void 0 ? void 0 : _a.timestamp) {
                    task.result.timestamp = new Date(task.result.timestamp);
                }
                (_b = task.payments) === null || _b === void 0 ? void 0 : _b.forEach(function (p) {
                    p.timestamp = new Date(p.timestamp);
                });
                tasks.set(task.id, task);
            });
            console.log("[Dispatcher] Loaded ".concat(tasks.size, " tasks from persistence"));
        }
    }
    catch (error) {
        console.error("[Dispatcher] Failed to load tasks:", error.message);
    }
}
/**
 * Save tasks to disk
 */
function saveTasks() {
    try {
        var data = JSON.stringify(Object.fromEntries(tasks), null, 2);
        fs.writeFileSync(TASKS_FILE, data, 'utf8');
    }
    catch (error) {
        console.error("[Dispatcher] Failed to save tasks:", error.message);
    }
}
// Initial load
loadTasks();
// Specialist descriptions
var SPECIALIST_DESCRIPTIONS = {
    magos: 'Market analysis & predictions',
    aura: 'Social sentiment analysis',
    bankr: 'Wallet operations',
    scribe: 'General assistant & fallback',
    seeker: 'Web research & search',
    general: 'General queries',
    sentinel: 'Smart contract security audits',
    'multi-hop': 'Orchestrated multi-agent workflow',
};
// Specialist pricing information
var SPECIALIST_PRICING = {
    magos: { fee: '0.001', description: 'Market analysis & predictions' },
    aura: { fee: '0.0005', description: 'Social sentiment analysis' },
    bankr: { fee: '0.0001', description: 'Wallet operations' },
    scribe: { fee: '0.0001', description: 'General assistant & fallback' },
    seeker: { fee: '0.0001', description: 'Web research & search' },
    general: { fee: '0', description: 'General queries' },
    sentinel: { fee: '2.50', description: 'Smart contract security audits (external)' },
    'multi-hop': { fee: '0', description: 'Orchestrated multi-agent workflow' },
};
/**
 * Complexity heuristic: detects if a query covers multiple domains
 * Flags queries that mention 2+ distinct domains as multi-hop
 */
function isComplexQuery(prompt) {
    var lower = prompt.toLowerCase();
    var domains = [
        { name: 'social', patterns: [/sentiment/, /vibe/, /mood/, /social/, /trending/, /popular/, /alpha/, /gem/, /influencer/, /kol/, /whale/, /twitter/, /fomo/, /fud/, /hype/, /buzz/] },
        { name: 'price', patterns: [/price/, /value/, /worth/, /cost/, /predict/, /forecast/, /chart/, /trend/, /market/, /valuation/, /support/, /resistance/, /technical/] },
        { name: 'security', patterns: [/audit/, /security/, /vulnerabilit/, /exploit/, /hack/, /safe/, /secure/, /risk/, /danger/, /smart\s*contract/] },
        { name: 'wallet', patterns: [/\bswap\b/, /\btrade\b/, /\bbuy\b/, /\bsell\b/, /\bexchange\b/, /\btransfer\b/, /\bsend\b/, /\bwithdraw\b/, /\bdeposit\b/, /\bbalance\b/, /\bportfolio\b/, /\bdca\b/] },
        { name: 'research', patterns: [/search/, /research/, /find/, /news/, /latest/, /happened/, /google/, /brave/, /internet/, /web/] }
    ];
    var detectedDomains = 0;
    for (var _i = 0, domains_1 = domains; _i < domains_1.length; _i++) {
        var domain = domains_1[_i];
        if (domain.patterns.some(function (p) { return p.test(lower); })) {
            detectedDomains++;
        }
    }
    return detectedDomains >= 2;
}
/**
 * Detect multi-hop patterns
 */
function detectMultiHop(prompt) {
    var lower = prompt.toLowerCase();
    // Pattern: "buy" + "trending/popular/talked about/most hyped" = aura → bankr
    if (lower.includes('buy') && (lower.includes('trending') || lower.includes('popular') || lower.includes('hot') || lower.includes('sentiment') || lower.includes('talked about') || lower.includes('most hyped') || lower.includes('most popular'))) {
        return ['aura', 'bankr'];
    }
    // Pattern: "find" + "buy" = seeker/aura → bankr (research then execute)
    if ((lower.includes('find') || lower.includes('discover') || lower.includes('what')) && lower.includes('buy')) {
        return ['seeker', 'bankr'];
    }
    // Pattern: "analyze" + "buy" = magos → bankr  
    if ((lower.includes('analyze') || lower.includes('research')) && lower.includes('buy')) {
        return ['magos', 'bankr'];
    }
    // Pattern: "research" + "summary" = seeker → scribe
    if ((lower.includes('research') || lower.includes('search') || lower.includes('news')) && (lower.includes('summary') || lower.includes('summarize'))) {
        return ['seeker', 'scribe'];
    }
    // Complexity heuristic fallback - if 2+ domains are detected, route to seeker -> scribe for research and synthesis
    if (isComplexQuery(prompt)) {
        return ['seeker', 'scribe'];
    }
    return null; // Single-hop
}
/**
 * Helper to extract tokens from Aura's result
 */
function extractTokensFromResult(result) {
    // Parse Aura's trending response
    // Look for token symbols like SOL, BONK, WIF
    var tokens = result.match(/\b(SOL|BONK|WIF|PEPE|DOGE|SHIB|FOMO)\b/gi) || [];
    return __spreadArray([], new Set(tokens.map(function (t) { return t.toUpperCase(); })), true);
}
var subscribers = new Map();
/**
 * Subscribe to task updates
 */
function subscribeToTask(taskId, callback) {
    var existing = subscribers.get(taskId) || [];
    existing.push(callback);
    subscribers.set(taskId, existing);
    return function () {
        var callbacks = subscribers.get(taskId) || [];
        subscribers.set(taskId, callbacks.filter(function (cb) { return cb !== callback; }));
    };
}
/**
 * Emit task update to subscribers
 */
function emitTaskUpdate(task) {
    var callbacks = subscribers.get(task.id) || [];
    callbacks.forEach(function (cb) { return cb(task); });
}
/**
 * Add a message to the task
 */
function addMessage(task, from, to, content) {
    console.log("[Dispatcher] Adding message from ".concat(from, " to ").concat(to, ": ").concat(content));
    task.messages.push({
        id: "msg-".concat(Date.now(), "-").concat(Math.random().toString(36).slice(2, 6)),
        from: from,
        to: to,
        content: content,
        timestamp: new Date().toISOString(),
    });
    emitTaskUpdate(task);
}
/**
 * Main dispatch function
 */
function dispatch(request) {
    return __awaiter(this, void 0, void 0, function () {
        var taskId, isSentinelQuery, isComplex, _a, dagPlan, isMultiStep, bestSpecialist, _b, _c, legacyHops, taskFallbackChain, chain, err_1, budgetCheck, singleStepFee, finalEstimatedCost, finalHops, isActuallyMultiStep, isApproved, isInSwarm, requiresApproval, pricing, reputationScore, displayName, approvalSpecialist, specialist, task;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    taskId = (0, uuid_1.v4)();
                    isSentinelQuery = /\b(audit|security|vulnerabilit|exploit|scan|review)\b/i.test(request.prompt) &&
                        (/0x[a-fA-F0-9]{40}/.test(request.prompt) || /\b(contract|function|mapping|pragma|solidity|modifier|require)\b/i.test(request.prompt));
                    if (!isSentinelQuery) return [3 /*break*/, 1];
                    _a = false;
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, isComplexQuery(request.prompt)];
                case 2:
                    _a = _d.sent();
                    _d.label = 3;
                case 3:
                    isComplex = _a;
                    isMultiStep = false;
                    if (!isComplex) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, llm_planner_1.planDAG)(request.prompt)];
                case 4:
                    dagPlan = _d.sent();
                    isMultiStep = dagPlan.steps.length > 1;
                    return [3 /*break*/, 6];
                case 5:
                    // Single-step fast path: Create a dummy plan for consistency
                    dagPlan = {
                        planId: "simple-".concat(Date.now()),
                        query: request.prompt,
                        steps: [],
                        totalEstimatedCost: 0,
                        reasoning: isSentinelQuery ? 'Security audit query — fast-path to sentinel.' : 'Simple query detected, skipping LLM planning.'
                    };
                    _d.label = 6;
                case 6:
                    _b = request.preferredSpecialist;
                    if (_b) return [3 /*break*/, 10];
                    if (!isMultiStep) return [3 /*break*/, 7];
                    _c = 'multi-hop';
                    return [3 /*break*/, 9];
                case 7: return [4 /*yield*/, routePrompt(request.prompt, request.hiredAgents)];
                case 8:
                    _c = _d.sent();
                    _d.label = 9;
                case 9:
                    _b = (_c);
                    _d.label = 10;
                case 10:
                    bestSpecialist = _b;
                    legacyHops = (isMultiStep || isSentinelQuery) ? null : detectMultiHop(request.prompt);
                    if (legacyHops && !request.preferredSpecialist) {
                        bestSpecialist = 'multi-hop';
                    }
                    if (!(!isMultiStep && bestSpecialist !== 'multi-hop')) return [3 /*break*/, 14];
                    _d.label = 11;
                case 11:
                    _d.trys.push([11, 13, , 14]);
                    return [4 /*yield*/, fallback_chain_1.fallbackChain.buildFallbackChain(request.prompt, [])];
                case 12:
                    chain = _d.sent();
                    taskFallbackChain = chain.map(function (c) { return c.agentId; });
                    // Ensure bestSpecialist is at the front if not already
                    if (taskFallbackChain.length > 0 && taskFallbackChain[0] !== bestSpecialist && taskFallbackChain.includes(bestSpecialist)) {
                        taskFallbackChain = __spreadArray([bestSpecialist], taskFallbackChain.filter(function (id) { return id !== bestSpecialist; }), true);
                    }
                    else if (!taskFallbackChain.includes(bestSpecialist)) {
                        taskFallbackChain = __spreadArray([bestSpecialist], taskFallbackChain, true);
                    }
                    return [3 /*break*/, 14];
                case 13:
                    err_1 = _d.sent();
                    console.error('[Dispatcher] Error building fallback chain:', err_1);
                    taskFallbackChain = [bestSpecialist];
                    return [3 /*break*/, 14];
                case 14:
                    // Phase 2d: Budget Enforcement
                    if (request.maxBudget !== undefined) {
                        budgetCheck = price_router_1.priceRouter.checkBudget(dagPlan, request.maxBudget);
                        singleStepFee = !isMultiStep ? (Number(config_1.default.fees[bestSpecialist]) || 0) : 0;
                        finalEstimatedCost = Math.max(budgetCheck.totalCost, singleStepFee);
                        if (finalEstimatedCost > request.maxBudget) {
                            console.log("[Dispatcher] Rejecting request: Estimated cost (".concat(finalEstimatedCost, " USDC) exceeds budget (").concat(request.maxBudget, " USDC)"));
                            return [2 /*return*/, {
                                    taskId: '',
                                    status: 'failed',
                                    specialist: bestSpecialist,
                                    error: "Estimated cost (".concat(finalEstimatedCost.toFixed(2), " USDC) exceeds your budget limit of ").concat(request.maxBudget.toFixed(2), " USDC."),
                                }];
                        }
                    }
                    finalHops = isMultiStep ? dagPlan.steps.map(function (s) { return s.specialist; }) : legacyHops;
                    isActuallyMultiStep = isMultiStep || !!legacyHops;
                    isApproved = request.approvedAgent === bestSpecialist;
                    isInSwarm = !request.hiredAgents || request.hiredAgents.includes(bestSpecialist);
                    requiresApproval = !isInSwarm && !isApproved && bestSpecialist !== 'general' && bestSpecialist !== 'scribe' && bestSpecialist !== 'multi-hop';
                    console.log("[Dispatcher] Routing decision (DAG):", {
                        bestSpecialist: bestSpecialist,
                        isMultiStep: isMultiStep,
                        isActuallyMultiStep: isActuallyMultiStep,
                        stepCount: dagPlan.steps.length,
                        requiresApproval: requiresApproval,
                    });
                    // If preview only or requires approval, return info without executing
                    if (request.previewOnly || requiresApproval) {
                        pricing = SPECIALIST_PRICING[bestSpecialist] || { fee: '0', description: 'Unknown' };
                        reputationScore = (0, reputation_1.getReputationScore)(bestSpecialist);
                        displayName = isActuallyMultiStep && finalHops
                            ? finalHops.map(function (h) { return getSpecialistDisplayName(h); }).join(' → ')
                            : getSpecialistDisplayName(bestSpecialist);
                        approvalSpecialist = isActuallyMultiStep && finalHops ? finalHops[0] : bestSpecialist;
                        return [2 /*return*/, {
                                taskId: '', // No task created yet
                                status: 'pending',
                                specialist: approvalSpecialist,
                                requiresApproval: requiresApproval,
                                specialistInfo: {
                                    name: displayName,
                                    description: isActuallyMultiStep
                                        ? "Multi-agent workflow: ".concat(finalHops === null || finalHops === void 0 ? void 0 : finalHops.join(' → '))
                                        : pricing.description,
                                    fee: isMultiStep ? String(dagPlan.totalEstimatedCost) : pricing.fee,
                                    feeCurrency: 'USDC',
                                    successRate: Math.round(reputationScore * 100),
                                },
                            }];
                    }
                    specialist = bestSpecialist;
                    task = {
                        id: taskId,
                        prompt: request.prompt,
                        userId: request.userId,
                        status: 'pending',
                        specialist: specialist,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        payments: [],
                        messages: [],
                        metadata: {
                            dryRun: request.dryRun,
                            hops: finalHops || undefined,
                            hiredAgents: request.hiredAgents,
                            wasApproved: isApproved,
                            intent: bestSpecialist.intent || undefined
                        },
                        dagPlan: dagPlan, // Store the DAG plan for execution
                        fallbackChain: taskFallbackChain, // Added for Phase 2e
                        callbackUrl: request.callbackUrl,
                    };
                    tasks.set(taskId, task);
                    saveTasks();
                    console.log("[Dispatcher] Created task ".concat(taskId, " for specialist: ").concat(specialist, " (").concat(isMultiStep ? 'DAG' : 'Single', ")"));
                    // Small delay to allow WebSocket subscription before execution
                    setTimeout(function () {
                        executeTask(task, request.dryRun || false).catch(function (err) {
                            console.error("[Dispatcher] Task ".concat(taskId, " failed:"), err);
                            updateTaskStatus(task, 'failed', { error: err.message });
                        });
                    }, 100);
                    return [2 /*return*/, {
                            taskId: taskId,
                            status: task.status,
                            specialist: specialist,
                        }];
            }
        });
    });
}
/**
 * Get display name for a specialist
 */
function getSpecialistDisplayName(specialist) {
    var names = {
        magos: 'Market Oracle',
        aura: 'Social Analyst',
        bankr: 'DeFi Executor',
        scribe: 'General Assistant',
        seeker: 'Web Researcher',
        sentinel: 'Security Auditor',
        general: 'General',
        'multi-hop': 'Multi-Agent Workflow',
    };
    return names[specialist] || specialist;
}
/**
 * Execute a task
 */
function executeTask(task, dryRun) {
    return __awaiter(this, void 0, void 0, function () {
        var stepExecutor, dagResult, successfulSteps, failedSteps, lastSuccessful, topLevelSummary, status_1, error_1, hops, currentContext, multiResults, i, specialist, step, result_1, responseContent_1, specialistFee, specialistUrl, extAgent, cap, baseUrl, paymentResult, feeRecord, onChainResult, feeRecord, feeRecord, tokens, tokens, lastResult, requiresPayment, balances, fee_1, usdcBalance, errorMsg, fee, result, chain, responseContent, specialistUrl, externalAgent, capability, baseUrl, paymentResult, feeRecord, recipientWallet, onChainResult, feeRecord, feeRecord, record, capabilityId, isValid, axios, isValid_1, err_2;
        var _this = this;
        var _a, _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0: 
                // Demo delay for visual effect
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 1:
                    // Demo delay for visual effect
                    _h.sent();
                    if (!(task.dagPlan && task.dagPlan.steps.length > 1)) return [3 /*break*/, 5];
                    updateTaskStatus(task, 'processing');
                    addMessage(task, 'dispatcher', 'multi-hop', "Executing dynamic DAG plan: ".concat(task.dagPlan.planId));
                    stepExecutor = function (step, context) { return __awaiter(_this, void 0, void 0, function () {
                        var resolvedPrompt, result, responseContent, fee, specialistUrl, externalAgent, cap, baseUrl, paymentResult, feeRecord, onChainResult, feeRecord;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    resolvedPrompt = (0, dag_executor_1.resolveVariables)(step.promptTemplate, context);
                                    // 2. Routing message
                                    addMessage(task, 'dispatcher', step.specialist, "[Step ".concat(step.id, "] Routing to ").concat(step.specialist, "..."));
                                    return [4 /*yield*/, callSpecialistGated(step.specialist, resolvedPrompt)];
                                case 1:
                                    result = _a.sent();
                                    responseContent = extractResponseContent(result);
                                    addMessage(task, step.specialist, 'dispatcher', responseContent);
                                    fee = step.estimatedCost || config_1.default.fees[step.specialist] || 0;
                                    if (!(fee > 0 && !dryRun)) return [3 /*break*/, 5];
                                    specialistUrl = void 0;
                                    externalAgent = (0, external_agents_1.isExternalAgent)(step.specialist) ? (0, external_agents_1.getExternalAgent)(step.specialist) : null;
                                    if (externalAgent) {
                                        cap = externalAgent.capabilities[0] || 'execute';
                                        specialistUrl = (cap === 'security-audit' || cap === 'audit')
                                            ? "".concat(externalAgent.endpoint, "/audit")
                                            : "".concat(externalAgent.endpoint, "/execute");
                                    }
                                    else {
                                        baseUrl = process.env.BASE_URL || 'https://circle-usdc-hackathon.onrender.com';
                                        specialistUrl = "".concat(baseUrl, "/api/specialist/").concat(step.specialist);
                                    }
                                    return [4 /*yield*/, (0, x402_protocol_1.executeDemoPayment)(specialistUrl, { prompt: resolvedPrompt }, fee)];
                                case 2:
                                    paymentResult = _a.sent();
                                    if (!(paymentResult.success && paymentResult.txSignature)) return [3 /*break*/, 3];
                                    feeRecord = (0, x402_1.createPaymentRecord)(String(fee), 'USDC', 'base', step.specialist, paymentResult.txSignature, 'x402');
                                    task.payments.push(feeRecord);
                                    addMessage(task, 'x402', 'dispatcher', "\uD83D\uDCB0 x402 Payment: ".concat(fee, " USDC \u2192 ").concat(step.specialist));
                                    return [3 /*break*/, 5];
                                case 3: return [4 /*yield*/, (0, onchain_payments_1.sendOnChainPayment)(step.specialist, String(fee))];
                                case 4:
                                    onChainResult = _a.sent();
                                    if (onChainResult) {
                                        feeRecord = (0, x402_1.createPaymentRecord)(onChainResult.amount, 'USDC', 'base-sepolia', step.specialist, onChainResult.txHash, 'on-chain');
                                        task.payments.push(feeRecord);
                                        addMessage(task, 'x402', 'dispatcher', "\uD83D\uDCB0 On-chain Payment: ".concat(fee, " USDC \u2192 ").concat(step.specialist));
                                    }
                                    _a.label = 5;
                                case 5: return [2 /*return*/, {
                                        stepId: step.id,
                                        specialist: step.specialist,
                                        output: result.data,
                                        summary: responseContent,
                                        success: result.success
                                    }];
                            }
                        });
                    }); };
                    _h.label = 2;
                case 2:
                    _h.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, dag_executor_1.executeDAG)(task.dagPlan, stepExecutor)];
                case 3:
                    dagResult = _h.sent();
                    successfulSteps = Object.values(dagResult.results).filter(function (r) { return r.success; });
                    failedSteps = Object.values(dagResult.results).filter(function (r) { return !r.success; });
                    lastSuccessful = successfulSteps.length > 0
                        ? successfulSteps[successfulSteps.length - 1]
                        : null;
                    topLevelSummary = (lastSuccessful === null || lastSuccessful === void 0 ? void 0 : lastSuccessful.summary) ||
                        successfulSteps.map(function (s) { return s.summary; }).filter(Boolean).join('\n\n') ||
                        'No results available.';
                    task.result = {
                        success: successfulSteps.length > 0, // Partial success if at least one step worked
                        data: __assign({ isDAG: true, summary: topLevelSummary, planId: dagResult.planId, steps: Object.values(dagResult.results).map(function (r) { return ({
                                specialist: r.specialist,
                                summary: r.summary,
                                success: r.success
                            }); }), details: dagResult.results }, (failedSteps.length > 0 && {
                            partialFailure: "".concat(failedSteps.length, "/").concat(Object.keys(dagResult.results).length, " steps failed")
                        })),
                        timestamp: new Date(),
                        executionTimeMs: dagResult.executionTimeMs,
                        cost: {
                            amount: String(dagResult.totalCost || ((_a = task.dagPlan) === null || _a === void 0 ? void 0 : _a.totalEstimatedCost) || 0),
                            currency: 'USDC',
                            network: 'base',
                            recipient: 'multi-agent-workflow',
                        },
                    };
                    status_1 = dagResult.success ? 'completed' : (successfulSteps.length > 0 ? 'completed' : 'failed');
                    updateTaskStatus(task, status_1);
                    console.log("[Dispatcher] DAG task ".concat(task.id, " ").concat(status_1, " (").concat(successfulSteps.length, "/").concat(Object.keys(dagResult.results).length, " steps OK)"));
                    return [2 /*return*/];
                case 4:
                    error_1 = _h.sent();
                    console.error("[Dispatcher] DAG execution error:", error_1.message);
                    updateTaskStatus(task, 'failed', { error: error_1.message });
                    return [2 /*return*/];
                case 5:
                    hops = (_b = task.metadata) === null || _b === void 0 ? void 0 : _b.hops;
                    if (!(hops && hops.length > 1)) return [3 /*break*/, 15];
                    updateTaskStatus(task, 'processing');
                    addMessage(task, 'dispatcher', 'multi-hop', "Executing multi-hop workflow: ".concat(hops.join(' → ')));
                    currentContext = task.prompt;
                    multiResults = [];
                    i = 0;
                    _h.label = 6;
                case 6:
                    if (!(i < hops.length)) return [3 /*break*/, 14];
                    specialist = hops[i];
                    step = i + 1;
                    updateTaskStatus(task, 'processing', {
                        currentStep: step,
                        totalSteps: hops.length,
                        activeSpecialist: specialist
                    });
                    addMessage(task, 'dispatcher', specialist, "[Step ".concat(step, "/").concat(hops.length, "] Routing to ").concat(specialist, "..."));
                    return [4 /*yield*/, callSpecialistGated(specialist, currentContext)];
                case 7:
                    result_1 = _h.sent();
                    multiResults.push({ specialist: specialist, result: result_1 });
                    responseContent_1 = extractResponseContent(result_1);
                    addMessage(task, specialist, 'dispatcher', responseContent_1);
                    specialistFee = config_1.default.fees[specialist] || 0;
                    if (!(specialistFee > 0 && !dryRun)) return [3 /*break*/, 11];
                    specialistUrl = void 0;
                    extAgent = (0, external_agents_1.isExternalAgent)(specialist) ? (0, external_agents_1.getExternalAgent)(specialist) : null;
                    if (extAgent) {
                        cap = extAgent.capabilities[0] || 'execute';
                        specialistUrl = (cap === 'security-audit' || cap === 'audit')
                            ? "".concat(extAgent.endpoint, "/audit")
                            : "".concat(extAgent.endpoint, "/execute");
                    }
                    else {
                        baseUrl = process.env.BASE_URL || 'https://circle-usdc-hackathon.onrender.com';
                        specialistUrl = "".concat(baseUrl, "/api/specialist/").concat(specialist);
                    }
                    return [4 /*yield*/, (0, x402_protocol_1.executeDemoPayment)(specialistUrl, { prompt: currentContext }, specialistFee)];
                case 8:
                    paymentResult = _h.sent();
                    if (!(paymentResult.success && paymentResult.txSignature)) return [3 /*break*/, 9];
                    feeRecord = (0, x402_1.createPaymentRecord)(String(specialistFee), 'USDC', 'base', specialist, paymentResult.txSignature, 'x402');
                    task.payments.push(feeRecord);
                    addMessage(task, 'x402', 'dispatcher', "\uD83D\uDCB0 x402 Payment: ".concat(specialistFee, " USDC \u2192 ").concat(specialist));
                    // Use the response from x402/fetch if available
                    if (paymentResult.response) {
                        multiResults[multiResults.length - 1].result = paymentResult.response;
                    }
                    return [3 /*break*/, 11];
                case 9: return [4 /*yield*/, (0, onchain_payments_1.sendOnChainPayment)(specialist, String(specialistFee))];
                case 10:
                    onChainResult = _h.sent();
                    if (onChainResult) {
                        feeRecord = (0, x402_1.createPaymentRecord)(onChainResult.amount, 'USDC', 'base-sepolia', specialist, onChainResult.txHash, 'on-chain');
                        task.payments.push(feeRecord);
                        addMessage(task, 'x402', 'dispatcher', "\uD83D\uDCB0 On-chain Payment: ".concat(specialistFee, " USDC \u2192 ").concat(specialist, " (tx: ").concat(onChainResult.txHash.slice(0, 10), "...)"));
                    }
                    else {
                        feeRecord = (0, x402_1.createPaymentRecord)(String(specialistFee), 'USDC', 'base', specialist, undefined, 'x402');
                        task.payments.push(feeRecord);
                        (0, x402_1.logTransaction)(feeRecord);
                        addMessage(task, 'x402', 'dispatcher', "\uD83D\uDCB0 x402 Fee (Pending): ".concat(specialistFee, " USDC \u2192 ").concat(specialist));
                    }
                    _h.label = 11;
                case 11:
                    // Update context for next hop
                    if (specialist === 'aura' && result_1.success) {
                        tokens = extractTokensFromResult(responseContent_1);
                        if (tokens.length > 0) {
                            currentContext = "Buy 0.1 SOL of ".concat(tokens[0]);
                            addMessage(task, 'dispatcher', 'system', "Next step: ".concat(currentContext));
                        }
                    }
                    else if ((specialist === 'magos' || specialist === 'seeker') && result_1.success) {
                        tokens = extractTokensFromResult(responseContent_1);
                        if (tokens.length > 0) {
                            currentContext = "Buy 0.1 SOL of ".concat(tokens[0]);
                            addMessage(task, 'dispatcher', 'system', "Next step: ".concat(currentContext));
                        }
                    }
                    if (!(i < hops.length - 1)) return [3 /*break*/, 13];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1200); })];
                case 12:
                    _h.sent();
                    _h.label = 13;
                case 13:
                    i++;
                    return [3 /*break*/, 6];
                case 14:
                    lastResult = multiResults[multiResults.length - 1].result;
                    task.result = __assign(__assign({}, lastResult), { data: __assign(__assign({}, lastResult.data), { isMultiHop: true, hops: hops, steps: multiResults.map(function (r) { return ({
                                specialist: r.specialist,
                                summary: extractResponseContent(r.result)
                            }); }) }) });
                    updateTaskStatus(task, 'completed');
                    console.log("[Dispatcher] Multi-hop task ".concat(task.id, " completed"));
                    return [2 /*return*/];
                case 15:
                    updateTaskStatus(task, 'routing');
                    addMessage(task, 'dispatcher', task.specialist, "Routing task: \"".concat(task.prompt.slice(0, 80), "...\""));
                    return [4 /*yield*/, checkPaymentRequired(task.specialist)];
                case 16:
                    requiresPayment = _h.sent();
                    if (!(requiresPayment && !dryRun)) return [3 /*break*/, 18];
                    updateTaskStatus(task, 'awaiting_payment');
                    addMessage(task, 'dispatcher', task.specialist, 'Checking x402 payment...');
                    return [4 /*yield*/, (0, x402_1.getBalances)()];
                case 17:
                    balances = _h.sent();
                    console.log("[Dispatcher] Wallet balances:", balances);
                    fee_1 = config_1.default.fees[task.specialist] || 0;
                    usdcBalance = ((_c = balances.evm) === null || _c === void 0 ? void 0 : _c.usdc) || ((_d = balances.solana) === null || _d === void 0 ? void 0 : _d.usdc);
                    if (config_1.default.enforcePayments && usdcBalance < fee_1) {
                        errorMsg = "Insufficient balance: ".concat(usdcBalance, " USDC < ").concat(fee_1, " USDC required for ").concat(task.specialist);
                        addMessage(task, 'x402', 'dispatcher', "\u274C ".concat(errorMsg));
                        throw new Error(errorMsg);
                    }
                    _h.label = 18;
                case 18:
                    updateTaskStatus(task, 'processing');
                    fee = config_1.default.fees[task.specialist] || 0;
                    addMessage(task, 'dispatcher', task.specialist, "Processing with ".concat(task.specialist, "... (fee: ").concat(fee, " USDC)"));
                    // Demo delay before calling specialist
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 800); })];
                case 19:
                    // Demo delay before calling specialist
                    _h.sent();
                    if (!(task.fallbackChain && task.fallbackChain.length > 1)) return [3 /*break*/, 21];
                    chain = task.fallbackChain.map(function (id) { return ({ agentId: id, score: 1, confidence: 1, reasoning: 'Fallback' }); });
                    return [4 /*yield*/, fallback_chain_1.fallbackChain.executeWithFallback(chain, task.prompt, function (agentId, prompt) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                if (agentId !== task.specialist) {
                                    addMessage(task, 'dispatcher', agentId, "Switching to fallback agent: ".concat(agentId));
                                    updateTaskStatus(task, 'processing', { activeSpecialist: agentId });
                                }
                                return [2 /*return*/, callSpecialistGated(agentId, prompt)];
                            });
                        }); }, { maxRetries: task.fallbackChain.length - 1, timeoutMs: 30000 })];
                case 20:
                    result = _h.sent();
                    // Update the task's specialist to the one that actually succeeded (if any)
                    if (result.success && result.data.agentId) {
                        task.specialist = result.data.agentId;
                    }
                    return [3 /*break*/, 24];
                case 21:
                    if (!!circuit_breaker_1.circuitBreaker.canCall(task.specialist)) return [3 /*break*/, 22];
                    result = {
                        success: false,
                        data: { error: "Circuit breaker is OPEN for ".concat(task.specialist) },
                        timestamp: new Date(),
                        executionTimeMs: 0
                    };
                    return [3 /*break*/, 24];
                case 22:
                    circuit_breaker_1.circuitBreaker.recordCall(task.specialist);
                    return [4 /*yield*/, callSpecialistGated(task.specialist, task.prompt, task)];
                case 23:
                    result = _h.sent();
                    // Handle transaction approval flow
                    if ((_e = result.data) === null || _e === void 0 ? void 0 : _e.requiresApproval) {
                        console.log("[Dispatcher] Task ".concat(task.id, " requires transaction approval"));
                        updateTaskStatus(task, 'pending', {
                            requiresTransactionApproval: true,
                            transactionDetails: result.data.details
                        });
                        return [2 /*return*/];
                    }
                    if (result.success) {
                        circuit_breaker_1.circuitBreaker.recordSuccess(task.specialist);
                    }
                    else {
                        circuit_breaker_1.circuitBreaker.recordFailure(task.specialist);
                    }
                    _h.label = 24;
                case 24:
                    responseContent = extractResponseContent(result);
                    addMessage(task, task.specialist, 'dispatcher', responseContent);
                    if (!(fee > 0 && !dryRun)) return [3 /*break*/, 28];
                    addMessage(task, 'x402', 'dispatcher', "\u23F3 Processing ".concat(fee, " USDC payment via x402..."));
                    specialistUrl = void 0;
                    externalAgent = (0, external_agents_1.isExternalAgent)(task.specialist) ? (0, external_agents_1.getExternalAgent)(task.specialist) : null;
                    if (externalAgent) {
                        capability = externalAgent.capabilities[0] || 'execute';
                        if (capability === 'security-audit' || capability === 'audit') {
                            specialistUrl = "".concat(externalAgent.endpoint, "/audit");
                        }
                        else {
                            specialistUrl = "".concat(externalAgent.endpoint, "/execute");
                        }
                        console.log("[Dispatcher] x402 routing to external agent: ".concat(specialistUrl));
                    }
                    else {
                        baseUrl = process.env.BASE_URL || 'https://circle-usdc-hackathon.onrender.com';
                        specialistUrl = "".concat(baseUrl, "/api/specialist/").concat(task.specialist);
                    }
                    return [4 /*yield*/, (0, x402_protocol_1.executeDemoPayment)(specialistUrl, { prompt: task.prompt }, fee)];
                case 25:
                    paymentResult = _h.sent();
                    if (!(paymentResult.success && paymentResult.txSignature)) return [3 /*break*/, 26];
                    feeRecord = (0, x402_1.createPaymentRecord)(String(fee), 'USDC', 'base', task.specialist, paymentResult.txSignature, 'x402');
                    task.payments.push(feeRecord);
                    addMessage(task, 'x402', 'dispatcher', "\uD83D\uDCB0 x402 Payment: ".concat(fee, " USDC \u2192 ").concat(task.specialist));
                    return [3 /*break*/, 28];
                case 26:
                    // Fallback: real on-chain USDC transfer
                    console.warn("[Dispatcher] x402 payment failed, falling back to on-chain transfer...");
                    recipientWallet = (externalAgent === null || externalAgent === void 0 ? void 0 : externalAgent.wallet) || undefined;
                    return [4 /*yield*/, (0, onchain_payments_1.sendOnChainPayment)(task.specialist, String(fee), recipientWallet)];
                case 27:
                    onChainResult = _h.sent();
                    if (onChainResult) {
                        feeRecord = (0, x402_1.createPaymentRecord)(onChainResult.amount, 'USDC', 'base-sepolia', task.specialist, onChainResult.txHash, 'on-chain');
                        task.payments.push(feeRecord);
                        addMessage(task, 'x402', 'dispatcher', "\uD83D\uDCB0 On-chain Payment: ".concat(fee, " USDC \u2192 ").concat(task.specialist, " (tx: ").concat(onChainResult.txHash.slice(0, 10), "...)"));
                    }
                    else {
                        feeRecord = (0, x402_1.createPaymentRecord)(String(fee), 'USDC', 'base', task.specialist, undefined, 'x402');
                        task.payments.push(feeRecord);
                        (0, x402_1.logTransaction)(feeRecord);
                        addMessage(task, 'x402', 'dispatcher', "\uD83D\uDCB0 x402 Fee (Pending): ".concat(fee, " USDC \u2192 ").concat(task.specialist));
                    }
                    _h.label = 28;
                case 28:
                    // Log any additional payments from the specialist result
                    // Skip if dispatcher already paid the fee (avoids double-counting for external agents)
                    if (result.cost && fee === 0) {
                        record = (0, x402_1.createPaymentRecord)(result.cost.amount, result.cost.currency, result.cost.network, result.cost.recipient);
                        task.payments.push(record);
                        (0, x402_1.logTransaction)(record);
                        addMessage(task, 'x402', 'dispatcher', "Payment: ".concat(result.cost.amount, " ").concat(result.cost.currency));
                    }
                    // Update task with result
                    task.result = result;
                    updateTaskStatus(task, result.success ? 'completed' : 'failed');
                    capabilityId = ((_g = (_f = task.metadata) === null || _f === void 0 ? void 0 : _f.intent) === null || _g === void 0 ? void 0 : _g.category) || 'generic';
                    (0, reputation_1.recordLatency)(task.specialist, capabilityId, result.executionTimeMs);
                    if (result.success) {
                        (0, reputation_1.recordSuccess)(task.specialist, capabilityId);
                    }
                    else {
                        (0, reputation_1.recordFailure)(task.specialist, capabilityId);
                    }
                    if (!task.callbackUrl) return [3 /*break*/, 35];
                    return [4 /*yield*/, validateCallbackUrl(task.callbackUrl)];
                case 29:
                    isValid = _h.sent();
                    if (!!isValid) return [3 /*break*/, 30];
                    console.error("[Dispatcher] Blocked potentially malicious callbackUrl: ".concat(task.callbackUrl));
                    addMessage(task, 'system', 'dispatcher', "Security: Blocked invalid callbackUrl (SSRF protection)");
                    return [3 /*break*/, 35];
                case 30:
                    _h.trys.push([30, 34, , 35]);
                    axios = require('axios');
                    return [4 /*yield*/, validateCallbackUrl(task.callbackUrl)];
                case 31:
                    isValid_1 = _h.sent();
                    if (!isValid_1) return [3 /*break*/, 33];
                    return [4 /*yield*/, axios.post(task.callbackUrl, {
                            taskId: task.id,
                            status: task.status,
                            specialist: task.specialist,
                            result: formatResultForCallback(result),
                            messages: task.messages,
                        }, { timeout: 5000 })];
                case 32:
                    _h.sent();
                    console.log("[Dispatcher] Callback sent to ".concat(task.callbackUrl));
                    _h.label = 33;
                case 33: return [3 /*break*/, 35];
                case 34:
                    err_2 = _h.sent();
                    console.error("[Dispatcher] Callback failed:", err_2.message);
                    return [3 /*break*/, 35];
                case 35:
                    console.log("[Dispatcher] Task ".concat(task.id, " ").concat(task.status, " in ").concat(result.executionTimeMs, "ms"));
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Validates a callback URL to prevent SSRF attacks.
 * Blocks localhost, private IP ranges, and cloud metadata services.
 * Resolves hostnames to IPs to prevent DNS rebinding.
 */
function validateCallbackUrl(urlStr) {
    return __awaiter(this, void 0, void 0, function () {
        var url, hostname, ip, result, e_1, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    url = new URL(urlStr);
                    // Only allow http:// and https:// schemes
                    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                        return [2 /*return*/, false];
                    }
                    hostname = url.hostname.toLowerCase();
                    ip = hostname;
                    if (!(!/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && !hostname.includes(':'))) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, lookup(hostname)];
                case 2:
                    result = _a.sent();
                    ip = result.address;
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    return [2 /*return*/, false]; // Could not resolve
                case 4:
                    // Block localhost, 127.0.0.1, ::1, 0.0.0.0
                    if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') {
                        return [2 /*return*/, false];
                    }
                    // Block private IP ranges
                    // 10.x.x.x
                    if (/^10\./.test(ip))
                        return [2 /*return*/, false];
                    // 172.16.x.x to 172.31.x.x
                    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip))
                        return [2 /*return*/, false];
                    // 192.168.x.x
                    if (/^192\.168\./.test(ip))
                        return [2 /*return*/, false];
                    // 169.254.x.x (Cloud metadata)
                    if (/^169\.254\./.test(ip))
                        return [2 /*return*/, false];
                    return [2 /*return*/, true];
                case 5:
                    e_2 = _a.sent();
                    return [2 /*return*/, false];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Extract human-readable content from specialist result
 */
function extractResponseContent(result) {
    var _a, _b;
    var data = result.data;
    if (data === null || data === void 0 ? void 0 : data.combined)
        return data.combined;
    if (data === null || data === void 0 ? void 0 : data.summary)
        return data.summary;
    if (data === null || data === void 0 ? void 0 : data.insight)
        return data.insight;
    if (data === null || data === void 0 ? void 0 : data.reasoning)
        return data.reasoning;
    // External agent results (e.g., Sentinel audit)
    if (data === null || data === void 0 ? void 0 : data.externalAgent) {
        // External agent responses are nested: data.data contains the agent's actual response
        var agentData = (data === null || data === void 0 ? void 0 : data.data) || data;
        var analysis = agentData === null || agentData === void 0 ? void 0 : agentData.analysis;
        if (analysis) {
            var content_1 = "**".concat(data.externalAgent, " Security Audit**\n\n");
            if (analysis.summary)
                content_1 += "".concat(analysis.summary, "\n\n");
            if (analysis.score !== undefined)
                content_1 += "**Score:** ".concat(analysis.score, "/100\n\n");
            if (analysis.findings && analysis.findings.length > 0) {
                content_1 += "**Findings:**\n";
                analysis.findings.forEach(function (f) {
                    content_1 += "\u2022 **[".concat(f.severity || 'Unknown', "]** ").concat(f.title || f.description || JSON.stringify(f), "\n");
                    if (f.recommendation)
                        content_1 += "  \u2192 ".concat(f.recommendation, "\n");
                });
                content_1 += '\n';
            }
            if (analysis.gasOptimizations && analysis.gasOptimizations.length > 0) {
                content_1 += "**Gas Optimizations:**\n";
                analysis.gasOptimizations.forEach(function (g) { return content_1 += "\u2022 ".concat(g, "\n"); });
                content_1 += '\n';
            }
            if (analysis.bestPractices) {
                var bp = analysis.bestPractices;
                content_1 += "**Best Practices:**\n";
                Object.entries(bp).forEach(function (_a) {
                    var key = _a[0], val = _a[1];
                    content_1 += "\u2022 ".concat(key, ": ").concat(val, "\n");
                });
            }
            return content_1.trim();
        }
        // Generic external agent fallback
        if (typeof agentData === 'string')
            return agentData;
        if (agentData === null || agentData === void 0 ? void 0 : agentData.output)
            return agentData.output;
        if (agentData === null || agentData === void 0 ? void 0 : agentData.response)
            return typeof agentData.response === 'string' ? agentData.response : JSON.stringify(agentData.response, null, 2);
        return JSON.stringify(agentData, null, 2);
    }
    if ((_a = data === null || data === void 0 ? void 0 : data.details) === null || _a === void 0 ? void 0 : _a.summary)
        return data.details.summary;
    if ((_b = data === null || data === void 0 ? void 0 : data.details) === null || _b === void 0 ? void 0 : _b.response) {
        return typeof data.details.response === 'string'
            ? data.details.response
            : JSON.stringify(data.details.response).slice(0, 200);
    }
    // Specialist specific fallbacks
    if ((data === null || data === void 0 ? void 0 : data.trending) && Array.isArray(data.trending)) {
        return "\uD83D\uDD25 **Trending Topics**:\n".concat(data.trending.slice(0, 3).map(function (t) { return "\u2022 ".concat(t.topic || t.name); }).join('\n'));
    }
    if (data === null || data === void 0 ? void 0 : data.type) {
        return "".concat(data.type, " ").concat(data.status || 'completed').concat(data.txSignature ? " (tx: ".concat(data.txSignature.slice(0, 16), "...)") : '');
    }
    return result.success
        ? "I'm not sure how to help with that. Try asking about wallet balances, market analysis, or social sentiment."
        : 'Task failed';
}
/**
 * Format result for callback webhook (human-readable)
 */
function formatResultForCallback(result) {
    var _a, _b, _c, _d, _e, _f, _g;
    var data = result.data;
    var summary = '';
    if ((data === null || data === void 0 ? void 0 : data.type) === 'balance' && ((_a = data === null || data === void 0 ? void 0 : data.details) === null || _a === void 0 ? void 0 : _a.summary)) {
        summary = "\uD83D\uDCB0 **Balance**\n".concat(data.details.summary);
    }
    else if ((data === null || data === void 0 ? void 0 : data.type) === 'transfer' && (data === null || data === void 0 ? void 0 : data.status) === 'confirmed') {
        summary = "\u2705 **Transfer Confirmed**\nSent ".concat((_b = data.details) === null || _b === void 0 ? void 0 : _b.amount, " to ").concat((_d = (_c = data.details) === null || _c === void 0 ? void 0 : _c.to) === null || _d === void 0 ? void 0 : _d.slice(0, 8), "...");
    }
    else if ((data === null || data === void 0 ? void 0 : data.type) === 'swap') {
        summary = "\uD83D\uDD04 **Swap ".concat(data.status, "**\n").concat((_e = data.details) === null || _e === void 0 ? void 0 : _e.amount, " ").concat((_f = data.details) === null || _f === void 0 ? void 0 : _f.from, " \u2192 ").concat((_g = data.details) === null || _g === void 0 ? void 0 : _g.to);
    }
    else if (data === null || data === void 0 ? void 0 : data.insight) {
        summary = "\uD83D\uDCCA **Analysis**\n".concat(data.insight);
    }
    else if ((data === null || data === void 0 ? void 0 : data.tokens) && Array.isArray(data.tokens)) {
        summary = "\uD83D\uDD25 **Trending Tokens**\n".concat(data.tokens.slice(0, 3).map(function (t) { return "\u2022 ".concat(t.symbol || t.name); }).join('\n'));
    }
    else {
        summary = extractResponseContent(result);
    }
    return { summary: summary, data: data };
}
/**
 * Update task status and emit event
 */
function updateTaskStatus(task, status, extra) {
    task.status = status;
    task.updatedAt = new Date();
    if (extra) {
        task.metadata = __assign(__assign({}, task.metadata), extra);
    }
    tasks.set(task.id, task);
    saveTasks();
    emitTaskUpdate(task);
}
/**
 * Route prompt to appropriate specialist
 * Supports Capability-based (modern), LLM-based (smart) and RegExp-based (fast) routing
 * Only routes to specialists in the hiredAgents list if provided
 */
function routePrompt(prompt, hiredAgents) {
    return __awaiter(this, void 0, void 0, function () {
        var lower, planningMode, intent, matches, best, specialist, error_2, plan, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    lower = prompt.toLowerCase();
                    planningMode = process.env.PLANNING_MODE || 'capability';
                    // 1. Fast-path: contract audit/security queries → sentinel (FIRST - before complexity detection)
                    // "audit contract" triggers false positives in complexity detection (security + wallet domains)
                    if (/\b(audit|security|vulnerabilit|exploit|scan|review)\b/i.test(prompt) &&
                        (/0x[a-fA-F0-9]{40}/.test(prompt) || /\b(contract|function|mapping|pragma|solidity|modifier|require)\b/i.test(prompt))) {
                        console.log("[Router] Fast-path: contract audit query detected, routing to sentinel");
                        if (!hiredAgents || hiredAgents.includes('sentinel'))
                            return [2 /*return*/, 'sentinel'];
                    }
                    // 1c. Fast-path: price/market queries → magos (before capability matcher misroutes to scribe)
                    if (/\b(price|value|worth|cost|how much)\b/i.test(prompt) &&
                        /\b(bitcoin|btc|ethereum|eth|solana|sol|bonk|wif|pepe|doge|avax|matic|bnb|jup|crypto|token|coin)\b/i.test(prompt)) {
                        console.log("[Router] Fast-path: price query detected, routing to magos");
                        if (!hiredAgents || hiredAgents.includes('magos'))
                            return [2 /*return*/, 'magos'];
                    }
                    // 1d. Fast-path: sentiment/social queries → aura
                    if (/\b(sentiment|vibe|mood|social\s+analysis|what.+saying|what.+think|buzz|hype|fud|fomo)\b/i.test(prompt)) {
                        console.log("[Router] Fast-path: sentiment/social query detected, routing to aura");
                        if (!hiredAgents || hiredAgents.includes('aura'))
                            return [2 /*return*/, 'aura'];
                    }
                    // 1b. Multi-hop / Complex Query Detection
                    // If query is complex or matches known multi-hop patterns, flag for orchestration
                    if (isComplexQuery(prompt) || detectMultiHop(prompt)) {
                        console.log("[Router] Complex query or multi-hop pattern detected, routing to multi-hop");
                        return [2 /*return*/, 'multi-hop'];
                    }
                    if (!(planningMode === 'capability')) return [3 /*break*/, 5];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, capability_matcher_1.capabilityMatcher.extractIntent(prompt)];
                case 2:
                    intent = _a.sent();
                    return [4 /*yield*/, capability_matcher_1.capabilityMatcher.matchAgents(intent)];
                case 3:
                    matches = _a.sent();
                    if (matches.length > 0) {
                        best = matches[0];
                        console.log("[Capability Matcher] Top match: ".concat(best.agentId, " (score: ").concat(best.score.toFixed(2), ")"));
                        // Use capability matcher if score is high enough (>= 0.6)
                        if (best.score >= 0.6) {
                            specialist = best.agentId;
                            // If specialist is not in hiredAgents, use fallback routing
                            if (hiredAgents && !hiredAgents.includes(specialist)) {
                                console.log("[Capability Matcher] Specialist ".concat(specialist, " not in swarm, falling back to regexp routing"));
                                return [2 /*return*/, routeWithRegExp(prompt, hiredAgents)];
                            }
                            return [2 /*return*/, specialist];
                        }
                    }
                    console.log("[Capability Matcher] No high-confidence match (top score < 0.6), falling back to next router");
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    console.error("[Capability Matcher] Error:", error_2.message, '- falling back to next router');
                    return [3 /*break*/, 5];
                case 5:
                    // 3. Fast-path: explicit trade/execution intents
                    // These are unambiguous action commands that should never route to analysis
                    if (/\b(buy|sell|swap|send|transfer|withdraw|deposit)\b/.test(lower) &&
                        !/\b(should i|good|recommend|analysis|analyze|compare|predict)\b/.test(lower)) {
                        console.log("[Router] Fast-path: explicit trade intent detected, routing to bankr");
                        if (!hiredAgents || hiredAgents.includes('bankr'))
                            return [2 /*return*/, 'bankr'];
                    }
                    if (!(planningMode === 'llm')) return [3 /*break*/, 9];
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, (0, llm_planner_1.planWithLLM)(prompt)];
                case 7:
                    plan = _a.sent();
                    console.log("[LLM Planner] ".concat(plan.specialist, " (confidence: ").concat(plan.confidence.toFixed(2), ") - ").concat(plan.reasoning));
                    // If specialist is not in hiredAgents, use fallback routing
                    if (hiredAgents && !hiredAgents.includes(plan.specialist)) {
                        console.log("[LLM Planner] Specialist ".concat(plan.specialist, " not in swarm, falling back to regexp routing"));
                        return [2 /*return*/, routeWithRegExp(prompt, hiredAgents)];
                    }
                    return [2 /*return*/, plan.specialist];
                case 8:
                    error_3 = _a.sent();
                    console.error("[LLM Planner] Error:", error_3.message, '- falling back to regexp');
                    return [2 /*return*/, routeWithRegExp(prompt, hiredAgents)];
                case 9: 
                // 5. Default: RegExp routing (LAST FALLBACK)
                return [2 /*return*/, routeWithRegExp(prompt, hiredAgents)];
            }
        });
    });
}
/**
 * Route prompt using RegExp pattern matching (fast, deterministic)
 * Only routes to specialists in the hiredAgents list if provided
 */
function routeWithRegExp(prompt, hiredAgents) {
    var lower = prompt.toLowerCase();
    // Specific intent detection for common mis-routings
    if (lower.includes('good buy') || lower.includes('should i') || lower.includes('recommend') || /is \w+ a good/.test(lower)) {
        if (!hiredAgents || hiredAgents.includes('magos'))
            return 'magos';
    }
    if (lower.includes('talking about') || lower.includes('mentions') || lower.includes('discussing')) {
        if (!hiredAgents || hiredAgents.includes('aura'))
            return 'aura';
    }
    // Price queries should go to magos (market analysis), not seeker
    // BUG FIX: Group regex patterns correctly to prevent greedy matching on single keywords
    if (/(?:price|value|worth|cost).*\b(sol|eth|btc|bonk|wif|pepe|usdc|usdt|solana|bitcoin|ethereum)\b/i.test(prompt) ||
        /\b(sol|eth|btc|bonk|wif|pepe|solana|bitcoin|ethereum)\b.*price/i.test(prompt)) {
        if (!hiredAgents || hiredAgents.includes('magos'))
            return 'magos';
    }
    // Define routing rules with weights
    var rules = [
        {
            specialist: 'sentinel',
            patterns: [
                /\b(audit|scan|inspect)\b.*\b(contract|token|address|0x)/i,
                /smart\s*contract.*(?:check|review|scan|inspect|analyz)/,
                /contract.*(?:safe|secure|risk|danger)/,
                /0x[a-fA-F0-9]{40}/, // Contract address pattern
                /\b(reentrancy|overflow|access.control|exploit|vulnerability)\b/,
            ],
            weight: 1.5, // Higher weight — specific capability
        },
        {
            specialist: 'magos',
            patterns: [
                /predict|forecast|price\s+target|will\s+\w+\s+(go|reach|hit)/,
                /risk|danger|safe|analysis|analyze|technical/,
                /support|resistance|trend|pattern|chart/,
            ],
            weight: 1,
        },
        {
            specialist: 'aura',
            patterns: [
                /sentiment|vibe|mood|feeling|social/,
                /trending|hot|popular|alpha|gem/,
                /influencer|kol|whale\s+watch|twitter|x\s+/,
                /fomo|fud|hype|buzz/,
            ],
            weight: 1,
        },
        {
            specialist: 'bankr',
            patterns: [
                /\b(?:swap|trade|buy|sell|exchange)\b.*\b(?:token|coin|sol|eth|btc|usdc|for)\b/,
                /\b(?:transfer|send|withdraw|deposit)\b/,
                /\bbalance\b|my wallet|my holdings|my portfolio/,
                /\b(?:dca|dollar\s+cost|recurring|auto-buy)\b/,
            ],
            weight: 1,
        },
        {
            specialist: 'seeker',
            patterns: [
                /search|find|lookup|what is|who is|where is|news about|latest on/,
                /research|google|brave|internet|web|look up/,
                /news|happened|today|recent|current events/,
                /what happened|tell me about/,
            ],
            weight: 1.2,
        },
        {
            specialist: 'scribe',
            patterns: [
                /summarize|explain|write|draft|document/,
                /help|question|how to|what can you/,
            ],
            weight: 0.5,
        },
    ];
    // Score each specialist (only those in hiredAgents if provided)
    var scores = {
        magos: 0,
        aura: 0,
        bankr: 0,
        scribe: 0,
        seeker: 0,
        sentinel: 0,
        general: 0,
        'multi-hop': 0,
    };
    for (var _i = 0, rules_1 = rules; _i < rules_1.length; _i++) {
        var rule = rules_1[_i];
        // Skip specialists not in hiredAgents (if list is provided)
        if (hiredAgents && !hiredAgents.includes(rule.specialist)) {
            continue;
        }
        for (var _a = 0, _b = rule.patterns; _a < _b.length; _a++) {
            var pattern = _b[_a];
            if (pattern.test(lower)) {
                scores[rule.specialist] += rule.weight;
            }
        }
    }
    // Find highest scoring specialist
    var bestSpecialist = 'general';
    var bestScore = 0;
    for (var _c = 0, _d = Object.entries(scores); _c < _d.length; _c++) {
        var _e = _d[_c], specialist = _e[0], score = _e[1];
        // Skip specialists not in hiredAgents (if list is provided)
        if (hiredAgents && !hiredAgents.includes(specialist) && specialist !== 'general') {
            continue;
        }
        if (score > bestScore) {
            bestScore = score;
            bestSpecialist = specialist;
        }
    }
    console.log("[Router] Scores:", scores, "-> ".concat(bestSpecialist), hiredAgents ? "(filtered by swarm: ".concat(hiredAgents.join(', '), ")") : '');
    return bestSpecialist;
}
/**
 * Check if specialist requires x402 payment
 */
function checkPaymentRequired(specialist) {
    return __awaiter(this, void 0, void 0, function () {
        var fee;
        return __generator(this, function (_a) {
            fee = config_1.default.fees[specialist] || 0;
            return [2 /*return*/, fee > 0];
        });
    });
}
/**
 * Call a specialist through the x402-gated endpoint
 * Handles 402 responses and provides payment instructions
 */
function callSpecialistGated(specialistId, prompt, context) {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, result, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    startTime = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    // In a real production app, we would use axios to call http://localhost:PORT/api/specialist/:id
                    // But since we are server-side and want to demo the flow, we will:
                    // 1. Manually check if it's a 402 (payment required)
                    // 2. If 402, simulate/execute payment
                    // 3. Then call the actual specialist
                    console.log("[x402-Client] Requesting gated access to ".concat(specialistId, "..."));
                    return [4 /*yield*/, callSpecialist(specialistId, prompt, context)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, __assign(__assign({}, result), { executionTimeMs: Date.now() - startTime })];
                case 3:
                    error_4 = _a.sent();
                    return [2 /*return*/, {
                            success: false,
                            data: { error: error_4.message },
                            timestamp: new Date(),
                            executionTimeMs: Date.now() - startTime
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Call the appropriate specialist
 * Checks external agents first, then falls back to built-in specialists
 */
function callSpecialist(specialist, prompt, context) {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, result, _a, _b, magosResult, auraResult, fee;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    startTime = Date.now();
                    // Check if this is an external agent (registered via marketplace)
                    if ((0, external_agents_1.isExternalAgent)(specialist)) {
                        console.log("[Dispatcher] Routing to external agent: ".concat(specialist));
                        return [2 /*return*/, (0, external_agents_1.callExternalAgent)(specialist, prompt)];
                    }
                    _a = specialist;
                    switch (_a) {
                        case 'magos': return [3 /*break*/, 1];
                        case 'aura': return [3 /*break*/, 3];
                        case 'bankr': return [3 /*break*/, 5];
                        case 'scribe': return [3 /*break*/, 7];
                        case 'seeker': return [3 /*break*/, 9];
                        case 'general': return [3 /*break*/, 11];
                    }
                    return [3 /*break*/, 11];
                case 1: return [4 /*yield*/, magos_1.default.handle(prompt)];
                case 2:
                    result = _c.sent();
                    return [3 /*break*/, 13];
                case 3: return [4 /*yield*/, aura_1.default.handle(prompt)];
                case 4:
                    result = _c.sent();
                    return [3 /*break*/, 13];
                case 5: return [4 /*yield*/, bankr_1.default.handle(prompt, context)];
                case 6:
                    result = _c.sent();
                    return [3 /*break*/, 13];
                case 7: return [4 /*yield*/, scribe_1.default.handle(prompt)];
                case 8:
                    result = _c.sent();
                    return [3 /*break*/, 13];
                case 9: return [4 /*yield*/, seeker_1.default.handle(prompt)];
                case 10:
                    result = _c.sent();
                    return [3 /*break*/, 13];
                case 11: return [4 /*yield*/, Promise.all([
                        magos_1.default.handle(prompt),
                        aura_1.default.handle(prompt),
                    ])];
                case 12:
                    _b = _c.sent(), magosResult = _b[0], auraResult = _b[1];
                    result = {
                        success: true,
                        data: {
                            magos: magosResult.data,
                            aura: auraResult.data,
                            combined: "I'm not sure how to help with that. Try asking about wallet balances, market analysis, or social sentiment.",
                        },
                        confidence: ((magosResult.confidence || 0) + (auraResult.confidence || 0)) / 2,
                        timestamp: new Date(),
                        executionTimeMs: Date.now() - startTime,
                    };
                    _c.label = 13;
                case 13:
                    // Ensure agentId is present in result data for routing/reputation tracking
                    if (result.data && typeof result.data === 'object') {
                        result.data.agentId = specialist;
                    }
                    // Add cost for built-in if not present
                    if (result && !result.cost) {
                        fee = config_1.default.fees[specialist];
                        if (fee !== undefined) {
                            result.cost = {
                                amount: String(fee),
                                currency: 'USDC',
                                network: 'base',
                                recipient: config_1.default.specialistWallets[specialist] || 'treasury',
                            };
                        }
                    }
                    return [2 /*return*/, result];
            }
        });
    });
}
/**
 * Get task by ID
 */
function getTask(taskId) {
    return tasks.get(taskId);
}
/**
 * Get all tasks for a user
 */
function getTasksByUser(userId) {
    return Array.from(tasks.values()).filter(function (t) { return t.userId === userId; });
}
/**
 * Get recent tasks
 */
function getRecentTasks(limit) {
    if (limit === void 0) { limit = 10; }
    return Array.from(tasks.values())
        .sort(function (a, b) { return b.createdAt.getTime() - a.createdAt.getTime(); })
        .slice(0, limit);
}
/**
 * Get specialist pricing with reputation
 */
function getSpecialistPricing() {
    var pricingWithRep = {};
    for (var _i = 0, _a = Object.entries(SPECIALIST_DESCRIPTIONS); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], description = _b[1];
        var fee = config_1.default.fees[key] || 0;
        pricingWithRep[key] = {
            fee: String(fee),
            description: description,
            success_rate: Math.round((0, reputation_1.getReputationScore)(key) * 100)
        };
    }
    return pricingWithRep;
}
/**
 * Get full specialist list with reputation data (including external agents)
 */
function getSpecialists() {
    // Built-in specialists
    var builtIn = Object.entries(SPECIALIST_DESCRIPTIONS).map(function (_a) {
        var name = _a[0], description = _a[1];
        // Get structured capabilities from matcher if available
        var structuredCapabilities = capability_matcher_1.capabilityMatcher.specialistManifests.get(name) || [];
        return {
            name: name,
            description: description,
            fee: String(config_1.default.fees[name] || 0),
            success_rate: Math.round((0, reputation_1.getReputationScore)(name) * 100),
            external: false,
            structuredCapabilities: structuredCapabilities,
        };
    });
    // External agents from the registry
    var external = (0, external_agents_1.getExternalAgents)()
        .filter(function (a) { return a.active && a.healthy; })
        .map(function (a) { return ({
        name: a.id,
        displayName: a.name,
        description: a.description,
        fee: String(Object.values(a.pricing)[0] || 0),
        success_rate: 0,
        external: true,
        endpoint: a.endpoint,
        wallet: a.wallet,
        capabilities: a.capabilities,
        structuredCapabilities: a.structuredCapabilities,
        pricing: a.pricing,
    }); });
    return __spreadArray(__spreadArray([], builtIn, true), external, true);
}
exports.default = {
    dispatch: dispatch,
    getTask: getTask,
    getTasksByUser: getTasksByUser,
    getRecentTasks: getRecentTasks,
    getSpecialistPricing: getSpecialistPricing,
    getSpecialists: getSpecialists,
    subscribeToTask: subscribeToTask,
    routePrompt: routePrompt,
};
