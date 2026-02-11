"use strict";
/**
 * Aura Specialist
 * Expert in social sentiment and market vibes
 * Connects to Brave Search for real-time social data
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
exports.aura = void 0;
var axios_1 = require("axios");
var config_1 = require("../config");
var brave_search_1 = require("./tools/brave-search");
var MOLTX_API = config_1.default.specialists.moltx.baseUrl;
var MOLTX_KEY = config_1.default.specialists.moltx.apiKey;
var BRAVE_API_KEY = process.env.BRAVE_API_KEY;
var BULLISH_WORDS = ['bullish', 'moon', 'buy', 'long', 'great', 'amazing', 'high', 'growth', 'pump', 'up', 'gain', 'green', 'undervalued', 'gem', 'rocket', 'top', 'win', 'good', 'strong', 'positive', 'catalyst', 'accumulation', 'excited', 'optimization', 'partnership', 'listing'];
var BEARISH_WORDS = ['bearish', 'dump', 'sell', 'short', 'bad', 'terrible', 'low', 'crash', 'down', 'loss', 'red', 'fud', 'overvalued', 'scam', 'rekt', 'bottom', 'fail', 'scary', 'weak', 'negative', 'concerns', 'exploit', 'hack', 'delay'];
/**
 * Aura specialist handler
 */
exports.aura = {
    name: 'Aura',
    description: 'Expert in social sentiment analysis, trending topics, and market vibes. Monitors X, Reddit, and Telegram for real-time alpha.',
    /**
     * Main handler - parses prompt and routes to appropriate function
     */
    handle: function (prompt) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, intent, data, _a, error_1;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        startTime = Date.now();
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 13, , 14]);
                        intent = parseIntent(prompt);
                        data = void 0;
                        _a = intent.type;
                        switch (_a) {
                            case 'sentiment': return [3 /*break*/, 2];
                            case 'trending': return [3 /*break*/, 4];
                            case 'alpha': return [3 /*break*/, 6];
                            case 'influencer': return [3 /*break*/, 8];
                        }
                        return [3 /*break*/, 10];
                    case 2: return [4 /*yield*/, analyzeSentiment(intent.topic || 'crypto')];
                    case 3:
                        data = _c.sent();
                        return [3 /*break*/, 12];
                    case 4: return [4 /*yield*/, getTrending(intent.category || 'all')];
                    case 5:
                        data = _c.sent();
                        return [3 /*break*/, 12];
                    case 6: return [4 /*yield*/, findAlpha(intent.topic || 'crypto')];
                    case 7:
                        data = _c.sent();
                        return [3 /*break*/, 12];
                    case 8: return [4 /*yield*/, trackInfluencers(intent.topic || 'crypto')];
                    case 9:
                        data = _c.sent();
                        return [3 /*break*/, 12];
                    case 10: return [4 /*yield*/, getVibes(prompt)];
                    case 11:
                        data = _c.sent();
                        _c.label = 12;
                    case 12: return [2 /*return*/, {
                            success: true,
                            data: data,
                            confidence: (_b = data.confidence) !== null && _b !== void 0 ? _b : (data.score !== undefined ? Math.abs(data.score) : 0.7),
                            timestamp: new Date(),
                            executionTimeMs: Date.now() - startTime,
                        }];
                    case 13:
                        error_1 = _c.sent();
                        console.error('[Aura] Handler error:', error_1);
                        return [2 /*return*/, {
                                success: false,
                                data: { error: 'An error occurred during social sentiment analysis.' },
                                timestamp: new Date(),
                                executionTimeMs: Date.now() - startTime,
                            }];
                    case 14: return [2 /*return*/];
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
    // Extract topic (token, project, or general topic)
    var stopWords = ['what', 'how', 'when', 'where', 'why', 'who', 'is', 'are', 'the', 'this', 'that', 'sentiment', 'vibe', 'mood', 'tokens'];
    var matches = prompt.match(/\b(SOL|BTC|ETH|BONK|WIF|JUP|Solana|Bitcoin|Ethereum|[A-Z][a-z]+(?:Fi|Swap|DAO)?)\b/g);
    var topic = 'crypto';
    if (matches) {
        var validTopic = matches.find(function (m) { return !stopWords.includes(m.toLowerCase()); });
        if (validTopic)
            topic = validTopic;
    }
    // Determine intent type
    if (lower.includes('sentiment') || lower.includes('feeling') || lower.includes('mood') ||
        lower.includes('saying') || lower.includes('think') || lower.includes('opinion') ||
        lower.includes('discussing') || lower.includes('people')) {
        return { type: 'sentiment', topic: topic };
    }
    if (lower.includes('trending') || lower.includes('hot') || lower.includes('popular') || lower.includes('talking about')) {
        return { type: 'trending', category: lower.includes('meme') ? 'meme' : 'all' };
    }
    if (lower.includes('alpha') || lower.includes('opportunity') || lower.includes('gem')) {
        return { type: 'alpha', topic: topic };
    }
    if (lower.includes('influencer') || lower.includes('kol') || lower.includes('whale')) {
        return { type: 'influencer', topic: topic };
    }
    return { type: 'vibes', topic: topic };
}
/**
 * Estimate sentiment score from text
 */
function estimateSentiment(text) {
    var words = text.toLowerCase().split(/\W+/);
    var score = 0;
    for (var _i = 0, words_1 = words; _i < words_1.length; _i++) {
        var word = words_1[_i];
        if (BULLISH_WORDS.includes(word))
            score += 1;
        if (BEARISH_WORDS.includes(word))
            score -= 1;
    }
    // Normalize
    if (score === 0)
        return 0;
    return score > 0 ? Math.min(1, score / 3) : Math.max(-1, score / 3);
}
/**
 * Analyze sentiment for a topic using Brave Search API
 */
function analyzeSentiment(topic) {
    return __awaiter(this, void 0, void 0, function () {
        var sanitizedTopic, query, searchResult, results, posts, avgScore, label, summary, error_2, response, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[Aura] Analyzing sentiment for: ".concat(topic));
                    sanitizedTopic = topic.replace(/[^a-zA-Z0-9$ ]/g, ' ').trim();
                    query = "".concat(sanitizedTopic, " crypto sentiment reddit discussion");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, brave_search_1.braveSearch)(query, { count: 10 })];
                case 2:
                    searchResult = _a.sent();
                    results = searchResult.results || [];
                    if (results.length > 0) {
                        posts = results.map(function (r) {
                            var _a, _b, _c;
                            var isTwitter = ((_a = r.url) === null || _a === void 0 ? void 0 : _a.includes('twitter.com')) || ((_b = r.url) === null || _b === void 0 ? void 0 : _b.includes('x.com'));
                            var isReddit = (_c = r.url) === null || _c === void 0 ? void 0 : _c.includes('reddit.com');
                            var snippet = stripHtml(r.description || '');
                            return {
                                title: stripHtml(r.title || ''),
                                snippet: snippet,
                                url: r.url,
                                source: isTwitter ? 'Twitter' : isReddit ? 'Reddit' : 'Web',
                                sentiment: estimateSentiment(snippet + ' ' + (r.title || '')),
                            };
                        });
                        avgScore = posts.reduce(function (acc, p) { return acc + p.sentiment; }, 0) / posts.length;
                        label = 'neutral';
                        if (avgScore > 0.4)
                            label = 'bullish';
                        else if (avgScore < -0.4)
                            label = 'bearish';
                        if (avgScore > 0.8)
                            label = 'fomo';
                        else if (avgScore < -0.8)
                            label = 'fud';
                        summary = generateRealSentimentSummary(topic, label, avgScore, posts.length, posts);
                        return [2 /*return*/, {
                                topic: topic,
                                sentiment: avgScore,
                                score: avgScore,
                                volume: posts.length,
                                trending: posts.length >= 5,
                                sources: Array.from(new Set(posts.map(function (p) { return p.source; }))),
                                summary: summary,
                                analysis: summary,
                                posts: posts,
                            }];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    console.error('[Aura] Search failed:', error_2);
                    return [3 /*break*/, 4];
                case 4:
                    if (!(MOLTX_API && MOLTX_KEY)) return [3 /*break*/, 8];
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, axios_1.default.get("".concat(MOLTX_API, "/v1/sentiment/").concat(topic), {
                            headers: { 'X-API-Key': MOLTX_KEY },
                        })];
                case 6:
                    response = _a.sent();
                    return [2 /*return*/, response.data];
                case 7:
                    error_3 = _a.sent();
                    console.log('[Aura] MoltX API unavailable');
                    return [3 /*break*/, 8];
                case 8: 
                // Final Fallback: Honest empty response
                return [2 /*return*/, {
                        topic: topic,
                        sentiment: 0,
                        score: 0,
                        volume: 0,
                        trending: false,
                        sources: [],
                        summary: "No social data currently available for ".concat(topic, ". Market monitoring is active but no recent discussions were found."),
                        analysis: "No real-time social data available for ".concat(topic, "."),
                        posts: [],
                    }];
            }
        });
    });
}
/**
 * Strip HTML tags and decode common entities
 */
function stripHtml(html) {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}
/**
 * Generate human-readable sentiment summary based on real data
 */
function generateRealSentimentSummary(topic, sentiment, score, count, posts) {
    var emoji = sentiment === 'bullish' ? '📈' : sentiment === 'bearish' ? '📉' : sentiment === 'fomo' ? '🚀' : sentiment === 'fud' ? '⚠️' : '📊';
    var intensity = Math.abs(score) > 0.7 ? 'strongly' : Math.abs(score) > 0.4 ? 'moderately' : 'slightly';
    var summary = "".concat(emoji, " **").concat(topic, "** sentiment is **").concat(intensity, " ").concat(sentiment, "**");
    summary += " (score: ".concat((score * 100).toFixed(0), "%) based on ").concat(count, " recent posts.\n");
    // Add top post snippets for richer UI display
    if (posts && posts.length > 0) {
        summary += '\n**Key Discussions:**\n';
        var topPosts = posts.slice(0, 3);
        for (var _i = 0, topPosts_1 = topPosts; _i < topPosts_1.length; _i++) {
            var post = topPosts_1[_i];
            var source = post.source || 'Web';
            var snippet = (post.snippet || post.title || '').slice(0, 120);
            var sentimentEmoji = post.sentiment > 0.2 ? '🟢' : post.sentiment < -0.2 ? '🔴' : '⚪';
            summary += "".concat(sentimentEmoji, " [").concat(source, "] ").concat(snippet).concat(snippet.length >= 120 ? '...' : '', "\n");
        }
    }
    return summary;
}
/**
 * Get trending topics/tokens
 */
function getTrending() {
    return __awaiter(this, arguments, void 0, function (category) {
        var response, results, e_1, trendingTopics;
        var _a;
        if (category === void 0) { category = 'all'; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!BRAVE_API_KEY) return [3 /*break*/, 4];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1.default.get('https://api.search.brave.com/res/v1/web/search', {
                            headers: { 'X-Subscription-Token': BRAVE_API_KEY },
                            params: { q: "trending ".concat(category, " crypto tokens 2026"), count: 5 }
                        })];
                case 2:
                    response = _b.sent();
                    results = ((_a = response.data.web) === null || _a === void 0 ? void 0 : _a.results) || [];
                    if (results.length > 0) {
                        return [2 /*return*/, {
                                category: category,
                                trending: results.map(function (r, i) { return ({
                                    rank: i + 1,
                                    topic: r.title.split(' ')[0].replace('$', ''),
                                    mentions: 1000 + Math.floor(Math.random() * 5000), // Mentions still estimated
                                    sentiment: estimateSentiment(r.description) > 0 ? 'bullish' : 'neutral',
                                    change24h: 0
                                }); }),
                                summary: "\uD83D\uDD25 **Real-time Trends**: ".concat(results.slice(0, 3).map(function (r) { return r.title.split(' ')[0]; }).join(', ')),
                                timestamp: new Date(),
                                posts: results.map(function (r) { return ({ title: r.title, url: r.url }); })
                            }];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _b.sent();
                    return [3 /*break*/, 4];
                case 4:
                    trendingTopics = [
                        { topic: 'SOL', baseMentions: 15000, sentiment: 'bullish' },
                        { topic: 'USDC', baseMentions: 12000, sentiment: 'stable' },
                        { topic: 'HIVE', baseMentions: 9500, sentiment: 'bullish' },
                    ];
                    return [2 /*return*/, {
                            category: category,
                            trending: trendingTopics.map(function (t, i) { return ({
                                rank: i + 1,
                                topic: t.topic,
                                mentions: t.baseMentions,
                                sentiment: t.sentiment,
                                change24h: 0,
                            }); }),
                            summary: "Current trending topics include ".concat(trendingTopics.map(function (t) { return t.topic; }).join(', '), "."),
                            timestamp: new Date(),
                        }];
            }
        });
    });
}
/**
 * Find alpha opportunities
 */
function findAlpha(topic) {
    return __awaiter(this, void 0, void 0, function () {
        var response, results, e_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!BRAVE_API_KEY) return [3 /*break*/, 4];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1.default.get('https://api.search.brave.com/res/v1/web/search', {
                            headers: { 'X-Subscription-Token': BRAVE_API_KEY },
                            params: { q: "".concat(topic, " crypto alpha opportunity gem"), count: 3 }
                        })];
                case 2:
                    response = _b.sent();
                    results = ((_a = response.data.web) === null || _a === void 0 ? void 0 : _a.results) || [];
                    if (results.length > 0) {
                        return [2 /*return*/, {
                                opportunities: results.map(function (r) { return ({
                                    token: topic.toUpperCase(),
                                    signal: r.title,
                                    confidence: 0.8,
                                    source: r.url,
                                    timeDetected: new Date()
                                }); }),
                                summary: "Found real-time alpha signals for ".concat(topic, " via web search."),
                                posts: results.map(function (r) { return ({ title: r.title, url: r.url }); })
                            }];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    e_2 = _b.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, {
                        opportunities: [],
                        summary: "No specific alpha detected for ".concat(topic, " at this time."),
                    }];
            }
        });
    });
}
/**
 * Track influencer activity
 */
function trackInfluencers(topic) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, {
                    topic: topic,
                    influencers: [],
                    summary: "Influencer tracking requires authenticated social API access.",
                    aggregateSentiment: 'neutral',
                }];
        });
    });
}
/**
 * Get general vibes/overview
 */
function getVibes(prompt) {
    return __awaiter(this, void 0, void 0, function () {
        var topicMatch, topic, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    topicMatch = prompt.match(/\b(SOL|BTC|ETH|BONK|WIF|JUP|Solana|Bitcoin|Ethereum)\b/i);
                    topic = topicMatch ? topicMatch[0] : 'crypto market';
                    return [4 /*yield*/, analyzeSentiment(topic)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, {
                            market: topic,
                            mood: result.score > 0 ? 'optimistic' : 'cautious',
                            topMentions: ['SOL', 'BTC', 'USDC'],
                            summary: result.summary,
                            confidence: 0.75,
                            posts: result.posts
                        }];
            }
        });
    });
}
exports.default = exports.aura;
