'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon, Activity, History } from 'lucide-react';
import {
  TaskInput,
  SwarmGraph,
  WalletPanel,
  PaymentFeed,
  MessageLog,
  ResultDisplay,
  Marketplace,
  ResultCard,
  QueryHistory,
} from '@/components';
import { AgentDetailModal } from '@/components/AgentDetailModal';
import { ActivityFeed, ActivityItem } from '@/components/ActivityFeed';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { SpecialistType, QueryHistoryItem } from '@/types';
import { LayoutGrid, Zap } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const SPECIALIST_NAMES: Record<string, string> = {
  aura: 'Social Analyst Aura',
  magos: 'Market Oracle Magos',
  bankr: 'DeFi Specialist Bankr',
  general: 'General Assistant',
  alphahunter: 'AlphaHunter',
  riskbot: 'RiskBot',
  newsdigest: 'NewsDigest',
  whalespy: 'WhaleSpy',
  scribe: 'Scribe',
  seeker: 'Seeker',
  dispatcher: 'Dispatcher',
  'multi-hop': 'Multi-hop Orchestrator',
};

const SPECIALIST_FEES: Record<string, number> = {
  bankr: 0.0001,
  scribe: 0.0001,
  seeker: 0.0001,
  magos: 0.001,
  aura: 0.0005,
  general: 0,
};

export default function CommandCenter() {
  const [activeView, setActiveView] = useState<'dispatch' | 'marketplace' | 'history'>('dispatch');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<SpecialistType | null>(null);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [preSelectedAgent, setPreSelectedAgent] = useState<string | null>(null);
  const [hiredAgents, setHiredAgents] = useState<string[]>(['bankr', 'scribe', 'seeker']);
  const [customInstructions, setCustomInstructions] = useState<Record<string, string>>({});
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [reRunPrompt, setReRunPrompt] = useState<string>('');
  const [lastResult, setLastResult] = useState<{
    query: string;
    status: 'success' | 'failure';
    result: string;
    cost: number;
    specialist: string;
  } | null>(null);
  
  const {
    isConnected,
    taskStatus,
    currentStep,
    messages,
    payments,
    result,
    subscribe,
    reset,
  } = useWebSocket();

  // Persistence for query history
  useEffect(() => {
    const saved = localStorage.getItem('queryHistory');
    if (saved) {
      try {
        setQueryHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse query history', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('queryHistory', JSON.stringify(queryHistory));
  }, [queryHistory]);

  // Add activity when task status changes
  useEffect(() => {
    if (taskStatus && currentTaskId) {
      const specialist = currentStep?.specialist || 'dispatcher';
      const specialistName = SPECIALIST_NAMES[specialist] || specialist;
      
      let message = '';
      let type: ActivityItem['type'] = 'processing';
      
      switch (taskStatus) {
        case 'routing':
          message = `Analyzing request...`;
          type = 'dispatch';
          break;
        case 'awaiting_payment':
          message = `Awaiting payment confirmation`;
          type = 'processing';
          break;
        case 'processing':
          message = `Processing with ${specialistName}`;
          type = 'processing';
          break;
        case 'completed':
          message = `Task completed successfully`;
          type = 'result';
          setIsLoading(false);
          // Set last result for ResultCard
          if (result) {
            const r = result as any;
            let content = '';
            
            // Handle multi-hop steps
            if (r.data?.isMultiHop && r.data?.steps) {
              const hops = r.data.hops as string[];
              message = `Successfully orchestrated: ${hops.join(' → ')}`;
              content = r.data.steps.map((s: any) => {
                const sName = SPECIALIST_NAMES[s.specialist] || s.specialist;
                return `[${sName}]\n${s.summary}`;
              }).join('\n\n');
            } else {
              if (r.data?.insight) content = r.data.insight;
              else if (r.data?.summary) content = r.data.summary;
              else if (r.data?.details?.response) content = typeof r.data.details.response === 'string' ? r.data.details.response : JSON.stringify(r.data.details.response);
            }
            
            const totalCost = payments.reduce((sum, p) => sum + p.amount, 0);
            const specialistId = currentStep?.specialist || 'dispatcher';
            
            setLastResult({
              query: currentPrompt,
              status: 'success',
              result: content || 'Task completed',
              cost: totalCost,
              specialist: r.data?.isMultiHop ? r.data.hops.map((h: string) => h.charAt(0).toUpperCase() + h.slice(1)).join(' → ') : (SPECIALIST_NAMES[specialistId] || specialistId),
              isMultiHop: r.data?.isMultiHop
            } as any);

            // Add to query history
            setQueryHistory(prev => {
              const newItem: QueryHistoryItem = {
                id: currentTaskId,
                prompt: currentPrompt,
                specialist: specialistId,
                cost: totalCost,
                status: 'success' as const,
                timestamp: new Date(),
                result: content
              };
              return [newItem, ...prev].slice(0, 20);
            });
          }
          break;
        case 'failed':
          message = `Task failed`;
          type = 'error';
          setIsLoading(false);
          const totalCostFailed = payments.reduce((sum, p) => sum + p.amount, 0);
          const specialistIdFailed = currentStep?.specialist || 'dispatcher';

          setLastResult({
            query: currentPrompt,
            status: 'failure',
            result: error || 'An unexpected error occurred',
            cost: totalCostFailed,
            specialist: SPECIALIST_NAMES[specialistIdFailed] || specialistIdFailed
          });

          // Add to query history
          setQueryHistory(prev => {
            const newItem: QueryHistoryItem = {
              id: currentTaskId || Date.now().toString(),
              prompt: currentPrompt,
              specialist: specialistIdFailed,
              cost: totalCostFailed,
              status: 'failed' as const,
              timestamp: new Date(),
            };
            return [newItem, ...prev].slice(0, 20);
          });
          break;
        default:
          message = `Status: ${taskStatus}`;
      }
      
      setActivityItems(prev => {
        // Avoid duplicate status messages
        const lastItem = prev[prev.length - 1];
        if (lastItem?.message === message) return prev;
        
        return [...prev, {
          id: `${Date.now()}-${taskStatus}`,
          type,
          message,
          specialist,
          timestamp: new Date(),
        }];
      });
    }
  }, [taskStatus, currentStep, currentTaskId, result, payments, currentPrompt, error]);

  // Add activity for payments
  useEffect(() => {
    if (payments.length > 0) {
      const latestPayment = payments[payments.length - 1];
      setActivityItems(prev => {
        // Check if we already have this payment
        if (prev.some(item => item.id === `payment-${latestPayment.id}`)) return prev;
        
        return [...prev, {
          id: `payment-${latestPayment.id}`,
          type: 'payment',
          message: `Paid ${latestPayment.amount} ${latestPayment.token}`,
          specialist: latestPayment.to,
          timestamp: new Date(),
          link: latestPayment.txSignature 
            ? `https://solscan.io/tx/${latestPayment.txSignature}?cluster=devnet`
            : undefined,
        }];
      });
    }
  }, [payments]);

  // Add agent message when result comes in
  useEffect(() => {
    if (result && currentStep?.specialist) {
      const r = result as any;
      let content = '';
      
      if (r.data?.insight) {
        content = r.data.insight;
      } else if (r.data?.summary) {
        content = r.data.summary;
      } else if (r.data?.details?.response) {
        content = typeof r.data.details.response === 'string' 
          ? r.data.details.response 
          : JSON.stringify(r.data.details.response);
      } else if (r.data?.type) {
        content = `${r.data.type} ${r.data.status || 'completed'}`;
      }
      
      if (content) {
        // Note: messages come from WebSocket, but we can add to activity
        setActivityItems(prev => [...prev, {
          id: `msg-${Date.now()}`,
          type: 'result',
          message: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
          specialist: currentStep.specialist || 'dispatcher',
          timestamp: new Date(),
          details: content,
        }]);
      }
    }
  }, [result, currentStep]);

  const handleSubmit = useCallback(async (prompt: string) => {
    setIsLoading(true);
    setError(null);
    setLastResult(null);
    setCurrentPrompt(prompt);
    reset();
    setActivityItems([{
      id: `${Date.now()}-submit`,
      type: 'dispatch',
      message: `Dispatching: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`,
      specialist: 'dispatcher',
      timestamp: new Date(),
    }]);

    try {
      const response = await fetch(`${API_URL}/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'demo-key',
        },
        body: JSON.stringify({
          prompt,
          userId: 'demo-user',
          customInstructions,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`);
      }

      const data = await response.json();
      setCurrentTaskId(data.taskId);
      subscribe(data.taskId);
      
      // Add routing activity
      const specialistName = SPECIALIST_NAMES[data.specialist] || data.specialist;
      setActivityItems(prev => [...prev, {
        id: `${Date.now()}-routed`,
        type: 'dispatch',
        message: `Routed to ${specialistName}`,
        specialist: data.specialist,
        timestamp: new Date(),
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit task');
      setIsLoading(false);
    }
  }, [reset, subscribe, customInstructions]);

  const handleNewQuery = useCallback(() => {
    setLastResult(null);
    setCurrentTaskId(null);
    setReRunPrompt('');
    reset();
  }, [reset]);

  const handleHireAgent = useCallback((agentId: string) => {
    setPreSelectedAgent(agentId);
    setHiredAgents(prev => prev.includes(agentId) ? prev : [...prev, agentId]);
    setActiveView('dispatch');
    // We could also pre-fill the prompt here if we wanted
  }, []);

  const removeHiredAgent = useCallback((agentId: string) => {
    setHiredAgents(prev => prev.filter(id => id !== agentId));
    if (preSelectedAgent === agentId) {
      setPreSelectedAgent(null);
    }
  }, [preSelectedAgent]);

  const handleUpdateInstructions = useCallback((agentId: string, instructions: string) => {
    setCustomInstructions(prev => ({
      ...prev,
      [agentId]: instructions
    }));
  }, []);

  const handleReRun = useCallback((prompt: string) => {
    setReRunPrompt(prompt);
    setActiveView('dispatch');
    handleSubmit(prompt);
  }, [handleSubmit]);

  // Reset loading state when task completes
  if (isLoading && (taskStatus === 'completed' || taskStatus === 'failed')) {
    setIsLoading(false);
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated Background */}
      <div className="animated-bg" />
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col p-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2 rounded-xl glass-panel relative"
              whileHover={{ scale: 1.05, rotate: 30 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <Hexagon size={28} className="text-[var(--accent-gold)]" strokeWidth={2.5} />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-gradient">
                Hivemind Protocol
              </h1>
              <p className="text-sm text-[var(--accent-gold)] opacity-80">
                Where agents find agents.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center p-1.5 glass-panel-subtle rounded-xl bg-black/20 backdrop-blur-md border border-white/5">
              <button
                onClick={() => setActiveView('dispatch')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 cursor-pointer ${
                  activeView === 'dispatch' 
                    ? 'bg-gradient-to-r from-[#F7B32B] to-[#f97316] text-[#0D0D0D] shadow-[0_0_20px_rgba(247,179,43,0.3)] scale-105' 
                    : 'text-white/50 hover:text-white/90 hover:bg-white/10'
                }`}
              >
                <Zap size={16} fill={activeView === 'dispatch' ? 'currentColor' : 'none'} />
                <span>Dispatch</span>
              </button>
              <button
                onClick={() => setActiveView('marketplace')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 cursor-pointer ${
                  activeView === 'marketplace' 
                    ? 'bg-gradient-to-r from-[#F7B32B] to-[#f97316] text-[#0D0D0D] shadow-[0_0_20px_rgba(247,179,43,0.3)] scale-105' 
                    : 'text-white/50 hover:text-white/90 hover:bg-white/10'
                }`}
              >
                <LayoutGrid size={16} />
                <span>Marketplace</span>
              </button>
              <button
                onClick={() => setActiveView('history')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 cursor-pointer ${
                  activeView === 'history' 
                    ? 'bg-gradient-to-r from-[#F7B32B] to-[#f97316] text-[#0D0D0D] shadow-[0_0_20px_rgba(247,179,43,0.3)] scale-105' 
                    : 'text-white/50 hover:text-white/90 hover:bg-white/10'
                }`}
              >
                <History size={16} />
                <span>History</span>
              </button>
            </div>
          
            {/* Connection Status */}
            <motion.div 
            className="flex items-center gap-2 px-3 py-2 rounded-full glass-panel-subtle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            title={isConnected ? 'WebSocket connected to backend' : 'Backend not running - start with: cd hackathon/backend && npm run dev'}
          >
            <div className={`status-dot ${isConnected ? 'status-active' : 'status-error'}`} />
            <span className="text-xs text-[var(--text-secondary)]">
              {isConnected ? 'Connected' : 'Backend Offline'}
            </span>
          </motion.div>
          </div>
        </motion.header>

        {/* Main Content Area */}
        <AnimatePresence mode="wait">
          {activeView === 'dispatch' ? (
            <motion.div
              key="dispatch"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              {/* Task Input or Result Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6"
              >
                <AnimatePresence mode="wait">
                  {lastResult ? (
                    <ResultCard
                      key="result-card"
                      {...lastResult}
                      onNewQuery={handleNewQuery}
                    />
                  ) : (
                    <TaskInput 
                      key="task-input"
                      onSubmit={handleSubmit} 
                      isLoading={isLoading}
                      disabled={false}
                      initialAgentId={preSelectedAgent}
                      initialPrompt={reRunPrompt}
                      onClearPreSelect={() => setPreSelectedAgent(null)}
                    />
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Main Grid */}
              <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
                {/* Left Column - Swarm Graph + Activity */}
                <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="min-h-[300px]"
                  >
                    <SwarmGraph 
                      activeSpecialist={currentStep?.specialist || null}
                      currentStep={currentStep}
                      taskStatus={taskStatus}
                      hiredAgents={hiredAgents}
                      onAgentClick={(specialist) => setSelectedAgent(specialist)}
                    />
                  </motion.div>
                  
                  {/* Activity Feed */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 }}
                    className="flex-1 min-h-[200px]"
                  >
                    <ActivityFeed items={activityItems} isProcessing={isLoading} />
                  </motion.div>
                </div>

                {/* Right Column - Panels */}
                <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
                  {/* Wallet Panel */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <WalletPanel />
                  </motion.div>

                  {/* Payment Feed */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <PaymentFeed payments={payments} />
                  </motion.div>

                  {/* Message Log */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <MessageLog messages={messages} />
                  </motion.div>
                </div>
              </div>

              {/* Result Display */}
              {(taskStatus || result || error) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4"
                >
                  <ResultDisplay 
                    taskStatus={taskStatus} 
                    result={result}
                    error={error || undefined}
                  />
                </motion.div>
              )}
            </motion.div>
          ) : activeView === 'marketplace' ? (
            <motion.div
              key="marketplace"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1"
            >
              <Marketplace onHireAgent={handleHireAgent} />
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1"
            >
              <QueryHistory history={queryHistory} onReRun={handleReRun} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 flex items-center justify-between text-xs text-[var(--text-muted)]"
        >
          <div className="flex items-center gap-2">
            <Hexagon size={12} className="text-[var(--accent-gold)]" />
            <span className="text-[var(--accent-gold)] opacity-60">Hivemind Protocol</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity size={12} />
            <span>Powered by x402 + Helius</span>
          </div>
        </motion.footer>
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <AgentDetailModal
          specialist={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          isHired={hiredAgents.includes(selectedAgent)}
          isProcessing={isLoading}
          customInstructions={customInstructions[selectedAgent] || ''}
          onUpdateInstructions={(instructions) => handleUpdateInstructions(selectedAgent, instructions)}
          onRemove={() => {
            removeHiredAgent(selectedAgent);
            setSelectedAgent(null);
          }}
          fee={SPECIALIST_FEES[selectedAgent]}
        />
      )}
    </div>
  );
}
