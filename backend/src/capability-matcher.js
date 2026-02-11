"use strict";
/**
 * Capability-Based Matching Engine
 * Matches user intents to agent capabilities using semantic vector similarity and scoring.
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
exports.capabilityMatcher = exports.CapabilityMatcher = exports.EmbeddingService = void 0;
var fs = require("fs");
var path = require("path");
var external_agents_1 = require("./external-agents");
var reputation_1 = require("./reputation");
var price_router_1 = require("./price-router");
var config_1 = require("./config");
var llm_client_1 = require("./llm-client");
var DATA_DIR = path.join(__dirname, '../data');
var EMBEDDINGS_FILE = path.join(DATA_DIR, 'embeddings.json');
var MANIFESTS_DIR = path.join(__dirname, 'specialists/manifests');
/**
 * Service for generating text embeddings using Gemini
 */
var EmbeddingService = /** @class */ (function () {
    function EmbeddingService() {
        this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    }
    /**
     * Generate an embedding vector for a given text
     */
    EmbeddingService.prototype.generateEmbedding = function (text) {
        return __awaiter(this, void 0, void 0, function () {
            var fetch, url, response, error, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.apiKey) {
                            throw new Error('GEMINI_API_KEY not configured');
                        }
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('node-fetch'); })];
                    case 1:
                        fetch = (_a.sent()).default;
                        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=".concat(this.apiKey);
                        return [4 /*yield*/, fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    model: 'models/gemini-embedding-001',
                                    content: { parts: [{ text: text }] }
                                }),
                            })];
                    case 2:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, response.text()];
                    case 3:
                        error = _a.sent();
                        throw new Error("Gemini Embedding API error: ".concat(response.status, " ").concat(error));
                    case 4: return [4 /*yield*/, response.json()];
                    case 5:
                        data = _a.sent();
                        return [2 /*return*/, data.embedding.values];
                }
            });
        });
    };
    /**
     * Batch generate embeddings
     */
    EmbeddingService.prototype.generateBatchEmbeddings = function (texts) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                // Gemini supports batch embedding calls, but for simplicity we'll do them sequentially or in small groups
                // given the scale of our agents.
                return [2 /*return*/, Promise.all(texts.map(function (text) { return _this.generateEmbedding(text); }))];
            });
        });
    };
    return EmbeddingService;
}());
exports.EmbeddingService = EmbeddingService;
/**
 * Main Capability Matching Engine
 */
var CapabilityMatcher = /** @class */ (function () {
    function CapabilityMatcher() {
        this.vectorStore = new Map(); // agentId -> vectors[]
        this.specialistManifests = new Map();
        this.embeddingService = new EmbeddingService();
        this.loadManifests();
        this.loadEmbeddings();
        // Background sync of missing embeddings
        this.initializeEmbeddings().catch(function (err) { return console.error('[CapabilityMatcher] Init failed:', err); });
    }
    /**
     * Ensure all specialists and external agents have embeddings
     */
    CapabilityMatcher.prototype.initializeEmbeddings = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, _b, id, capabilities, externalAgents, _c, externalAgents_1, agent;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: 
                    // Wait for a few seconds to let everything load
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                    case 1:
                        // Wait for a few seconds to let everything load
                        _d.sent();
                        console.log('[CapabilityMatcher] Checking for missing embeddings...');
                        _i = 0, _a = this.specialistManifests.entries();
                        _d.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        _b = _a[_i], id = _b[0], capabilities = _b[1];
                        if (!!this.vectorStore.has(id)) return [3 /*break*/, 4];
                        console.log("[CapabilityMatcher] Generating embeddings for built-in: ".concat(id));
                        return [4 /*yield*/, this.syncAgentEmbeddings(id, capabilities)];
                    case 3:
                        _d.sent();
                        _d.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        externalAgents = (0, external_agents_1.getExternalAgents)();
                        _c = 0, externalAgents_1 = externalAgents;
                        _d.label = 6;
                    case 6:
                        if (!(_c < externalAgents_1.length)) return [3 /*break*/, 9];
                        agent = externalAgents_1[_c];
                        if (!!this.vectorStore.has(agent.id)) return [3 /*break*/, 8];
                        console.log("[CapabilityMatcher] Generating embeddings for external: ".concat(agent.id));
                        return [4 /*yield*/, this.syncAgentEmbeddings(agent.id, agent.structuredCapabilities)];
                    case 7:
                        _d.sent();
                        _d.label = 8;
                    case 8:
                        _c++;
                        return [3 /*break*/, 6];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load specialist manifests from disk
     */
    CapabilityMatcher.prototype.loadManifests = function () {
        try {
            if (!fs.existsSync(MANIFESTS_DIR)) {
                fs.mkdirSync(MANIFESTS_DIR, { recursive: true });
                return;
            }
            var files = fs.readdirSync(MANIFESTS_DIR);
            for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
                var file = files_1[_i];
                if (file.endsWith('.json')) {
                    var specialistId = file.replace('.json', '');
                    var manifest = JSON.parse(fs.readFileSync(path.join(MANIFESTS_DIR, file), 'utf8'));
                    this.specialistManifests.set(specialistId, manifest);
                }
            }
            console.log("[CapabilityMatcher] Loaded ".concat(this.specialistManifests.size, " specialist manifests"));
        }
        catch (err) {
            console.error('[CapabilityMatcher] Failed to load manifests:', err);
        }
    };
    /**
     * Load embeddings from persistence
     */
    CapabilityMatcher.prototype.loadEmbeddings = function () {
        try {
            if (fs.existsSync(EMBEDDINGS_FILE)) {
                var data = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf8'));
                for (var _i = 0, _a = Object.entries(data); _i < _a.length; _i++) {
                    var _b = _a[_i], agentId = _b[0], vectors = _b[1];
                    this.vectorStore.set(agentId, vectors);
                }
                console.log("[CapabilityMatcher] Loaded embeddings for ".concat(this.vectorStore.size, " agents"));
            }
        }
        catch (err) {
            console.error('[CapabilityMatcher] Failed to load embeddings:', err);
        }
    };
    /**
     * Save embeddings to disk
     */
    CapabilityMatcher.prototype.saveEmbeddings = function () {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }
            var data = Object.fromEntries(this.vectorStore);
            fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
        }
        catch (err) {
            console.error('[CapabilityMatcher] Failed to save embeddings:', err);
        }
    };
    /**
     * Extract user intent from prompt using LLM
     */
    CapabilityMatcher.prototype.extractIntent = function (prompt) {
        return __awaiter(this, void 0, void 0, function () {
            var systemPrompt, data, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        systemPrompt = "You are an Intent Extractor for Hivemind Protocol.\nYour goal is to transform a raw user prompt into a structured Intent Object.\n\nAvailable categories: defi, security, social, research, dev, generic\n\nReturn ONLY a JSON object in this format:\n{\n  \"category\": \"category_name\",\n  \"requiredCapabilities\": [\"semantic description of needed capability\", ...],\n  \"constraints\": {\n    \"maxFee\": number,\n    \"preferredNetwork\": \"string\",\n    \"minSuccessRate\": number\n  },\n  \"entities\": {\n    \"tokens\": [\"SYMBOL\", ...],\n    \"addresses\": [\"0x...\", ...],\n    \"protocols\": [\"name\", ...]\n  }\n}\n\nExample: \"Audit this contract 0x123... on Base\"\n{\n  \"category\": \"security\",\n  \"requiredCapabilities\": [\"smart contract security audit\", \"vulnerability scanning\"],\n  \"constraints\": { \"preferredNetwork\": \"base\" },\n  \"entities\": { \"addresses\": [\"0x123...\"] }\n}";
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, llm_client_1.chatJSON)(systemPrompt, prompt, {
                                model: llm_client_1.MODELS.fast,
                                caller: 'capability-matcher',
                                temperature: 0.1,
                                maxTokens: 500,
                            })];
                    case 2:
                        data = (_a.sent()).data;
                        return [2 /*return*/, data];
                    case 3:
                        err_1 = _a.sent();
                        console.error('[CapabilityMatcher] Intent extraction failed:', err_1);
                        return [2 /*return*/, {
                                category: 'generic',
                                requiredCapabilities: ['An internal error occurred during intent extraction.'],
                                constraints: {},
                                entities: {}
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Match agents against user intent
     */
    CapabilityMatcher.prototype.matchAgents = function (intent) {
        return __awaiter(this, void 0, void 0, function () {
            var queryText, queryVector, candidates, builtInAgents, externalAgents, allAgents, _loop_1, this_1, _i, allAgents_1, agent;
            var _this = this;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        queryText = intent.requiredCapabilities.join(' ') + ' ' + intent.category;
                        return [4 /*yield*/, this.embeddingService.generateEmbedding(queryText)];
                    case 1:
                        queryVector = _d.sent();
                        candidates = [];
                        builtInAgents = Array.from(this.specialistManifests.keys());
                        externalAgents = (0, external_agents_1.getExternalAgents)();
                        allAgents = __spreadArray(__spreadArray([], builtInAgents.map(function (id) { return ({ id: id, capabilities: _this.specialistManifests.get(id) || [] }); }), true), externalAgents.map(function (a) { return ({ id: a.id, capabilities: a.structuredCapabilities }); }), true);
                        _loop_1 = function (agent) {
                            var agentVectors = this_1.vectorStore.get(agent.id);
                            if (!agentVectors || agentVectors.length === 0) {
                                return "continue";
                            }
                            // S_semantic: Max cosine similarity
                            var maxSim = 0;
                            var bestCapIdx = -1;
                            for (var i = 0; i < agentVectors.length; i++) {
                                var sim = this_1.cosineSimilarity(queryVector, agentVectors[i]);
                                if (sim > maxSim) {
                                    maxSim = sim;
                                    bestCapIdx = i;
                                }
                            }
                            if (maxSim < 0.75)
                                return "continue"; // Threshold
                            // Determine price for the matched capability
                            var matchedCap = agent.capabilities[bestCapIdx];
                            var capabilityId = matchedCap ? matchedCap.id : 'generic';
                            var agentPrice = 0;
                            if (config_1.config.fees[agent.id] !== undefined) {
                                agentPrice = config_1.config.fees[agent.id];
                            }
                            else {
                                var extAgent_1 = externalAgents.find(function (a) { return a.id === agent.id; });
                                if (extAgent_1) {
                                    agentPrice = (_b = (_a = extAgent_1.pricing[capabilityId]) !== null && _a !== void 0 ? _a : extAgent_1.pricing['generic']) !== null && _b !== void 0 ? _b : 0;
                                }
                            }
                            var marketData = price_router_1.priceRouter.getMarketData(capabilityId);
                            var priceEfficiency = price_router_1.priceRouter.calculatePriceEfficiency(agentPrice, marketData.average);
                            // S_reputation
                            var reputation = (0, reputation_1.getReputationScore)(agent.id);
                            // Phase 2e: Health-Weighted Scoring
                            var extAgent = externalAgents.find(function (a) { return a.id === agent.id; });
                            var isHealthy = extAgent ? extAgent.healthy : true; // Built-in are always healthy
                            // Penalty: If unhealthy, score is 0
                            var healthPenalty = isHealthy ? 1.0 : 0.0;
                            // Latency Penalty: If Latency_avg > Latency_target * 2, reputation is halved
                            // (Target latency is 15s per SPEC-2DE timeout, so penalty if > 30s)
                            // Actually, Capability metrics have p50/p95.
                            var repData = (0, reputation_1.getReputationStats)(agent.id);
                            var capabilities = ((repData === null || repData === void 0 ? void 0 : repData.capabilities) || {});
                            var avgLatency = ((_c = capabilities[capabilityId]) === null || _c === void 0 ? void 0 : _c.p50) || 0;
                            if (avgLatency > 30000) { // 30s threshold
                                reputation *= 0.5;
                            }
                            // Updated weights per SPEC-2DE: semantic 0.4, reputation 0.3, price 0.3
                            var score = ((maxSim * 0.4) + (reputation * 0.3) + (priceEfficiency * 0.3)) * healthPenalty;
                            candidates.push({
                                agentId: agent.id,
                                score: score,
                                confidence: maxSim,
                                reasoning: "Matched via semantic similarity (".concat(maxSim.toFixed(2), "), reputation (").concat(reputation.toFixed(2), "), and price efficiency (").concat(priceEfficiency.toFixed(2), ").")
                            });
                        };
                        this_1 = this;
                        for (_i = 0, allAgents_1 = allAgents; _i < allAgents_1.length; _i++) {
                            agent = allAgents_1[_i];
                            _loop_1(agent);
                        }
                        return [2 /*return*/, candidates.sort(function (a, b) { return b.score - a.score; })];
                }
            });
        });
    };
    /**
     * Generate embeddings for an agent's capabilities
     */
    CapabilityMatcher.prototype.syncAgentEmbeddings = function (agentId, capabilities) {
        return __awaiter(this, void 0, void 0, function () {
            var texts, vectors;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        texts = capabilities.map(function (c) { return "".concat(c.name, ": ").concat(c.description, " (").concat(c.category, ") ").concat(c.subcategories.join(' ')); });
                        return [4 /*yield*/, this.embeddingService.generateBatchEmbeddings(texts)];
                    case 1:
                        vectors = _a.sent();
                        this.vectorStore.set(agentId, vectors);
                        this.saveEmbeddings();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Helper: Cosine Similarity
     */
    CapabilityMatcher.prototype.cosineSimilarity = function (a, b) {
        var dotProduct = 0;
        var mA = 0;
        var mB = 0;
        for (var i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            mA += a[i] * a[i];
            mB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
    };
    return CapabilityMatcher;
}());
exports.CapabilityMatcher = CapabilityMatcher;
// Singleton instance
exports.capabilityMatcher = new CapabilityMatcher();
