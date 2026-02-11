"use strict";
/**
 * Reputation System V2 - Multi-dimensional, time-decayed, and capability-aware.
 *
 * Each task response can be upvoted or downvoted by any user or agent.
 * Votes and latency are tracked per-agent and per-capability.
 * Performance data is decayed over time to prioritize recent reliability.
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
exports.recordLatency = recordLatency;
exports.recordSuccess = recordSuccess;
exports.recordFailure = recordFailure;
exports.submitVote = submitVote;
exports.getSuccessRate = getSuccessRate;
exports.getReputationScore = getReputationScore;
exports.getCapabilityReputation = getCapabilityReputation;
exports.getReputationStats = getReputationStats;
exports.updateSyncStatus = updateSyncStatus;
exports.getVote = getVote;
exports.getAllReputation = getAllReputation;
var fs = require("fs");
var path = require("path");
var DATA_DIR = path.join(__dirname, '../data');
var REPUTATION_FILE = path.join(DATA_DIR, 'reputation.json');
var REP_CONFIG = {
    HALF_LIFE_HOURS: 168, // 7 days
    WEIGHT_SUCCESS: 0.7,
    WEIGHT_LATENCY: 0.3,
    LATENCY_THRESHOLD_MS: 30000,
    MIN_VOLUME_FOR_CONFIDENCE: 20,
    MIN_ROUTING_THRESHOLD: 0.2,
    COLD_START_TASKS: 5,
    COLD_START_SCORE: 0.5
};
// In-memory cache
var reputationData = {
    specialists: {},
    voterTaskIndex: {},
};
/**
 * Load reputation data from disk
 */
function loadReputation() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (fs.existsSync(REPUTATION_FILE)) {
            var data = fs.readFileSync(REPUTATION_FILE, 'utf8');
            var parsed = JSON.parse(data);
            // Handle legacy format (flat specialist records or V1)
            if (!parsed.specialists) {
                // Migrate from extremely old format
                var specialists = {};
                for (var _i = 0, _a = Object.entries(parsed); _i < _a.length; _i++) {
                    var _b = _a[_i], key = _b[0], value = _b[1];
                    var legacy = value;
                    specialists[key] = migrateToV2(key, legacy);
                }
                reputationData = { specialists: specialists, voterTaskIndex: {} };
                saveReputation();
                console.log("[Reputation] Migrated legacy data for ".concat(Object.keys(specialists).length, " specialists"));
            }
            else {
                // Check if migration to V2 is needed for individual specialists
                var migratedCount = 0;
                for (var _c = 0, _d = Object.entries(parsed.specialists); _c < _d.length; _c++) {
                    var _e = _d[_c], key = _e[0], value = _e[1];
                    var spec = value;
                    if (!spec.capabilities || spec.globalScore === undefined) {
                        parsed.specialists[key] = migrateToV2(key, spec);
                        migratedCount++;
                    }
                }
                reputationData = parsed;
                if (migratedCount > 0) {
                    saveReputation();
                    console.log("[Reputation] Migrated ".concat(migratedCount, " specialists to V2 format"));
                }
                console.log("[Reputation] Loaded data for ".concat(Object.keys(reputationData.specialists).length, " specialists"));
            }
        }
        else {
            reputationData = { specialists: {}, voterTaskIndex: {} };
            saveReputation();
        }
    }
    catch (error) {
        console.error("[Reputation] Failed to load reputation:", error.message);
        reputationData = { specialists: {}, voterTaskIndex: {} };
    }
}
/**
 * Migrate a V1 specialist record to V2
 */
function migrateToV2(agentId, legacy) {
    var upvotes = legacy.upvotes || legacy.successCount || 0;
    var downvotes = legacy.downvotes || legacy.failureCount || 0;
    var total = upvotes + downvotes;
    var score = total > 0 ? upvotes / total : REP_CONFIG.COLD_START_SCORE;
    return {
        agentId: agentId,
        successCount: legacy.successCount || 0,
        failureCount: legacy.failureCount || 0,
        upvotes: upvotes,
        downvotes: downvotes,
        globalScore: score,
        capabilities: {},
        votes: legacy.votes || [],
        lastSyncTx: legacy.lastSyncTx,
        lastSyncTimestamp: legacy.lastSyncTimestamp
    };
}
/**
 * Save reputation data to disk
 */
function saveReputation() {
    try {
        var dataToSave = __assign({}, reputationData);
        // Limit stored votes and latency samples for file size
        for (var _i = 0, _a = Object.values(dataToSave.specialists); _i < _a.length; _i++) {
            var specialist = _a[_i];
            if (specialist.votes && specialist.votes.length > 100) {
                specialist.votes = specialist.votes.slice(-100);
            }
            for (var _b = 0, _c = Object.values(specialist.capabilities); _b < _c.length; _b++) {
                var cap = _c[_b];
                if (cap.latencySamples.length > 100) {
                    cap.latencySamples = cap.latencySamples.slice(-100);
                }
            }
        }
        var data = JSON.stringify(dataToSave, null, 2);
        fs.writeFileSync(REPUTATION_FILE, data, 'utf8');
    }
    catch (error) {
        console.error("[Reputation] Failed to save reputation:", error.message);
    }
}
// Initial load
loadReputation();
/**
 * Get or initialize specialist record
 */
function getSpecialist(agentId) {
    if (!reputationData.specialists[agentId]) {
        reputationData.specialists[agentId] = {
            agentId: agentId,
            successCount: 0,
            failureCount: 0,
            upvotes: 0,
            downvotes: 0,
            globalScore: REP_CONFIG.COLD_START_SCORE,
            capabilities: {},
            votes: [],
        };
    }
    return reputationData.specialists[agentId];
}
/**
 * Get or initialize capability metrics for an agent
 */
function getCapabilityMetrics(agentId, capabilityId) {
    var specialist = getSpecialist(agentId);
    if (!specialist.capabilities[capabilityId]) {
        specialist.capabilities[capabilityId] = {
            capabilityId: capabilityId,
            decayedUpvotes: 0,
            decayedDownvotes: 0,
            lastUpdateTimestamp: Date.now(),
            latencySamples: [],
            p50: 0,
            p95: 0,
            p99: 0,
            totalTasks: 0,
            currentScore: REP_CONFIG.COLD_START_SCORE
        };
    }
    return specialist.capabilities[capabilityId];
}
/**
 * Apply exponential decay to success metrics
 */
function applyDecay(metrics) {
    var now = Date.now();
    var deltaHours = (now - metrics.lastUpdateTimestamp) / (1000 * 60 * 60);
    if (deltaHours <= 0)
        return;
    var lambda = Math.log(2) / REP_CONFIG.HALF_LIFE_HOURS;
    var decayFactor = Math.exp(-lambda * deltaHours);
    metrics.decayedUpvotes *= decayFactor;
    metrics.decayedDownvotes *= decayFactor;
    metrics.lastUpdateTimestamp = now;
}
/**
 * Calculate percentiles for latency
 */
function calculatePercentiles(samples) {
    if (samples.length === 0)
        return { p50: 0, p95: 0, p99: 0 };
    var sorted = __spreadArray([], samples, true).sort(function (a, b) { return a - b; });
    var getP = function (p) {
        var idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
        return sorted[idx];
    };
    return {
        p50: getP(0.5),
        p95: getP(0.95),
        p99: getP(0.99)
    };
}
/**
 * Calculate the comprehensive reputation score
 */
function calculateScore(metrics) {
    // 1. Success Score (S_decayed)
    var totalDecayed = metrics.decayedUpvotes + metrics.decayedDownvotes;
    var s_decayed = totalDecayed > 0 ? metrics.decayedUpvotes / totalDecayed : REP_CONFIG.COLD_START_SCORE;
    // 2. Latency Score (L_score)
    var l_score = 0;
    if (metrics.p50 > 0) {
        l_score = Math.max(0, 1 - (metrics.p50 / REP_CONFIG.LATENCY_THRESHOLD_MS));
    }
    else {
        l_score = 0.8; // Assume decent latency if no samples yet
    }
    // 3. Combined Base Score (Rc)
    var rc = (s_decayed * REP_CONFIG.WEIGHT_SUCCESS) + (l_score * REP_CONFIG.WEIGHT_LATENCY);
    // 4. Volume Confidence Factor (Vconf)
    // Cold start logic: default score of 0.5 for agents with <5 tasks, ramping to actual score
    var v_conf = 1.0;
    if (metrics.totalTasks < REP_CONFIG.MIN_VOLUME_FOR_CONFIDENCE) {
        v_conf = metrics.totalTasks / REP_CONFIG.MIN_VOLUME_FOR_CONFIDENCE;
    }
    // If very new (< COLD_START_TASKS), weight heavily towards COLD_START_SCORE
    if (metrics.totalTasks < REP_CONFIG.COLD_START_TASKS) {
        var actualWeight = metrics.totalTasks / REP_CONFIG.COLD_START_TASKS;
        return (rc * actualWeight) + (REP_CONFIG.COLD_START_SCORE * (1 - actualWeight));
    }
    return rc * v_conf;
}
/**
 * Update global score for an agent (weighted average of capabilities)
 */
function updateGlobalScore(agentId) {
    var specialist = getSpecialist(agentId);
    var caps = Object.values(specialist.capabilities);
    if (caps.length === 0) {
        // Keep existing global score or default
        return;
    }
    var sumScores = caps.reduce(function (sum, cap) { return sum + cap.currentScore; }, 0);
    specialist.globalScore = sumScores / caps.length;
}
/**
 * Record latency for a task
 */
function recordLatency(agentId, capabilityId, ms) {
    var metrics = getCapabilityMetrics(agentId, capabilityId);
    metrics.latencySamples.push(ms);
    if (metrics.latencySamples.length > 100) {
        metrics.latencySamples.shift();
    }
    var percentiles = calculatePercentiles(metrics.latencySamples);
    metrics.p50 = percentiles.p50;
    metrics.p95 = percentiles.p95;
    metrics.p99 = percentiles.p99;
    metrics.currentScore = calculateScore(metrics);
    updateGlobalScore(agentId);
    saveReputation();
}
/**
 * Record a successful task completion
 */
function recordSuccess(agentId, capabilityId) {
    var specialist = getSpecialist(agentId);
    specialist.successCount++;
    specialist.upvotes++;
    if (capabilityId) {
        var metrics = getCapabilityMetrics(agentId, capabilityId);
        applyDecay(metrics);
        metrics.decayedUpvotes += 1;
        metrics.totalTasks += 1;
        metrics.currentScore = calculateScore(metrics);
    }
    updateGlobalScore(agentId);
    saveReputation();
}
/**
 * Record a failed task completion
 */
function recordFailure(agentId, capabilityId) {
    var specialist = getSpecialist(agentId);
    specialist.failureCount++;
    specialist.downvotes++;
    if (capabilityId) {
        var metrics = getCapabilityMetrics(agentId, capabilityId);
        applyDecay(metrics);
        metrics.decayedDownvotes += 1;
        metrics.totalTasks += 1;
        metrics.currentScore = calculateScore(metrics);
    }
    updateGlobalScore(agentId);
    saveReputation();
}
/**
 * Submit a vote on a task response
 */
function submitVote(agentId, taskId, voterId, voterType, vote, capabilityId) {
    var voteKey = "".concat(voterId, ":").concat(taskId);
    var existingVote = reputationData.voterTaskIndex[voteKey];
    var specialist = getSpecialist(agentId);
    // Check if already voted
    if (existingVote) {
        if (existingVote === vote) {
            return {
                success: false,
                message: "Already ".concat(vote, "voted this response"),
                newRate: Math.round(specialist.globalScore * 100),
                upvotes: specialist.upvotes,
                downvotes: specialist.downvotes,
            };
        }
        // Changing vote - undo previous vote
        if (existingVote === 'up') {
            specialist.upvotes = Math.max(0, specialist.upvotes - 1);
            if (capabilityId) {
                var metrics = getCapabilityMetrics(agentId, capabilityId);
                metrics.decayedUpvotes = Math.max(0, metrics.decayedUpvotes - 1);
            }
        }
        else {
            specialist.downvotes = Math.max(0, specialist.downvotes - 1);
            if (capabilityId) {
                var metrics = getCapabilityMetrics(agentId, capabilityId);
                metrics.decayedDownvotes = Math.max(0, metrics.decayedDownvotes - 1);
            }
        }
    }
    // Apply new vote
    if (vote === 'up') {
        specialist.upvotes++;
        if (capabilityId) {
            var metrics = getCapabilityMetrics(agentId, capabilityId);
            applyDecay(metrics);
            metrics.decayedUpvotes += 1;
            metrics.totalTasks = Math.max(metrics.totalTasks, 1); // Ensure task count at least 1
            metrics.currentScore = calculateScore(metrics);
        }
    }
    else {
        specialist.downvotes++;
        if (capabilityId) {
            var metrics = getCapabilityMetrics(agentId, capabilityId);
            applyDecay(metrics);
            metrics.decayedDownvotes += 1;
            metrics.totalTasks = Math.max(metrics.totalTasks, 1);
            metrics.currentScore = calculateScore(metrics);
        }
    }
    // Record the vote
    var voteRecord = {
        taskId: taskId,
        voterId: voterId,
        voterType: voterType,
        vote: vote,
        timestamp: Date.now(),
        capabilityId: capabilityId
    };
    specialist.votes.push(voteRecord);
    reputationData.voterTaskIndex[voteKey] = vote;
    updateGlobalScore(agentId);
    saveReputation();
    return {
        success: true,
        message: existingVote ? "Vote changed to ".concat(vote, "vote") : "".concat(vote === 'up' ? 'Upvote' : 'Downvote', " recorded"),
        newRate: Math.round(specialist.globalScore * 100),
        upvotes: specialist.upvotes,
        downvotes: specialist.downvotes,
    };
}
/**
 * Get the success rate for a specialist as a percentage (legacy/compat)
 */
function getSuccessRate(agentId) {
    var specialist = reputationData.specialists[agentId];
    if (!specialist)
        return 100;
    return Math.round(specialist.globalScore * 100);
}
/**
 * Get reputation score for a specific capability (0.0 - 1.0)
 */
function getReputationScore(agentId, capabilityId) {
    var specialist = reputationData.specialists[agentId];
    if (!specialist)
        return REP_CONFIG.COLD_START_SCORE;
    if (capabilityId && specialist.capabilities[capabilityId]) {
        return specialist.capabilities[capabilityId].currentScore;
    }
    return specialist.globalScore;
}
/**
 * Get capability-specific reputation metrics
 */
function getCapabilityReputation(agentId, capabilityId) {
    var specialist = reputationData.specialists[agentId];
    if (!specialist || !specialist.capabilities[capabilityId])
        return null;
    return specialist.capabilities[capabilityId];
}
/**
 * Get detailed reputation stats (augmented for V2)
 */
function getReputationStats(agentId) {
    var specialist = reputationData.specialists[agentId];
    if (!specialist) {
        return {
            successRate: 100,
            upvotes: 0,
            downvotes: 0,
            totalVotes: 0,
            recentVotes: [],
            capabilities: {}
        };
    }
    return {
        successRate: Math.round(specialist.globalScore * 100),
        upvotes: specialist.upvotes,
        downvotes: specialist.downvotes,
        totalVotes: specialist.upvotes + specialist.downvotes,
        recentVotes: specialist.votes.slice(-10),
        lastSyncTx: specialist.lastSyncTx,
        lastSyncTimestamp: specialist.lastSyncTimestamp,
        capabilities: specialist.capabilities
    };
}
/**
 * Update the on-chain sync status
 */
function updateSyncStatus(agentId, signature) {
    var specialist = getSpecialist(agentId);
    specialist.lastSyncTx = signature;
    specialist.lastSyncTimestamp = Date.now();
    saveReputation();
}
/**
 * Get the vote for a specific task
 */
function getVote(taskId, voterId) {
    var voteKey = "".concat(voterId, ":").concat(taskId);
    return reputationData.voterTaskIndex[voteKey] || null;
}
/**
 * Get all reputation data
 */
function getAllReputation() {
    var result = {};
    for (var _i = 0, _a = Object.entries(reputationData.specialists); _i < _a.length; _i++) {
        var _b = _a[_i], agentId = _b[0], record = _b[1];
        result[agentId] = {
            successRate: Math.round(record.globalScore * 100),
            upvotes: record.upvotes,
            downvotes: record.downvotes,
            capabilities: Object.keys(record.capabilities)
        };
    }
    return result;
}
