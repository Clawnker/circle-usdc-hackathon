"use strict";
/**
 * Unified LLM Client for Hivemind Protocol
 * Routes all inference through ClawRouter/BlockRun (OpenAI-compatible)
 * Tracks real token usage and cost for dynamic pricing
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
exports.MODELS = exports.costTracker = void 0;
exports.callLLM = callLLM;
exports.chat = chat;
exports.chatText = chatText;
exports.chatJSON = chatJSON;
var axios_1 = require("axios");
// --- Configuration ---
var LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://127.0.0.1:8402/v1';
var LLM_API_KEY = process.env.LLM_API_KEY || process.env.CLAWROUTER_API_KEY || 'clawrouter';
var DEFAULT_MODEL = process.env.LLM_DEFAULT_MODEL || 'google/gemini-2.5-flash';
var GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
var VERTEX_PROJECT_ID = process.env.VERTEX_PROJECT_ID || process.env.GCP_PROJECT_ID || '';
var VERTEX_LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
// Vertex AI global endpoint for Gemini 3.x models
var VERTEX_BASE_URL = VERTEX_PROJECT_ID
    ? "https://".concat(VERTEX_LOCATION, "-aiplatform.googleapis.com/v1beta1/projects/").concat(VERTEX_PROJECT_ID, "/locations/").concat(VERTEX_LOCATION, "/endpoints/openapi")
    : '';
var GEMINI_FALLBACK_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
// Cost markup for specialist pricing (e.g., 1.5 = 50% markup)
var COST_MARKUP = parseFloat(process.env.LLM_COST_MARKUP || '1.5');
// Priority: Explicit LLM_BASE_URL > Vertex AI (3.x support) > AI Studio fallback
var useVertex = !process.env.LLM_BASE_URL && !!VERTEX_PROJECT_ID && !!GEMINI_API_KEY;
var useGeminiFallback = !process.env.LLM_BASE_URL && !!GEMINI_API_KEY && !useVertex;
var ACTIVE_BASE_URL = process.env.LLM_BASE_URL || (useVertex ? VERTEX_BASE_URL : GEMINI_FALLBACK_URL);
var ACTIVE_API_KEY = LLM_API_KEY || GEMINI_API_KEY;
// Model mapping - Vertex supports Gemini 3.x models
var GEMINI_MODEL_MAP = {
    'google/gemini-2.5-flash': 'gemini-2.5-flash',
    'google/gemini-2.5-pro': 'gemini-2.5-pro',
    'google/gemini-3-pro-preview': 'gemini-3-pro-preview-001',
    'google/gemini-3-flash-preview': 'gemini-3-flash-preview-001',
    'nvidia/gpt-oss-120b': 'gemini-2.0-flash',
    'auto': 'gemini-2.5-flash',
};
if (useVertex) {
    console.log("[LLM] Using Vertex AI (".concat(VERTEX_LOCATION, ") \u2014 Gemini 3.x models enabled"));
}
else if (useGeminiFallback) {
    console.log('[LLM] ClawRouter not configured — using Gemini AI Studio fallback');
}
else {
    console.log("[LLM] Using ".concat(ACTIVE_BASE_URL));
}
var CostTracker = /** @class */ (function () {
    function CostTracker() {
        this.records = [];
        this.maxRecords = 1000;
    }
    CostTracker.prototype.record = function (entry) {
        this.records.push(entry);
        if (this.records.length > this.maxRecords) {
            this.records = this.records.slice(-this.maxRecords);
        }
    };
    /** Get total cost for a specific caller (specialist) */
    CostTracker.prototype.getCallerCost = function (caller) {
        var callerRecords = this.records.filter(function (r) { return r.caller === caller; });
        return {
            raw: callerRecords.reduce(function (sum, r) { return sum + r.cost.rawCost; }, 0),
            markedUp: callerRecords.reduce(function (sum, r) { return sum + r.cost.markedUpCost; }, 0),
            requests: callerRecords.length,
        };
    };
    /** Get cost summary across all callers */
    CostTracker.prototype.getSummary = function () {
        var summary = {};
        for (var _i = 0, _a = this.records; _i < _a.length; _i++) {
            var r = _a[_i];
            if (!summary[r.caller]) {
                summary[r.caller] = { raw: 0, markedUp: 0, requests: 0, tokens: 0 };
            }
            summary[r.caller].raw += r.cost.rawCost;
            summary[r.caller].markedUp += r.cost.markedUpCost;
            summary[r.caller].requests += 1;
            summary[r.caller].tokens += r.usage.totalTokens;
        }
        return summary;
    };
    /** Get the last N records */
    CostTracker.prototype.getRecent = function (n) {
        if (n === void 0) { n = 10; }
        return this.records.slice(-n);
    };
    /** Reset all records */
    CostTracker.prototype.reset = function () {
        this.records = [];
    };
    return CostTracker;
}());
exports.costTracker = new CostTracker();
// --- Known model pricing (per million tokens, USD) ---
// Used to estimate cost when the API doesn't return it
var MODEL_PRICING = {
    'google/gemini-2.5-flash': { input: 0.15, output: 0.60 },
    'google/gemini-2.5-pro': { input: 1.25, output: 10.0 },
    'google/gemini-3-pro-preview': { input: 2.0, output: 12.0 },
    'anthropic/claude-sonnet-4': { input: 3.0, output: 15.0 },
    'anthropic/claude-haiku-4.5': { input: 1.0, output: 5.0 },
    'anthropic/claude-opus-4': { input: 15.0, output: 75.0 },
    'openai/gpt-4o': { input: 2.5, output: 10.0 },
    'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
    'deepseek/deepseek-chat': { input: 0.28, output: 0.42 },
    'xai/grok-4-fast-reasoning': { input: 0.20, output: 0.50 },
    // Aliases
    'flash': { input: 0.15, output: 0.60 },
    'gemini': { input: 1.25, output: 10.0 },
    'sonnet': { input: 3.0, output: 15.0 },
    'haiku': { input: 1.0, output: 5.0 },
    'auto': { input: 0.50, output: 2.0 }, // estimate for smart router
};
function estimateCost(model, usage) {
    var pricing = MODEL_PRICING[model] || MODEL_PRICING['auto'];
    var inputCost = (usage.promptTokens / 1000000) * pricing.input;
    var outputCost = (usage.completionTokens / 1000000) * pricing.output;
    return inputCost + outputCost;
}
// --- Main LLM Call ---
function callLLM(messages_1) {
    return __awaiter(this, arguments, void 0, function (messages, options) {
        var model, caller, startTime, resolvedModel, requestBody, response, data, text, usage, rawCost, cost, latencyMs, resolvedModel_1, error_1, latencyMs;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    model = options.model || DEFAULT_MODEL;
                    caller = options.caller || 'unknown';
                    startTime = Date.now();
                    resolvedModel = useGeminiFallback
                        ? (GEMINI_MODEL_MAP[model] || 'gemini-2.5-flash')
                        : model;
                    requestBody = {
                        model: resolvedModel,
                        messages: messages,
                        temperature: (_a = options.temperature) !== null && _a !== void 0 ? _a : 0.3,
                        max_tokens: useGeminiFallback
                            ? Math.max((_b = options.maxTokens) !== null && _b !== void 0 ? _b : 2048, 500) // Gemini needs headroom for thinking tokens
                            : ((_c = options.maxTokens) !== null && _c !== void 0 ? _c : 2048),
                        top_p: (_d = options.topP) !== null && _d !== void 0 ? _d : 0.95,
                    };
                    if (options.jsonMode) {
                        requestBody.response_format = { type: 'json_object' };
                    }
                    _l.label = 1;
                case 1:
                    _l.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1.default.post("".concat(ACTIVE_BASE_URL, "/chat/completions"), requestBody, {
                            headers: {
                                'Authorization': "Bearer ".concat(ACTIVE_API_KEY),
                                'Content-Type': 'application/json',
                            },
                            timeout: 60000,
                        })];
                case 2:
                    response = _l.sent();
                    data = response.data;
                    text = ((_g = (_f = (_e = data.choices) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.message) === null || _g === void 0 ? void 0 : _g.content) || '';
                    usage = {
                        promptTokens: ((_h = data.usage) === null || _h === void 0 ? void 0 : _h.prompt_tokens) || 0,
                        completionTokens: ((_j = data.usage) === null || _j === void 0 ? void 0 : _j.completion_tokens) || 0,
                        totalTokens: ((_k = data.usage) === null || _k === void 0 ? void 0 : _k.total_tokens) || 0,
                    };
                    rawCost = estimateCost(model, usage);
                    cost = {
                        rawCost: rawCost,
                        markedUpCost: rawCost * COST_MARKUP,
                        markup: COST_MARKUP,
                    };
                    latencyMs = Date.now() - startTime;
                    resolvedModel_1 = data.model || model;
                    // Track cost
                    exports.costTracker.record({
                        caller: caller,
                        model: resolvedModel_1,
                        usage: usage,
                        cost: cost,
                        timestamp: new Date(),
                    });
                    console.log("[LLM] ".concat(caller, " \u2192 ").concat(resolvedModel_1, " | ").concat(usage.totalTokens, " tokens | $").concat(rawCost.toFixed(6), " raw | $").concat(cost.markedUpCost.toFixed(6), " marked up | ").concat(latencyMs, "ms"));
                    return [2 /*return*/, { text: text, model: resolvedModel_1, usage: usage, cost: cost, latencyMs: latencyMs, caller: caller }];
                case 3:
                    error_1 = _l.sent();
                    latencyMs = Date.now() - startTime;
                    console.error("[LLM] ".concat(caller, " \u2192 ").concat(model, " FAILED after ").concat(latencyMs, "ms:"), error_1.message);
                    if (error_1.response) {
                        console.error("[LLM] Status: ".concat(error_1.response.status, ", Body:"), JSON.stringify(error_1.response.data).slice(0, 500));
                    }
                    throw new Error("LLM call failed (".concat(model, "): ").concat(error_1.message));
                case 4: return [2 /*return*/];
            }
        });
    });
}
// --- Convenience Helpers ---
/** Simple prompt → text (system + user message pattern) */
function chat(systemPrompt_1, userPrompt_1) {
    return __awaiter(this, arguments, void 0, function (systemPrompt, userPrompt, options) {
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            return [2 /*return*/, callLLM([
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ], options)];
        });
    });
}
/** Simple prompt → text string only */
function chatText(systemPrompt_1, userPrompt_1) {
    return __awaiter(this, arguments, void 0, function (systemPrompt, userPrompt, options) {
        var result;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, chat(systemPrompt, userPrompt, options)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.text];
            }
        });
    });
}
/** JSON mode — returns parsed JSON */
function chatJSON(systemPrompt_1, userPrompt_1) {
    return __awaiter(this, arguments, void 0, function (systemPrompt, userPrompt, options) {
        var jsonSystemPrompt, result, jsonMatch, data;
        var _a;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    jsonSystemPrompt = systemPrompt + '\n\nIMPORTANT: You MUST respond with ONLY a valid JSON object. No markdown, no explanation, just JSON.';
                    return [4 /*yield*/, chat(jsonSystemPrompt, userPrompt, __assign(__assign({}, options), { temperature: (_a = options.temperature) !== null && _a !== void 0 ? _a : 0.1 }))];
                case 1:
                    result = _b.sent();
                    jsonMatch = result.text.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        throw new Error("Could not parse JSON from LLM response: ".concat(result.text.slice(0, 200)));
                    }
                    data = JSON.parse(jsonMatch[0]);
                    return [2 /*return*/, { data: data, result: result }];
            }
        });
    });
}
// --- Model Presets for Specialists ---
exports.MODELS = {
    /** Cheapest, fastest — routing decisions, simple classification */
    fast: 'google/gemini-2.5-flash',
    /** Mid-tier — most specialist work */
    standard: 'google/gemini-2.5-pro',
    /** Premium — complex analysis, multi-step reasoning */
    premium: 'anthropic/claude-sonnet-4',
    /** Free tier — NVIDIA GPT-OSS (no cost) */
    free: 'nvidia/gpt-oss-120b',
};
exports.default = { callLLM: callLLM, chat: chat, chatText: chatText, chatJSON: chatJSON, costTracker: exports.costTracker, MODELS: exports.MODELS };
