'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { getDelegationState, recordDelegationSpend } from '@/components/DelegationPanel';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  CORE_AGENTS,
  DEFAULT_SWARM_AGENTS,
  SPECIALIST_NAMES,
  buildBazaarRegistration,
  type BazaarAgentPayload,
  type CommandCenterLastResult,
  type PaymentRequiredState,
  type PendingApprovalState,
  type RegistryMetaMap,
} from '@/lib/command-center';
import {
  approvePendingTransaction,
  fetchRoutePreview,
  registerExternalAgent,
  rejectPendingTransaction,
  requestDelegatedPayment,
  submitDispatch,
} from '@/lib/command-center-api';
import {
  loadCustomInstructions,
  loadHiredAgents,
  loadInitialNetworkMode,
  loadQueryHistory,
  loadRegistryMeta,
  persistCustomInstructions,
  persistHiredAgents,
  persistNetworkMode,
  persistQueryHistory,
  persistRegistryMeta,
} from '@/lib/command-center-storage';
import {
  NETWORK_MODE_LABELS,
  getExplorerTxUrl,
  resolveNetworkMode,
  supportsDirectPayments,
} from '@/lib/networkMode';
import type { NetworkMode, Payment, QueryHistoryItem, TransactionDetails } from '@/types';

interface CommandCenterActivityItem {
  id: string;
  type: 'dispatch' | 'processing' | 'payment' | 'result' | 'error';
  message: string;
  timestamp: Date;
  specialist?: string;
  link?: string;
  details?: string;
}

interface PendingSwarmAdd {
  specialist: string;
  specialistName: string;
}

interface RoutePreviewResponse {
  fee?: number | string;
  specialist?: string;
  network?: string;
}

interface DelegatePaymentResponse {
  txHash?: string;
  explorer?: string;
}

interface DispatchResponseData {
  taskId?: string;
  specialist?: string;
  requiresApproval?: boolean;
  specialistInfo?: PendingApprovalState['specialistInfo'];
  fee?: number;
}

interface CommandCenterWindow extends Window {
  __pendingPaymentProof?: string;
  __pendingSwarmAdd?: PendingSwarmAdd;
}

function getCommandCenterWindow(): CommandCenterWindow | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window as CommandCenterWindow;
}

function formatExternalAgentResult(agentData: any): string {
  const analysis = agentData?.analysis;
  if (!analysis) {
    return typeof agentData === 'string' ? agentData : JSON.stringify(agentData, null, 2);
  }

  const parts: string[] = [];
  if (analysis.summary) parts.push(analysis.summary);
  if (analysis.score !== undefined) parts.push(`**Score:** ${analysis.score}/100`);
  if (analysis.findings?.length > 0) {
    parts.push('', '**Findings:**');
    analysis.findings.forEach((finding: any) => {
      parts.push(`- **[${finding.severity || 'Unknown'}]** ${finding.title || finding.description || JSON.stringify(finding)}`);
      if (finding.recommendation) parts.push(`  Recommendation: ${finding.recommendation}`);
    });
  }
  if (analysis.gasOptimizations?.length > 0) {
    parts.push('', '**Gas Optimizations:**');
    analysis.gasOptimizations.forEach((optimization: string) => parts.push(`- ${optimization}`));
  }
  if (analysis.bestPractices) {
    parts.push('', '**Best Practices:**');
    Object.entries(analysis.bestPractices as Record<string, unknown>).forEach(([key, value]) => {
      parts.push(`- ${key}: ${String(value)}`);
    });
  }

  return parts.join('\n');
}

function extractResultContent(taskResult: any): string {
  if (taskResult?.data?.isMultiHop && taskResult.data?.steps) {
    const steps = taskResult.data.steps as Array<{ summary?: string }>;
    const lastStep = steps[steps.length - 1];
    return lastStep?.summary || steps.map((step) => step.summary || '').filter(Boolean).join('\n\n');
  }
  if (taskResult?.data?.isDAG && taskResult.data?.summary) return taskResult.data.summary;
  if (taskResult?.data?.summary) return taskResult.data.summary;
  if (taskResult?.data?.insight) return taskResult.data.insight;
  if (taskResult?.data?.externalAgent) return formatExternalAgentResult(taskResult.data?.data || taskResult.data);
  if (taskResult?.data?.details?.response) {
    return typeof taskResult.data.details.response === 'string'
      ? taskResult.data.details.response
      : JSON.stringify(taskResult.data.details.response);
  }
  return '';
}

function extractTransferRequest(taskResult: any, prompt: string): PaymentRequiredState | null {
  if (!taskResult?.data?.requiresWalletAction || !taskResult?.data?.details) return null;
  const amount = Number.parseFloat(taskResult.data.details.amount || '0');
  if (amount <= 0 || !taskResult.data.details.to) return null;
  return {
    specialistId: 'bankr',
    fee: amount,
    prompt,
    transferTo: taskResult.data.details.to,
  };
}

function extractTransactions(taskResult: any): TransactionDetails[] {
  const transactions: TransactionDetails[] = [];
  if (taskResult?.data?.details?.type === 'swap' || taskResult?.data?.details?.type === 'compound') {
    if (taskResult.data.details.swap) {
      transactions.push({
        type: 'swap',
        inputToken: taskResult.data.details.swap.inputToken,
        outputToken: taskResult.data.details.swap.outputToken,
        inputAmount: taskResult.data.details.swap.inputAmount,
        outputAmount: taskResult.data.details.swap.outputAmount,
      });
    }
    if (taskResult.data.details.transfer) {
      transactions.push({
        type: 'transfer',
        inputToken: taskResult.data.details.transfer.token,
        inputAmount: taskResult.data.details.transfer.amount,
        recipient: taskResult.data.details.transfer.recipient,
      });
    }
  }
  return transactions;
}

function formatSpecialistLabel(taskResult: any, specialistId: string): string {
  if (taskResult?.data?.isMultiHop) {
    const hops = taskResult.data.hops as string[];
    return hops.map((hop) => hop.charAt(0).toUpperCase() + hop.slice(1)).join(' -> ');
  }
  if (taskResult?.data?.isDAG) {
    const steps = taskResult.data.steps as Array<{ specialist: string }>;
    return steps.map((step) => SPECIALIST_NAMES[step.specialist] || step.specialist).join(' -> ');
  }
  return SPECIALIST_NAMES[specialistId] || specialistId;
}

function buildHistoryPayments(payments: Payment[], specialistId: string): Payment[] {
  return payments.map((payment) => ({
    specialist: payment.specialist || specialistId,
    amount: payment.amount,
    currency: 'USDC',
    status: 'completed',
  }));
}

export function useCommandCenter() {
  const { address: onchainAddress } = useAccount();
  const [networkMode, setNetworkModeState] = useState<NetworkMode>('testnet');
  const [hiredAgents, setHiredAgents] = useState<string[]>(() => [...DEFAULT_SWARM_AGENTS]);
  const [customInstructions, setCustomInstructions] = useState<Record<string, string>>({});
  const [registryMeta, setRegistryMeta] = useState<RegistryMetaMap>({});
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preSelectedAgent, setPreSelectedAgent] = useState<string | null>(null);
  const [activityItems, setActivityItems] = useState<CommandCenterActivityItem[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [reRunPrompt, setReRunPrompt] = useState('');
  const [lastResult, setLastResult] = useState<CommandCenterLastResult | null>(null);
  const [pendingApproval, setPendingApproval] = useState<PendingApprovalState | null>(null);
  const [showAddToSwarm, setShowAddToSwarm] = useState<PendingSwarmAdd | null>(null);
  const [paymentRequired, setPaymentRequired] = useState<PaymentRequiredState | null>(null);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [storageReadyMode, setStorageReadyMode] = useState<NetworkMode | null>(null);

  const {
    isConnected,
    taskStatus,
    currentStep,
    messages,
    payments,
    result,
    pendingTransaction,
    subscribe,
    reset,
  } = useWebSocket();

  useEffect(() => {
    setQueryHistory(loadQueryHistory());
    setNetworkModeState(loadInitialNetworkMode());
    setHasHydratedStorage(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedStorage) return;
    persistNetworkMode(networkMode);
  }, [hasHydratedStorage, networkMode]);

  useEffect(() => {
    setStorageReadyMode(null);
    setHiredAgents(loadHiredAgents(networkMode));
    setRegistryMeta(loadRegistryMeta(networkMode));
    setCustomInstructions(loadCustomInstructions(networkMode));
    setCurrentTaskId(null);
    setPreSelectedAgent(null);
    setShowAddToSwarm(null);
    setPaymentRequired(null);
    setPendingApproval(null);
    setLastResult(null);
    setActivityItems([]);
    setError(null);
    setIsLoading(false);
    reset();
    setStorageReadyMode(networkMode);
  }, [networkMode, reset]);

  useEffect(() => {
    if (storageReadyMode === networkMode) {
      persistHiredAgents(networkMode, hiredAgents);
    }
  }, [hiredAgents, networkMode, storageReadyMode]);

  useEffect(() => {
    if (storageReadyMode === networkMode) {
      persistRegistryMeta(networkMode, registryMeta);
    }
  }, [networkMode, registryMeta, storageReadyMode]);

  useEffect(() => {
    if (storageReadyMode === networkMode) {
      persistCustomInstructions(networkMode, customInstructions);
    }
  }, [customInstructions, networkMode, storageReadyMode]);

  useEffect(() => {
    if (!hasHydratedStorage) return;
    persistQueryHistory(queryHistory);
  }, [hasHydratedStorage, queryHistory]);

  useEffect(() => {
    if (!taskStatus || !currentTaskId) return;

    const specialist = currentStep?.specialist || 'dispatcher';
    const specialistName = SPECIALIST_NAMES[specialist] || specialist;
    let message = '';
    let type: CommandCenterActivityItem['type'] = 'processing';

    switch (taskStatus) {
      case 'routing':
        message = 'Analyzing request...';
        type = 'dispatch';
        break;
      case 'awaiting_payment':
        message = 'Awaiting payment confirmation';
        break;
      case 'processing':
        message = `Processing with ${specialistName}`;
        break;
      case 'completed': {
        message = 'Task completed successfully';
        type = 'result';
        setIsLoading(false);

        if (result) {
          const taskResult = result as any;
          const content = extractResultContent(taskResult) || 'Task completed';
          const transferRequest = extractTransferRequest(taskResult, currentPrompt);
          if (transferRequest) {
            setPaymentRequired(transferRequest);
          }

          const totalCost = payments.reduce((sum, payment) => sum + payment.amount, 0);
          const specialistId = currentStep?.specialist || 'dispatcher';
          const historyPayments = buildHistoryPayments(payments, specialistId);
          const transactions = extractTransactions(taskResult);

          setLastResult({
            query: currentPrompt,
            status: 'success',
            result: content,
            cost: totalCost,
            specialist: formatSpecialistLabel(taskResult, specialistId),
            taskId: currentTaskId,
            isMultiHop: taskResult?.data?.isMultiHop,
            rawResult: taskResult,
          });

          setTimeout(() => {
            if (typeof window !== 'undefined') {
              document.querySelector('[data-result-card]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);

          setQueryHistory((previousHistory) => {
            const newItem: QueryHistoryItem = {
              id: currentTaskId || Date.now().toString(),
              prompt: currentPrompt,
              specialist: specialistId,
              cost: totalCost,
              status: 'success',
              timestamp: new Date(),
              result: content,
              payments: historyPayments.length > 0 ? historyPayments : undefined,
              transactions: transactions.length > 0 ? transactions : undefined,
              networkMode,
            };
            return [newItem, ...previousHistory].slice(0, 20);
          });
        }
        break;
      }
      case 'failed': {
        message = 'Task failed';
        type = 'error';
        setIsLoading(false);
        const totalCost = payments.reduce((sum, payment) => sum + payment.amount, 0);
        const specialistId = currentStep?.specialist || 'dispatcher';

        setLastResult({
          query: currentPrompt,
          status: 'failure',
          result: error || 'An unexpected error occurred',
          cost: totalCost,
          specialist: SPECIALIST_NAMES[specialistId] || specialistId,
          taskId: currentTaskId || undefined,
          rawResult: null,
        });

        setQueryHistory((previousHistory) => {
          const newItem: QueryHistoryItem = {
            id: currentTaskId || Date.now().toString(),
            prompt: currentPrompt,
            specialist: specialistId,
            cost: totalCost,
            status: 'failed',
            timestamp: new Date(),
            networkMode,
          };
          return [newItem, ...previousHistory].slice(0, 20);
        });
        break;
      }
      default:
        message = `Status: ${taskStatus}`;
    }

    setActivityItems((previousItems) => {
      const lastItem = previousItems[previousItems.length - 1];
      if (lastItem?.message === message) return previousItems;
      return [
        ...previousItems,
        {
          id: `${Date.now()}-${taskStatus}`,
          type,
          message,
          specialist,
          timestamp: new Date(),
        },
      ];
    });
  }, [currentPrompt, currentStep, currentTaskId, error, networkMode, payments, result, taskStatus]);

  useEffect(() => {
    if (payments.length === 0) return;

    const latestPayment = payments[payments.length - 1];
    setActivityItems((previousItems) => {
      if (previousItems.some((item) => item.id === `payment-${latestPayment.id}`)) return previousItems;
      return [
        ...previousItems,
        {
          id: `payment-${latestPayment.id}`,
          type: 'payment',
          message: `Paid ${latestPayment.amount} ${latestPayment.token}`,
          specialist: latestPayment.to,
          timestamp: new Date(),
          link: latestPayment.txSignature ? getExplorerTxUrl(networkMode, latestPayment.txSignature) : undefined,
        },
      ];
    });
  }, [networkMode, payments]);

  useEffect(() => {
    if (messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];
    setActivityItems((previousItems) => {
      if (previousItems.some((item) => item.id === latestMessage.id)) return previousItems;
      return [
        ...previousItems,
        {
          id: latestMessage.id,
          type: 'processing',
          message: latestMessage.content ?? '',
          specialist: latestMessage.from,
          timestamp: new Date(latestMessage.timestamp),
        },
      ];
    });
  }, [messages]);

  useEffect(() => {
    if (!result || !currentStep?.specialist) return;

    const taskResult = result as any;
    let content = '';
    if (taskResult?.data?.insight) content = taskResult.data.insight;
    else if (taskResult?.data?.summary) content = taskResult.data.summary;
    else if (taskResult?.data?.details?.response) {
      content = typeof taskResult.data.details.response === 'string'
        ? taskResult.data.details.response
        : JSON.stringify(taskResult.data.details.response);
    } else if (taskResult?.data?.type) {
      content = `${taskResult.data.type} ${taskResult.data.status || 'completed'}`;
    }

    if (!content) return;

    setActivityItems((previousItems) => [
      ...previousItems,
      {
        id: `msg-${Date.now()}`,
        type: 'result',
        message: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
        specialist: currentStep.specialist,
        timestamp: new Date(),
        details: content,
      },
    ]);
  }, [currentStep, result]);

  const handleSubmit = useCallback(async (prompt: string, approvedAgent?: string) => {
    setIsLoading(true);
    setError(null);
    setLastResult(null);
    setCurrentPrompt(prompt);
    setShowAddToSwarm(null);
    reset();
    setActivityItems([
      {
        id: `${Date.now()}-submit`,
        type: 'dispatch',
        message: `Dispatching: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`,
        specialist: 'dispatcher',
        timestamp: new Date(),
      },
    ]);

    try {
      const riskyPaymentIntent = /\b(send|transfer|swap|buy|sell|approve|allowance)\b/i.test(prompt);
      if (!supportsDirectPayments(networkMode) && riskyPaymentIntent) {
        setError(`${NETWORK_MODE_LABELS[networkMode].label} wallet actions are disabled by runtime configuration.`);
        setIsLoading(false);
        return;
      }

      const commandCenterWindow = getCommandCenterWindow();
      let paymentProof = commandCenterWindow?.__pendingPaymentProof;
      if (commandCenterWindow?.__pendingPaymentProof) delete commandCenterWindow.__pendingPaymentProof;

      if (!paymentProof) {
        try {
          const { response: previewResponse, data: previewData } = await fetchRoutePreview({
            prompt,
            hiredAgents,
            networkMode,
          });

          if (previewResponse.ok) {
            const preview = (previewData || {}) as RoutePreviewResponse;
            const resolvedPreviewMode = resolveNetworkMode(preview.network);
            const specialistId = String(preview.specialist || 'dispatcher');
            const fee = Number(preview.fee || 0);

            if (!supportsDirectPayments(networkMode) && fee > 0) {
              setError(`${NETWORK_MODE_LABELS[networkMode].label} payments are disabled by runtime configuration.`);
              setIsLoading(false);
              return;
            }

            if (resolvedPreviewMode !== networkMode && fee > 0) {
              setError(`Route preview returned ${NETWORK_MODE_LABELS[resolvedPreviewMode].label} while ${NETWORK_MODE_LABELS[networkMode].label} is selected.`);
              setIsLoading(false);
              return;
            }

            if (fee > 0) {
              const delegation = getDelegationState(networkMode);
              const remaining = delegation
                ? Math.max(0, Number(delegation.allowance || 0) - Number(delegation.spent || 0))
                : 0;
              const delegatedWalletAddress = (onchainAddress || delegation?.walletAddress || '').toString();
              const hasUsableDelegatedWallet = /^0x[a-fA-F0-9]{40}$/.test(delegatedWalletAddress);
              const canAutoPay = Boolean(delegation?.enabled) && (remaining + 1e-6) >= fee && hasUsableDelegatedWallet;

              if (canAutoPay) {
                try {
                  const { response: delegateResponse, data: delegateDataRaw } = await requestDelegatedPayment({
                    userAddress: delegatedWalletAddress,
                    amount: fee,
                    specialist: specialistId,
                    networkMode,
                  });

                  if (delegateResponse.ok) {
                    const delegateData = (delegateDataRaw || {}) as DelegatePaymentResponse;
                    paymentProof = delegateData.txHash;
                    if (paymentProof) {
                      recordDelegationSpend(networkMode, fee, specialistId, paymentProof);
                      const feePayment = {
                        id: `delegate-${Date.now()}`,
                        from: 'user',
                        to: specialistId,
                        amount: fee,
                        token: 'USDC' as const,
                        txSignature: paymentProof,
                        timestamp: new Date(),
                        method: 'on-chain' as const,
                        specialist: specialistId,
                        networkMode,
                      };
                      window.dispatchEvent(new CustomEvent('hivemind-payment', { detail: feePayment }));
                    }

                    setActivityItems((previousItems) => [
                      ...previousItems,
                      {
                        id: `payment-${delegateData.txHash || Date.now()}`,
                        type: 'payment',
                        message: `Auto-paid ${fee} USDC to ${specialistId}`,
                        specialist: specialistId,
                        timestamp: new Date(),
                        link: delegateData.explorer,
                      },
                    ]);
                  } else {
                    setPaymentRequired({ specialistId, fee, prompt });
                    return;
                  }
                } catch {
                  setPaymentRequired({ specialistId, fee, prompt });
                  return;
                }
              } else {
                setPaymentRequired({ specialistId, fee, prompt });
                return;
              }
            }
          }
        } catch {
          // Route preview is advisory. Dispatch can still proceed without it.
        }
      }

      const { response, data: dispatchDataRaw } = await submitDispatch({
        prompt,
        customInstructions,
        hiredAgents,
        approvedAgent,
        networkMode,
        paymentProof,
      });

      if (response.status === 402) {
        const paymentData = (dispatchDataRaw || {}) as DispatchResponseData;
        setIsLoading(false);
        setPaymentRequired({
          specialistId: String(paymentData.specialist || 'dispatcher'),
          fee: Number(paymentData.fee || 0),
          prompt,
        });
        return;
      }

      if (!response.ok) throw new Error(`Request failed: ${response.statusText}`);

      const dispatchData = (dispatchDataRaw || {}) as DispatchResponseData;
      if (dispatchData.requiresApproval && dispatchData.specialistInfo) {
        setIsLoading(false);
        setPendingApproval({
          prompt,
          specialist: String(dispatchData.specialist || 'dispatcher'),
          specialistInfo: dispatchData.specialistInfo,
        });
        return;
      }

      if (!dispatchData.taskId) throw new Error('Dispatch did not return a task id');

      setCurrentTaskId(dispatchData.taskId);
      subscribe(dispatchData.taskId);

      if (approvedAgent && !hiredAgents.includes(approvedAgent) && commandCenterWindow) {
        commandCenterWindow.__pendingSwarmAdd = {
          specialist: approvedAgent,
          specialistName: SPECIALIST_NAMES[approvedAgent] || approvedAgent,
        };
      }

      const specialistId = String(dispatchData.specialist || 'dispatcher');
      const specialistName = SPECIALIST_NAMES[specialistId] || specialistId;
      setActivityItems((previousItems) => [
        ...previousItems,
        {
          id: `${Date.now()}-routed`,
          type: 'dispatch',
          message: `Routed to ${specialistName}`,
          specialist: specialistId,
          timestamp: new Date(),
        },
      ]);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Failed to submit task');
      setIsLoading(false);
    }
  }, [customInstructions, hiredAgents, networkMode, onchainAddress, reset, subscribe]);

  const handleApproveAgent = useCallback(() => {
    if (!pendingApproval) return;
    const { prompt, specialist } = pendingApproval;
    setPendingApproval(null);
    void handleSubmit(prompt, specialist);
  }, [handleSubmit, pendingApproval]);

  const handleCancelApproval = useCallback(() => {
    setPendingApproval(null);
    setIsLoading(false);
  }, []);

  const handleApproveTransaction = useCallback(async () => {
    if (!pendingTransaction) return;
    try {
      const response = await approvePendingTransaction(pendingTransaction.taskId);
      if (!response.ok) throw new Error('Failed to approve transaction');
    } catch {
      setError('Failed to approve transaction');
    }
  }, [pendingTransaction]);

  const handleRejectTransaction = useCallback(async () => {
    if (!pendingTransaction) return;
    try {
      const response = await rejectPendingTransaction(pendingTransaction.taskId);
      if (!response.ok) throw new Error('Failed to reject transaction');
    } catch {
      setError('Failed to reject transaction');
    }
  }, [pendingTransaction]);

  const handleNewQuery = useCallback(() => {
    setLastResult(null);
    setCurrentTaskId(null);
    setReRunPrompt('');
  }, []);

  const handleAddAgentToSwarm = useCallback((agentId: string) => {
    setPreSelectedAgent(agentId);
    setHiredAgents((currentAgents) => currentAgents.includes(agentId) ? currentAgents : [...currentAgents, agentId]);
  }, []);

  const handleRemoveHiredAgent = useCallback((agentId: string) => {
    if (CORE_AGENTS.includes(agentId as typeof CORE_AGENTS[number])) return;
    setHiredAgents((currentAgents) => currentAgents.filter((currentAgentId) => currentAgentId !== agentId));
    setPreSelectedAgent((currentAgentId) => currentAgentId === agentId ? null : currentAgentId);
  }, []);

  const handleUpdateInstructions = useCallback((agentId: string, instructions: string) => {
    setCustomInstructions((currentInstructions) => ({
      ...currentInstructions,
      [agentId]: instructions,
    }));
  }, []);

  const handleBazaarAdd = useCallback(async (agentPayload: BazaarAgentPayload) => {
    const registration = buildBazaarRegistration(agentPayload);
    setRegistryMeta((currentRegistryMeta) => ({
      ...currentRegistryMeta,
      [registration.agentId]: registration.metadata,
    }));

    try {
      const { response, data } = await registerExternalAgent(agentPayload, registration.capabilities);
      if (!response.ok) {
        const errorMessage = (data as { error?: string } | null)?.error || 'Registration failed';
        throw new Error(errorMessage);
      }
    } catch {
      // Keep the agent locally even if backend registration fails.
    }

    handleAddAgentToSwarm(registration.agentId);
  }, [handleAddAgentToSwarm]);

  const handleReRun = useCallback((prompt: string) => {
    setReRunPrompt(prompt);
    void handleSubmit(prompt);
  }, [handleSubmit]);

  useEffect(() => {
    const commandCenterWindow = getCommandCenterWindow();
    if (taskStatus === 'completed') {
      setIsLoading(false);
      if (commandCenterWindow?.__pendingSwarmAdd) {
        setShowAddToSwarm(commandCenterWindow.__pendingSwarmAdd);
        delete commandCenterWindow.__pendingSwarmAdd;
      }
    } else if (taskStatus === 'failed') {
      setIsLoading(false);
      if (commandCenterWindow?.__pendingSwarmAdd) {
        delete commandCenterWindow.__pendingSwarmAdd;
      }
    }
  }, [taskStatus]);

  const handleAddToSwarm = useCallback((specialist: string) => {
    setHiredAgents((currentAgents) => currentAgents.includes(specialist) ? currentAgents : [...currentAgents, specialist]);
  }, []);

  const handlePaymentComplete = useCallback((txHash: string) => {
    if (!paymentRequired) return;

    if (paymentRequired.transferTo) {
      const recipient = paymentRequired.transferTo;
      const truncatedRecipient = `${recipient.slice(0, 6)}...${recipient.slice(-4)}`;
      const explorerLink = getExplorerTxUrl(networkMode, txHash);
      const completedResult = `**Transfer Complete**\n- Sent ${paymentRequired.fee} USDC to ${truncatedRecipient}\n- Chain: ${NETWORK_MODE_LABELS[networkMode].label}\n- Tx: [${txHash.slice(0, 10)}...${txHash.slice(-6)}](${explorerLink})`;

      setLastResult((previousResult) => previousResult ? {
        ...previousResult,
        result: completedResult,
      } : previousResult);

      setQueryHistory((previousHistory) => {
        if (previousHistory.length === 0) return previousHistory;
        const updatedHistory = [...previousHistory];
        updatedHistory[0] = {
          ...updatedHistory[0],
          result: completedResult,
          transactions: [
            {
              type: 'transfer',
              txHash,
              recipient,
              inputAmount: paymentRequired.fee,
              inputToken: 'USDC',
            },
          ],
        };
        return updatedHistory;
      });

      setActivityItems((previousItems) => [
        ...previousItems,
        {
          id: `transfer-${txHash}`,
          type: 'result',
          message: `Sent ${paymentRequired.fee} USDC to ${truncatedRecipient}`,
          specialist: 'bankr',
          timestamp: new Date(),
          link: explorerLink,
        },
      ]);
      setPaymentRequired(null);
      setIsLoading(false);
      return;
    }

    const feePayment = {
      id: `user-tx-${Date.now()}`,
      from: 'user',
      to: paymentRequired.specialistId,
      amount: paymentRequired.fee,
      token: 'USDC' as const,
      txSignature: txHash,
      timestamp: new Date(),
      method: 'on-chain' as const,
      specialist: paymentRequired.specialistId,
      networkMode,
    };

    setActivityItems((previousItems) => [
      ...previousItems,
      {
        id: `payment-${txHash}`,
        type: 'payment',
        message: `Paid ${paymentRequired.fee} USDC to ${paymentRequired.specialistId}`,
        specialist: paymentRequired.specialistId,
        timestamp: new Date(),
        link: getExplorerTxUrl(networkMode, txHash),
      },
    ]);
    window.dispatchEvent(new CustomEvent('hivemind-payment', { detail: feePayment }));

    const commandCenterWindow = getCommandCenterWindow();
    if (commandCenterWindow) {
      commandCenterWindow.__pendingPaymentProof = txHash;
    }

    const prompt = paymentRequired.prompt;
    setPaymentRequired(null);
    void handleSubmit(prompt);
  }, [handleSubmit, networkMode, paymentRequired]);

  const handlePaymentCancel = useCallback(() => {
    setPaymentRequired(null);
    setIsLoading(false);
  }, []);

  const dismissShowAddToSwarm = useCallback(() => {
    setShowAddToSwarm(null);
  }, []);

  const clearPreSelectedAgent = useCallback(() => {
    setPreSelectedAgent(null);
  }, []);

  const setNetworkMode = useCallback((nextMode: NetworkMode) => {
    setNetworkModeState(nextMode);
    setError(null);
  }, []);

  return {
    activityItems,
    clearPreSelectedAgent,
    currentStep,
    currentTaskId,
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
  };
}
