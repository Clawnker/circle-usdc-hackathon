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
exports.getOrCreateServerWallet = getOrCreateServerWallet;
exports.getWalletBalances = getWalletBalances;
exports.sendUSDC = sendUSDC;
exports.tradeTokens = tradeTokens;
var cdp_sdk_1 = require("@coinbase/cdp-sdk");
// Load credentials from environment
var apiKeyId = process.env.CDP_API_KEY_NAME || '';
var apiKeySecret = (process.env.CDP_API_KEY_SECRET || '').replace(/\\n/g, '\n');
// Initialize CDP client
var client = null;
if (apiKeyId && apiKeySecret) {
    client = new cdp_sdk_1.CdpClient({ apiKeyId: apiKeyId, apiKeySecret: apiKeySecret });
}
else {
    console.warn('[CDP] API credentials missing. CDP functions will fail.');
}
/**
 * Get or create the server's CDP wallet
 * Note: standard x402-express uses the treasury address directly.
 * This helper is for manual on-chain payments.
 */
function getOrCreateServerWallet() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!client)
                throw new Error('CDP Client not initialized');
            // For simplicity in this hackathon version, we'll use the client to interact with the network
            // In a full implementation, we'd use client.createWallet() etc.
            return [2 /*return*/, client];
        });
    });
}
/**
 * Get wallet balances
 */
function getWalletBalances(address) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!client)
                return [2 /*return*/, []];
            try {
                // In CDP SDK v1.44 (express version), we might need to use the client directly
                // This is a simplified mock for the hackathon backend to compile
                return [2 /*return*/, []];
            }
            catch (error) {
                console.error('[CDP] Failed to get balances:', error.message);
                return [2 /*return*/, []];
            }
            return [2 /*return*/];
        });
    });
}
/**
 * Send USDC to a recipient
 */
function sendUSDC(to, amount) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!client)
                throw new Error('CDP Client not initialized');
            try {
                console.log("[CDP] Sending ".concat(amount, " USDC to ").concat(to, "..."));
                // Placeholder for actual transfer using CdpClient
                // The exact method depends on the wallet being loaded/created
                return [2 /*return*/, { getTransactionHash: function () { return '0x_placeholder_hash'; } }];
            }
            catch (error) {
                console.error('[CDP] Transfer failed:', error.message);
                throw error;
            }
            return [2 /*return*/];
        });
    });
}
/**
 * Trade/swap tokens
 */
function tradeTokens(from, to, amount) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!client)
                throw new Error('CDP Client not initialized');
            try {
                console.log("[CDP] Trading ".concat(amount, " ").concat(from, " for ").concat(to, "..."));
                return [2 /*return*/, { getTransactionHash: function () { return '0x_placeholder_hash'; } }];
            }
            catch (error) {
                console.error('[CDP] Trade failed:', error.message);
                throw error;
            }
            return [2 /*return*/];
        });
    });
}
exports.default = {
    getOrCreateServerWallet: getOrCreateServerWallet,
    getWalletBalances: getWalletBalances,
    sendUSDC: sendUSDC,
    tradeTokens: tradeTokens
};
