'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Coins, Sparkles, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Import all specialist cards
import { MagosCard, AuraCard, BankrCard, SeekerCard, MultiHopCard } from './cards';

interface ResultCardProps {
  query: string;
  status: 'success' | 'failure';
  result: string;
  cost: number;
  specialist: string;
  taskId?: string;
  onNewQuery: () => void;
  onViewDetails?: () => void;
  isMultiHop?: boolean;
  rawResult?: any; // Add rawResult prop to receive structured data
}

const USER_ID = 'demo-user'; // In production, this would come from auth

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Detect specialist type from result data
function detectCardType(result: any, specialist: string): string {
  if (result?.isDAG || result?.isMultiHop) return 'multi-hop'; // Check directly on result.data
  const s = specialist?.toLowerCase();
  if (s?.includes('magos') || s?.includes('market')) return 'magos';
  if (s?.includes('aura') || s?.includes('sentiment')) return 'aura';
  if (s?.includes('bankr') || s?.includes('defi')) return 'bankr';
  if (s?.includes('seeker') || s?.includes('research')) return 'seeker';
  return 'generic';
}

// Data adapters: map backend specialist responses to card-expected shapes
function adaptBankrData(data: any) {
  if (!data) return data;
  return {
    transactionSummary: {
      inputAmount: data.details?.amount || data.quote?.inputAmount || '0',
      inputToken: data.details?.from || data.quote?.inputToken || '?',
      outputAmount: data.details?.estimatedOutput || data.quote?.outputAmount || '0',
      outputToken: data.details?.to || data.quote?.outputToken || '?',
    },
    route: data.details?.routePlan?.map((h: any) => h.dex) || [],
    priceImpact: data.details?.priceImpact ? parseFloat(data.details.priceImpact) / 100 : undefined,
    feeEstimate: {
      gasCost: data.details?.gasEstimate || data.gasEstimate || '~0.000005 SOL',
      currency: 'SOL',
    },
    balanceBefore: data.details?.balancesBefore 
      ? Object.entries(data.details.balancesBefore).map(([token, amount]) => ({ token, amount: String(amount) }))
      : undefined,
    balanceAfter: data.details?.balancesAfter
      ? Object.entries(data.details.balancesAfter).map(([token, amount]) => ({ token, amount: String(amount) }))
      : undefined,
    requiresApproval: data.requiresApproval,
    status: data.status,
    summary: data.summary,
  };
}

function adaptSeekerData(data: any) {
  if (!data) return data;
  return {
    query: data.details?.query || '',
    keyFindings: data.results?.slice(0, 5).map((r: any) => ({
      title: r.title || 'Untitled',
      content: r.description || '',
    })) || [],
    citations: data.results?.map((r: any) => ({
      title: r.title || 'Untitled',
      url: r.url || '#',
      source: 'web' as const,
    })) || [],
    summary: data.summary || data.insight || '',
  };
}

// Component to delegate rendering to the correct specialist card
const SpecialistCard = ({ type, data }: { type: string; data: any }) => {
  switch (type) {
    case 'magos':
      return <MagosCard data={data} />;
    case 'aura':
      return <AuraCard data={data} />;
    case 'bankr':
      return <BankrCard data={adaptBankrData(data)} />;
    case 'seeker':
      return <SeekerCard data={adaptSeekerData(data)} />;
    case 'multi-hop':
      return <MultiHopCard data={data} />;
    default:
      return null;
  }
};

export function ResultCard({
  query,
  status,
  result,
  cost,
  specialist,
  taskId,
  onNewQuery,
  onViewDetails,
  isMultiHop,
  rawResult, // Destructure rawResult
}: ResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [voteStats, setVoteStats] = useState({ upvotes: 0, downvotes: 0, successRate: 100 });
  const [isVoting, setIsVoting] = useState(false);
  
  const isSuccess = status === 'success';
  // Show more content for search/research results
  const truncateLength = result.includes('**') || result.includes('🔍') ? 500 : 200;
  const summary = result.length > truncateLength ? result.substring(0, truncateLength) + '...' : result;
  const displayResult = isExpanded ? result : summary;

  // Detect card type early
  const cardType = detectCardType(rawResult?.data, specialist); // Pass rawResult.data to detectCardType

  // If we have structured data and a specialist card, render it
  if (cardType !== 'generic' && rawResult?.data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass-panel gradient-border p-6 w-full max-w-2xl mx-auto overflow-hidden relative"
      >
        <SpecialistCard type={cardType} data={rawResult.data} />
        {/* Keep voting, download, and Ask Another functionality */}
        {/* Re-implementing simplified footer for specialist cards */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
          <motion.button
            onClick={onNewQuery}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-[var(--accent-gold)] to-[#FFD700] text-black font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,191,0,0.3)]"
          >
            <RotateCcw size={18} />
            <span>Ask Another</span>
          </motion.button>

          <motion.button
            onClick={() => {
              // This download should download the raw JSON for specialist cards
              const filename = `hivemind-data-${specialist.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
              const blob = new Blob([JSON.stringify(rawResult.data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)' }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto py-3 px-8 rounded-xl bg-white/5 border border-white/10 text-[var(--text-primary)] font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <Download size={18} />
            <span>Download Raw Data</span>
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // Fetch existing vote and stats on mount
  useEffect(() => {
    if (taskId && specialist) {
      // Get existing vote
      fetch(`${API_URL}/api/vote/${taskId}/${USER_ID}`)
        .then(res => res.json())
        .then(data => setUserVote(data.vote))
        .catch(() => {});
      
      // Get reputation stats
      fetch(`${API_URL}/api/reputation/${specialist}`)
        .then(res => res.json())
        .then(data => setVoteStats({
          upvotes: data.upvotes || 0,
          downvotes: data.downvotes || 0,
          successRate: data.successRate || 100,
        }))
        .catch(() => {});
    }
  }, [taskId, specialist]);

  const handleVote = async (vote: 'up' | 'down') => {
    if (!taskId || isVoting) return;
    
    setIsVoting(true);
    try {
      const response = await fetch(`${API_URL}/api/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          specialist,
          voterId: USER_ID,
          voterType: 'human',
          vote,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setUserVote(vote);
        setVoteStats({
          upvotes: data.upvotes,
          downvotes: data.downvotes,
          successRate: data.newRate,
        });
      }
    } catch (error) {
      console.error('Vote failed:', error);
    }
    setIsVoting(false);
  };

  const handleDownload = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `hivemind-report-${specialist.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.md`;
    
    const content = `# Hivemind Protocol Report\n\n## Query\n${query}\n\n## Specialist\n${specialist}\n\n## Result\n${result}\n\n## Cost\n${cost.toFixed(2)} USDC\n\n## Timestamp\n${new Date().toLocaleString()}\n`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="glass-panel gradient-border p-6 w-full max-w-2xl mx-auto overflow-hidden relative"
    >
      {/* Background Pulse Animation */}
      <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-20 ${isSuccess ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      
      <div className="flex items-start gap-4 mb-6">
        <div className={`p-3 rounded-full ${isSuccess ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {isSuccess ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
        </div>
        
        <div className="flex-1">
          <div className="text-sm text-gray-400 mb-2">
            <span className="text-gray-500">Query:</span> "{query}"
          </div>
          <div className="flex items-center justify-between mb-1">
            <h3 className={`text-xl font-bold ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
              {isMultiHop ? 'Workflow Completed' : `Task ${isSuccess ? 'Completed' : 'Failed'}`}
            </h3>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <Sparkles size={14} className="text-[var(--accent-gold)]" />
              <span className="text-xs font-mono text-[var(--text-secondary)]">
                {isMultiHop ? `Via: ${specialist}` : specialist}
              </span>
            </div>
          </div>
          <div className={`text-[var(--text-secondary)] leading-relaxed max-h-80 overflow-y-auto pr-2 ${isExpanded ? '' : 'max-h-48'}`}>
            <ReactMarkdown
              components={{
                strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                em: ({ children }) => <em className="text-gray-400 italic">{children}</em>,
                p: ({ children }) => <p className="mb-2">{children}</p>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-cyan)] hover:underline">
                    {children}
                  </a>
                ),
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
              }}
            >
              {displayResult}
            </ReactMarkdown>
          </div>
          {result.length > (result.includes('**') ? 500 : 200) && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-sm text-[var(--accent-cyan)] hover:text-[var(--accent-gold)] mt-2 transition-colors"
            >
              {isExpanded ? <><ChevronUp size={16} /> Show Less</> : <><ChevronDown size={16} /> Show More</>}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="glass-panel-subtle p-4 flex flex-col gap-1 border-white/5">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">
            <Coins size={14} />
            Cost Incurred
          </div>
          <span className="text-xl font-mono font-bold text-[var(--accent-cyan)]">
            {cost.toFixed(2)} <span className="text-xs text-[var(--text-muted)]">USDC</span>
          </span>
        </div>
        
        <div className="glass-panel-subtle p-4 flex flex-col gap-1 border-white/5">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">
            <RotateCcw size={14} />
            Status
          </div>
          <span className={`text-xl font-bold ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
            {isSuccess ? 'Success' : 'Error'}
          </span>
        </div>
      </div>

      {/* Voting Section */}
      {taskId && (
        <div className="mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-secondary)]">Rate this response</span>
              <span className="ml-2 text-xs">
                ({voteStats.upvotes} 👍 / {voteStats.downvotes} 👎 • {voteStats.successRate}% approval)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                onClick={() => handleVote('up')}
                disabled={isVoting}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`p-2 rounded-lg transition-all ${
                  userVote === 'up'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                    : 'bg-white/5 text-gray-400 hover:text-green-400 hover:bg-green-500/10 border border-transparent'
                } ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Helpful response"
              >
                <ThumbsUp size={18} />
              </motion.button>
              <motion.button
                onClick={() => handleVote('down')}
                disabled={isVoting}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`p-2 rounded-lg transition-all ${
                  userVote === 'down'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                    : 'bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent'
                } ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Unhelpful response"
              >
                <ThumbsDown size={18} />
              </motion.button>
            </div>
          </div>
          {userVote && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-[var(--text-muted)] mt-2"
            >
              ✓ Your feedback helps improve agent quality globally
            </motion.p>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <motion.button
          onClick={onNewQuery}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-[var(--accent-gold)] to-[#FFD700] text-black font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,191,0,0.3)]"
        >
          <RotateCcw size={18} />
          <span>Ask Another</span>
        </motion.button>

        <motion.button
          onClick={handleDownload}
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.98 }}
          className="w-full sm:w-auto py-3 px-8 rounded-xl bg-white/5 border border-white/10 text-[var(--text-primary)] font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <Download size={18} />
          <span>Download Report</span>
        </motion.button>
        
        {result.length > 200 && (
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)' }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto py-3 px-8 rounded-xl bg-white/5 border border-white/10 text-[var(--text-primary)] font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <span>{isExpanded ? 'Show Less' : 'View Full Result'}</span>
            <ArrowRight size={18} className={isExpanded ? '-rotate-90 transition-transform' : 'transition-transform'} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
