/**
 * Reputation System V2 - Multi-dimensional, time-decayed, and capability-aware.
 * 
 * Each task response can be upvoted or downvoted by any user or agent.
 * Votes and latency are tracked per-agent and per-capability.
 * Performance data is decayed over time to prioritize recent reliability.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SpecialistReputationV2, CapabilityMetrics } from './types';

interface Vote {
  taskId: string;
  voterId: string;      // User or agent ID who voted
  voterType: 'human' | 'agent';
  vote: 'up' | 'down';
  timestamp: number;
  capabilityId?: string;
}

interface ReputationData {
  specialists: Record<string, SpecialistReputationV2>;
  // Track which voter has voted on which task (prevent double voting)
  voterTaskIndex: Record<string, string>;  // "voterId:taskId" -> "up"|"down"
}

const DATA_DIR = path.join(__dirname, '../data');
const REPUTATION_FILE = path.join(DATA_DIR, 'reputation.json');

const REP_CONFIG = {
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
let reputationData: ReputationData = {
  specialists: {},
  voterTaskIndex: {},
};

/**
 * Load reputation data from disk
 */
function loadReputation(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    if (fs.existsSync(REPUTATION_FILE)) {
      const data = fs.readFileSync(REPUTATION_FILE, 'utf8');
      const parsed = JSON.parse(data);
      
      // Handle legacy format (flat specialist records or V1)
      if (!parsed.specialists) {
        // Migrate from extremely old format
        const specialists: Record<string, SpecialistReputationV2> = {};
        for (const [key, value] of Object.entries(parsed)) {
          const legacy = value as any;
          specialists[key] = migrateToV2(key, legacy);
        }
        reputationData = { specialists, voterTaskIndex: {} };
        saveReputation();
        console.log(`[Reputation] Migrated legacy data for ${Object.keys(specialists).length} specialists`);
      } else {
        // Check if migration to V2 is needed for individual specialists
        let migratedCount = 0;
        for (const [key, value] of Object.entries(parsed.specialists)) {
          const spec = value as any;
          if (!spec.capabilities || spec.globalScore === undefined) {
            parsed.specialists[key] = migrateToV2(key, spec);
            migratedCount++;
          }
        }
        reputationData = parsed;
        if (migratedCount > 0) {
          saveReputation();
          console.log(`[Reputation] Migrated ${migratedCount} specialists to V2 format`);
        }
        console.log(`[Reputation] Loaded data for ${Object.keys(reputationData.specialists).length} specialists`);
      }
    } else {
      reputationData = { specialists: {}, voterTaskIndex: {} };
      saveReputation();
    }
  } catch (error: any) {
    console.error(`[Reputation] Failed to load reputation:`, error.message);
    reputationData = { specialists: {}, voterTaskIndex: {} };
  }
}

/**
 * Migrate a V1 specialist record to V2
 */
function migrateToV2(agentId: string, legacy: any): SpecialistReputationV2 {
  const upvotes = legacy.upvotes || legacy.successCount || 0;
  const downvotes = legacy.downvotes || legacy.failureCount || 0;
  const total = upvotes + downvotes;
  const score = total > 0 ? upvotes / total : REP_CONFIG.COLD_START_SCORE;

  return {
    agentId,
    successCount: legacy.successCount || 0,
    failureCount: legacy.failureCount || 0,
    upvotes,
    downvotes,
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
function saveReputation(): void {
  try {
    const dataToSave = { ...reputationData };
    // Limit stored votes and latency samples for file size
    for (const specialist of Object.values(dataToSave.specialists)) {
      if (specialist.votes && specialist.votes.length > 100) {
        specialist.votes = specialist.votes.slice(-100);
      }
      for (const cap of Object.values(specialist.capabilities)) {
        if (cap.latencySamples.length > 100) {
          cap.latencySamples = cap.latencySamples.slice(-100);
        }
      }
    }
    
    const data = JSON.stringify(dataToSave, null, 2);
    fs.writeFileSync(REPUTATION_FILE, data, 'utf8');
  } catch (error: any) {
    console.error(`[Reputation] Failed to save reputation:`, error.message);
  }
}

// Initial load
loadReputation();

/**
 * Get or initialize specialist record
 */
function getSpecialist(agentId: string): SpecialistReputationV2 {
  if (!reputationData.specialists[agentId]) {
    reputationData.specialists[agentId] = {
      agentId,
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
function getCapabilityMetrics(agentId: string, capabilityId: string): CapabilityMetrics {
  const specialist = getSpecialist(agentId);
  if (!specialist.capabilities[capabilityId]) {
    specialist.capabilities[capabilityId] = {
      capabilityId,
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
function applyDecay(metrics: CapabilityMetrics): void {
  const now = Date.now();
  const deltaHours = (now - metrics.lastUpdateTimestamp) / (1000 * 60 * 60);
  
  if (deltaHours <= 0) return;

  const lambda = Math.log(2) / REP_CONFIG.HALF_LIFE_HOURS;
  const decayFactor = Math.exp(-lambda * deltaHours);

  metrics.decayedUpvotes *= decayFactor;
  metrics.decayedDownvotes *= decayFactor;
  metrics.lastUpdateTimestamp = now;
}

/**
 * Calculate percentiles for latency
 */
function calculatePercentiles(samples: number[]): { p50: number; p95: number; p99: number } {
  if (samples.length === 0) return { p50: 0, p95: 0, p99: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const getP = (p: number) => {
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
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
function calculateScore(metrics: CapabilityMetrics): number {
  // 1. Success Score (S_decayed)
  const totalDecayed = metrics.decayedUpvotes + metrics.decayedDownvotes;
  let s_decayed = totalDecayed > 0 ? metrics.decayedUpvotes / totalDecayed : REP_CONFIG.COLD_START_SCORE;

  // 2. Latency Score (L_score)
  let l_score = 0;
  if (metrics.p50 > 0) {
    l_score = Math.max(0, 1 - (metrics.p50 / REP_CONFIG.LATENCY_THRESHOLD_MS));
  } else {
    l_score = 0.8; // Assume decent latency if no samples yet
  }

  // 3. Combined Base Score (Rc)
  let rc = (s_decayed * REP_CONFIG.WEIGHT_SUCCESS) + (l_score * REP_CONFIG.WEIGHT_LATENCY);

  // 4. Volume Confidence Factor (Vconf)
  // Cold start logic: default score of 0.5 for agents with <5 tasks, ramping to actual score
  let v_conf = 1.0;
  if (metrics.totalTasks < REP_CONFIG.MIN_VOLUME_FOR_CONFIDENCE) {
    v_conf = metrics.totalTasks / REP_CONFIG.MIN_VOLUME_FOR_CONFIDENCE;
  }

  // If very new (< COLD_START_TASKS), weight heavily towards COLD_START_SCORE
  if (metrics.totalTasks < REP_CONFIG.COLD_START_TASKS) {
    const actualWeight = metrics.totalTasks / REP_CONFIG.COLD_START_TASKS;
    return (rc * actualWeight) + (REP_CONFIG.COLD_START_SCORE * (1 - actualWeight));
  }

  return rc * v_conf;
}

/**
 * Update global score for an agent (weighted average of capabilities)
 */
function updateGlobalScore(agentId: string): void {
  const specialist = getSpecialist(agentId);
  const caps = Object.values(specialist.capabilities);
  
  if (caps.length === 0) {
    // Keep existing global score or default
    return;
  }

  const sumScores = caps.reduce((sum, cap) => sum + cap.currentScore, 0);
  specialist.globalScore = sumScores / caps.length;
}

/**
 * Record latency for a task
 */
export function recordLatency(agentId: string, capabilityId: string, ms: number): void {
  const metrics = getCapabilityMetrics(agentId, capabilityId);
  
  metrics.latencySamples.push(ms);
  if (metrics.latencySamples.length > 100) {
    metrics.latencySamples.shift();
  }

  const percentiles = calculatePercentiles(metrics.latencySamples);
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
export function recordSuccess(agentId: string, capabilityId?: string): void {
  const specialist = getSpecialist(agentId);
  specialist.successCount++;
  specialist.upvotes++;

  if (capabilityId) {
    const metrics = getCapabilityMetrics(agentId, capabilityId);
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
export function recordFailure(agentId: string, capabilityId?: string): void {
  const specialist = getSpecialist(agentId);
  specialist.failureCount++;
  specialist.downvotes++;

  if (capabilityId) {
    const metrics = getCapabilityMetrics(agentId, capabilityId);
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
export function submitVote(
  agentId: string,
  taskId: string,
  voterId: string,
  voterType: 'human' | 'agent',
  vote: 'up' | 'down',
  capabilityId?: string
): { success: boolean; message: string; newRate: number; upvotes: number; downvotes: number } {
  const voteKey = `${voterId}:${taskId}`;
  const existingVote = reputationData.voterTaskIndex[voteKey];
  
  const specialist = getSpecialist(agentId);
  
  // Check if already voted
  if (existingVote) {
    if (existingVote === vote) {
      return {
        success: false,
        message: `Already ${vote}voted this response`,
        newRate: Math.round(specialist.globalScore * 100),
        upvotes: specialist.upvotes,
        downvotes: specialist.downvotes,
      };
    }
    
    // Changing vote - undo previous vote
    if (existingVote === 'up') {
      specialist.upvotes = Math.max(0, specialist.upvotes - 1);
      if (capabilityId) {
        const metrics = getCapabilityMetrics(agentId, capabilityId);
        metrics.decayedUpvotes = Math.max(0, metrics.decayedUpvotes - 1);
      }
    } else {
      specialist.downvotes = Math.max(0, specialist.downvotes - 1);
      if (capabilityId) {
        const metrics = getCapabilityMetrics(agentId, capabilityId);
        metrics.decayedDownvotes = Math.max(0, metrics.decayedDownvotes - 1);
      }
    }
  }
  
  // Apply new vote
  if (vote === 'up') {
    specialist.upvotes++;
    if (capabilityId) {
      const metrics = getCapabilityMetrics(agentId, capabilityId);
      applyDecay(metrics);
      metrics.decayedUpvotes += 1;
      metrics.totalTasks = Math.max(metrics.totalTasks, 1); // Ensure task count at least 1
      metrics.currentScore = calculateScore(metrics);
    }
  } else {
    specialist.downvotes++;
    if (capabilityId) {
      const metrics = getCapabilityMetrics(agentId, capabilityId);
      applyDecay(metrics);
      metrics.decayedDownvotes += 1;
      metrics.totalTasks = Math.max(metrics.totalTasks, 1);
      metrics.currentScore = calculateScore(metrics);
    }
  }
  
  // Record the vote
  const voteRecord: Vote = {
    taskId,
    voterId,
    voterType,
    vote,
    timestamp: Date.now(),
    capabilityId
  };
  specialist.votes.push(voteRecord);
  reputationData.voterTaskIndex[voteKey] = vote;
  
  updateGlobalScore(agentId);
  saveReputation();
  
  return {
    success: true,
    message: existingVote ? `Vote changed to ${vote}vote` : `${vote === 'up' ? 'Upvote' : 'Downvote'} recorded`,
    newRate: Math.round(specialist.globalScore * 100),
    upvotes: specialist.upvotes,
    downvotes: specialist.downvotes,
  };
}

/**
 * Get the success rate for a specialist as a percentage (legacy/compat)
 */
export function getSuccessRate(agentId: string): number {
  const specialist = reputationData.specialists[agentId];
  if (!specialist) return 100;
  return Math.round(specialist.globalScore * 100);
}

/**
 * Get reputation score for a specific capability (0.0 - 1.0)
 */
export function getReputationScore(agentId: string, capabilityId?: string): number {
  const specialist = reputationData.specialists[agentId];
  if (!specialist) return REP_CONFIG.COLD_START_SCORE;

  if (capabilityId && specialist.capabilities[capabilityId]) {
    return specialist.capabilities[capabilityId].currentScore;
  }

  return specialist.globalScore;
}

/**
 * Get capability-specific reputation metrics
 */
export function getCapabilityReputation(agentId: string, capabilityId: string): CapabilityMetrics | null {
  const specialist = reputationData.specialists[agentId];
  if (!specialist || !specialist.capabilities[capabilityId]) return null;
  return specialist.capabilities[capabilityId];
}

/**
 * Get detailed reputation stats (augmented for V2)
 */
export function getReputationStats(agentId: string) {
  const specialist = reputationData.specialists[agentId];
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
export function updateSyncStatus(agentId: string, signature: string): void {
  const specialist = getSpecialist(agentId);
  specialist.lastSyncTx = signature;
  specialist.lastSyncTimestamp = Date.now();
  saveReputation();
}

/**
 * Get the vote for a specific task
 */
export function getVote(taskId: string, voterId: string): 'up' | 'down' | null {
  const voteKey = `${voterId}:${taskId}`;
  return (reputationData.voterTaskIndex[voteKey] as 'up' | 'down') || null;
}

/**
 * Get all reputation data
 */
export function getAllReputation(): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [agentId, record] of Object.entries(reputationData.specialists)) {
    result[agentId] = {
      successRate: Math.round(record.globalScore * 100),
      upvotes: record.upvotes,
      downvotes: record.downvotes,
      capabilities: Object.keys(record.capabilities)
    };
  }
  return result;
}
