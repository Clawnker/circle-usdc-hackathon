"use strict";
/**
 * DAG Execution Engine for Hivemind Protocol
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
exports.executeDAG = executeDAG;
exports.resolveVariables = resolveVariables;
/**
 * Executes a Directed Acyclic Graph (DAG) of agent tasks
 */
function executeDAG(plan_1, executeStep_1) {
    return __awaiter(this, arguments, void 0, function (plan, executeStep, options) {
        var startTime, timeoutMs, results, completedStepIds, failedStepIds, skippedStepIds, allStepIds, readySteps, stepsToSkip, _i, stepsToSkip_1, step, executionTimeMs, success;
        var _this = this;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    startTime = Date.now();
                    timeoutMs = options.timeoutMs || 30000;
                    results = {};
                    completedStepIds = new Set();
                    failedStepIds = new Set();
                    skippedStepIds = new Set();
                    allStepIds = plan.steps.map(function (s) { return s.id; });
                    _a.label = 1;
                case 1:
                    if (!(completedStepIds.size + failedStepIds.size + skippedStepIds.size < allStepIds.length)) return [3 /*break*/, 3];
                    readySteps = plan.steps.filter(function (step) {
                        if (completedStepIds.has(step.id) || failedStepIds.has(step.id) || skippedStepIds.has(step.id)) {
                            return false;
                        }
                        // All dependencies must be completed successfully
                        return step.dependencies.every(function (depId) { return completedStepIds.has(depId); });
                    });
                    stepsToSkip = plan.steps.filter(function (step) {
                        if (completedStepIds.has(step.id) || failedStepIds.has(step.id) || skippedStepIds.has(step.id)) {
                            return false;
                        }
                        // If any dependency failed or was skipped, this step cannot proceed
                        return step.dependencies.some(function (depId) { return failedStepIds.has(depId) || skippedStepIds.has(depId); });
                    });
                    // Mark blocked steps as skipped
                    for (_i = 0, stepsToSkip_1 = stepsToSkip; _i < stepsToSkip_1.length; _i++) {
                        step = stepsToSkip_1[_i];
                        skippedStepIds.add(step.id);
                        results[step.id] = {
                            stepId: step.id,
                            specialist: step.specialist,
                            output: null,
                            summary: "Skipped due to dependency failure in: ".concat(step.dependencies.join(', ')),
                            success: false
                        };
                    }
                    // 3. If no steps are ready and we're not finished, we have a problem (cycle or deadlock)
                    if (readySteps.length === 0 && stepsToSkip.length === 0) {
                        if (completedStepIds.size + failedStepIds.size + skippedStepIds.size < allStepIds.length) {
                            throw new Error('Cycle detected in DAG plan or invalid dependency IDs');
                        }
                        return [3 /*break*/, 3];
                    }
                    // 4. Execute all ready steps in parallel
                    return [4 /*yield*/, Promise.all(readySteps.map(function (step) { return __awaiter(_this, void 0, void 0, function () {
                            var context, stepResult, error_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        context = Object.fromEntries(Object.entries(results)
                                            .filter(function (_a) {
                                            var _ = _a[0], res = _a[1];
                                            return res.success;
                                        })
                                            .map(function (_a) {
                                            var id = _a[0], res = _a[1];
                                            return [id, res.output];
                                        }));
                                        return [4 /*yield*/, withTimeout(executeStep(step, context), timeoutMs, "Step ".concat(step.id, " (").concat(step.specialist, ") timed out after ").concat(timeoutMs, "ms"))];
                                    case 1:
                                        stepResult = _a.sent();
                                        results[step.id] = stepResult;
                                        if (stepResult.success) {
                                            completedStepIds.add(step.id);
                                        }
                                        else {
                                            failedStepIds.add(step.id);
                                        }
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_1 = _a.sent();
                                        console.error("[DAG Executor] Error executing step ".concat(step.id, ":"), error_1.message);
                                        failedStepIds.add(step.id);
                                        results[step.id] = {
                                            stepId: step.id,
                                            specialist: step.specialist,
                                            output: { error: error_1.message },
                                            summary: "Execution Error: ".concat(error_1.message),
                                            success: false
                                        };
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 2:
                    // 4. Execute all ready steps in parallel
                    _a.sent();
                    return [3 /*break*/, 1];
                case 3:
                    executionTimeMs = Date.now() - startTime;
                    success = failedStepIds.size === 0 && skippedStepIds.size === 0;
                    return [2 /*return*/, {
                            planId: plan.planId,
                            success: success,
                            results: results,
                            totalCost: plan.totalEstimatedCost,
                            executionTimeMs: executionTimeMs
                        }];
            }
        });
    });
}
/**
 * Utility: Execute promise with timeout
 */
function withTimeout(promise, ms, errorMessage) {
    return __awaiter(this, void 0, void 0, function () {
        var timeoutId, timeoutPromise;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    timeoutPromise = new Promise(function (_, reject) {
                        timeoutId = setTimeout(function () { return reject(new Error(errorMessage)); }, ms);
                    });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 3, 4]);
                    return [4 /*yield*/, Promise.race([promise, timeoutPromise])];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    clearTimeout(timeoutId);
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Utility: Resolve variables in prompt templates
 * Supports {{step-id.output.path.to.value}} and {{step-id.summary}}
 * Falls back to step summary when specific path not found
 */
function resolveVariables(template, context) {
    return template.replace(/\{\{([^}]+)\}\}/g, function (match, expression) {
        var parts = expression.trim().split('.');
        var stepId = parts[0];
        if (!context[stepId]) {
            // Step result not available — remove the template tag and note it
            return "[data from ".concat(stepId, " unavailable]");
        }
        var current = context[stepId];
        // If path is step-1.output.foo, the context already holds the output for step-1
        // So we skip 'output' if it's the second part
        var startIndex = parts[1] === 'output' ? 2 : 1;
        for (var i = startIndex; i < parts.length; i++) {
            var part = parts[i];
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            }
            else {
                // Path not found — fall back to stringifying the entire step output
                // This ensures downstream specialists get actual data, not raw template tags
                var stepData = context[stepId];
                if (typeof stepData === 'object') {
                    // Try to extract meaningful content: insight, summary, analysis, or full JSON
                    var fallback = stepData.insight || stepData.summary || stepData.analysis ||
                        stepData.description || stepData.content || JSON.stringify(stepData);
                    console.log("[DAG] Template fallback for {{".concat(expression, "}}: using step ").concat(stepId, " full output"));
                    return typeof fallback === 'string' ? fallback : JSON.stringify(fallback);
                }
                return String(stepData);
            }
        }
        if (typeof current === 'object') {
            return JSON.stringify(current);
        }
        return String(current);
    });
}
