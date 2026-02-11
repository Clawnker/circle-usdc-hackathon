"use strict";
/**
 * Solana Integration
 * Handles Solana RPC connections, transaction monitoring via Helius
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
exports.getConnection = getConnection;
exports.testConnection = testConnection;
exports.getBalance = getBalance;
exports.getRecentTransactions = getRecentTransactions;
exports.monitorAddress = monitorAddress;
exports.getTokenAccounts = getTokenAccounts;
exports.getEnhancedTransaction = getEnhancedTransaction;
var web3_js_1 = require("@solana/web3.js");
var axios_1 = require("axios");
var config_1 = require("./config");
// Use devnet for testing, mainnet for production
var DEVNET_RPC = config_1.default.helius.devnet;
var MAINNET_RPC = config_1.default.helius.mainnet;
var devnetConnection = null;
var mainnetConnection = null;
/**
 * Get Solana connection (lazy initialization)
 */
function getConnection(network) {
    if (network === void 0) { network = 'devnet'; }
    if (network === 'devnet') {
        if (!devnetConnection) {
            devnetConnection = new web3_js_1.Connection(DEVNET_RPC, 'confirmed');
        }
        return devnetConnection;
    }
    else {
        if (!mainnetConnection) {
            mainnetConnection = new web3_js_1.Connection(MAINNET_RPC, 'confirmed');
        }
        return mainnetConnection;
    }
}
/**
 * Test connection to Helius RPC
 */
function testConnection() {
    return __awaiter(this, arguments, void 0, function (network) {
        var connection, slot, error_1;
        if (network === void 0) { network = 'devnet'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    connection = getConnection(network);
                    return [4 /*yield*/, connection.getSlot()];
                case 1:
                    slot = _a.sent();
                    console.log("[Helius] Connected to ".concat(network, ", current slot: ").concat(slot));
                    return [2 /*return*/, true];
                case 2:
                    error_1 = _a.sent();
                    console.error("[Helius] Connection failed for ".concat(network, ":"), error_1.message);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get SOL balance for an address
 */
function getBalance(address_1) {
    return __awaiter(this, arguments, void 0, function (address, network) {
        var connection, pubkey, balance, error_2;
        if (network === void 0) { network = 'devnet'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    connection = getConnection(network);
                    pubkey = new web3_js_1.PublicKey(address);
                    return [4 /*yield*/, connection.getBalance(pubkey)];
                case 1:
                    balance = _a.sent();
                    return [2 /*return*/, balance / web3_js_1.LAMPORTS_PER_SOL];
                case 2:
                    error_2 = _a.sent();
                    console.error('[Helius] Failed to get balance:', error_2.message);
                    return [2 /*return*/, 0];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get recent transactions for an address
 */
function getRecentTransactions(address_1) {
    return __awaiter(this, arguments, void 0, function (address, limit, network) {
        var connection, pubkey, signatures, error_3;
        if (limit === void 0) { limit = 10; }
        if (network === void 0) { network = 'devnet'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    connection = getConnection(network);
                    pubkey = new web3_js_1.PublicKey(address);
                    return [4 /*yield*/, connection.getSignaturesForAddress(pubkey, { limit: limit })];
                case 1:
                    signatures = _a.sent();
                    return [2 /*return*/, signatures];
                case 2:
                    error_3 = _a.sent();
                    console.error('[Helius] Failed to get transactions:', error_3.message);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Monitor address for new transactions (webhook-style polling)
 * Returns a function to stop monitoring
 */
function monitorAddress(address, callback, intervalMs, network) {
    var _this = this;
    if (intervalMs === void 0) { intervalMs = 5000; }
    if (network === void 0) { network = 'devnet'; }
    var lastSeen = null;
    var check = function () { return __awaiter(_this, void 0, void 0, function () {
        var txs, latest, _i, txs_1, tx, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getRecentTransactions(address, 5, network)];
                case 1:
                    txs = _a.sent();
                    if (txs.length > 0) {
                        latest = txs[0].signature;
                        if (lastSeen && latest !== lastSeen) {
                            // New transaction(s) detected
                            for (_i = 0, txs_1 = txs; _i < txs_1.length; _i++) {
                                tx = txs_1[_i];
                                if (tx.signature === lastSeen)
                                    break;
                                callback(tx);
                            }
                        }
                        lastSeen = latest;
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _a.sent();
                    console.error('[Monitor] Error:', error_4.message);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    // Initial check
    check();
    // Set up polling
    var interval = setInterval(check, intervalMs);
    // Return stop function
    return function () {
        clearInterval(interval);
        console.log("[Monitor] Stopped monitoring ".concat(address));
    };
}
/**
 * Get token accounts for an address using Helius enhanced API
 */
function getTokenAccounts(address_1) {
    return __awaiter(this, arguments, void 0, function (address, network) {
        var rpcUrl, response, error_5;
        var _a;
        if (network === void 0) { network = 'devnet'; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    rpcUrl = network === 'devnet' ? DEVNET_RPC : MAINNET_RPC;
                    return [4 /*yield*/, axios_1.default.post(rpcUrl, {
                            jsonrpc: '2.0',
                            id: 'token-accounts',
                            method: 'getTokenAccountsByOwner',
                            params: [
                                address,
                                { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
                                { encoding: 'jsonParsed' },
                            ],
                        })];
                case 1:
                    response = _b.sent();
                    return [2 /*return*/, ((_a = response.data.result) === null || _a === void 0 ? void 0 : _a.value) || []];
                case 2:
                    error_5 = _b.sent();
                    console.error('[Helius] Failed to get token accounts:', error_5.message);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get transaction details using Helius enhanced transaction API
 */
function getEnhancedTransaction(signature_1) {
    return __awaiter(this, arguments, void 0, function (signature, network) {
        var apiKey, baseUrl, response, error_6;
        if (network === void 0) { network = 'devnet'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    apiKey = config_1.default.helius.apiKey;
                    baseUrl = network === 'devnet'
                        ? 'https://api-devnet.helius.xyz'
                        : 'https://api.helius.xyz';
                    return [4 /*yield*/, axios_1.default.get("".concat(baseUrl, "/v0/transactions/?api-key=").concat(apiKey, "&transactions=").concat(signature))];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.data[0] || null];
                case 2:
                    error_6 = _a.sent();
                    console.error('[Helius] Failed to get enhanced transaction:', error_6.message);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
exports.default = {
    getConnection: getConnection,
    testConnection: testConnection,
    getBalance: getBalance,
    getRecentTransactions: getRecentTransactions,
    monitorAddress: monitorAddress,
    getTokenAccounts: getTokenAccounts,
    getEnhancedTransaction: getEnhancedTransaction,
};
