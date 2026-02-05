'use client';

import { motion } from 'framer-motion';
import { Coins, Check, AlertCircle } from 'lucide-react';
import { SpecialistPricing } from '../types';

interface CostPreviewProps {
  pricing: Record<string, SpecialistPricing>;
  specialist: string;
  onConfirm: () => void;
  isConfirmed: boolean;
}

/**
 * @deprecated Integrated into TaskInput for smoother UX
 */
export function CostPreview({ pricing, specialist, onConfirm, isConfirmed }: CostPreviewProps) {
  const selectedPricing = pricing[specialist] || pricing['general'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="mt-4 overflow-hidden"
    >
      <div className="glass-panel-subtle p-4 border-[var(--glass-border)] bg-[rgba(247,179,43,0.03)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[rgba(247,179,43,0.1)]">
              <Coins size={16} className="text-[var(--accent-gold)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Estimated Cost</h3>
          </div>
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
            <AlertCircle size={12} />
            x402 protocol
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4 p-2 rounded-lg bg-[rgba(255,255,255,0.02)]">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)] capitalize">
                {specialist} Specialist
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {selectedPricing?.description}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono text-[var(--accent-gold)]">
                {selectedPricing?.fee} USDC
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-[rgba(255,255,255,0.05)] flex justify-between items-center">
            <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Total</span>
            <span className="text-lg font-bold text-[var(--accent-gold)] glow-gold-text">
              {selectedPricing?.fee} USDC
            </span>
          </div>

          <button
            onClick={onConfirm}
            className={`
              w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg
              transition-all duration-200 text-sm font-medium
              ${isConfirmed 
                ? 'bg-[var(--accent-green)] text-[var(--bg-primary)] shadow-[0_0_15px_rgba(34,197,94,0.3)]' 
                : 'glass-panel border-[var(--glass-border)] text-[var(--text-primary)] hover:border-[var(--accent-gold)]'}
            `}
          >
            {isConfirmed ? (
              <>
                <Check size={16} />
                Price Acknowledged
              </>
            ) : (
              'Acknowledge & Continue'
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
