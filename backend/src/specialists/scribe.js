"use strict";
/**
 * Scribe Specialist
 * Knowledge synthesis, summarization, and explanation
 * Upgraded to use Gemini Flash + Brave Search for dynamic, data-driven responses
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
exports.scribe = void 0;
var fs = require("fs");
var path = require("path");
var brave_search_1 = require("./tools/brave-search");
var llm_client_1 = require("../llm-client");
// Load system prompt
var PROMPT_PATH = path.join(__dirname, 'prompts', 'scribe.md');
var systemPrompt = '';
try {
    systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8');
}
catch (e) {
    console.log('[Scribe] Could not load system prompt');
    systemPrompt = "You are Scribe, a knowledge synthesis expert. Your goal is to provide accurate, well-structured summaries, explanations, and documentation.";
}
exports.scribe = {
    name: 'Scribe',
    description: 'Knowledge synthesizer for summaries, explanations, and documentation (Powered by Gemini)',
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
                        _b.trys.push([1, 15, , 16]);
                        intent = parseIntent(prompt);
                        data = void 0;
                        _a = intent.type;
                        switch (_a) {
                            case 'synthesize': return [3 /*break*/, 2];
                            case 'summarize': return [3 /*break*/, 4];
                            case 'explain': return [3 /*break*/, 6];
                            case 'document': return [3 /*break*/, 8];
                            case 'draft': return [3 /*break*/, 10];
                        }
                        return [3 /*break*/, 12];
                    case 2: return [4 /*yield*/, synthesize(prompt)];
                    case 3:
                        data = _b.sent();
                        return [3 /*break*/, 14];
                    case 4: return [4 /*yield*/, summarize(intent.content || intent.topic)];
                    case 5:
                        data = _b.sent();
                        return [3 /*break*/, 14];
                    case 6: return [4 /*yield*/, explain(intent.topic, intent.audience)];
                    case 7:
                        data = _b.sent();
                        return [3 /*break*/, 14];
                    case 8: return [4 /*yield*/, document(intent.topic)];
                    case 9:
                        data = _b.sent();
                        return [3 /*break*/, 14];
                    case 10: return [4 /*yield*/, draft(intent.topic, intent.format)];
                    case 11:
                        data = _b.sent();
                        return [3 /*break*/, 14];
                    case 12: return [4 /*yield*/, generalAssist(prompt)];
                    case 13:
                        data = _b.sent();
                        _b.label = 14;
                    case 14: return [2 /*return*/, {
                            success: true,
                            data: data,
                            confidence: data.confidence || 0.9,
                            timestamp: new Date(),
                            executionTimeMs: Date.now() - startTime,
                        }];
                    case 15:
                        error_1 = _b.sent();
                        console.error('[Scribe] Error:', error_1.message);
                        return [2 /*return*/, {
                                success: false,
                                data: { error: "An error occurred during knowledge synthesis: ".concat(error_1.message) },
                                timestamp: new Date(),
                                executionTimeMs: Date.now() - startTime,
                            }];
                    case 16: return [2 /*return*/];
                }
            });
        });
    },
};
/**
 * Call LLM via unified client
 */
function callLLM(task_1, userContent_1) {
    return __awaiter(this, arguments, void 0, function (task, userContent, context) {
        var fullPrompt;
        if (context === void 0) { context = ''; }
        return __generator(this, function (_a) {
            fullPrompt = "\n".concat(systemPrompt, "\n\nCurrent Task: ").concat(task, "\n\n").concat(context ? "### Context/Sources:\n".concat(context, "\n") : '', "\n\n### User Input:\n<user_input>\n").concat(userContent, "\n</user_input>\n\nWrite the actual content directly. Do NOT include meta-commentary like \"Here is a draft\" or \"Created a report about...\".\nStart with the content itself. Use Markdown for formatting. Be concise and professional.\nIf sources were provided, include citations at the end.\n");
            return [2 /*return*/, (0, llm_client_1.chatText)('', fullPrompt, {
                    model: llm_client_1.MODELS.fast,
                    caller: 'scribe',
                    temperature: 0.3,
                    maxTokens: 4096,
                })];
        });
    });
}
/**
 * Parse user intent from prompt
 */
function parseIntent(prompt) {
    var lower = prompt.toLowerCase();
    // Detect synthesis patterns for multi-hop DAG results
    var synthesisPatterns = [
        '{{step-',
        'based on the following data',
        'synthesize',
        'combine these results',
        'analyze the results from',
        '"data": {',
        '"results": ['
    ];
    if (synthesisPatterns.some(function (p) { return lower.includes(p); }) || (prompt.length > 500 && (prompt.includes('{') || prompt.includes('[')))) {
        return { type: 'synthesize', topic: 'Data Synthesis' };
    }
    // Extract the main topic/content
    var topic = prompt;
    if (lower.includes('summarize') || lower.includes('summary') || lower.includes('tldr')) {
        // Extract content to summarize (everything after the keyword)
        var content = prompt.replace(/^.*?(summarize|summary|tldr)[:\s]*/i, '').trim();
        return { type: 'summarize', topic: topic, content: content || topic };
    }
    if (lower.includes('explain') || lower.includes('what is') || lower.includes('how does')) {
        var audience = lower.includes('eli5') || lower.includes('simple') ? 'beginner' :
            lower.includes('technical') || lower.includes('developer') ? 'technical' : 'general';
        topic = prompt.replace(/^.*?(explain|what is|how does)\s*/i, '').replace(/\?$/, '').trim();
        return { type: 'explain', topic: topic, audience: audience };
    }
    if (lower.includes('document') || lower.includes('docs') || lower.includes('write docs')) {
        topic = prompt.replace(/^.*?(document|docs|write docs)\s*/i, '').trim();
        return { type: 'document', topic: topic };
    }
    if (lower.includes('draft') || lower.includes('write') || lower.includes('compose')) {
        var format = lower.includes('email') ? 'email' :
            lower.includes('tweet') || lower.includes('post') ? 'social' :
                lower.includes('message') ? 'message' : 'general';
        topic = prompt.replace(/^.*?(draft|write|compose)\s*/i, '').trim();
        return { type: 'draft', topic: topic, format: format };
    }
    return { type: 'general', topic: topic };
}
/**
 * Synthesize pre-collected data from prior steps
 */
function synthesize(data) {
    return __awaiter(this, void 0, void 0, function () {
        var synthesis;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[Scribe] Synthesizing pre-collected data (".concat(data.length, " chars)"));
                    return [4 /*yield*/, callLLM('You are Scribe, a knowledge synthesis expert. You have been provided with data from previous steps in a pipeline. ' +
                            'Your goal is to synthesize this information into a coherent, well-structured response. ' +
                            'Analyze the data, extract key insights, and present the findings clearly. ' +
                            'Do NOT perform any external searches. Focus entirely on the provided data.', data)];
                case 1:
                    synthesis = _a.sent();
                    return [2 /*return*/, {
                            summary: synthesis,
                            insight: synthesis.split('\n')[0].replace(/[*#]/g, '').trim().substring(0, 200),
                            confidence: 0.98,
                            details: {
                                type: 'synthesis',
                                dataLength: data.length,
                                response: synthesis,
                            },
                        }];
            }
        });
    });
}
/**
 * Summarize content
 */
function summarize(content) {
    return __awaiter(this, void 0, void 0, function () {
        var summaryText, insight;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("[Scribe] Dynamically summarizing content (".concat(content.length, " chars)"));
                    return [4 /*yield*/, callLLM('Summarize the provided content. Extract key insights and maintain a concise but informative tone.', content)];
                case 1:
                    summaryText = _b.sent();
                    insight = summaryText.split('\n')[0].replace(/[*#]/g, '').trim();
                    return [2 /*return*/, {
                            summary: summaryText,
                            insight: insight,
                            keyPoints: ((_a = summaryText.match(/^[*-] (.*)/gm)) === null || _a === void 0 ? void 0 : _a.map(function (p) { return p.replace(/^[*-] /, ''); })) || [],
                            wordCount: {
                                original: content.split(/\s+/).length,
                                summary: summaryText.split(/\s+/).length,
                            },
                            confidence: 0.95,
                            details: {
                                type: 'summary',
                                response: summaryText,
                            },
                        }];
            }
        });
    });
}
/**
 * Explain a concept with live research
 */
function explain(topic_1) {
    return __awaiter(this, arguments, void 0, function (topic, audience) {
        var search, context, explanation;
        if (audience === void 0) { audience = 'general'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[Scribe] Researching and explaining \"".concat(topic, "\" for ").concat(audience, " audience"));
                    return [4 /*yield*/, (0, brave_search_1.braveSearch)("".concat(topic, " explanation ").concat(audience === 'technical' ? 'technical details architecture' : 'simple terms beginners'))];
                case 1:
                    search = _a.sent();
                    context = search.results.map(function (r) { return "Source: ".concat(r.title, " (").concat(r.url, ")\nSnippet: ").concat(r.description); }).join('\n\n');
                    return [4 /*yield*/, callLLM("Explain the following topic for a ".concat(audience, " audience. Use the provided search results as context and cite sources."), topic, context)];
                case 2:
                    explanation = _a.sent();
                    return [2 /*return*/, {
                            summary: explanation,
                            insight: explanation.split('\n')[0].replace(/[*#]/g, '').trim(),
                            explanation: explanation,
                            examples: explanation.match(/Example: (.*)/g) || [],
                            sources: search.results.map(function (r) { return ({ title: r.title, url: r.url }); }),
                            confidence: 0.92,
                            details: {
                                type: 'explanation',
                                response: explanation,
                            },
                        }];
            }
        });
    });
}
/**
 * Generate documentation
 */
function document(topic) {
    return __awaiter(this, void 0, void 0, function () {
        var search, context, documentation;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[Scribe] Generating dynamic docs for \"".concat(topic, "\""));
                    return [4 /*yield*/, (0, brave_search_1.braveSearch)("".concat(topic, " technical documentation api reference guide"))];
                case 1:
                    search = _a.sent();
                    context = search.results.map(function (r) { return "Reference: ".concat(r.title, " (").concat(r.url, ")\nInfo: ").concat(r.description); }).join('\n\n');
                    return [4 /*yield*/, callLLM("Generate comprehensive, professional documentation for the following topic. Include sections for Overview, Usage, and Examples.", topic, context)];
                case 2:
                    documentation = _a.sent();
                    return [2 /*return*/, {
                            summary: "\uD83D\uDCC4 **Documentation Generated**: ".concat(topic),
                            insight: "Created dynamic documentation for ".concat(topic, " using recent sources"),
                            documentation: documentation,
                            sources: search.results.map(function (r) { return ({ title: r.title, url: r.url }); }),
                            confidence: 0.88,
                            details: {
                                type: 'documentation',
                                response: documentation,
                            },
                        }];
            }
        });
    });
}
/**
 * Draft content
 */
function draft(topic_1) {
    return __awaiter(this, arguments, void 0, function (topic, format) {
        var search, context, draft;
        if (format === void 0) { format = 'general'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[Scribe] Drafting ".concat(format, " about \"").concat(topic, "\""));
                    return [4 /*yield*/, (0, brave_search_1.braveSearch)("".concat(topic, " recent news updates context"))];
                case 1:
                    search = _a.sent();
                    context = search.results.map(function (r) { return "News: ".concat(r.title, "\nContext: ").concat(r.description); }).join('\n\n');
                    return [4 /*yield*/, callLLM("Write a ".concat(format, " based on the topic. Output ONLY the content \u2014 no preamble, no \"here is your draft\", just the actual text. Professional and engaging tone. Incorporate relevant details from context."), topic, context)];
                case 2:
                    draft = _a.sent();
                    return [2 /*return*/, {
                            summary: draft,
                            insight: draft,
                            confidence: 0.9,
                            details: {
                                type: 'draft',
                                format: format,
                                topic: topic,
                            },
                        }];
            }
        });
    });
}
/**
 * General assistance
 */
function generalAssist(prompt) {
    return __awaiter(this, void 0, void 0, function () {
        var search, context, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[Scribe] Dynamic general assist: \"".concat(prompt, "\""));
                    return [4 /*yield*/, (0, brave_search_1.braveSearch)(prompt)];
                case 1:
                    search = _a.sent();
                    context = search.results.map(function (r) { return "Source: ".concat(r.title, "\nSnippet: ").concat(r.description); }).join('\n\n');
                    return [4 /*yield*/, callLLM('You are Scribe, an expert knowledge assistant. Answer the user request accurately and helpfully.', prompt, context)];
                case 2:
                    response = _a.sent();
                    return [2 /*return*/, {
                            summary: response,
                            insight: response,
                            confidence: 0.95,
                            details: {
                                type: 'general',
                                response: response,
                            },
                        }];
            }
        });
    });
}
exports.default = exports.scribe;
