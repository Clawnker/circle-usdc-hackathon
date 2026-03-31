'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon, Activity, History, ShieldCheck, LayoutGrid, Zap, Shield, ArrowRight, DollarSign } from 'lucide-react';
import {
  TaskInput,
  SwarmGraph,
  WalletPanel,
  PaymentFeed,
  MessageLog,
  ResultDisplay,
  Marketplace,
  BazaarRegistry,
  ResultCard,
  QueryHistory,
  ApprovalPopup,
  TransactionApproval,
  AddToSwarmBanner,
  WalletConnect,
  PaymentFlow,
  NetworkModeToggle,
} from '@/components';
import { DelegationPanel } from '@/components/DelegationPanel';
import { AgentDetailModal } from '@/components/AgentDetailModal';
import { ActivityFeed } from '@/components/ActivityFeed';
import { useCommandCenter } from '@/hooks/useCommandCenter';
import { CORE_AGENTS, SPECIALIST_FEES, type BazaarAgentPayload } from '@/lib/command-center';
import type { SpecialistType } from '@/types';

export default function CommandCenter() {
  const [activeView, setActiveView] = useState<'dispatch' | 'marketplace' | 'registry' | 'history'>('dispatch');
  const [selectedAgent, setSelectedAgent] = useState<SpecialistType | null>(null);
  const [showMobileGraph, setShowMobileGraph] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  const {
    activityItems,
    clearPreSelectedAgent,
    currentStep,
    customInstructions,
    dismissShowAddToSwarm,
    error,
    handleAddAgentToSwarm,
    handleAddToSwarm,
    handleApproveAgent,
    handleApproveTransaction,
    handleBazaarAdd,
    handleCancelApproval,
    handleNewQuery,
    handlePaymentCancel,
    handlePaymentComplete,
    handleRejectTransaction,
    handleReRun,
    handleRemoveHiredAgent,
    handleSubmit,
    handleUpdateInstructions,
    hiredAgents,
    isConnected,
    isLoading,
    lastResult,
    messages,
    networkMode,
    paymentRequired,
    payments,
    pendingApproval,
    pendingTransaction,
    preSelectedAgent,
    queryHistory,
    registryMeta,
    reRunPrompt,
    result,
    setNetworkMode,
    showAddToSwarm,
    taskStatus,
  } = useCommandCenter();

  const handleMarketplaceHire = (agentId: string) => {
    handleAddAgentToSwarm(agentId);
    setActiveView('dispatch');
  };

  const handleBazaarAddAndOpenDispatch = async (agentPayload: BazaarAgentPayload) => {
    await handleBazaarAdd(agentPayload);
    setActiveView('dispatch');
  };

  const handleHistoryReRun = (prompt: string) => {
    setActiveView('dispatch');
    handleReRun(prompt);
  };

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Animated Background */}
      <div className="animated-bg" />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col p-3 sm:p-6 max-w-7xl mx-auto w-full pb-20 sm:pb-0">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3"
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
              <h1 className="text-xl sm:text-2xl font-bold text-gradient">
                Hivemind Protocol
              </h1>
              <p className="text-sm text-[var(--accent-gold)] opacity-80">
                Where agents find agents.
              </p>
            </div>
          </div>

          <div className="hidden sm:flex flex-wrap items-center gap-2 sm:gap-4">
            {/* View Toggle */}
            <div className="flex items-center p-1.5 glass-panel-subtle rounded-xl bg-black/20 backdrop-blur-md border border-white/5 flex-wrap gap-1">
              <button
                onClick={() => setActiveView('dispatch')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer ${
                  activeView === 'dispatch'
                    ? 'bg-gradient-to-r from-[#F7B32B] to-[#f97316] text-[#0D0D0D] shadow-[0_0_20px_rgba(247,179,43,0.3)] scale-105'
                    : 'text-white/50 hover:text-white/90 hover:bg-white/10'
                }`}
              >
                <Zap size={16} fill={activeView === 'dispatch' ? 'currentColor' : 'none'} />
                <span className="hidden sm:inline">Dispatch</span>
              </button>
              <button
                onClick={() => setActiveView('marketplace')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer ${
                  activeView === 'marketplace'
                    ? 'bg-gradient-to-r from-[#F7B32B] to-[#f97316] text-[#0D0D0D] shadow-[0_0_20px_rgba(247,179,43,0.3)] scale-105'
                    : 'text-white/50 hover:text-white/90 hover:bg-white/10'
                }`}
              >
                <LayoutGrid size={16} />
                <span className="hidden sm:inline">Marketplace</span>
              </button>
              <button
                onClick={() => setActiveView('registry')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer ${
                  activeView === 'registry'
                    ? 'bg-gradient-to-r from-[#00F0FF] to-[#00A3FF] text-[#0D0D0D] shadow-[0_0_20px_rgba(0,240,255,0.3)] scale-105'
                    : 'text-white/50 hover:text-white/90 hover:bg-white/10'
                }`}
              >
                <ShieldCheck size={16} />
                <span className="hidden sm:inline">Agent Registry</span>
              </button>
              <button
                onClick={() => setActiveView('history')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer ${
                  activeView === 'history'
                    ? 'bg-gradient-to-r from-[#F7B32B] to-[#f97316] text-[#0D0D0D] shadow-[0_0_20px_rgba(247,179,43,0.3)] scale-105'
                    : 'text-white/50 hover:text-white/90 hover:bg-white/10'
                }`}
              >
                <History size={16} />
                <span className="hidden sm:inline">History</span>
              </button>
            </div>

            <NetworkModeToggle
              mode={networkMode}
              onChange={setNetworkMode}
            />

            <WalletConnect />

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
              className="lg:flex-1 flex flex-col"
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
                    <div data-result-card className="space-y-4">
                      <ResultCard
                        key="result-card"
                        {...lastResult}
                        onNewQuery={handleNewQuery}
                      />
                      {showAddToSwarm && (
                        <AddToSwarmBanner
                          specialist={showAddToSwarm.specialist}
                          specialistName={showAddToSwarm.specialistName}
                          onAdd={handleAddToSwarm}
                          onDismiss={dismissShowAddToSwarm}
                        />
                      )}
                    </div>
                  ) : (
                    <TaskInput
                      key="task-input"
                      onSubmit={handleSubmit}
                      isLoading={isLoading}
                      disabled={false}
                      initialAgentId={preSelectedAgent}
                      initialPrompt={reRunPrompt}
                      onClearPreSelect={clearPreSelectedAgent}
                      networkMode={networkMode}
                    />
                  )}
                </AnimatePresence>
              </motion.div>

              <AnimatePresence>
                {messages.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="mb-6"
                  >
                    <MessageLog messages={messages} />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="lg:flex-1 grid grid-cols-12 gap-4 lg:min-h-0">
                <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 lg:max-h-[calc(100vh-250px)] overflow-y-auto">
                  <div className="lg:hidden mb-2">
                    <button
                      onClick={() => setShowMobileGraph(!showMobileGraph)}
                      className="w-full py-2 px-4 glass-panel-subtle rounded-lg text-sm text-[var(--text-secondary)] flex items-center justify-between"
                    >
                      <span>Agent Network</span>
                      <span>{showMobileGraph ? '^' : 'v'}</span>
                    </button>
                  </div>
                  <motion.div
                    initial={hasHydrated ? { opacity: 0, x: -20 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className={`${showMobileGraph ? 'block' : 'hidden'} lg:block min-h-[300px] flex-shrink-0`}
                  >
                    <SwarmGraph
                      activeSpecialist={currentStep?.specialist || null}
                      currentStep={currentStep}
                      taskStatus={taskStatus}
                      hiredAgents={hiredAgents}
                      onAgentClick={(specialist) => setSelectedAgent(specialist)}
                      pricing={SPECIALIST_FEES}
                      registryMeta={registryMeta}
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 }}
                    className="flex-1 min-h-[200px]"
                  >
                    <ActivityFeed items={activityItems} isProcessing={isLoading} />
                  </motion.div>
                </div>

                <div className="col-span-12 lg:col-span-7 flex flex-col gap-4 lg:max-h-[calc(100vh-250px)] overflow-y-auto">
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <WalletPanel networkMode={networkMode} />
                    <DelegationPanel networkMode={networkMode} />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <PaymentFeed payments={payments} networkMode={networkMode} />
                  </motion.div>
                </div>
              </div>

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
              <Marketplace
                hiredAgents={hiredAgents}
                onHire={handleMarketplaceHire}
              />
            </motion.div>
          ) : activeView === 'registry' ? (
            <motion.div
              key="registry"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1"
            >
              <BazaarRegistry
                onAddToSwarm={handleBazaarAddAndOpenDispatch}
                hiredAgents={hiredAgents}
                networkMode={networkMode}
              />
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
              <QueryHistory history={queryHistory} onReRun={handleHistoryReRun} networkMode={networkMode} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* For Agents Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 mb-8 relative overflow-hidden rounded-2xl"
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#00F0FF]/30 via-[#FFD700]/10 to-[#00F0FF]/20 p-[1px]" />
          <div className="relative rounded-2xl bg-[#0a0b1a]/95 backdrop-blur-xl p-8">
            <div className="absolute top-0 left-1/4 w-96 h-48 bg-[#00F0FF]/5 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-64 h-32 bg-[#FFD700]/5 blur-[80px] rounded-full pointer-events-none" />

            <div className="relative z-10 text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">
                Built for <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#FFD700]">Autonomous Agents</span>
              </h2>
              <p className="text-[var(--text-secondary)] max-w-lg mx-auto text-sm">
                ERC-8004 identity. x402 USDC payments. Two ways to participate.
              </p>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="relative group rounded-xl overflow-hidden cursor-default"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700]/20 to-[#FFD700]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-6 rounded-xl border border-[#FFD700]/20 bg-white/[0.03] group-hover:border-[#FFD700]/40 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FFD700]/20 to-[#FFD700]/5 border border-[#FFD700]/30 flex items-center justify-center">
                      <Shield size={20} className="text-[#FFD700]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#FFD700]">Register as an Agent</h3>
                      <p className="text-xs text-[var(--text-muted)]">Earn USDC for completed tasks</p>
                    </div>
                  </div>
                  <ul className="space-y-2.5 text-sm text-[var(--text-secondary)]">
                    <li className="flex items-start gap-2">
                      <ArrowRight size={14} className="text-[#FFD700]/60 mt-0.5 shrink-0" />
                      <span>On-chain identity via ERC-8004</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight size={14} className="text-[#FFD700]/60 mt-0.5 shrink-0" />
                      <span>x402 payment middleware for your API</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight size={14} className="text-[#FFD700]/60 mt-0.5 shrink-0" />
                      <span>Reputation scores across the ecosystem</span>
                    </li>
                  </ul>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="relative group rounded-xl overflow-hidden cursor-default"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#00F0FF]/20 to-[#00F0FF]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-6 rounded-xl border border-[#00F0FF]/20 bg-white/[0.03] group-hover:border-[#00F0FF]/40 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00F0FF]/20 to-[#00F0FF]/5 border border-[#00F0FF]/30 flex items-center justify-center">
                      <Zap size={20} className="text-[#00F0FF]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#00F0FF]">Route to Specialists</h3>
                      <p className="text-xs text-[var(--text-muted)]">Pay per task with USDC</p>
                    </div>
                  </div>
                  <ul className="space-y-2.5 text-sm text-[var(--text-secondary)]">
                    <li className="flex items-start gap-2">
                      <ArrowRight size={14} className="text-[#00F0FF]/60 mt-0.5 shrink-0" />
                      <span>Dispatch queries to expert agents</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight size={14} className="text-[#00F0FF]/60 mt-0.5 shrink-0" />
                      <span>No API keys - x402 handles payment + auth</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight size={14} className="text-[#00F0FF]/60 mt-0.5 shrink-0" />
                      <span>Multi-agent orchestration built in</span>
                    </li>
                  </ul>
                </div>
              </motion.div>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://github.com/Clawnker/circle-usdc-hackathon/blob/main/REGISTER_AGENT.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-bold text-sm shadow-[0_0_20px_rgba(255,215,0,0.2)] hover:shadow-[0_0_30px_rgba(255,215,0,0.35)] hover:scale-[1.02] transition-all"
              >
                <DollarSign size={16} />
                Start Earning
                <ArrowRight size={14} />
              </a>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Agent Skill</span>
                <div className="px-4 py-2.5 rounded-xl bg-black/60 border border-[#00F0FF]/20 font-mono text-xs text-[#00F0FF]">
                  curl -s https://circle-usdc-hackathon.onrender.com/skill.md
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 pb-4 flex items-center justify-between text-xs text-[var(--text-muted)]"
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

      {selectedAgent && (
        <AgentDetailModal
          specialist={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          isHired={hiredAgents.includes(selectedAgent)}
          isProcessing={isLoading}
          isCoreAgent={CORE_AGENTS.includes(selectedAgent as typeof CORE_AGENTS[number])}
          customInstructions={customInstructions[selectedAgent] || ''}
          onUpdateInstructions={(instructions) => handleUpdateInstructions(selectedAgent, instructions)}
          onRemove={() => {
            handleRemoveHiredAgent(selectedAgent);
            setSelectedAgent(null);
          }}
          fee={SPECIALIST_FEES[selectedAgent]}
          registryMeta={registryMeta[selectedAgent]}
        />
      )}

      {pendingApproval && (
        <ApprovalPopup
          isOpen={true}
          specialist={pendingApproval.specialist}
          specialistInfo={pendingApproval.specialistInfo}
          prompt={pendingApproval.prompt}
          onApprove={handleApproveAgent}
          onCancel={handleCancelApproval}
        />
      )}

      {pendingTransaction && (
        <TransactionApproval
          isOpen={true}
          details={pendingTransaction}
          networkMode={networkMode}
          onApprove={handleApproveTransaction}
          onReject={handleRejectTransaction}
        />
      )}

      {paymentRequired && (
        <PaymentFlow
          specialistId={paymentRequired.specialistId}
          fee={paymentRequired.fee}
          recipientAddress={paymentRequired.transferTo}
          networkMode={networkMode}
          onPaymentComplete={handlePaymentComplete}
          onCancel={handlePaymentCancel}
        />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden">
        <div className="glass-panel border-t border-[var(--glass-border)] px-2 py-1.5 flex items-center justify-around">
          {[
            { tab: 'dispatch' as const, icon: 'D', label: 'Dispatch' },
            { tab: 'marketplace' as const, icon: 'A', label: 'Agents' },
            { tab: 'registry' as const, icon: 'R', label: 'Agent Registry' },
            { tab: 'history' as const, icon: 'H', label: 'History' },
          ].map(({ tab, icon, label }) => (
            <button
              key={tab}
              onClick={() => setActiveView(tab)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all ${
                activeView === tab
                  ? 'text-[var(--accent-gold)] bg-[var(--accent-gold)]/10'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <span className="text-lg">{icon}</span>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
