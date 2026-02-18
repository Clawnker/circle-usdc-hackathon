'use client';

import { Globe } from 'lucide-react';
import type { NetworkMode } from '@/lib/networkMode';
import { NETWORK_MODE_LABELS, supportsDirectPayments } from '@/lib/networkMode';

interface NetworkModeToggleProps {
  mode: NetworkMode;
  onChange: (mode: NetworkMode) => void;
  disabled?: boolean;
}

export function NetworkModeToggle({ mode, onChange, disabled }: NetworkModeToggleProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 glass-panel-subtle rounded-xl border border-white/10">
      <Globe size={14} className="text-[var(--accent-cyan)]" />
      <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1">
        {(['testnet', 'mainnet'] as const).map((candidate) => (
          <button
            key={candidate}
            disabled={disabled}
            onClick={() => onChange(candidate)}
            className={`px-2 py-1 rounded-md text-[10px] uppercase tracking-wider font-semibold transition-all ${
              mode === candidate
                ? 'bg-[var(--accent-gold)] text-black'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            {NETWORK_MODE_LABELS[candidate].shortLabel}
          </button>
        ))}
      </div>
      <span className="text-[10px] text-white/60 hidden md:inline">{NETWORK_MODE_LABELS[mode].label}</span>
      {!supportsDirectPayments(mode) && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Preview-only</span>
      )}
    </div>
  );
}
