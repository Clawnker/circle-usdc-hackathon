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
exports.authMiddleware = void 0;
var erc8128_auth_1 = require("./erc8128-auth");
/**
 * Authentication middleware.
 * Supports two methods (checked in order):
 *   1. ERC-8128 — Signed HTTP requests with Ethereum wallets (cryptographic)
 *   2. API Key  — Static X-API-Key header (legacy)
 *
 * ERC-8128 is preferred: agents authenticate with their wallet, same identity
 * that pays and earns reputation on-chain.
 */
var authMiddleware = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var publicPaths, result, err_1, apiKey, apiKeysEnv, validKeys;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                // Always allow /health
                if (req.path === '/health') {
                    return [2 /*return*/, next()];
                }
                // x402-gated specialist endpoints bypass API key auth (protected by payment instead)
                if (req.path.startsWith('/api/specialist/')) {
                    req.user = { id: 'x402-payer', authMethod: 'x402' };
                    return [2 /*return*/, next()];
                }
                publicPaths = [
                    '/dispatch',
                    '/pricing',
                    '/api/pricing',
                    '/api/agents',
                    '/api/reputation',
                    '/api/vote',
                    '/api/wallet',
                    '/wallet/balances',
                    '/wallet/transactions',
                    '/status',
                    '/tasks',
                    '/api/auth/verify',
                ];
                if (publicPaths.some(function (p) { return req.path === p || req.path.startsWith(p + '/'); })) {
                    req.user = { id: 'demo-user', authMethod: 'public' };
                    return [2 /*return*/, next()];
                }
                if (!(0, erc8128_auth_1.hasErc8128Headers)(req)) return [3 /*break*/, 4];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, (0, erc8128_auth_1.verifyErc8128Request)(req)];
            case 2:
                result = _a.sent();
                if (result && result.ok) {
                    req.user = {
                        id: result.address,
                        address: result.address,
                        chainId: result.chainId,
                        authMethod: 'erc8128',
                    };
                    req.erc8128Verified = true;
                    return [2 /*return*/, next()];
                }
                // ERC-8128 headers present but invalid — reject
                if (result && !result.ok) {
                    return [2 /*return*/, res.status(401).json({
                            error: 'ERC-8128 authentication failed',
                            reason: result.reason,
                        })];
                }
                return [3 /*break*/, 4];
            case 3:
                err_1 = _a.sent();
                console.error('[Auth] ERC-8128 verification error:', err_1.message);
                return [2 /*return*/, res.status(401).json({
                        error: 'ERC-8128 authentication error',
                        reason: err_1.message,
                    })];
            case 4:
                apiKey = req.headers['x-api-key'];
                apiKeysEnv = process.env.API_KEYS || '';
                validKeys = apiKeysEnv.split(',').map(function (k) { return k.trim(); }).filter(function (k) { return k.length > 0; });
                if (!apiKey || !validKeys.includes(apiKey)) {
                    return [2 /*return*/, res.status(401).json({
                            error: 'Unauthorized: Invalid or missing API Key',
                            hint: 'Provide X-API-Key header or sign requests with ERC-8128 (https://erc8128.org)',
                        })];
                }
                req.user = {
                    id: apiKey,
                    authMethod: 'api-key',
                };
                next();
                return [2 /*return*/];
        }
    });
}); };
exports.authMiddleware = authMiddleware;
