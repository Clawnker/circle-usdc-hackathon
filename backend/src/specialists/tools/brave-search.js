"use strict";
/**
 * Brave Search Tool
 * Provides web search capabilities via Brave Search API
 * Supports both Web Search and Data for AI endpoints
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
exports.braveAISearch = braveAISearch;
exports.braveSearch = braveSearch;
var axios_1 = require("axios");
// Use environment variables
var BRAVE_API_KEY = process.env.BRAVE_API_KEY || '';
var BRAVE_AI_API_KEY = process.env.BRAVE_AI_API_KEY || '';
var BRAVE_WEB_URL = 'https://api.search.brave.com/res/v1/web/search';
var BRAVE_AI_URL = 'https://api.search.brave.com/res/v1/summarizer/search';
/**
 * Strip HTML tags and decode entities from text
 */
function stripHtml(html) {
    return html
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&#(\d+);/g, function (_, code) { return String.fromCharCode(parseInt(code, 10)); })
        .replace(/&#x([0-9a-fA-F]+);/g, function (_, code) { return String.fromCharCode(parseInt(code, 16)); })
        .trim();
}
/**
 * Search using Brave's Data for AI (summarizer) - best for agents
 * Note: Summarizer requires a two-step process, falling back to web search
 */
function braveAISearch(query_1) {
    return __awaiter(this, arguments, void 0, function (query, options) {
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            // The summarizer API requires a key from web search first
            // For simplicity, use web search directly which gives good results
            console.log('[Brave] Using web search (summarizer requires 2-step flow)');
            return [2 /*return*/, braveSearch(query, options)];
        });
    });
}
/**
 * Search the web using Brave Search API
 */
function braveSearch(query_1) {
    return __awaiter(this, arguments, void 0, function (query, options) {
        var startTime, count, response, webResults, error_1;
        var _a, _b;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    startTime = Date.now();
                    count = options.count || 5;
                    // If no API key, return mock results
                    if (!BRAVE_API_KEY) {
                        console.log('[Brave] No API key, using mock search');
                        return [2 /*return*/, mockSearch(query, count, startTime)];
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1.default.get(BRAVE_WEB_URL, {
                            headers: {
                                'Accept': 'application/json',
                                'X-Subscription-Token': BRAVE_API_KEY,
                            },
                            params: {
                                q: query,
                                count: count,
                                freshness: options.freshness,
                                country: options.country || 'us',
                            },
                        })];
                case 2:
                    response = _c.sent();
                    webResults = ((_a = response.data.web) === null || _a === void 0 ? void 0 : _a.results) || [];
                    return [2 /*return*/, {
                            query: query,
                            results: webResults.map(function (r) { return ({
                                title: stripHtml(r.title || ''),
                                url: r.url,
                                description: stripHtml(r.description || ''),
                                age: r.age,
                            }); }),
                            totalResults: ((_b = response.data.web) === null || _b === void 0 ? void 0 : _b.count) || webResults.length,
                            searchTimeMs: Date.now() - startTime,
                        }];
                case 3:
                    error_1 = _c.sent();
                    console.error('[Brave] Search error:', error_1.message);
                    return [2 /*return*/, mockSearch(query, count, startTime)];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Mock search for demo/fallback
 */
function mockSearch(query, count, startTime) {
    var lowerQuery = query.toLowerCase();
    // Generate contextual mock results based on query
    var results = [];
    if (lowerQuery.includes('solana') || lowerQuery.includes('sol')) {
        results = [
            {
                title: 'Solana: Web3 Infrastructure for Everyone',
                url: 'https://solana.com',
                description: 'Solana is a high-performance blockchain supporting builders around the world creating crypto apps.',
                age: '1 day ago',
            },
            {
                title: 'Solana Price, SOL Chart, and Market Cap | CoinGecko',
                url: 'https://coingecko.com/en/coins/solana',
                description: 'Get Solana price, SOL chart, trading volume, market cap, and more.',
                age: '2 hours ago',
            },
            {
                title: 'Solana Ecosystem - DeFi, NFTs, and More',
                url: 'https://solana.com/ecosystem',
                description: 'Explore the Solana ecosystem of decentralized apps, DeFi protocols, and NFT marketplaces.',
                age: '3 days ago',
            },
        ];
    }
    else if (lowerQuery.includes('firedancer')) {
        results = [
            {
                title: 'Firedancer: A New Solana Validator Client by Jump Crypto',
                url: 'https://jumpcrypto.com/firedancer',
                description: 'Firedancer is a new, independent Solana validator client being built by Jump Crypto to increase network resilience.',
                age: '1 week ago',
            },
            {
                title: 'Firedancer Testnet Achieves 1M+ TPS',
                url: 'https://theblock.co/post/firedancer-testnet',
                description: 'Jump Crypto\'s Firedancer validator client demonstrates unprecedented transaction throughput on testnet.',
                age: '3 days ago',
            },
        ];
    }
    else if (lowerQuery.includes('mountain') || lowerQuery.includes('everest')) {
        results = [
            {
                title: 'Mount Everest - Wikipedia',
                url: 'https://en.wikipedia.org/wiki/Mount_Everest',
                description: 'Mount Everest is Earth\'s highest mountain above sea level, located in the Mahalangur Himal sub-range of the Himalayas.',
                age: '1 month ago',
            },
            {
                title: 'Mount Everest | Height, Location, Map, & Facts | Britannica',
                url: 'https://britannica.com/place/Mount-Everest',
                description: 'Mount Everest, mountain on the crest of the Great Himalayas of southern Asia. Height: 29,032 feet (8,849 meters).',
                age: '2 weeks ago',
            },
        ];
    }
    else if (lowerQuery.includes('capital') && lowerQuery.includes('france')) {
        results = [
            {
                title: 'Paris - Capital of France - Wikipedia',
                url: 'https://en.wikipedia.org/wiki/Paris',
                description: 'Paris is the capital and most populous city of France. With an estimated population of 2.1 million in the city proper and over 12 million in the metropolitan area.',
                age: '1 week ago',
            },
            {
                title: 'Paris | History, Geography, Facts | Britannica',
                url: 'https://britannica.com/place/Paris',
                description: 'Paris, capital city of France, located in north-central France along the Seine River. One of the world\'s most visited cities.',
                age: '2 weeks ago',
            },
        ];
    }
    else if (lowerQuery.includes('capital')) {
        // Generic capital question - extract country
        var capitals = {
            'germany': { capital: 'Berlin', info: 'Berlin is the capital and largest city of Germany with 3.6 million residents.' },
            'japan': { capital: 'Tokyo', info: 'Tokyo is the capital of Japan and the world\'s most populous metropolitan area.' },
            'uk': { capital: 'London', info: 'London is the capital and largest city of England and the United Kingdom.' },
            'italy': { capital: 'Rome', info: 'Rome is the capital of Italy, known for its ancient history and architecture.' },
            'spain': { capital: 'Madrid', info: 'Madrid is the capital and most populous city of Spain.' },
            'canada': { capital: 'Ottawa', info: 'Ottawa is the capital of Canada, located in Ontario.' },
            'australia': { capital: 'Canberra', info: 'Canberra is the capital of Australia, planned as a purpose-built capital.' },
            'brazil': { capital: 'Brasília', info: 'Brasília is the federal capital of Brazil, inaugurated in 1960.' },
            'china': { capital: 'Beijing', info: 'Beijing is the capital of China and the world\'s most populous national capital.' },
            'india': { capital: 'New Delhi', info: 'New Delhi is the capital of India, serving as the seat of government.' },
        };
        var foundCapital = null;
        for (var _i = 0, _a = Object.entries(capitals); _i < _a.length; _i++) {
            var _b = _a[_i], country = _b[0], data = _b[1];
            if (lowerQuery.includes(country)) {
                foundCapital = __assign({ country: country }, data);
                break;
            }
        }
        if (foundCapital) {
            results = [
                {
                    title: "".concat(foundCapital.capital, " - Capital of ").concat(foundCapital.country.charAt(0).toUpperCase() + foundCapital.country.slice(1)),
                    url: "https://en.wikipedia.org/wiki/".concat(foundCapital.capital),
                    description: foundCapital.info,
                    age: '1 week ago',
                },
            ];
        }
    }
    else if (lowerQuery.includes('bitcoin') || lowerQuery.includes('btc')) {
        results = [
            {
                title: 'Bitcoin - Wikipedia',
                url: 'https://en.wikipedia.org/wiki/Bitcoin',
                description: 'Bitcoin is a decentralized digital currency created in 2009 by pseudonymous developer Satoshi Nakamoto.',
                age: '1 day ago',
            },
            {
                title: 'Bitcoin Price | BTC Price Index | CoinGecko',
                url: 'https://coingecko.com/en/coins/bitcoin',
                description: 'Get the latest Bitcoin price, BTC market cap, trading pairs, charts and data.',
                age: '1 hour ago',
            },
        ];
    }
    else if (lowerQuery.includes('ethereum') || lowerQuery.includes('eth')) {
        results = [
            {
                title: 'Ethereum - Wikipedia',
                url: 'https://en.wikipedia.org/wiki/Ethereum',
                description: 'Ethereum is a decentralized blockchain platform featuring smart contract functionality, founded by Vitalik Buterin.',
                age: '2 days ago',
            },
        ];
    }
    else {
        // Generic results
        results = [
            {
                title: "Search results for: ".concat(query),
                url: "https://example.com/search?q=".concat(encodeURIComponent(query)),
                description: "Information about ".concat(query, ". This is a mock result for demonstration purposes."),
                age: '1 day ago',
            },
            {
                title: "".concat(query, " - Latest News and Updates"),
                url: "https://news.example.com/".concat(query.replace(/\s+/g, '-').toLowerCase()),
                description: "Stay updated with the latest news about ".concat(query, "."),
                age: '6 hours ago',
            },
        ];
    }
    return {
        query: query,
        results: results.slice(0, count),
        totalResults: results.length,
        searchTimeMs: Date.now() - startTime,
    };
}
exports.default = {
    search: braveSearch,
};
