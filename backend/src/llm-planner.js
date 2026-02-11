"use strict";
/**
 * LLM-based routing planner using Gemini Flash
 * Alternative to RegExp-based routing in dispatcher.ts
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isComplexQuery = isComplexQuery;
exports.planDAG = planDAG;
exports.planWithLLM = planWithLLM;
var capability_matcher_1 = require("./capability-matcher");
var llm_client_1 = require("./llm-client");
/**
 * Determine if a query is complex enough to require multi-step DAG planning.
 * Triggered if 2+ distinct capability domains are mentioned.
 */
function isComplexQuery(prompt) {
    return __awaiter(this, void 0, void 0, function () {
        var lower, multiHopWords, domains, matchedDomains, intent, hasMultipleCaps, hasMultipleEntities, error_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    lower = prompt.toLowerCase();
                    multiHopWords = [
                        'compare', 'then', 'and then', 'after', 'followed by',
                        'while', 'relationship between', 'correlation', 'summarize both',
                        'buy and', 'sell and', 'swap and'
                    ];
                    if (multiHopWords.some(function (word) { return lower.includes(word); })) {
                        console.log("[Complexity Detector] Fast-path: multi-hop keywords detected");
                        return [2 /*return*/, true];
                    }
                    domains = [
                        { name: 'market', regex: /price|market|predict|analysis|oracle/i },
                        { name: 'social', regex: /sentiment|trending|popular|social|alpha|mention/i },
                        { name: 'defi', regex: /swap|send|buy|sell|wallet|balance|transfer/i },
                        { name: 'research', regex: /search|find|news|research|lookup/i },
                        { name: 'security', regex: /audit|security|contract|vulnerability/i }
                    ];
                    matchedDomains = domains.filter(function (d) { return d.regex.test(prompt); });
                    if (matchedDomains.length >= 2) {
                        console.log("[Complexity Detector] Fast-path: ".concat(matchedDomains.length, " domains detected: ").concat(matchedDomains.map(function (d) { return d.name; }).join(', ')));
                        return [2 /*return*/, true];
                    }
                    if (!(prompt.split(' ').length > 15)) return [3 /*break*/, 4];
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, capability_matcher_1.capabilityMatcher.extractIntent(prompt)];
                case 2:
                    intent = _e.sent();
                    hasMultipleCaps = intent.requiredCapabilities && intent.requiredCapabilities.length >= 2;
                    hasMultipleEntities = (((_b = (_a = intent.entities) === null || _a === void 0 ? void 0 : _a.tokens) === null || _b === void 0 ? void 0 : _b.length) || 0) + (((_d = (_c = intent.entities) === null || _c === void 0 ? void 0 : _c.addresses) === null || _d === void 0 ? void 0 : _d.length) || 0) >= 2;
                    if (hasMultipleCaps || hasMultipleEntities) {
                        console.log("[Complexity Detector] Smart-path: Complex query detected via LLM intent");
                        return [2 /*return*/, true];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _e.sent();
                    console.error('[Complexity Detector] Smart-path error:', error_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, false];
            }
        });
    });
}
/**
 * Specialist pricing for cost estimation
 */
var SPECIALIST_PRICING = {
    magos: 0.001,
    aura: 0.0005,
    bankr: 0.0001,
    scribe: 0.0001,
    seeker: 0.0001,
    sentinel: 2.50,
    general: 0,
};
/**
 * Plan a multi-step DAG using Gemini Flash
 */
function planDAG(prompt) {
    return __awaiter(this, void 0, void 0, function () {
        var systemPrompt, parsed, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    systemPrompt = "You are the Hivemind Orchestrator. Your job is to decompose complex user queries into a Directed Acyclic Graph (DAG) of specialized agent tasks.\n\nAVAILABLE SPECIALISTS:\n- magos: Market analysis, price predictions, technical analysis, risk assessment.\n- aura: Social sentiment analysis, trending topics, influencer tracking.\n- bankr: Wallet operations (transfers, swaps, balances), Solana transactions.\n- scribe: General assistant, summarization, explanations, formatting results.\n- seeker: Web research, news lookup, search queries, current events.\n- sentinel: Smart contract security audits (requires a contract address).\n\nPRICING (USDC):\n- magos: 0.001\n- aura: 0.0005\n- bankr: 0.0001\n- scribe: 0.0001\n- seeker: 0.0001\n- sentinel: 2.50\n\nOUTPUT FORMAT:\nReturn ONLY a valid JSON object:\n{\n  \"planId\": \"unique-id\",\n  \"steps\": [\n    {\n      \"id\": \"step-1\",\n      \"specialist\": \"aura\",\n      \"promptTemplate\": \"Find the top trending token on Solana right now.\",\n      \"dependencies\": [],\n      \"estimatedCost\": 0.0005\n    },\n    {\n      \"id\": \"step-2\",\n      \"specialist\": \"magos\",\n      \"promptTemplate\": \"Analyze the price history and potential for {{step-1.output.trendingTokens[0].symbol}}\",\n      \"dependencies\": [\"step-1\"],\n      \"estimatedCost\": 0.001\n    }\n  ],\n  \"reasoning\": \"Explain the plan strategy.\",\n  \"totalEstimatedCost\": 0.0015\n}\n\nRULES:\n1. MANDATORY: Use {{step-id.output.path}} for dependency injection. EVERY time you refer to data from a previous step, you MUST use this syntax.\n2. Parallelize: Steps with no common dependencies should run simultaneously.\n3. Minimalist: Use the fewest agents possible to solve the query.\n4. Sentinel: Only use for security audits of contract addresses.\n5. If the query is simple and only needs one specialist, return a single-step plan.";
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, llm_client_1.chatJSON)(systemPrompt, prompt, {
                            model: llm_client_1.MODELS.fast,
                            caller: 'llm-planner',
                            temperature: 0.1,
                            maxTokens: 1000,
                        })];
                case 2:
                    parsed = (_a.sent()).data;
                    // Ensure totalEstimatedCost is calculated if missing
                    if (parsed.steps && parsed.totalEstimatedCost === undefined) {
                        parsed.totalEstimatedCost = parsed.steps.reduce(function (sum, step) { return sum + (step.estimatedCost || 0); }, 0);
                    }
                    return [2 /*return*/, {
                            planId: parsed.planId || "plan-".concat(Date.now()),
                            query: prompt,
                            steps: parsed.steps || [],
                            totalEstimatedCost: parsed.totalEstimatedCost || 0,
                            reasoning: parsed.reasoning || 'Dynamic plan generated by Hivemind Orchestrator.'
                        }];
                case 3:
                    error_2 = _a.sent();
                    console.error("[LLM Planner] Failed to plan DAG:", error_2.message);
                    // Fallback to a single-step scribe plan
                    return [2 /*return*/, {
                            planId: "fallback-".concat(Date.now()),
                            query: prompt,
                            steps: [{
                                    id: 'step-1',
                                    specialist: 'scribe',
                                    promptTemplate: prompt,
                                    dependencies: [],
                                    estimatedCost: 0.0001
                                }],
                            totalEstimatedCost: 0.0001,
                            reasoning: "LLM planning failed, falling back to scribe"
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Plan routing using Gemini Flash LLM (Backward Compatibility)
 */
function planWithLLM(prompt) {
    return __awaiter(this, void 0, void 0, function () {
        var plan, firstStep;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, planDAG(prompt)];
                case 1:
                    plan = _a.sent();
                    firstStep = plan.steps[0];
                    return [2 /*return*/, {
                            specialist: (firstStep === null || firstStep === void 0 ? void 0 : firstStep.specialist) || 'scribe',
                            confidence: plan.steps.length > 0 ? 0.9 : 0.3,
                            reasoning: plan.reasoning
                        }];
            }
        });
    });
}
exports.default = {
    planWithLLM: planWithLLM,
    planDAG: planDAG
};
