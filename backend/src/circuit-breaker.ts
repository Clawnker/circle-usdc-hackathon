/**
 * Circuit Breaker Service
 * Prevents "hammering" failing agents and manages failover states.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CircuitState, CircuitBreakerStatus, CircuitBreakerConfig } from './types';

const DATA_DIR = path.join(__dirname, '../data');
const CIRCUIT_FILE = path.join(DATA_DIR, 'circuit-breakers.json');

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 60000, // 1 minute
  halfOpenMaxAttempts: 1,
};

export class CircuitBreakerService {
  private statuses: Map<string, CircuitBreakerStatus> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.load();
  }

  private load() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(CIRCUIT_FILE)) {
        const data = fs.readFileSync(CIRCUIT_FILE, 'utf8');
        const parsed = JSON.parse(data);
        Object.entries(parsed).forEach(([agentId, status]) => {
          this.statuses.set(agentId, status as CircuitBreakerStatus);
        });
      }
    } catch (error) {
      console.error('[CircuitBreaker] Failed to load statuses:', error);
    }
  }

  private save() {
    try {
      const data = JSON.stringify(Object.fromEntries(this.statuses), null, 2);
      fs.writeFileSync(CIRCUIT_FILE, data, 'utf8');
    } catch (error) {
      console.error('[CircuitBreaker] Failed to save statuses:', error);
    }
  }

  private getOrCreateStatus(agentId: string): CircuitBreakerStatus {
    let status = this.statuses.get(agentId);
    if (!status) {
      status = {
        agentId,
        state: 'CLOSED',
        consecutiveFailures: 0,
        halfOpenAttempts: 0,
      };
      this.statuses.set(agentId, status);
    }
    return status;
  }

  canCall(agentId: string): boolean {
    const status = this.getOrCreateStatus(agentId);

    if (status.state === 'CLOSED') {
      return true;
    }

    const now = Date.now();
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
  }

  recordCall(agentId: string) {
    const status = this.getOrCreateStatus(agentId);
    if (status.state === 'HALF_OPEN') {
      status.halfOpenAttempts++;
      this.save();
    }
  }

  recordSuccess(agentId: string) {
    const status = this.getOrCreateStatus(agentId);
    status.state = 'CLOSED';
    status.consecutiveFailures = 0;
    status.halfOpenAttempts = 0;
    status.lastFailureTime = undefined;
    this.save();
  }

  recordFailure(agentId: string) {
    const status = this.getOrCreateStatus(agentId);
    const now = Date.now();

    if (status.state === 'HALF_OPEN') {
      status.state = 'OPEN';
      status.lastFailureTime = now;
      // We don't reset consecutiveFailures here so it stays at threshold
    } else {
      status.consecutiveFailures++;
      status.lastFailureTime = now;
      if (status.consecutiveFailures >= this.config.failureThreshold) {
        status.state = 'OPEN';
      }
    }

    this.save();
  }

  getState(agentId: string): CircuitState {
    return this.getOrCreateStatus(agentId).state;
  }
}

export const circuitBreaker = new CircuitBreakerService();
