"use strict";
/**
 * MCP Client
 * Model Context Protocol client for connecting to MCP servers
 *
 * Provides standardized tool access via MCP protocol
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
exports.connectToServer = connectToServer;
exports.listTools = listTools;
exports.callTool = callTool;
exports.braveSearch = braveSearch;
exports.fetchUrl = fetchUrl;
exports.closeAll = closeAll;
var index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
var stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
// MCP server configurations
var MCP_SERVERS = {
    'brave-search': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY || '' },
    },
    'fetch': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch'],
    },
    'filesystem': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    },
};
// Cache for connected clients
var clientCache = new Map();
/**
 * Connect to an MCP server
 * @param serverName - Name of the server to connect to
 */
function connectToServer(serverName) {
    return __awaiter(this, void 0, void 0, function () {
        var serverConfig, transport, client, error_1, msg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Check cache first
                    if (clientCache.has(serverName)) {
                        return [2 /*return*/, clientCache.get(serverName)];
                    }
                    serverConfig = MCP_SERVERS[serverName];
                    if (!serverConfig) {
                        console.error("[MCP] Unknown server: ".concat(serverName));
                        return [2 /*return*/, null];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    console.log("[MCP] Connecting to ".concat(serverName, "..."));
                    transport = new stdio_js_1.StdioClientTransport({
                        command: serverConfig.command,
                        args: serverConfig.args,
                        env: __assign(__assign({}, process.env), serverConfig.env),
                    });
                    client = new index_js_1.Client({
                        name: 'hivemind-protocol',
                        version: '1.0.0',
                    }, {
                        capabilities: {},
                    });
                    return [4 /*yield*/, client.connect(transport)];
                case 2:
                    _a.sent();
                    clientCache.set(serverName, client);
                    console.log("[MCP] Connected to ".concat(serverName));
                    return [2 /*return*/, client];
                case 3:
                    error_1 = _a.sent();
                    msg = error_1 instanceof Error ? error_1.message : String(error_1);
                    console.error("[MCP] Failed to connect to ".concat(serverName, ":"), msg);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * List available tools from an MCP server
 * @param serverName - Name of the server
 */
function listTools(serverName) {
    return __awaiter(this, void 0, void 0, function () {
        var client, result, error_2, msg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, connectToServer(serverName)];
                case 1:
                    client = _a.sent();
                    if (!client)
                        return [2 /*return*/, []];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, client.listTools()];
                case 3:
                    result = _a.sent();
                    return [2 /*return*/, result.tools.map(function (t) { return ({
                            name: t.name,
                            description: t.description || '',
                            inputSchema: t.inputSchema,
                        }); })];
                case 4:
                    error_2 = _a.sent();
                    msg = error_2 instanceof Error ? error_2.message : String(error_2);
                    console.error("[MCP] Failed to list tools from ".concat(serverName, ":"), msg);
                    return [2 /*return*/, []];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Call a tool on an MCP server with timeout protection
 * @param serverName - Name of the server
 * @param toolName - Name of the tool
 * @param args - Tool arguments
 * @param timeoutMs - Timeout in milliseconds (default: 30s)
 */
function callTool(serverName_1, toolName_1, args_1) {
    return __awaiter(this, arguments, void 0, function (serverName, toolName, args, timeoutMs) {
        var client, timeoutPromise, callPromise, result, textContent, error_3, msg;
        if (timeoutMs === void 0) { timeoutMs = 30000; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, connectToServer(serverName)];
                case 1:
                    client = _a.sent();
                    if (!client) {
                        throw new Error("Could not connect to MCP server: ".concat(serverName));
                    }
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    console.log("[MCP] Calling ".concat(serverName, "/").concat(toolName, " with:"), args);
                    timeoutPromise = new Promise(function (_, reject) {
                        return setTimeout(function () { return reject(new Error("MCP tool call timed out after ".concat(timeoutMs, "ms"))); }, timeoutMs);
                    });
                    callPromise = client.callTool({
                        name: toolName,
                        arguments: args,
                    });
                    return [4 /*yield*/, Promise.race([callPromise, timeoutPromise])];
                case 3:
                    result = _a.sent();
                    // Extract text content from result
                    if (result.content && Array.isArray(result.content)) {
                        textContent = result.content
                            .filter(function (c) { return c.type === 'text'; })
                            .map(function (c) { return c.text; })
                            .join('\n');
                        // Try to parse as JSON if it looks like JSON
                        if (textContent.startsWith('{') || textContent.startsWith('[')) {
                            try {
                                return [2 /*return*/, JSON.parse(textContent)];
                            }
                            catch (_b) {
                                return [2 /*return*/, textContent];
                            }
                        }
                        return [2 /*return*/, textContent];
                    }
                    return [2 /*return*/, result];
                case 4:
                    error_3 = _a.sent();
                    msg = error_3 instanceof Error ? error_3.message : String(error_3);
                    console.error("[MCP] Tool call failed:", msg);
                    throw error_3;
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Brave Search via MCP
 */
function braveSearch(query_1) {
    return __awaiter(this, arguments, void 0, function (query, count) {
        var error_4;
        if (count === void 0) { count = 5; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, callTool('brave-search', 'brave_web_search', {
                            query: query,
                            count: Math.min(count, 20)
                        })];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_4 = _a.sent();
                    console.log('[MCP] Brave search failed, using fallback');
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Fetch URL content via MCP
 */
function fetchUrl(url, maxLength) {
    return __awaiter(this, void 0, void 0, function () {
        var error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, callTool('fetch', 'fetch', {
                            url: url,
                            max_length: maxLength || 50000,
                        })];
                case 1: return [2 /*return*/, (_a.sent())];
                case 2:
                    error_5 = _a.sent();
                    console.log('[MCP] Fetch failed:', error_5.message);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Close all MCP connections
 */
function closeAll() {
    return __awaiter(this, void 0, void 0, function () {
        var _i, clientCache_1, _a, name_1, client, error_6;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _i = 0, clientCache_1 = clientCache;
                    _b.label = 1;
                case 1:
                    if (!(_i < clientCache_1.length)) return [3 /*break*/, 6];
                    _a = clientCache_1[_i], name_1 = _a[0], client = _a[1];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, client.close()];
                case 3:
                    _b.sent();
                    console.log("[MCP] Closed connection to ".concat(name_1));
                    return [3 /*break*/, 5];
                case 4:
                    error_6 = _b.sent();
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6:
                    clientCache.clear();
                    return [2 /*return*/];
            }
        });
    });
}
exports.default = {
    connectToServer: connectToServer,
    listTools: listTools,
    callTool: callTool,
    braveSearch: braveSearch,
    fetchUrl: fetchUrl,
    closeAll: closeAll,
};
