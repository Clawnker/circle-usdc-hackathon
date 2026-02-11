"use strict";
/**
 * Circuit Breaker Service
 * Prevents "hammering" failing agents and manages failover states.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.circuitBreaker = exports.CircuitBreakerService = void 0;
var fs = require("fs");
var path = require("path");
var DATA_DIR = path.join(__dirname, '../data');
var CIRCUIT_FILE = path.join(DATA_DIR, 'circuit-breakers.json');
var DEFAULT_CONFIG = {
    failureThreshold: 5,
    cooldownMs: 60000, // 1 minute
    halfOpenMaxAttempts: 1,
};
var CircuitBreakerService = /** @class */ (function () {
    function CircuitBreakerService(config) {
        if (config === void 0) { config = {}; }
        this.statuses = new Map();
        this.config = __assign(__assign({}, DEFAULT_CONFIG), config);
        this.load();
    }
    CircuitBreakerService.prototype.load = function () {
        var _this = this;
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }
            if (fs.existsSync(CIRCUIT_FILE)) {
                var data = fs.readFileSync(CIRCUIT_FILE, 'utf8');
                var parsed = JSON.parse(data);
                Object.entries(parsed).forEach(function (_a) {
                    var agentId = _a[0], status = _a[1];
                    _this.statuses.set(agentId, status);
                });
            }
        }
        catch (error) {
            console.error('[CircuitBreaker] Failed to load statuses:', error);
        }
    };
    CircuitBreakerService.prototype.save = function () {
        try {
            var data = JSON.stringify(Object.fromEntries(this.statuses), null, 2);
            fs.writeFileSync(CIRCUIT_FILE, data, 'utf8');
        }
        catch (error) {
            console.error('[CircuitBreaker] Failed to save statuses:', error);
        }
    };
    CircuitBreakerService.prototype.getOrCreateStatus = function (agentId) {
        var status = this.statuses.get(agentId);
        if (!status) {
            status = {
                agentId: agentId,
                state: 'CLOSED',
                consecutiveFailures: 0,
                halfOpenAttempts: 0,
            };
            this.statuses.set(agentId, status);
        }
        return status;
    };
    CircuitBreakerService.prototype.canCall = function (agentId) {
        var status = this.getOrCreateStatus(agentId);
        if (status.state === 'CLOSED') {
            return true;
        }
        var now = Date.now();
        if (status.state === 'OPEN') {
            if (status.lastFailureTime && now - status.lastFailureTime > this.config.cooldownMs) {
                // Transition to HALF_OPEN
                status.state = 'HALF_OPEN';
                status.halfOpenAttempts = 0;
                this.save();
                return true;
            }
            return false;
        }
        if (status.state === 'HALF_OPEN') {
            return status.halfOpenAttempts < this.config.halfOpenMaxAttempts;
        }
        return false;
    };
    CircuitBreakerService.prototype.recordCall = function (agentId) {
        var status = this.getOrCreateStatus(agentId);
        if (status.state === 'HALF_OPEN') {
            status.halfOpenAttempts++;
            this.save();
        }
    };
    CircuitBreakerService.prototype.recordSuccess = function (agentId) {
        var status = this.getOrCreateStatus(agentId);
        status.state = 'CLOSED';
        status.consecutiveFailures = 0;
        status.halfOpenAttempts = 0;
        status.lastFailureTime = undefined;
        this.save();
    };
    CircuitBreakerService.prototype.recordFailure = function (agentId) {
        var status = this.getOrCreateStatus(agentId);
        var now = Date.now();
        if (status.state === 'HALF_OPEN') {
            status.state = 'OPEN';
            status.lastFailureTime = now;
            // We don't reset consecutiveFailures here so it stays at threshold
        }
        else {
            status.consecutiveFailures++;
            status.lastFailureTime = now;
            if (status.consecutiveFailures >= this.config.failureThreshold) {
                status.state = 'OPEN';
            }
        }
        this.save();
    };
    CircuitBreakerService.prototype.getState = function (agentId) {
        return this.getOrCreateStatus(agentId).state;
    };
    return CircuitBreakerService;
}());
exports.CircuitBreakerService = CircuitBreakerService;
exports.circuitBreaker = new CircuitBreakerService();
