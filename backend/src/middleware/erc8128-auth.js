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
exports.erc8128AuthMiddleware = void 0;
exports.hasErc8128Headers = hasErc8128Headers;
exports.verifyErc8128Request = verifyErc8128Request;
var viem_1 = require("viem");
var chains_1 = require("viem/chains");
var fs = require("fs");
var path = require("path");
// Use require to avoid tsc following types into the broken ox dependency
var createVerifierClient = require('@slicekit/erc8128').createVerifierClient;
var NONCE_STORE_FILE = path.join(__dirname, '../../data/erc8128-nonces.json');
// Simple persistent NonceStore for replay protection
var PersistentNonceStore = /** @class */ (function () {
    function PersistentNonceStore() {
        this.nonces = new Set();
        this.load();
    }
    PersistentNonceStore.prototype.load = function () {
        try {
            if (fs.existsSync(NONCE_STORE_FILE)) {
                var data = fs.readFileSync(NONCE_STORE_FILE, 'utf8');
                this.nonces = new Set(JSON.parse(data));
                console.log("[ERC-8128] Loaded ".concat(this.nonces.size, " nonces from persistence"));
            }
        }
        catch (err) {
            console.error('[ERC-8128] Failed to load nonces:', err);
        }
    };
    PersistentNonceStore.prototype.save = function () {
        try {
            var dir = path.dirname(NONCE_STORE_FILE);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(NONCE_STORE_FILE, JSON.stringify(Array.from(this.nonces)), 'utf8');
        }
        catch (err) {
            console.error('[ERC-8128] Failed to save nonces:', err);
        }
    };
    PersistentNonceStore.prototype.has = function (nonce) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.nonces.has(nonce)];
            });
        });
    };
    PersistentNonceStore.prototype.set = function (nonce) {
        return __awaiter(this, void 0, void 0, function () {
            var list;
            return __generator(this, function (_a) {
                this.nonces.add(nonce);
                // Keep last 10,000 nonces
                if (this.nonces.size > 10000) {
                    list = Array.from(this.nonces);
                    this.nonces = new Set(list.slice(-5000));
                }
                this.save();
                return [2 /*return*/];
            });
        });
    };
    return PersistentNonceStore;
}());
var persistentNonceStore = new PersistentNonceStore();
var publicClient = (0, viem_1.createPublicClient)({
    chain: chains_1.baseSepolia,
    transport: (0, viem_1.http)(),
});
var nonceStore = {
    consume: function (key, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, persistentNonceStore.has(key)];
                    case 1:
                        if (_a.sent())
                            return [2 /*return*/, false];
                        return [4 /*yield*/, persistentNonceStore.set(key)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    }
};
var verifyMessage = function (args) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, publicClient.verifyMessage({
                address: args.address,
                message: { raw: args.message.raw },
                signature: args.signature,
            })];
    });
}); };
var verifier = createVerifierClient(verifyMessage, nonceStore);
function hasErc8128Headers(req) {
    return !!(req.headers['signature'] && req.headers['signature-input']);
}
function verifyErc8128Request(req) {
    return __awaiter(this, void 0, void 0, function () {
        var protocol, host, fullUrl, nativeRequest, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    protocol = req.protocol || 'http';
                    host = req.get('host') || 'localhost';
                    fullUrl = "".concat(protocol, "://").concat(host).concat(req.originalUrl || req.url);
                    nativeRequest = new Request(fullUrl, {
                        method: req.method,
                        headers: req.headers,
                        body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
                    });
                    return [4 /*yield*/, verifier.verifyRequest(nativeRequest)];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_1 = _a.sent();
                    console.error('[ERC-8128] Verification error:', error_1);
                    return [2 /*return*/, { ok: false, reason: 'internal_error', detail: error_1.message }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * ERC-8128 Authentication Middleware
 */
var erc8128AuthMiddleware = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var verification, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!hasErc8128Headers(req)) {
                    return [2 /*return*/, next()];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, verifyErc8128Request(req)];
            case 2:
                verification = _a.sent();
                if (verification.ok) {
                    console.log("[ERC-8128] Verified request from ".concat(verification.address));
                    req.user = {
                        id: verification.address,
                        address: verification.address,
                        authMethod: 'erc8128',
                    };
                    return [2 /*return*/, next()];
                }
                else {
                    console.warn("[ERC-8128] Verification failed: ".concat(verification.reason));
                    return [2 /*return*/, res.status(401).json({
                            error: 'ERC-8128 verification failed',
                            reason: verification.reason
                        })];
                }
                return [3 /*break*/, 4];
            case 3:
                error_2 = _a.sent();
                console.error('[ERC-8128] Middleware error:', error_2);
                return [2 /*return*/, res.status(500).json({ error: 'Internal server error during ERC-8128 verification' })];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.erc8128AuthMiddleware = erc8128AuthMiddleware;
