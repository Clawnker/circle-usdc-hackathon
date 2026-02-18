import { createHash } from 'crypto';

export type RolloutDecision =
  | { allowed: true; mode: 'off' | 'canary'; reason: string }
  | { allowed: false; mode: 'disabled' | 'rollback' | 'canary'; reason: string };

function hashToBucket(input: string): number {
  const digest = createHash('sha256').update(input).digest();
  return digest[0]; // 0-255
}

export function evaluateDispatchRollout(userId: string): RolloutDecision {
  const killSwitch = process.env.DISPATCH_KILL_SWITCH === 'true';
  if (killSwitch) {
    return { allowed: false, mode: 'rollback', reason: 'Emergency rollback is active' };
  }

  const mode = (process.env.DISPATCH_ROLLOUT_MODE || 'off').toLowerCase();
  if (mode === 'disabled') {
    return { allowed: false, mode: 'disabled', reason: 'Dispatch rollout mode disabled' };
  }

  if (mode !== 'canary') {
    return { allowed: true, mode: 'off', reason: 'Rollout guard not active' };
  }

  const allowlist = (process.env.DISPATCH_CANARY_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowlist.includes(userId)) {
    return { allowed: true, mode: 'canary', reason: 'Caller is in canary allowlist' };
  }

  const percentage = Math.max(0, Math.min(100, Number(process.env.DISPATCH_CANARY_PERCENT || 100)));
  const bucket = hashToBucket(userId || 'anonymous');
  const threshold = Math.floor((percentage / 100) * 256);
  if (bucket < threshold) {
    return { allowed: true, mode: 'canary', reason: `Caller selected in canary ${percentage}% cohort` };
  }

  return { allowed: false, mode: 'canary', reason: `Caller outside canary ${percentage}% cohort` };
}
