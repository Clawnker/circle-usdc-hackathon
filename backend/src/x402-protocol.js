"use strict";
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
exports.executeDemoPayment = executeDemoPayment;
exports.checkPaymentCost = checkPaymentCost;
var axios_1 = require("axios");
var config_1 = require("./config");
var x402_1 = require("./x402");
var AGENTWALLET_API = 'https://agentwallet.mcpay.tech/api';
/**
 * Fetch the most recent x402 payment event from AgentWallet activity
 */
function getLatestPaymentEvent(username, token) {
    return __awaiter(this, void 0, void 0, function () {
        var response, events, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, axios_1.default.get("".concat(AGENTWALLET_API, "/wallets/").concat(username, "/activity?limit=1"), {
                            headers: { 'Authorization': "Bearer ".concat(token) },
                            timeout: 5000,
                        })];
                case 1:
                    response = _b.sent();
                    events = (_a = response.data) === null || _a === void 0 ? void 0 : _a.events;
                    if (events && events.length > 0 && events[0].eventType === 'x402.fetch.completed') {
                        return [2 /*return*/, {
                                eventId: events[0].id,
                                amount: events[0].amountWithSymbol,
                            }];
                    }
                    return [2 /*return*/, null];
                case 2:
                    error_1 = _b.sent();
                    console.error('[x402] Failed to fetch activity:', error_1);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Execute real x402 payment via AgentWallet's x402/fetch proxy
 * This is the ONE-STEP solution that handles 402 detection, signing, and retry
 */
function executeDemoPayment(specialistEndpoint, // e.g., "http://localhost:3000/api/specialist/aura"
requestBody, amountUsdc) {
    return __awaiter(this, void 0, void 0, function () {
        var username, token, response, payment, latestEvent, receiptId, error_2;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    username = config_1.default.agentWallet.username || 'claw';
                    token = config_1.default.agentWallet.token;
                    if (!token) {
                        console.error('[x402] No AgentWallet token configured');
                        return [2 /*return*/, { success: false }];
                    }
                    console.log("[x402] Calling x402/fetch for: ".concat(specialistEndpoint));
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, axios_1.default.post("".concat(AGENTWALLET_API, "/wallets/").concat(username, "/actions/x402/fetch"), {
                            url: specialistEndpoint,
                            method: 'POST',
                            body: requestBody,
                            // Let AgentWallet auto-select chain based on 402 response payment options
                        }, {
                            headers: {
                                'Authorization': "Bearer ".concat(token),
                                'Content-Type': 'application/json',
                            },
                            timeout: 60000, // 60s timeout
                        })];
                case 2:
                    response = _f.sent();
                    console.log('[x402] Response:', JSON.stringify(response.data).slice(0, 300));
                    if (!(response.data.success && response.data.paid)) return [3 /*break*/, 4];
                    payment = response.data.payment;
                    return [4 /*yield*/, getLatestPaymentEvent(username, token)];
                case 3:
                    latestEvent = _f.sent();
                    receiptId = (latestEvent === null || latestEvent === void 0 ? void 0 : latestEvent.eventId) || response.data.policyEvaluationId || "x402-".concat(Date.now());
                    console.log("[Payment] completed: ".concat(payment === null || payment === void 0 ? void 0 : payment.amountFormatted, " ").concat(payment === null || payment === void 0 ? void 0 : payment.tokenSymbol, " on ").concat(((_a = payment === null || payment === void 0 ? void 0 : payment.chain) === null || _a === void 0 ? void 0 : _a.includes('solana')) ? 'solana' : 'base'));
                    console.log("  Receipt: ".concat(receiptId));
                    console.log("  Verify: https://agentwallet.mcpay.tech/u/".concat(username));
                    // Log the real transaction
                    (0, x402_1.logTransaction)({
                        amount: (payment === null || payment === void 0 ? void 0 : payment.amountFormatted) || amountUsdc.toString(),
                        currency: 'USDC',
                        network: ((_b = payment === null || payment === void 0 ? void 0 : payment.chain) === null || _b === void 0 ? void 0 : _b.includes('solana')) ? 'solana' : 'base',
                        recipient: (payment === null || payment === void 0 ? void 0 : payment.recipient) || 'unknown',
                        txHash: receiptId,
                        status: 'completed',
                        timestamp: new Date(),
                    });
                    return [2 /*return*/, {
                            success: true,
                            txSignature: receiptId,
                            response: (_c = response.data.response) === null || _c === void 0 ? void 0 : _c.body,
                        }];
                case 4:
                    // Payment not required or failed
                    if (response.data.success && !response.data.paid) {
                        console.log('[x402] No payment required for this endpoint');
                        return [2 /*return*/, { success: true, response: (_d = response.data.response) === null || _d === void 0 ? void 0 : _d.body }];
                    }
                    console.error('[x402] Payment failed:', response.data);
                    return [2 /*return*/, { success: false }];
                case 5:
                    error_2 = _f.sent();
                    console.error('[x402] x402/fetch error:', ((_e = error_2.response) === null || _e === void 0 ? void 0 : _e.data) || error_2.message);
                    return [2 /*return*/, { success: false }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Check payment cost without paying (dry run)
 */
function checkPaymentCost(specialistEndpoint, requestBody) {
    return __awaiter(this, void 0, void 0, function () {
        var username, token, response, error_3;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    username = config_1.default.agentWallet.username || 'claw';
                    token = config_1.default.agentWallet.token;
                    if (!token) {
                        return [2 /*return*/, { required: false }];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1.default.post("".concat(AGENTWALLET_API, "/wallets/").concat(username, "/actions/x402/fetch"), {
                            url: specialistEndpoint,
                            method: 'POST',
                            body: requestBody,
                            dryRun: true,
                        }, {
                            headers: {
                                'Authorization': "Bearer ".concat(token),
                                'Content-Type': 'application/json',
                            },
                        })];
                case 2:
                    response = _b.sent();
                    if ((_a = response.data.payment) === null || _a === void 0 ? void 0 : _a.required) {
                        return [2 /*return*/, {
                                required: true,
                                amount: response.data.payment.amountFormatted,
                                chain: response.data.payment.chain,
                            }];
                    }
                    return [2 /*return*/, { required: false }];
                case 3:
                    error_3 = _b.sent();
                    return [2 /*return*/, { required: false }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
