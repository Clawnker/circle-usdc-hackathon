"use strict";
/**
 * x402 Payment Integration
 * Handles payments through AgentWallet's x402 protocol
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
exports.getBalances = getBalances;
exports.createPaymentRecord = createPaymentRecord;
exports.logTransaction = logTransaction;
exports.getTransactionLog = getTransactionLog;
var axios_1 = require("axios");
var fs = require("fs");
var path = require("path");
var config_1 = require("./config");
var AGENTWALLET_API = config_1.default.agentWallet.apiUrl;
var USERNAME = config_1.default.agentWallet.username;
var TOKEN = config_1.default.agentWallet.token;
// Persistence settings
var DATA_DIR = path.join(__dirname, '../data');
var PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');
/**
 * Check wallet balances before making payments
 */
function getBalances() {
    return __awaiter(this, void 0, void 0, function () {
        var response, data, solanaBalances, solBalance, solUsdcBalance, evmBalances, ethBalance, evmUsdcBalance, evmUsdc, evmEth, treasuryAddress, usdcAddress, paddedAddr, _a, ethRes, usdcRes, rpcErr_1, error_1, treasuryAddress, usdcAddress, paddedAddr, _b, ethRes, usdcRes, _c;
        var _d, _e, _f, _g, _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    _k.trys.push([0, 6, , 11]);
                    return [4 /*yield*/, axios_1.default.get("".concat(AGENTWALLET_API, "/wallets/").concat(USERNAME, "/balances"), {
                            headers: { Authorization: "Bearer ".concat(TOKEN) },
                        })];
                case 1:
                    response = _k.sent();
                    data = response.data;
                    solanaBalances = ((_d = data.solana) === null || _d === void 0 ? void 0 : _d.balances) || [];
                    solBalance = solanaBalances.find(function (b) { return b.asset === 'sol'; });
                    solUsdcBalance = solanaBalances.find(function (b) { return b.asset === 'usdc'; });
                    evmBalances = ((_e = data.evm) === null || _e === void 0 ? void 0 : _e.balances) || [];
                    ethBalance = evmBalances.find(function (b) { return b.chain === 'base' && b.asset === 'eth'; });
                    evmUsdcBalance = evmBalances.find(function (b) { return b.chain === 'base' && b.asset === 'usdc'; });
                    evmUsdc = evmUsdcBalance ? parseFloat(evmUsdcBalance.rawValue) / Math.pow(10, evmUsdcBalance.decimals) : 0;
                    evmEth = ethBalance ? parseFloat(ethBalance.rawValue) / Math.pow(10, ethBalance.decimals) : 0;
                    _k.label = 2;
                case 2:
                    _k.trys.push([2, 4, , 5]);
                    treasuryAddress = process.env.TREASURY_WALLET_EVM || '0x676fF3d546932dE6558a267887E58e39f405B135';
                    usdcAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
                    paddedAddr = treasuryAddress.replace('0x', '').toLowerCase().padStart(64, '0');
                    return [4 /*yield*/, Promise.all([
                            axios_1.default.post('https://sepolia.base.org', {
                                jsonrpc: '2.0', method: 'eth_getBalance',
                                params: [treasuryAddress, 'latest'], id: 1
                            }),
                            axios_1.default.post('https://sepolia.base.org', {
                                jsonrpc: '2.0', method: 'eth_call',
                                params: [{ to: usdcAddress, data: "0x70a08231".concat(paddedAddr) }, 'latest'], id: 2
                            })
                        ])];
                case 3:
                    _a = _k.sent(), ethRes = _a[0], usdcRes = _a[1];
                    evmEth = parseInt(((_f = ethRes.data) === null || _f === void 0 ? void 0 : _f.result) || '0x0', 16) / 1e18;
                    evmUsdc = parseInt(((_g = usdcRes.data) === null || _g === void 0 ? void 0 : _g.result) || '0x0', 16) / 1e6;
                    console.log("[Wallet] On-chain Base Sepolia balance: ".concat(evmEth, " ETH, ").concat(evmUsdc, " USDC"));
                    return [3 /*break*/, 5];
                case 4:
                    rpcErr_1 = _k.sent();
                    console.error('[Wallet] Base Sepolia RPC fallback failed:', rpcErr_1.message);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/, {
                        solana: {
                            sol: solBalance ? parseFloat(solBalance.rawValue) / Math.pow(10, solBalance.decimals) : 0,
                            usdc: solUsdcBalance ? parseFloat(solUsdcBalance.rawValue) / Math.pow(10, solUsdcBalance.decimals) : 0,
                        },
                        evm: {
                            eth: evmEth,
                            usdc: evmUsdc,
                        },
                    }];
                case 6:
                    error_1 = _k.sent();
                    console.error('Failed to get balances:', error_1.message);
                    _k.label = 7;
                case 7:
                    _k.trys.push([7, 9, , 10]);
                    treasuryAddress = process.env.TREASURY_WALLET_EVM || '0x676fF3d546932dE6558a267887E58e39f405B135';
                    usdcAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
                    paddedAddr = treasuryAddress.replace('0x', '').toLowerCase().padStart(64, '0');
                    return [4 /*yield*/, Promise.all([
                            axios_1.default.post('https://sepolia.base.org', {
                                jsonrpc: '2.0', method: 'eth_getBalance',
                                params: [treasuryAddress, 'latest'], id: 1
                            }),
                            axios_1.default.post('https://sepolia.base.org', {
                                jsonrpc: '2.0', method: 'eth_call',
                                params: [{ to: usdcAddress, data: "0x70a08231".concat(paddedAddr) }, 'latest'], id: 2
                            })
                        ])];
                case 8:
                    _b = _k.sent(), ethRes = _b[0], usdcRes = _b[1];
                    return [2 /*return*/, {
                            solana: { sol: 0, usdc: 0 },
                            evm: {
                                eth: parseInt(((_h = ethRes.data) === null || _h === void 0 ? void 0 : _h.result) || '0x0', 16) / 1e18,
                                usdc: parseInt(((_j = usdcRes.data) === null || _j === void 0 ? void 0 : _j.result) || '0x0', 16) / 1e6,
                            },
                        }];
                case 9:
                    _c = _k.sent();
                    return [2 /*return*/, {
                            solana: { sol: 0, usdc: 0 },
                            evm: { eth: 0, usdc: 0 },
                        }];
                case 10: return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    });
}
/**
 * Create a payment record for logging
 */
function createPaymentRecord(amount, currency, network, recipient, txHash, method) {
    return {
        amount: amount,
        currency: currency,
        network: network,
        recipient: recipient,
        txHash: txHash,
        status: txHash ? 'completed' : 'pending',
        timestamp: new Date(),
        method: method,
    };
}
/**
 * Log transaction for audit trail
 */
var transactionLog = [];
/**
 * Load payments from disk
 */
function loadPayments() {
    try {
        if (fs.existsSync(PAYMENTS_FILE)) {
            var data = fs.readFileSync(PAYMENTS_FILE, 'utf8');
            var parsed = JSON.parse(data);
            parsed.forEach(function (p) {
                p.timestamp = new Date(p.timestamp);
                transactionLog.push(p);
            });
            console.log("[x402] Loaded ".concat(transactionLog.length, " payments from persistence"));
        }
    }
    catch (error) {
        console.error("[x402] Failed to load payments:", error.message);
    }
}
/**
 * Save payments to disk
 */
function savePayments() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(transactionLog, null, 2), 'utf8');
    }
    catch (error) {
        console.error("[x402] Failed to save payments:", error.message);
    }
}
// Initial load
loadPayments();
function logTransaction(record) {
    transactionLog.push(record);
    savePayments();
    console.log("[Payment] ".concat(record.status, ": ").concat(record.amount, " ").concat(record.currency, " on ").concat(record.network));
    if (record.txHash) {
        console.log("  TxHash: ".concat(record.txHash));
    }
}
function getTransactionLog() {
    return __spreadArray([], transactionLog, true);
}
exports.default = {
    getBalances: getBalances,
    createPaymentRecord: createPaymentRecord,
    logTransaction: logTransaction,
    getTransactionLog: getTransactionLog,
};
