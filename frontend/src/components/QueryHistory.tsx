'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, RotateCcw, CheckCircle2, XCircle, Search, Clock, ChevronDown, ChevronUp, Coins, ArrowRightLeft, Send, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { QueryHistoryItem, Payment, TransactionDetails } from '@/types';

interface QueryHistoryProps {
  history: QueryHistoryItem[];
  onReRun: (prompt: string) => void;
  className?: string;
}

const SPECIALIST_NAMES: Record<string, string> = {
  aura: 'Social Analyst',
  magos: 'Market Oracle',
  bankr: 'Bankr',
  general: 'Assistant',
  alphahunter: 'AlphaHunter',
  riskbot: 'RiskBot',
  newsdigest: 'NewsDigest',
  whalespy: 'WhaleSpy',
  scribe: 'Scribe',
  seeker: 'Seeker',
  dispatcher: 'Dispatcher',
};

export function QueryHistory({ history, onReRun, className = '' }: QueryHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatTime = (date: Date | string) => {
    try {
      const now = new Date();
      const past = new Date(date);
      const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
      
      if (diffInSeconds < 60) return 'just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } catch (e) {
      return 'just now';
    }
  };

  const truncate = (text: string, length: number) => {
    if (text.length <= length) return text;
    return text.slice(0, length) + '...';
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className={`glass-panel overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2">
          <History size={16} className="text-[var(--accent-cyan)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Query History</span>
        </div>
        {history.length > 0 && (
          <span className="text-xs text-[var(--text-muted)]">
            {history.length} items
          </span>
        )}
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-3" style={{ maxHeight: '500px' }}>
        <AnimatePresence mode="popLayout">
          {history.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center py-8"
            >
              <History size={32} className="text-[var(--text-muted)] mb-2" />
              <p className="text-sm text-[var(--text-muted)]">
                No history yet
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Your past queries will appear here
              </p>
            </motion.div>
          ) : (
            <div className="space-y-2">
              {history.map((item, index) => {
                const isExpanded = expandedId === item.id;
                
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="glass-panel-subtle overflow-hidden"
                  >
                    {/* Main Row */}
                    <div 
                      className="p-3 hover:bg-white/5 transition-all cursor-pointer"
                      onClick={() => toggleExpand(item.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-[var(--text-primary)] truncate block">
                              "{truncate(item.prompt, 80)}"
                            </span>
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                              <Search size={10} />
                              {SPECIALIST_NAMES[item.specialist] || item.specialist}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                              <Coins size={10} />
                              {item.cost.toFixed(4)} USDC
                            </span>
                            <span>•</span>
                            <span className={`flex items-center gap-1 ${item.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                              {item.status === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                              {item.status === 'success' ? 'Success' : 'Failed'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {formatTime(item.timestamp)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onReRun(item.prompt);
                            }}
                            className="p-2 rounded-lg bg-white/5 hover:bg-[var(--accent-cyan)] hover:text-black transition-all text-[var(--text-muted)]"
                            title="Re-run query"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <div className="p-1 text-[var(--text-muted)]">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-white/10"
                        >
                          <div className="p-4 space-y-4 bg-black/20">
                            {/* Result Preview */}
                            {item.result && (
                              <div>
                                <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                                  Result
                                </h4>
                                <div className="text-sm text-[var(--text-secondary)] max-h-32 overflow-y-auto bg-white/5 rounded p-3">
                                  <ReactMarkdown
                                    components={{
                                      strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                                      a: ({ href, children }) => (
                                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-cyan)] hover:underline">
                                          {children}
                                        </a>
                                      ),
                                    }}
                                  >
                                    {truncate(item.result, 500)}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )}

                            {/* x402 Payments */}
                            <div>
                              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Coins size={12} />
                                x402 Payments
                              </h4>
                              {item.payments && item.payments.length > 0 ? (
                                <div className="space-y-1">
                                  {item.payments.map((payment, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs bg-white/5 rounded px-3 py-2">
                                      <span className="text-[var(--text-secondary)]">
                                        {SPECIALIST_NAMES[payment.specialist || ''] || payment.specialist || 'Unknown'}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-[var(--accent-cyan)]">
                                          {payment.amount.toFixed(4)} {payment.currency || 'USDC'}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                          payment.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 
                                          payment.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 
                                          'bg-red-500/20 text-red-400'
                                        }`}>
                                          {payment.status}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-[var(--text-muted)] bg-white/5 rounded px-3 py-2">
                                  {item.cost > 0 ? (
                                    <div className="flex items-center justify-between">
                                      <span>{SPECIALIST_NAMES[item.specialist] || item.specialist}</span>
                                      <span className="font-mono text-[var(--accent-cyan)]">{item.cost.toFixed(4)} USDC</span>
                                    </div>
                                  ) : (
                                    'No payments for this task'
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Transactions (Swaps/Transfers) */}
                            {item.transactions && item.transactions.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-2">
                                  <ArrowRightLeft size={12} />
                                  Transactions
                                </h4>
                                <div className="space-y-2">
                                  {item.transactions.map((tx, i) => (
                                    <div key={i} className="bg-white/5 rounded p-3">
                                      {tx.type === 'swap' ? (
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className="text-[var(--text-secondary)]">Swap:</span>
                                          <span className="font-mono text-[var(--accent-gold)]">
                                            {tx.inputAmount} {tx.inputToken}
                                          </span>
                                          <ArrowRightLeft size={14} className="text-[var(--text-muted)]" />
                                          <span className="font-mono text-green-400">
                                            {tx.outputAmount?.toLocaleString()} {tx.outputToken}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 text-sm">
                                          <Send size={14} className="text-[var(--accent-cyan)]" />
                                          <span className="text-[var(--text-secondary)]">Transfer:</span>
                                          <span className="font-mono text-[var(--accent-gold)]">
                                            {tx.inputAmount} {tx.inputToken}
                                          </span>
                                          <span className="text-[var(--text-muted)]">→</span>
                                          <span className="font-mono text-xs text-[var(--text-secondary)]">
                                            {tx.recipient?.slice(0, 8)}...{tx.recipient?.slice(-6)}
                                          </span>
                                        </div>
                                      )}
                                      {tx.txHash && (
                                        <a 
                                          href={`https://sepolia.basescan.org/tx/${tx.txHash}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-xs text-[var(--accent-cyan)] hover:underline mt-2"
                                        >
                                          <ExternalLink size={10} />
                                          View on Basescan
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Task ID */}
                            <div className="text-xs text-[var(--text-muted)] font-mono">
                              Task ID: {item.id}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
