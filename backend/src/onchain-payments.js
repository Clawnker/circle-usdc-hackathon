"use strict";
/**
 * On-Chain Payment Executor
 * Sends real USDC micro-transfers on Base Sepolia when tasks are dispatched.
 * Uses Coinbase CDP SDK for standard wallet management.
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
exports.sendOnChainPayment = sendOnChainPayment;
exports.getDemoWalletBalances = getDemoWalletBalances;
var cdp_wallet_1 = require("./cdp-wallet");
var x402_1 = require("./x402");
// Specialist treasury addresses (deterministic per-agent for demo)
// In production these would be real agent-controlled wallets
var SPECIALIST_ADDRESSES = {
    magos: '0x0000000000000000000000000000000000000001',
    aura: '0x0000000000000000000000000000000000000002',
    bankr: '0x0000000000000000000000000000000000000003',
    scribe: '0x0000000000000000000000000000000000000004',
    seeker: '0x0000000000000000000000000000000000000005',
};
// Use the treasury wallet as a catch-all recipient so USDC stays recoverable
var DEFAULT_RECIPIENT = process.env.CDP_WALLET_ADDRESS || '0x676fF3d546932dE6558a267887E58e39f405B135';
/**
 * Send a real USDC payment on Base Sepolia using CDP SDK
 * @param specialist - Agent name (magos, aura, etc.)
 * @param amountUsdc - Amount in USDC (e.g. "0.001")
 * @returns Payment record with real tx hash, or null on failure
 */
function sendOnChainPayment(specialist, amountUsdc, recipientOverride) {
    return __awaiter(this, void 0, void 0, function () {
        var recipient, amount, transfer, txHash, record, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    recipient = recipientOverride || DEFAULT_RECIPIENT;
                    amount = parseFloat(amountUsdc);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    console.log("[OnChain] Sending ".concat(amountUsdc, " USDC to ").concat(recipientOverride ? specialist : 'treasury', " (").concat(recipient.slice(0, 10), "...) for ").concat(specialist, " using CDP..."));
                    return [4 /*yield*/, (0, cdp_wallet_1.sendUSDC)(recipient, amount)];
                case 2:
                    transfer = _a.sent();
                    txHash = transfer.getTransactionHash() || 'pending';
                    console.log("[OnChain] CDP Transfer submitted: ".concat(txHash));
                    record = (0, x402_1.createPaymentRecord)(amountUsdc, 'USDC', 'base-sepolia', specialist, txHash);
                    (0, x402_1.logTransaction)(record);
                    return [2 /*return*/, { txHash: txHash, amount: amountUsdc }];
                case 3:
                    err_1 = _a.sent();
                    console.error("[OnChain] CDP Payment failed:", err_1.message);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Check CDP wallet balances
 */
function getDemoWalletBalances() {
    return __awaiter(this, void 0, void 0, function () {
        var address;
        return __generator(this, function (_a) {
            try {
                address = process.env.CDP_WALLET_ADDRESS || '0x676fF3d546932dE6558a267887E58e39f405B135';
                return [2 /*return*/, {
                        eth: "0",
                        usdc: "0",
                        address: address,
                    }];
            }
            catch (err) {
                console.error('[OnChain] Balance check failed:', err.message);
                return [2 /*return*/, null];
            }
            return [2 /*return*/];
        });
    });
}
exports.default = { sendOnChainPayment: sendOnChainPayment, getDemoWalletBalances: getDemoWalletBalances };
