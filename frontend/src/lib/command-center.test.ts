import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SWARM_AGENTS,
  buildBazaarRegistration,
  deriveBazaarCapabilities,
  getRegistryColor,
} from './command-center';

describe('command-center helpers', () => {
  it('keeps the default swarm stable', () => {
    expect(DEFAULT_SWARM_AGENTS).toEqual(['bankr', 'scribe', 'seeker']);
  });

  it('derives and deduplicates bazaar capabilities', () => {
    const capabilities = deriveBazaarCapabilities('Security audit and backend developer assistant for cloud systems');

    expect(capabilities).toContain('Security audit');
    expect(capabilities).toContain('Software development');
    expect(capabilities.length).toBeLessThanOrEqual(5);
    expect(new Set(capabilities).size).toBe(capabilities.length);
  });

  it('falls back to a general capability when description is empty', () => {
    expect(deriveBazaarCapabilities('')).toEqual(['General purpose agent']);
  });

  it('builds a stable bazaar registration payload', () => {
    const registration = buildBazaarRegistration({
      name: 'Security Sentinel',
      description: 'Security audit and trading assistant',
    });

    expect(registration.agentId).toBe('security-sentinel');
    expect(registration.metadata.name).toBe('Security Sentinel');
    expect(registration.metadata.description).toBe('Security audit and trading assistant');
    expect(registration.metadata.capabilities).toEqual(registration.capabilities);
    expect(registration.metadata.color).toBe(getRegistryColor('security-sentinel'));
  });
});
