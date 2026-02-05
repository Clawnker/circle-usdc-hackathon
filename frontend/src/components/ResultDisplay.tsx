'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, Sparkles, TrendingUp, Brain, Zap } from 'lucide-react';
import type { TaskStatus } from '@/types';

interface ResultDisplayProps {
  taskStatus: TaskStatus | null;
  result: unknown;
  error?: string;
  className?: string;
}

interface SpecialistResult {
  success?: boolean;
  data?: {
    insight?: string;
    confidence?: number;
    relatedTokens?: string[];
    sentiment?: number;
    trending?: string[];
    type?: string;
    status?: string;
    txSignature?: string;
    details?: any;
    market?: string;
    mood?: string;
    topMentions?: string[];
    summary?: string;
  };
  confidence?: number;
  timestamp?: string;
}

export function ResultDisplay({ taskStatus, result, error, className = '' }: ResultDisplayProps) {
  
  const formatHumanReadable = (data: unknown): React.ReactNode => {
    if (!data) return null;
    
    const r = data as SpecialistResult;
    
    // Check for Magos insight
    if (r.data?.insight) {
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Brain className="text-[#ec4899] mt-1 flex-shrink-0" size={20} />
            <div>
              <h4 className="text-sm font-semibold text-[#ec4899] mb-1">Magos Analysis</h4>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                {r.data.insight}
              </p>
            </div>
          </div>
          
          {r.data.confidence && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Confidence:</span>
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden max-w-[200px]">
                <div 
                  className="h-full bg-gradient-to-r from-[#ec4899] to-[#F7B32B]"
                  style={{ width: `${(r.data.confidence || r.confidence || 0) * 100}%` }}
                />
              </div>
              <span className="text-xs text-[var(--text-secondary)]">
                {((r.data.confidence || r.confidence || 0) * 100).toFixed(0)}%
              </span>
            </div>
          )}
          
          {r.data.relatedTokens && r.data.relatedTokens.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--text-muted)]">Related:</span>
              {r.data.relatedTokens.map((token, i) => (
                <span 
                  key={i}
                  className="px-2 py-0.5 rounded-full bg-[#ec4899]/20 text-[#ec4899] text-xs font-medium"
                >
                  ${token}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    // Check for Aura sentiment
    if (r.data?.mood || r.data?.sentiment !== undefined) {
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Sparkles className="text-[#a855f7] mt-1 flex-shrink-0" size={20} />
            <div>
              <h4 className="text-sm font-semibold text-[#a855f7] mb-1">Aura Sentiment</h4>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                {r.data.summary || `Market mood: ${r.data.mood || 'neutral'}`}
              </p>
            </div>
          </div>
          
          {r.data.topMentions && r.data.topMentions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--text-muted)]">Trending:</span>
              {r.data.topMentions.map((mention, i) => (
                <span 
                  key={i}
                  className="px-2 py-0.5 rounded-full bg-[#a855f7]/20 text-[#a855f7] text-xs font-medium"
                >
                  {mention}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    // Check for bankr transaction
    if (r.data?.type === 'swap' || r.data?.type === 'transfer') {
      const details = r.data.details || {};
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Zap className="text-[#22c55e] mt-1 flex-shrink-0" size={20} />
            <div>
              <h4 className="text-sm font-semibold text-[#22c55e] mb-1">
                bankr {r.data.type === 'swap' ? 'Swap' : 'Transfer'} 
                {r.data.status === 'confirmed' ? ' ✓' : r.data.status === 'simulated' ? ' (Simulated)' : ''}
              </h4>
              {details.response ? (
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                  {typeof details.response === 'string' ? details.response : JSON.stringify(details.response)}
                </p>
              ) : (
                <p className="text-sm text-[var(--text-primary)]">
                  {details.from && details.to 
                    ? `${details.amount || '?'} ${details.from} → ${details.to}`
                    : 'Transaction processed'}
                </p>
              )}
            </div>
          </div>
          
          {r.data.txSignature && (
            <a
              href={`https://solscan.io/tx/${r.data.txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-[#00F0FF] hover:underline"
            >
              <TrendingUp size={12} />
              View on Solscan: {r.data.txSignature.slice(0, 20)}...
            </a>
          )}
        </div>
      );
    }
    
    // Fallback: formatted JSON
    return (
      <pre className="text-xs text-[var(--text-secondary)] font-mono overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  if (!taskStatus && !result && !error) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`glass-panel overflow-hidden ${className}`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--glass-border)]">
          {taskStatus === 'completed' ? (
            <>
              <CheckCircle size={16} className="text-[#22c55e]" />
              <span className="text-sm font-medium text-[#22c55e]">
                Task Completed
              </span>
            </>
          ) : taskStatus === 'failed' ? (
            <>
              <XCircle size={16} className="text-red-500" />
              <span className="text-sm font-medium text-red-500">
                Task Failed
              </span>
            </>
          ) : taskStatus === 'executing' || taskStatus === 'planning' || taskStatus === 'processing' ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 size={16} className="text-[#00F0FF]" />
              </motion.div>
              <span className="text-sm font-medium text-[#00F0FF]">
                {taskStatus === 'planning' ? 'Planning...' : 'Processing...'}
              </span>
            </>
          ) : (
            <>
              <Sparkles size={16} className="text-[#F7B32B]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Result
              </span>
            </>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {error ? (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          ) : taskStatus === 'executing' || taskStatus === 'planning' || taskStatus === 'processing' ? (
            <div className="flex items-center justify-center py-8">
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
                <span className="text-sm text-[var(--text-secondary)]">
                  Agents are working on your request...
                </span>
              </motion.div>
            </div>
          ) : result ? (
            formatHumanReadable(result)
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
