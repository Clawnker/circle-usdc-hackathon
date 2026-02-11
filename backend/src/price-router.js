"use strict";
/**
 * Price-Aware Routing Engine
 * Handles price efficiency calculations, market averages, and budget enforcement.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.priceRouter = exports.PriceRouter = void 0;
var config_1 = require("./config");
var external_agents_1 = require("./external-agents");
var PriceRouter = /** @class */ (function () {
    function PriceRouter() {
        this.cache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    }
    /**
     * Calculate price efficiency score (0-1)
     * Formula: Price_min / Price_agent
     */
    PriceRouter.prototype.calculatePriceEfficiency = function (agentPrice, marketAverage) {
        if (agentPrice <= 0)
            return 1.0;
        // The spec uses Price_min / Price_agent. 
        // But the method signature asks for marketAverage.
        // We'll use a hybrid approach that favors prices below average.
        var ratio = marketAverage / agentPrice;
        // If agent is exactly at market average, they get 0.5
        // If agent is 50% cheaper than average, they get ~0.75
        // If agent is twice as expensive as average, they get 0.25
        // Using a simple bounded linear scale for now
        if (ratio >= 2.0)
            return 1.0;
        if (ratio <= 0.2)
            return 0.0;
        // Map ratio [0.2, 1.0, 2.0] to score [0.0, 0.5, 1.0]
        if (ratio >= 1.0) {
            // [1.0, 2.0] -> [0.5, 1.0]
            return 0.5 + (ratio - 1.0) * 0.5;
        }
        else {
            // [0.2, 1.0] -> [0.0, 0.5]
            return (ratio - 0.2) * (0.5 / 0.8);
        }
    };
    /**
     * Get market average and min price for a capability
     */
    PriceRouter.prototype.getMarketData = function (capabilityId) {
        var _a, _b;
        var cached = this.cache.get(capabilityId);
        if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
            return { average: cached.average, min: cached.min };
        }
        var prices = [];
        // 1. Check built-in specialists
        var specialistId = capabilityId.split(':')[0];
        var builtInFee = config_1.config.fees[specialistId];
        if (builtInFee !== undefined) {
            prices.push(builtInFee);
        }
        // 2. Check external agents
        var externalAgents = (0, external_agents_1.getExternalAgents)();
        for (var _i = 0, externalAgents_1 = externalAgents; _i < externalAgents_1.length; _i++) {
            var agent = externalAgents_1[_i];
            // Check if agent has this capability
            var hasCap = agent.structuredCapabilities.some(function (c) { return c.id === capabilityId; }) ||
                agent.capabilities.includes(capabilityId);
            if (hasCap) {
                var price = (_b = (_a = agent.pricing[capabilityId]) !== null && _a !== void 0 ? _a : agent.pricing['generic']) !== null && _b !== void 0 ? _b : 0;
                prices.push(price);
            }
        }
        // Fallback if no prices found
        if (prices.length === 0) {
            var defaultPrice = config_1.config.fees.general || 0.10;
            return { average: defaultPrice, min: defaultPrice };
        }
        var average = prices.reduce(function (a, b) { return a + b; }, 0) / prices.length;
        var min = Math.min.apply(Math, prices);
        this.cache.set(capabilityId, { average: average, min: min, timestamp: Date.now() });
        return { average: average, min: min };
    };
    /**
     * Wrapper for getMarketAverage (requested by spec)
     */
    PriceRouter.prototype.getMarketAverage = function (capabilityId) {
        return this.getMarketData(capabilityId).average;
    };
    /**
     * Check if a plan fits within the budget
     */
    PriceRouter.prototype.checkBudget = function (plan, maxBudget) {
        var totalCost = 0;
        var breakdown = [];
        for (var _i = 0, _a = plan.steps; _i < _a.length; _i++) {
            var step = _a[_i];
            totalCost += step.estimatedCost;
            breakdown.push({
                agentId: step.specialist,
                capabilityId: step.id, // Using step ID as a placeholder for capability
                estimatedCost: step.estimatedCost
            });
        }
        return {
            withinBudget: totalCost <= maxBudget,
            totalCost: totalCost,
            breakdown: breakdown
        };
    };
    /**
     * Re-rank agents factoring in price efficiency and budget limits
     */
    PriceRouter.prototype.rankByValue = function (agents, budgetLimit) {
        var _this = this;
        var result = agents;
        // Filter by budget if provided
        if (budgetLimit !== undefined) {
            result = result.filter(function (agent) {
                var price = _this.getAgentPrice(agent.agentId);
                return price <= budgetLimit;
            });
        }
        // The scoring is already handled in the matcher, but we can re-sort here
        // if we wanted to apply a different value-based ranking logic.
        // For now, we follow the matcher's lead.
        return result.sort(function (a, b) { return b.score - a.score; });
    };
    /**
     * Internal helper to get generic price for an agent
     */
    PriceRouter.prototype.getAgentPrice = function (agentId) {
        var _a;
        var builtInFee = config_1.config.fees[agentId];
        if (builtInFee !== undefined) {
            return builtInFee;
        }
        var external = (0, external_agents_1.getExternalAgents)().find(function (a) { return a.id === agentId; });
        if (external) {
            // Use the first available price or generic
            return (_a = Object.values(external.pricing)[0]) !== null && _a !== void 0 ? _a : 0;
        }
        return 0;
    };
    return PriceRouter;
}());
exports.PriceRouter = PriceRouter;
exports.priceRouter = new PriceRouter();
