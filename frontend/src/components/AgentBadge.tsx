'use client';

import React from 'react';

interface AgentBadgeProps {
  tier: 'core' | 'marketplace';
}

export function AgentBadge({ tier }: AgentBadgeProps) {
  if (tier === 'core') {
    return (
      <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/50">
        Core
      </div>
    );
  }

  return (
    <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/50">
      Marketplace
    </div>
  );
}
