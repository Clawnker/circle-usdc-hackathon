'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Hexagon, Activity } from 'lucide-react';
import {
  TaskInput,
  SwarmGraph,
  WalletPanel,
  PaymentFeed,
  MessageLog,
  ResultDisplay,
} from '@/components';
import { AgentDetailModal } from '@/components/AgentDetailModal';
import { ActivityFeed, ActivityItem } from '@/components/ActivityFeed';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { SpecialistType } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const SPECIALIST_NAMES: Record<string, string> = {
  aura: 'Social Analyst Aura',
  magos: 'Market Oracle Magos',
  bankr: 'DeFi Specialist bankr',
  general: 'General Assistant',
};

export default function CommandCenter() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<SpecialistType | null>(null);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  
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
          break;
        case 'failed':
          message = `Task failed`;
          type = 'error';
          setIsLoading(false);
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
  }, [taskStatus, currentStep, currentTaskId]);

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
        const newMessage = {
          id: `result-${Date.now()}`,
          from: currentStep.specialist,
          to: 'dispatcher',
          content,
          timestamp: new Date().toISOString(),
        };
        
        // Check if we already have this message (avoid duplicates)
        const isDuplicate = messages.some(m => m.content === content);
        if (!isDuplicate) {
          // Note: messages come from WebSocket, but we can add to activity
          setActivityItems(prev => [...prev, {
            id: `msg-${Date.now()}`,
            type: 'result',
            message: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
            specialist: currentStep.specialist,
            timestamp: new Date(),
            details: content,
          }]);
        }
      }
    }
  }, [result, currentStep, messages]);

  const handleSubmit = useCallback(async (prompt: string) => {
    setIsLoading(true);
    setError(null);
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
        },
        body: JSON.stringify({
          prompt,
          userId: 'demo-user',
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
  }, [reset, subscribe]);

  // Reset loading state when task completes
  if (isLoading && (taskStatus === 'completed' || taskStatus === 'failed')) {
    setIsLoading(false);
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated Background */}
      <div className="animated-bg" />
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col p-6">
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
        </motion.header>

        {/* Task Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <TaskInput 
            onSubmit={handleSubmit} 
            isLoading={isLoading}
            disabled={false}
          />
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
          <div className="col-span-12 lg:col-span-7 grid grid-rows-[auto_1fr_1fr] gap-4">
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
              className="min-h-[200px]"
            >
              <PaymentFeed payments={payments} />
            </motion.div>

            {/* Message Log */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="min-h-[200px]"
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
          onSavePrompt={(specialist, prompt) => {
            console.log('Saved prompt for', specialist, ':', prompt);
            // TODO: Persist to backend
          }}
        />
      )}
    </div>
  );
}
