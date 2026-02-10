import * as fs from 'fs';
import * as path from 'path';

// Mock fs before importing reputation to avoid actual file I/O
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;
mockedFs.existsSync.mockReturnValue(false);
mockedFs.readFileSync.mockReturnValue('{}');
mockedFs.writeFileSync.mockImplementation(() => {});
mockedFs.mkdirSync.mockImplementation(() => "" as any);

import { 
  recordSuccess, 
  recordFailure, 
  recordLatency, 
  getReputationScore, 
  getSuccessRate,
  getCapabilityReputation
} from '../reputation';

describe('Reputation System V2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // We set the system time to a fixed point to ensure consistent decay calculations
    jest.setSystemTime(new Date('2026-02-09T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Cold start - new agent with 0 tasks returns default 0.5 score', () => {
    const score = getReputationScore('new-agent');
    expect(score).toBe(0.5);
  });

  test('Volume-based confidence - ramped confidence for <5 tasks, full for 5+', () => {
    const agentId = 'vol-agent';
    const capId = 'test-cap';
    
    // 1 success
    // rc = (1.0 * 0.7) + (0.8 * 0.3) = 0.7 + 0.24 = 0.94 (0.8 is default l_score)
    // totalTasks = 1 (< COLD_START_TASKS=5)
    // actualWeight = 1/5 = 0.2
    // score = (0.94 * 0.2) + (0.5 * 0.8) = 0.188 + 0.4 = 0.588
    recordSuccess(agentId, capId);
    let score = getReputationScore(agentId, capId);
    expect(score).toBeCloseTo(0.588, 3);

    // 5 successes
    // totalTasks = 5 (>= COLD_START_TASKS, but < MIN_VOLUME_FOR_CONFIDENCE=20)
    // v_conf = 5 / 20 = 0.25
    // score = 0.94 * 0.25 = 0.235
    for(let i=0; i<4; i++) recordSuccess(agentId, capId);
    score = getReputationScore(agentId, capId);
    expect(score).toBeCloseTo(0.235, 3);
    
    // 20 successes
    // totalTasks = 20 (>= MIN_VOLUME_FOR_CONFIDENCE)
    // v_conf = 1.0
    // score = 0.94
    for(let i=0; i<15; i++) recordSuccess(agentId, capId);
    score = getReputationScore(agentId, capId);
    expect(score).toBeCloseTo(0.94, 3);
  });

  test('Time decay - verify exponential decay with 7-day half-life', () => {
    const agentId = 'decay-agent';
    const capId = 'test-cap';
    
    // Record success today
    recordSuccess(agentId, capId);
    let metrics = getCapabilityReputation(agentId, capId);
    expect(metrics?.decayedUpvotes).toBe(1);

    // Advance time by 7 days (168 hours)
    jest.advanceTimersByTime(7 * 24 * 60 * 60 * 1000);
    
    // Recording another success should trigger decay of the previous one
    recordSuccess(agentId, capId);
    metrics = getCapabilityReputation(agentId, capId);
    
    // Previous 1 should be decayed to 0.5. New 1 added. Total 1.5.
    expect(metrics?.decayedUpvotes).toBeCloseTo(1.5, 5);
  });

  test('Per-capability scoring - independent scores', () => {
    const agentId = 'multi-cap-agent';
    // cap-a: 20 successes
    for(let i=0; i<20; i++) recordSuccess(agentId, 'cap-a');
    // cap-b: 20 failures and bad latency
    for(let i=0; i<20; i++) {
      recordFailure(agentId, 'cap-b');
      recordLatency(agentId, 'cap-b', 30000);
    }
    
    const scoreA = getReputationScore(agentId, 'cap-a');
    const scoreB = getReputationScore(agentId, 'cap-b');
    
    expect(scoreA).toBeGreaterThan(0.9);
    expect(scoreB).toBeLessThan(0.1);
  });

  test('Latency tracking - verify p50/p95/p99 calculations', () => {
    const agentId = 'latency-agent';
    const capId = 'test-cap';
    
    const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    latencies.forEach(l => recordLatency(agentId, capId, l));
    
    const metrics = getCapabilityReputation(agentId, capId);
    // Sorted: 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000 (length 10)
    // p50: floor(10 * 0.5) = index 5 -> 600
    // p95: floor(10 * 0.95) = index 9 -> 1000
    // p99: floor(10 * 0.99) = index 9 -> 1000
    
    expect(metrics?.p50).toBe(600);
    expect(metrics?.p95).toBe(1000);
    expect(metrics?.p99).toBe(1000);
  });

  test('Combined score - verify Rc formula (70% success + 30% latency)', () => {
    const agentId = 'rc-agent';
    const capId = 'test-cap';
    
    // Give enough tasks to avoid confidence ramping
    for(let i=0; i<20; i++) recordSuccess(agentId, capId);
    
    // Set p50 to 15000ms (half of threshold 30000ms)
    // We record multiple latencies to ensure p50 is 15000
    for(let i=0; i<5; i++) recordLatency(agentId, capId, 15000);
    
    // s_decayed = 1.0 (all successes)
    // l_score = 1 - (15000 / 30000) = 0.5
    // rc = (1.0 * 0.7) + (0.5 * 0.3) = 0.7 + 0.15 = 0.85
    
    const score = getReputationScore(agentId, capId);
    expect(score).toBeCloseTo(0.85, 2);
  });

  test('Backward compatibility - getSuccessRate() returns valid number', () => {
    const agentId = 'compat-agent';
    recordSuccess(agentId, 'any');
    const rate = getSuccessRate(agentId);
    expect(typeof rate).toBe('number');
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThanOrEqual(100);
  });

  test('recordLatency() - stores per-agent per-capability latency', () => {
    const agentId = 'store-latency-agent';
    recordLatency(agentId, 'cap-1', 100);
    recordLatency(agentId, 'cap-2', 500);
    
    const m1 = getCapabilityReputation(agentId, 'cap-1');
    const m2 = getCapabilityReputation(agentId, 'cap-2');
    
    expect(m1?.latencySamples).toContain(100);
    expect(m2?.latencySamples).toContain(500);
    expect(m1?.latencySamples).not.toContain(500);
  });
});
