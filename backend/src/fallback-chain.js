"use strict";
/**
 * Fallback Chain Service
 * Manages failover logic and ordered execution paths.
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
exports.fallbackChain = exports.FallbackChainService = void 0;
var capability_matcher_1 = require("./capability-matcher");
var circuit_breaker_1 = require("./circuit-breaker");
var FallbackChainService = /** @class */ (function () {
    function FallbackChainService() {
    }
    /**
     * Build an ordered list of candidate agents for a specific capability/intent
     */
    FallbackChainService.prototype.buildFallbackChain = function (prompt_1) {
        return __awaiter(this, arguments, void 0, function (prompt, excludeAgents) {
            var intent, candidates, error_1;
            if (excludeAgents === void 0) { excludeAgents = []; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, capability_matcher_1.capabilityMatcher.extractIntent(prompt)];
                    case 1:
                        intent = _a.sent();
                        return [4 /*yield*/, capability_matcher_1.capabilityMatcher.matchAgents(intent)];
                    case 2:
                        candidates = _a.sent();
                        // 3. Filter out excluded agents and those with OPEN circuit breakers
                        candidates = candidates.filter(function (agent) {
                            return !excludeAgents.includes(agent.agentId) &&
                                circuit_breaker_1.circuitBreaker.canCall(agent.agentId);
                        });
                        // 4. Return top candidates (already sorted by score in matchAgents)
                        return [2 /*return*/, candidates];
                    case 3:
                        error_1 = _a.sent();
                        console.error('[FallbackChain] Failed to build fallback chain:', error_1);
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute a task with automatic fallback to next agent in chain
     */
    FallbackChainService.prototype.executeWithFallback = function (chain_1, taskPrompt_1, executor_1) {
        return __awaiter(this, arguments, void 0, function (chain, taskPrompt, executor, options) {
            var maxRetries, timeoutMs, lastError, limitedChain, _i, limitedChain_1, candidate, agentId, result, error_2;
            var _a, _b, _c, _d;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        maxRetries = (_a = options.maxRetries) !== null && _a !== void 0 ? _a : 3;
                        timeoutMs = (_b = options.timeoutMs) !== null && _b !== void 0 ? _b : 30000;
                        lastError = null;
                        limitedChain = chain.slice(0, maxRetries + 1);
                        _i = 0, limitedChain_1 = limitedChain;
                        _e.label = 1;
                    case 1:
                        if (!(_i < limitedChain_1.length)) return [3 /*break*/, 7];
                        candidate = limitedChain_1[_i];
                        agentId = candidate.agentId;
                        console.log("[FallbackChain] Attempting execution with agent: ".concat(agentId));
                        _e.label = 2;
                    case 2:
                        _e.trys.push([2, 4, , 5]);
                        // Record that we are attempting a call (important for HALF_OPEN state)
                        circuit_breaker_1.circuitBreaker.recordCall(agentId);
                        return [4 /*yield*/, this.withTimeout(executor(agentId, taskPrompt), timeoutMs)];
                    case 3:
                        result = _e.sent();
                        if (result.success) {
                            console.log("[FallbackChain] Success with agent: ".concat(agentId));
                            circuit_breaker_1.circuitBreaker.recordSuccess(agentId);
                            return [2 /*return*/, result];
                        }
                        else {
                            console.warn("[FallbackChain] Failure with agent: ".concat(agentId, ":"), (_c = result.data) === null || _c === void 0 ? void 0 : _c.error);
                            circuit_breaker_1.circuitBreaker.recordFailure(agentId);
                            lastError = ((_d = result.data) === null || _d === void 0 ? void 0 : _d.error) || 'Unknown error';
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _e.sent();
                        console.error("[FallbackChain] Error calling agent ".concat(agentId, ":"), error_2.message);
                        circuit_breaker_1.circuitBreaker.recordFailure(agentId);
                        lastError = error_2.message;
                        return [3 /*break*/, 5];
                    case 5:
                        console.log("[FallbackChain] Falling back from ".concat(agentId, "..."));
                        _e.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/, {
                            success: false,
                            data: { error: "Fallback chain exhausted. Last error: ".concat(lastError) },
                            timestamp: new Date(),
                            executionTimeMs: 0
                        }];
                }
            });
        });
    };
    FallbackChainService.prototype.withTimeout = function (promise, ms) {
        return Promise.race([
            promise,
            new Promise(function (_, reject) {
                return setTimeout(function () { return reject(new Error("Timeout after ".concat(ms, "ms"))); }, ms);
            })
        ]);
    };
    return FallbackChainService;
}());
exports.FallbackChainService = FallbackChainService;
exports.fallbackChain = new FallbackChainService();
