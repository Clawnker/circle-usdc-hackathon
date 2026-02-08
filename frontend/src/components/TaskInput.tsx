'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, TrendingUp, Coins, Loader2, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { SpecialistPricing, SpecialistType } from '../types';

interface TaskInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  initialAgentId?: string | null;
  onClearPreSelect?: () => void;
  initialPrompt?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const SUGGESTED_PROMPTS = [
  { icon: TrendingUp, text: "Find trending meme coins on Base", color: "cyan" },
  { icon: Zap, text: "Predict price for USDC/ETH", color: "purple" },
  { icon: Coins, text: "Send 5 USDC to 0x72a...", color: "pink" },
  { icon: Sparkles, text: "Base sentiment analysis", color: "green" },
];

const SPECIALIST_NAMES: Record<string, string> = {
  aura: 'Social Analyst',
  magos: 'Market Oracle',
  bankr: 'DeFi Specialist Bankr',
  general: 'General Assistant',
  alphahunter: 'AlphaHunter',
  riskbot: 'RiskBot',
  newsdigest: 'NewsDigest',
  whalespy: 'WhaleSpy',
  scribe: 'Scribe',
  seeker: 'Seeker',
};

export function TaskInput({ 
  onSubmit, 
  isLoading, 
  disabled, 
  initialAgentId, 
  onClearPreSelect,
  initialPrompt,
}: TaskInputProps) {
  const [prompt, setPrompt] = useState('');
  const [pricing, setPricing] = useState<Record<string, SpecialistPricing> | null>(null);
  const [selectedSpecialist, setSelectedSpecialist] = useState<SpecialistType>('general');
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch pricing on mount
  useEffect(() => {
    fetch(`${API_URL}/pricing`)
      .then(res => res.json())
      .then(data => setPricing(data.pricing))
      .catch(err => console.error('Failed to fetch pricing:', err));
  }, []);

  // Simplified routing logic (matching backend)
  const routePrompt = useCallback((p: string): SpecialistType => {
    const lower = p.toLowerCase();
    
    // Add pattern for "what's happening on X"
    if (lower.includes('happening on') || lower.includes('on x today')) {
      return 'aura';
    }

    if (lower.includes('good buy') || lower.includes('should i') || lower.includes('recommend') || /is \w+ a good/.test(lower)) {
      return 'magos';
    }
    if (lower.includes('talking about') || lower.includes('mentions') || lower.includes('discussing')) {
      return 'aura';
    }
    if (lower.includes('swap') || lower.includes('trade') || lower.includes('buy') || lower.includes('sell') || lower.includes('balance') || lower.includes('wallet')) {
      return 'bankr';
    }
    return 'general';
  }, []);

  // Handle auto-routing as user types
  useEffect(() => {
    if (initialAgentId) {
      setSelectedSpecialist(initialAgentId as SpecialistType);
      return;
    }

    // Default to general assistant when typing
    setSelectedSpecialist('general');
    setIsDebouncing(false);
  }, [initialAgentId]);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  const handleDispatch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading || disabled) return;

    const currentFee = pricing?.[selectedSpecialist]?.fee || '0';
    const isHighAmount = parseFloat(currentFee) > 0.01;

    if (isHighAmount && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    onSubmit(prompt.trim());
    setShowConfirmation(false);
    if (onClearPreSelect) onClearPreSelect();
  };

  const currentPricing = pricing?.[selectedSpecialist];
  const isReady = prompt.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className="w-full space-y-4">
      <div className="relative">
        <form onSubmit={handleDispatch} className="group">
          <div className={`
            relative flex flex-col transition-all duration-300 rounded-2xl overflow-hidden
            bg-[#0D0D0D]/80 backdrop-blur-xl border-2
            ${isReady ? 'border-[rgba(247,179,43,0.3)] shadow-[0_0_30px_rgba(247,179,43,0.05)]' : 'border-white/5'}
            focus-within:border-[rgba(247,179,43,0.5)] focus-within:shadow-[0_0_40px_rgba(247,179,43,0.1)]
          `}>
            {/* Input Field */}
            <div className="flex items-center p-2 gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask the Hivemind anything..."
                  disabled={isLoading || disabled}
                  className="w-full bg-transparent px-5 py-4 text-xl text-white
                    placeholder:text-white/20 focus:outline-none disabled:opacity-50"
                />
                
                {/* Specialist Indicator (Inline) */}
                <AnimatePresence>
                  {prompt.trim() && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none"
                    >
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                        <div className={`w-1.5 h-1.5 rounded-full bg-[var(--accent-gold)] shadow-[0_0_8px_var(--accent-gold)]`} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                          Ready to dispatch
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Button */}
              <motion.button
                type="submit"
                disabled={!isReady}
                whileHover={isReady ? { scale: 1.02, x: 2 } : {}}
                whileTap={isReady ? { scale: 0.98 } : {}}
                className={`
                  relative overflow-hidden group/btn flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-300
                  ${isReady 
                    ? 'bg-gradient-to-r from-[#F7B32B] to-[#f97316] text-[#0D0D0D] shadow-[0_0_25px_rgba(247,179,43,0.4)]' 
                    : 'bg-white/5 text-white/20 cursor-not-allowed'}
                `}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Routing...</span>
                  </>
                ) : showConfirmation ? (
                  <>
                    <CheckCircle2 size={20} />
                    <span>Confirm Dispatch</span>
                  </>
                ) : (
                  <>
                    <span>Send</span>
                    {currentPricing && (
                      <span className="opacity-70 text-sm font-medium border-l border-black/20 pl-3">
                        {parseFloat(currentPricing.fee).toFixed(4)} USDC
                      </span>
                    )}
                    <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                  </>
                )}
              </motion.button>
            </div>

            {/* Bottom Info Bar */}
            <AnimatePresence>
              {prompt.trim() && !isLoading && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-white/5 bg-white/[0.02] px-6 py-2.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-[11px] text-white/40 uppercase tracking-widest font-medium">Estimated Cost</span>
                    <span className="text-sm font-mono text-[var(--accent-gold)]">
                      {currentPricing ? parseFloat(currentPricing.fee).toFixed(4) : '0.0001'} USDC
                    </span>
                    <span className="text-white/20">•</span>
                    <span className="text-[11px] text-white/40 uppercase tracking-widest font-medium">System</span>
                    <span className="text-sm text-white/70">
                      Hivemind Routing Enabled
                    </span>
                  </div>
                  
                  {showConfirmation && (
                    <motion.div 
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="flex items-center gap-2 text-[var(--accent-gold)]"
                    >
                      <AlertCircle size={14} />
                      <span className="text-xs font-medium italic">High value task - please confirm</span>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </form>
      </div>

      {/* Suggested Prompts */}
      <AnimatePresence>
        {!prompt.trim() && !isLoading && (
          <motion.div 
            className="flex flex-wrap gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            {SUGGESTED_PROMPTS.map((suggestion, index) => {
              const Icon = suggestion.icon;
              return (
                <motion.button
                  key={index}
                  onClick={() => setPrompt(suggestion.text)}
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.08)' }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl glass-panel-subtle text-sm text-white/60 hover:text-white transition-colors cursor-pointer border border-white/5"
                >
                  <Icon size={14} className="text-[var(--accent-gold)]" />
                  <span>{suggestion.text}</span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}