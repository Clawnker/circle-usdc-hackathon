"use strict";
/**
 * Magos Specialist
 * Expert in predictions and market analysis
 * Uses MoltX API for social trends + Jupiter for real-time price data + Brave for deep analysis
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.magos = void 0;
var axios_1 = require("axios");
var config_1 = require("../config");
var brave_search_1 = require("./tools/brave-search");
var llm_client_1 = require("../llm-client");
var MOLTX_API = 'https://moltx.io/v1';
var MOLTX_KEY = ((_a = config_1.default.specialists.moltx) === null || _a === void 0 ? void 0 : _a.apiKey) || process.env.MOLTX_API_KEY;
var JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';
var TOKEN_ALIASES = {
    'bitcoin': 'BTC', 'btc': 'BTC',
    'ethereum': 'ETH', 'eth': 'ETH', 'ether': 'ETH',
    'solana': 'SOL', 'sol': 'SOL',
    'usdc': 'USDC', 'usdt': 'USDT',
    'base': 'BASE', 'polygon': 'MATIC', 'avalanche': 'AVAX',
};
var TOKEN_MINTS = {
    'SOL': 'So11111111111111111111111111111111111111112',
    'BTC': '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', // WBTC (Portal)
    'ETH': '7vf79GH2nU78W973sRbeXfTPhEAtRPRQ8vKyS5FmP9', // WETH
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    'BONK': 'DezXAZ8z7Pnrn9jzX7BSS4CR1GY8PV2Swbe3PZimbUmA',
    'WIF': 'EKpQGSJtjMFqKZ9KQanCDT7YV3dQrN5ifR8n2An36S31',
    'JUP': 'JUPyiwrYJFskR4ZBvMmcuyMvM8FmNdxUuzpzp7L6z8v',
    'POPCAT': '7GCih6mSgSwwZ9Y9CnyTmsL7w13r6uunqB7UStyK88w',
};
/**
 * Magos specialist handler
 */
exports.magos = {
    name: 'Magos',
    description: 'Market Oracle - real-time predictions, risk analysis, and social trend detection',
    handle: function (prompt) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, maxRetries, attempt, intent, data, _a, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        maxRetries = 2;
                        attempt = 0;
                        _b.label = 1;
                    case 1:
                        if (!(attempt <= maxRetries)) return [3 /*break*/, 20];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 16, , 19]);
                        intent = parseIntent(prompt);
                        data = void 0;
                        _a = intent.type;
                        switch (_a) {
                            case 'trending': return [3 /*break*/, 3];
                            case 'predict': return [3 /*break*/, 5];
                            case 'risk': return [3 /*break*/, 7];
                            case 'analyze': return [3 /*break*/, 9];
                            case 'sentiment': return [3 /*break*/, 11];
                        }
                        return [3 /*break*/, 13];
                    case 3: return [4 /*yield*/, findTrendingTokens(prompt)];
                    case 4:
                        data = _b.sent();
                        return [3 /*break*/, 15];
                    case 5: return [4 /*yield*/, predictPrice(intent.token || 'SOL', intent.timeHorizon || '4h')];
                    case 6:
                        data = _b.sent();
                        return [3 /*break*/, 15];
                    case 7: return [4 /*yield*/, assessRisk(intent.token || 'SOL')];
                    case 8:
                        data = _b.sent();
                        return [3 /*break*/, 15];
                    case 9: return [4 /*yield*/, analyzeToken(intent.token || 'SOL')];
                    case 10:
                        data = _b.sent();
                        return [3 /*break*/, 15];
                    case 11: return [4 /*yield*/, analyzeSentiment(intent.token || prompt)];
                    case 12:
                        data = _b.sent();
                        return [3 /*break*/, 15];
                    case 13: return [4 /*yield*/, generateInsight(prompt)];
                    case 14:
                        data = _b.sent();
                        _b.label = 15;
                    case 15:
                        // Add human-readable summary if not present
                        if (!data.summary) {
                            data.summary = buildMagosSummary(data, intent.type);
                        }
                        return [2 /*return*/, {
                                success: true,
                                data: data,
                                confidence: data.confidence || 0.75,
                                timestamp: new Date(),
                                executionTimeMs: Date.now() - startTime,
                            }];
                    case 16:
                        error_1 = _b.sent();
                        console.error("[Magos] Error (attempt ".concat(attempt + 1, "/").concat(maxRetries + 1, "):"), error_1.message);
                        if (!(attempt < maxRetries)) return [3 /*break*/, 18];
                        console.log("[Magos] Retrying in 1s...");
                        return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1000); })];
                    case 17:
                        _b.sent();
                        return [3 /*break*/, 19];
                    case 18: return [2 /*return*/, {
                            success: false,
                            data: { error: 'An error occurred during market analysis.' },
                            timestamp: new Date(),
                            executionTimeMs: Date.now() - startTime,
                        }];
                    case 19:
                        attempt++;
                        return [3 /*break*/, 1];
                    case 20: 
                    // Should never reach here, but TypeScript needs it
                    return [2 /*return*/, { success: false, data: { error: 'Unexpected error' }, timestamp: new Date(), executionTimeMs: Date.now() - startTime }];
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
    // Extract token mention using alias map
    var token;
    for (var _i = 0, _a = Object.entries(TOKEN_ALIASES); _i < _a.length; _i++) {
        var _b = _a[_i], alias = _b[0], symbol = _b[1];
        if (new RegExp("\\b".concat(alias, "\\b"), 'i').test(lower)) {
            token = symbol;
            break;
        }
    }
    // Fallback to regex
    if (!token) {
        var tokenMatch = prompt.match(/\b(SOL|BTC|ETH|BONK|WIF|JUP|POPCAT|PEPE|DOGE|[A-Za-z0-9]{32,44})\b/i);
        token = tokenMatch ? tokenMatch[1].toUpperCase() : undefined;
    }
    // Time horizon
    var timeMatch = prompt.match(/(\d+)\s*(h|hour|hr|d|day|w|week|m|min)/i);
    var timeHorizon = '4h';
    if (timeMatch) {
        var num = parseInt(timeMatch[1]);
        var unit = timeMatch[2].toLowerCase();
        if (unit.startsWith('h'))
            timeHorizon = "".concat(num, "h");
        else if (unit.startsWith('d'))
            timeHorizon = "".concat(num, "d");
        else if (unit.startsWith('w'))
            timeHorizon = "".concat(num, "w");
    }
    // Intent detection
    if (lower.includes('trending') || lower.includes('meme coin') || (lower.includes('find') && lower.includes('coin'))) {
        return { type: 'trending' };
    }
    if (lower.includes('sentiment') || lower.includes('bullish') || lower.includes('bearish')) {
        return { type: token ? 'sentiment' : 'insight', token: token };
    }
    if (lower.includes('predict') || lower.includes('forecast')) {
        return { type: token ? 'predict' : 'insight', token: token, timeHorizon: timeHorizon };
    }
    if (lower.includes('price') && token) {
        return { type: 'predict', token: token, timeHorizon: timeHorizon };
    }
    if (lower.includes('risk') || lower.includes('safe') || lower.includes('rug')) {
        return { type: token ? 'risk' : 'insight', token: token };
    }
    if (lower.includes('analyze') || lower.includes('analysis')) {
        return { type: token ? 'analyze' : 'insight', token: token };
    }
    return { type: 'insight', token: token, timeHorizon: timeHorizon };
}
/**
 * CoinGecko ID mapping for major tokens (free API, no key needed)
 */
var COINGECKO_IDS = {
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana',
    'USDC': 'usd-coin', 'USDT': 'tether', 'BONK': 'bonk',
    'WIF': 'dogwifcoin', 'JUP': 'jupiter-exchange-solana',
    'DOGE': 'dogecoin', 'PEPE': 'pepe', 'AVAX': 'avalanche-2',
    'MATIC': 'matic-network', 'BASE': 'base-protocol',
};
/**
 * Helper to get price — tries CoinGecko first for major tokens, Jupiter as fallback
 */
function getJupiterPrice(token) {
    return __awaiter(this, void 0, void 0, function () {
        var upperToken, mint, geckoId, response, price, err_1, response, data, err_2;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    upperToken = token.toUpperCase();
                    mint = TOKEN_MINTS[upperToken] || (token.length >= 32 ? token : null);
                    geckoId = COINGECKO_IDS[upperToken];
                    if (!geckoId) return [3 /*break*/, 4];
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1.default.get("https://api.coingecko.com/api/v3/simple/price?ids=".concat(geckoId, "&vs_currencies=usd"), { timeout: 5000 })];
                case 2:
                    response = _d.sent();
                    price = (_a = response.data[geckoId]) === null || _a === void 0 ? void 0 : _a.usd;
                    if (price && price > 0.001) {
                        console.log("[Magos] CoinGecko price for ".concat(token, ": $").concat(price));
                        return [2 /*return*/, { price: price, mint: mint || upperToken }];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _d.sent();
                    console.log("[Magos] CoinGecko error for ".concat(token, ":"), err_1.message);
                    return [3 /*break*/, 4];
                case 4:
                    if (!mint) return [3 /*break*/, 8];
                    _d.label = 5;
                case 5:
                    _d.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, axios_1.default.get("".concat(JUPITER_PRICE_API, "?ids=").concat(mint), { timeout: 5000 })];
                case 6:
                    response = _d.sent();
                    data = (_c = (_b = response.data) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c[mint];
                    if (data && data.price && parseFloat(data.price) > 0.001) {
                        console.log("[Magos] Jupiter price for ".concat(token, ": $").concat(data.price));
                        return [2 /*return*/, { price: parseFloat(data.price), mint: mint }];
                    }
                    return [3 /*break*/, 8];
                case 7:
                    err_2 = _d.sent();
                    console.log("[Magos] Jupiter price fetch error:", err_2.message);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/, null];
            }
        });
    });
}
/**
 * Call LLM or Search for analysis
 */
function callLLM(systemPrompt, userPrompt) {
    return __awaiter(this, void 0, void 0, function () {
        var e_1, search;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, llm_client_1.chatText)(systemPrompt, userPrompt, {
                            model: llm_client_1.MODELS.fast,
                            caller: 'magos',
                            temperature: 0.7,
                            maxTokens: 500,
                        })];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    e_1 = _a.sent();
                    console.log('[Magos] LLM failed:', e_1.message);
                    return [3 /*break*/, 3];
                case 3: return [4 /*yield*/, (0, brave_search_1.braveSearch)(userPrompt)];
                case 4:
                    search = _a.sent();
                    return [2 /*return*/, search.results.map(function (r) { return r.description; }).join(' ').slice(0, 1000) || "Data unavailable."];
            }
        });
    });
}
/**
 * Find trending tokens from MoltX + Brave
 */
function findTrendingTokens(query) {
    return __awaiter(this, void 0, void 0, function () {
        var feedRes, posts, tokenMentions, tokenRegex, _i, posts_1, post, content, matches, _a, matches_1, match, t, sorted, trending, err_3, search, insight;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('[Magos] Searching for trending tokens...');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1.default.get("".concat(MOLTX_API, "/feed/global?limit=50"))];
                case 2:
                    feedRes = _c.sent();
                    posts = ((_b = feedRes.data) === null || _b === void 0 ? void 0 : _b.posts) || [];
                    tokenMentions = {};
                    tokenRegex = /\$([A-Z]{2,10})\b/g;
                    for (_i = 0, posts_1 = posts; _i < posts_1.length; _i++) {
                        post = posts_1[_i];
                        content = post.content || '';
                        matches = content.matchAll(tokenRegex);
                        for (_a = 0, matches_1 = matches; _a < matches_1.length; _a++) {
                            match = matches_1[_a];
                            t = match[1].toUpperCase();
                            tokenMentions[t] = (tokenMentions[t] || 0) + 1;
                        }
                    }
                    sorted = Object.entries(tokenMentions)
                        .sort(function (_a, _b) {
                        var a = _a[1];
                        var b = _b[1];
                        return b - a;
                    })
                        .slice(0, 5);
                    if (sorted.length > 0) {
                        trending = sorted.map(function (_a) {
                            var token = _a[0], mentions = _a[1];
                            return ({
                                token: token,
                                mentions: mentions,
                                sentiment: mentions > 3 ? 'bullish' : 'neutral'
                            });
                        });
                        return [2 /*return*/, {
                                insight: "\uD83D\uDD25 **Trending on MoltX:** ".concat(trending.map(function (t) { return "$".concat(t.token, " (").concat(t.mentions, " mentions)"); }).join(', '), "."),
                                confidence: 0.85,
                                trending: trending,
                                relatedTokens: trending.map(function (t) { return t.token; })
                            }];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_3 = _c.sent();
                    console.log('[Magos] MoltX error, falling back to search');
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, (0, brave_search_1.braveSearch)("trending crypto tokens solana right now")];
                case 5:
                    search = _c.sent();
                    return [4 /*yield*/, callLLM("Identify trending crypto tokens from these search results and provide a summary.", search.results.map(function (r) { return r.description; }).join('\n'))];
                case 6:
                    insight = _c.sent();
                    return [2 /*return*/, {
                            insight: "\uD83D\uDCCA **Market Trends:** ".concat(insight),
                            confidence: 0.7,
                            trending: [],
                            relatedTokens: []
                        }];
            }
        });
    });
}
/**
 * Analyze sentiment
 */
function analyzeSentiment(tokenOrQuery) {
    return __awaiter(this, void 0, void 0, function () {
        var sanitizedQuery, search, analysis, lower, sentiment;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[Magos] Analyzing sentiment for: ".concat(tokenOrQuery));
                    sanitizedQuery = tokenOrQuery.replace(/[^a-zA-Z0-9$ ]/g, ' ').trim();
                    return [4 /*yield*/, (0, brave_search_1.braveSearch)("".concat(sanitizedQuery, " crypto sentiment news"))];
                case 1:
                    search = _a.sent();
                    return [4 /*yield*/, callLLM("Analyze the sentiment (bullish, bearish, or neutral) for the following topic and provide a brief explanation.", "Topic: ".concat(tokenOrQuery, "\n\nSearch Results: ").concat(search.results.map(function (r) { return r.description; }).join('\n')))];
                case 2:
                    analysis = _a.sent();
                    lower = analysis.toLowerCase();
                    sentiment = lower.includes('bullish') ? 'bullish' : lower.includes('bearish') ? 'bearish' : 'neutral';
                    return [2 /*return*/, {
                            insight: analysis,
                            confidence: 0.8,
                            sentiment: sentiment,
                            score: sentiment === 'bullish' ? 0.5 : sentiment === 'bearish' ? -0.5 : 0,
                            relatedTokens: [tokenOrQuery.toUpperCase()]
                        }];
            }
        });
    });
}
/**
 * Price prediction
 */
function predictPrice() {
    return __awaiter(this, arguments, void 0, function (token, timeHorizon) {
        var jup, currentPrice, search, _i, _a, result, text, match, parsed, sentimentData, direction, multiplier, predictedPrice, reasoning;
        if (token === void 0) { token = 'SOL'; }
        if (timeHorizon === void 0) { timeHorizon = '4h'; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("[Magos] Predicting price for ".concat(token));
                    return [4 /*yield*/, getJupiterPrice(token)];
                case 1:
                    jup = _b.sent();
                    currentPrice = jup === null || jup === void 0 ? void 0 : jup.price;
                    if (!!currentPrice) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, brave_search_1.braveSearch)("".concat(token, " crypto price usd today"))];
                case 2:
                    search = _b.sent();
                    // Try multiple result snippets for price extraction
                    for (_i = 0, _a = search.results.slice(0, 5); _i < _a.length; _i++) {
                        result = _a[_i];
                        text = (result.description || '') + ' ' + (result.title || '');
                        match = text.match(/\$\s?([0-9]{1,3}(?:,\d{3})*(?:\.\d+)?)/);
                        if (match) {
                            parsed = parseFloat(match[1].replace(/,/g, ''));
                            if (parsed > 0.001) {
                                currentPrice = parsed;
                                console.log("[Magos] Brave Search price for ".concat(token, ": $").concat(parsed));
                                break;
                            }
                        }
                    }
                    _b.label = 3;
                case 3:
                    if (!currentPrice) {
                        throw new Error("Real-time price for ".concat(token, " unavailable."));
                    }
                    return [4 /*yield*/, analyzeSentiment(token)];
                case 4:
                    sentimentData = _b.sent();
                    direction = (sentimentData.sentiment === 'neutral' ? 'bullish' : sentimentData.sentiment);
                    multiplier = direction === 'bullish' ? 1.05 : direction === 'bearish' ? 0.95 : 1.0;
                    predictedPrice = currentPrice * multiplier;
                    return [4 /*yield*/, callLLM("Provide a price prediction reasoning for ".concat(token, " over ").concat(timeHorizon, " based on this sentiment and current price."), "Token: ".concat(token, ", Price: $").concat(currentPrice, ", Sentiment: ").concat(sentimentData.insight))];
                case 5:
                    reasoning = _b.sent();
                    return [2 /*return*/, {
                            token: token,
                            currentPrice: currentPrice,
                            predictedPrice: predictedPrice,
                            timeHorizon: timeHorizon,
                            confidence: 0.8,
                            direction: direction,
                            reasoning: reasoning
                        }];
            }
        });
    });
}
/**
 * Risk Assessment
 */
function assessRisk() {
    return __awaiter(this, arguments, void 0, function (token) {
        var search, analysis, lower, riskLevel;
        if (token === void 0) { token = 'SOL'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, brave_search_1.braveSearch)("".concat(token, " crypto risk assessment security audit rug"))];
                case 1:
                    search = _a.sent();
                    return [4 /*yield*/, callLLM("Assess the risk level (low, medium, high, or extreme) for the following token and list key factors.", "Token: ".concat(token, "\n\nSearch Results: ").concat(search.results.map(function (r) { return r.description; }).join('\n')))];
                case 2:
                    analysis = _a.sent();
                    lower = analysis.toLowerCase();
                    riskLevel = lower.includes('extreme') ? 'extreme' : lower.includes('high') ? 'high' : lower.includes('low') ? 'low' : 'medium';
                    return [2 /*return*/, {
                            token: token,
                            riskLevel: riskLevel,
                            riskScore: riskLevel === 'low' ? 20 : riskLevel === 'medium' ? 50 : riskLevel === 'high' ? 80 : 95,
                            factors: [analysis],
                            insight: "**".concat(token, " Risk Assessment:** ").concat(analysis),
                            confidence: 0.85,
                            relatedTokens: [token]
                        }];
            }
        });
    });
}
/**
 * Deep Analysis
 */
function analyzeToken() {
    return __awaiter(this, arguments, void 0, function (token) {
        var prediction, risk;
        if (token === void 0) { token = 'SOL'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, predictPrice(token, '24h')];
                case 1:
                    prediction = _a.sent();
                    return [4 /*yield*/, assessRisk(token)];
                case 2:
                    risk = _a.sent();
                    return [2 /*return*/, {
                            token: token,
                            insight: "**".concat(token, " Deep Analysis:**\n\n").concat(prediction.reasoning, "\n\n**Risk Profile:** ").concat(risk.riskLevel.toUpperCase(), " - ").concat(risk.insight),
                            prediction: prediction,
                            risk: risk,
                            confidence: 0.85,
                            relatedTokens: [token]
                        }];
            }
        });
    });
}
/**
 * General Insight
 */
function generateInsight(prompt) {
    return __awaiter(this, void 0, void 0, function () {
        var insight;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, callLLM("You are Magos, a market oracle. Analyze the user query and provide a professional crypto market insight.", prompt)];
                case 1:
                    insight = _a.sent();
                    return [2 /*return*/, {
                            insight: insight,
                            confidence: 0.9,
                            relatedTokens: []
                        }];
            }
        });
    });
}
/**
 * Build a human-readable summary from structured Magos data
 */
function buildMagosSummary(data, intentType) {
    var _a, _b, _c, _d, _e;
    if (data.insight && intentType !== 'predict')
        return data.insight;
    switch (intentType) {
        case 'predict': {
            var dir = data.direction === 'bullish' ? '📈' : data.direction === 'bearish' ? '📉' : '➡️';
            var token = data.token || 'Token';
            var price = data.currentPrice ? "$".concat(Number(data.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : 'N/A';
            var predicted = data.predictedPrice ? "$".concat(Number(data.predictedPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '';
            var change = data.currentPrice && data.predictedPrice
                ? ((data.predictedPrice - data.currentPrice) / data.currentPrice * 100).toFixed(1)
                : null;
            var summary = "".concat(dir, " **").concat(token, "** is currently at **").concat(price, "**");
            if (predicted && change) {
                summary += " | ".concat(data.timeHorizon || '4h', " target: **").concat(predicted, "** (").concat(Number(change) > 0 ? '+' : '').concat(change, "%)");
            }
            summary += "\n\n**Outlook:** ".concat((_a = data.direction) === null || _a === void 0 ? void 0 : _a.charAt(0).toUpperCase()).concat(((_b = data.direction) === null || _b === void 0 ? void 0 : _b.slice(1)) || 'Neutral');
            if (data.reasoning)
                summary += "\n\n".concat(data.reasoning);
            return summary;
        }
        case 'risk':
            return "\u26A0\uFE0F **".concat(data.token, " Risk Assessment:** ").concat(((_c = data.riskLevel) === null || _c === void 0 ? void 0 : _c.toUpperCase()) || '?', " (").concat(data.riskScore || '?', "/100)\n\n").concat(((_d = data.factors) === null || _d === void 0 ? void 0 : _d[0]) || '');
        case 'trending': {
            if (!((_e = data.trending) === null || _e === void 0 ? void 0 : _e.length))
                return data.insight || 'No trending data available.';
            var lines = data.trending.map(function (t) { return "\u2022 **$".concat(t.token, "** \u2014 ").concat(t.mentions, " mentions (").concat(t.sentiment, ")"); });
            return "\uD83D\uDD25 **Trending Tokens**\n\n".concat(lines.join('\n'));
        }
        case 'sentiment':
            return data.insight || "Sentiment for ".concat(data.token, ": ").concat(data.sentiment || 'neutral');
        default:
            return data.insight || data.reasoning || data.analysis || JSON.stringify(data);
    }
}
exports.default = exports.magos;
