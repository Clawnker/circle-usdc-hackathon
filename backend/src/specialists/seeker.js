"use strict";
/**
 * Seeker Specialist
 * Web research and information lookup using Brave Search
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
exports.seeker = void 0;
var fs = require("fs");
var path = require("path");
var brave_search_1 = require("./tools/brave-search");
var mcp_client_1 = require("./tools/mcp-client");
// Load system prompt
var PROMPT_PATH = path.join(__dirname, 'prompts', 'seeker.md');
var systemPrompt = '';
try {
    systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8');
}
catch (e) {
    console.log('[Seeker] Could not load system prompt');
}
exports.seeker = {
    name: 'Seeker',
    description: 'Web research specialist with real-time search capabilities',
    systemPrompt: systemPrompt,
    handle: function (prompt) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, intent, data, _a, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 11, , 12]);
                        intent = parseIntent(prompt);
                        data = void 0;
                        _a = intent.type;
                        switch (_a) {
                            case 'search': return [3 /*break*/, 2];
                            case 'news': return [3 /*break*/, 4];
                            case 'factcheck': return [3 /*break*/, 6];
                        }
                        return [3 /*break*/, 8];
                    case 2: return [4 /*yield*/, performSearch(intent.query, intent.originalPrompt)];
                    case 3:
                        data = _b.sent();
                        return [3 /*break*/, 10];
                    case 4: return [4 /*yield*/, searchNews(intent.query)];
                    case 5:
                        data = _b.sent();
                        return [3 /*break*/, 10];
                    case 6: return [4 /*yield*/, factCheck(intent.query)];
                    case 7:
                        data = _b.sent();
                        return [3 /*break*/, 10];
                    case 8: return [4 /*yield*/, performSearch(prompt, prompt)];
                    case 9:
                        data = _b.sent();
                        _b.label = 10;
                    case 10: return [2 /*return*/, {
                            success: true,
                            data: data,
                            confidence: data.confidence || 0.85,
                            timestamp: new Date(),
                            executionTimeMs: Date.now() - startTime,
                        }];
                    case 11:
                        error_1 = _b.sent();
                        console.error('[Seeker] Error:', error_1.message);
                        return [2 /*return*/, {
                                success: false,
                                data: { error: 'An error occurred during web research.' },
                                timestamp: new Date(),
                                executionTimeMs: Date.now() - startTime,
                            }];
                    case 12: return [2 /*return*/];
                }
            });
        });
    },
};
/**
 * Parse user intent from prompt
 */
function parseIntent(prompt) {
    var lower = prompt.toLowerCase();
    // Clean up the query for search
    var query = prompt
        .replace(/^(search|find|look up|google)\s+/i, '') // Only strip search prefixes, not question words
        .replace(/\?$/, '')
        .trim();
    if (lower.includes('news') || lower.includes('latest') || lower.includes('recent')) {
        return { type: 'news', query: query, originalPrompt: prompt };
    }
    if (lower.includes('true') || lower.includes('fact') || lower.includes('verify') || lower.includes('is it')) {
        return { type: 'factcheck', query: query, originalPrompt: prompt };
    }
    return { type: 'search', query: query, originalPrompt: prompt };
}
/**
 * Perform search using Brave AI (best), MCP, or fallback
 */
function braveSearch(query_1) {
    return __awaiter(this, arguments, void 0, function (query, count) {
        var aiResult, error_2, mcpResult, error_3, fallbackResult;
        if (count === void 0) { count = 5; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, brave_search_1.braveAISearch)(query, { count: count })];
                case 1:
                    aiResult = _a.sent();
                    if (aiResult.results.length > 0) {
                        console.log('[Seeker] Using Brave AI Search');
                        return [2 /*return*/, { results: aiResult.results, summary: aiResult.summary }];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    console.log('[Seeker] Brave AI not available, trying MCP');
                    return [3 /*break*/, 3];
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, mcp_client_1.default.braveSearch(query, count)];
                case 4:
                    mcpResult = _a.sent();
                    if (mcpResult && mcpResult.web && mcpResult.web.results) {
                        console.log('[Seeker] Using MCP Brave Search');
                        return [2 /*return*/, {
                                results: mcpResult.web.results.map(function (r) { return ({
                                    title: r.title,
                                    url: r.url,
                                    description: r.description,
                                    age: r.age,
                                }); }),
                            }];
                    }
                    return [3 /*break*/, 6];
                case 5:
                    error_3 = _a.sent();
                    console.log('[Seeker] MCP not available, using fallback');
                    return [3 /*break*/, 6];
                case 6: return [4 /*yield*/, brave_search_1.default.search(query, { count: count })];
                case 7:
                    fallbackResult = _a.sent();
                    return [2 /*return*/, { results: fallbackResult.results }];
            }
        });
    });
}
/**
 * Check if query is a simple factual question
 */
function isSimpleFactualQuery(query) {
    var lower = query.toLowerCase();
    return /^(who|what|where|when|how tall|how old|how many|how much|which|whose)\s+(is|are|was|were|did|does|do)\b/.test(lower);
}
/**
 * Synthesize a direct answer from search results for simple questions
 */
function synthesizeAnswer(query, results) {
    if (results.length === 0)
        return '';
    // Take the first result's description as the primary answer
    // It's usually the most relevant snippet
    var primaryAnswer = results[0].description;
    // Get additional context from other results if they add info
    var additionalInfo = results.slice(1, 3)
        .map(function (r) { return r.description; })
        .filter(function (d) { return !primaryAnswer.includes(d.substring(0, 50)); }) // Avoid duplicates
        .join(' ');
    // Combine into a coherent answer
    var answer = primaryAnswer;
    if (additionalInfo && additionalInfo.length > 50) {
        answer += '\n\n' + additionalInfo;
    }
    return answer;
}
/**
 * Perform a general web search
 */
function performSearch(query, originalPrompt) {
    return __awaiter(this, void 0, void 0, function () {
        var searchResult, results, promptToCheck, isSimple, summary, insight, answer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[Seeker] Searching: \"".concat(query, "\""));
                    return [4 /*yield*/, braveSearch(query, 5)];
                case 1:
                    searchResult = _a.sent();
                    results = searchResult.results;
                    promptToCheck = originalPrompt || query;
                    isSimple = isSimpleFactualQuery(promptToCheck);
                    console.log("[Seeker] Simple factual query: ".concat(isSimple, " (checked: \"").concat(promptToCheck, "\")"));
                    summary = '';
                    insight = '';
                    if (results.length > 0) {
                        if (isSimple) {
                            answer = synthesizeAnswer(query, results);
                            summary = "**".concat(promptToCheck, "**\n\n").concat(answer, "\n\n");
                            summary += "**Sources:**\n";
                            results.slice(0, 3).forEach(function (r, i) {
                                summary += "\u2022 [".concat(r.title, "](").concat(r.url, ")\n");
                            });
                            insight = answer;
                        }
                        else {
                            // For complex queries, show detailed findings
                            summary = "\uD83D\uDD0D **Research: ".concat(query, "**\n\n");
                            summary += "**Key Findings:**\n";
                            results.slice(0, 5).forEach(function (r, i) {
                                summary += "".concat(i + 1, ". **").concat(r.title, "**").concat(r.age ? " _(".concat(r.age, ")_") : '', "\n");
                                summary += "   ".concat(r.description, "\n\n");
                            });
                            summary += "**Sources:**\n";
                            results.forEach(function (r, i) {
                                // Make links clickable
                                summary += "[".concat(i + 1, ". ").concat(r.title, "](").concat(r.url, ")\n");
                            });
                            // Build insight from top descriptions
                            insight = results.slice(0, 3).map(function (r) { return r.description; }).join(' ');
                        }
                    }
                    else {
                        summary = "No results found for \"".concat(query, "\". Try rephrasing your search.");
                        insight = 'No relevant information found.';
                    }
                    return [2 /*return*/, {
                            summary: summary,
                            insight: insight,
                            results: results,
                            confidence: results.length > 0 ? 0.85 : 0.3,
                            details: {
                                type: 'search',
                                query: query,
                                count: results.length,
                            },
                        }];
            }
        });
    });
}
/**
 * Search for recent news
 */
function searchNews(query) {
    return __awaiter(this, void 0, void 0, function () {
        var fallbackResult, results, summary;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("[Seeker] Searching news: \"".concat(query, "\""));
                    return [4 /*yield*/, brave_search_1.default.search(query, {
                            count: 5,
                            freshness: 'pw', // Past week
                        })];
                case 1:
                    fallbackResult = _b.sent();
                    results = fallbackResult.results;
                    summary = "\uD83D\uDCF0 **Latest News: ".concat(query, "**\n\n");
                    if (results.length > 0) {
                        results.forEach(function (r, i) {
                            summary += "".concat(i + 1, ". **").concat(r.title, "**\n");
                            summary += "   ".concat(r.description, "\n");
                            if (r.age)
                                summary += "   _".concat(r.age, "_\n");
                            summary += "\n";
                        });
                        // Add clickable sources section
                        summary += "**Sources:**\n";
                        results.forEach(function (r, i) {
                            summary += "[".concat(i + 1, ". ").concat(r.title, "](").concat(r.url, ")\n");
                        });
                    }
                    else {
                        summary += 'No recent news found for this topic.\n';
                    }
                    return [2 /*return*/, {
                            summary: summary,
                            insight: ((_a = results[0]) === null || _a === void 0 ? void 0 : _a.description) || 'No recent news available.',
                            results: results,
                            confidence: results.length > 0 ? 0.8 : 0.3,
                            details: {
                                type: 'news',
                                query: query,
                                count: results.length,
                            },
                        }];
            }
        });
    });
}
/**
 * Fact check a claim
 */
function factCheck(query) {
    return __awaiter(this, void 0, void 0, function () {
        var searchResult, results, verdict, allText, summary;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[Seeker] Fact checking: \"".concat(query, "\""));
                    return [4 /*yield*/, braveSearch("".concat(query, " fact check"), 5)];
                case 1:
                    searchResult = _a.sent();
                    results = searchResult.results;
                    verdict = 'unverified';
                    allText = results.map(function (r) { return r.description.toLowerCase(); }).join(' ');
                    if (allText.includes('true') && !allText.includes('false'))
                        verdict = 'true';
                    else if (allText.includes('false') && !allText.includes('true'))
                        verdict = 'false';
                    else if (allText.includes('true') && allText.includes('false'))
                        verdict = 'mixed';
                    summary = "\u2705 **Fact Check: ".concat(query, "**\n\n");
                    summary += "**Verdict**: ".concat(verdict.toUpperCase(), "\n\n");
                    if (results.length > 0) {
                        summary += "**Evidence**:\n";
                        results.slice(0, 3).forEach(function (r, i) {
                            summary += "".concat(i + 1, ". ").concat(r.description, "\n");
                        });
                        summary += "\n**Sources**: ".concat(results.map(function (r) { return r.url; }).join(', '), "\n");
                    }
                    summary += "\n\u26A0\uFE0F *This is an automated check. Verify with primary sources.*";
                    return [2 /*return*/, {
                            summary: summary,
                            insight: "Verdict: ".concat(verdict),
                            results: results,
                            confidence: verdict !== 'unverified' ? 0.7 : 0.4,
                            verdict: verdict,
                            details: {
                                type: 'factcheck',
                                query: query,
                                count: results.length,
                            },
                        }];
            }
        });
    });
}
exports.default = exports.seeker;
