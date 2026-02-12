'use client';

import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Zap, Loader2, X } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { baseSepolia } from 'wagmi/chains';

// The address that the backend uses to call transferFrom on behalf of the user.
// This is the demo wallet — user approves THIS address to spend their USDC.
const DELEGATE_ADDRESS = '0x4a9948159B7e6c19301ebc388E72B1EdFf87187B' as `0x${string}`;
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;

const USDC_APPROVE_ABI = [{
  name: 'approve',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'spender', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  outputs: [{ type: 'bool' }],
}] as const;

interface DelegationState {
  enabled: boolean;
  allowance: number;
  spent: number;
  walletAddress: string;
  approveTxHash: string;
  payments: { amount: number; specialist: string; txHash: string; timestamp: string }[];
}

export function getDelegationState(): DelegationState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('hivemind-delegation');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.payments) parsed.payments = [];
      if (!parsed.approveTxHash) parsed.approveTxHash = '';
      return parsed;
    }
  } catch {}
  return null;
}

export function recordDelegationSpend(amount: number, specialist?: string, txHash?: string) {
  const state = getDelegationState();
  if (!state) return;
  
  state.payments.push({
    amount,
    specialist: specialist || 'unknown',
    txHash: txHash || '',
    timestamp: new Date().toISOString(),
  });
  
  // Recalculate spent from actual payment records
  state.spent = Math.round(state.payments.reduce((sum, p) => sum + p.amount, 0) * 1000000) / 1000000;
  
  if (state.spent >= state.allowance) {
    state.enabled = false;
  }
  localStorage.setItem('hivemind-delegation', JSON.stringify(state));
  window.dispatchEvent(new Event('delegation-updated'));
}

export function getDelegationTotalSpent(): number {
  const state = getDelegationState();
  if (!state) return 0;
  return state.spent;
}

export function DelegationPanel() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const [delegation, setDelegation] = useState<DelegationState | null>(null);
  const [approveAmount, setApproveAmount] = useState(5);
  const [isApproving, setIsApproving] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  useEffect(() => {
    setDelegation(getDelegationState());
  }, []);

  useEffect(() => {
    const handler = () => setDelegation(getDelegationState());
    window.addEventListener('delegation-updated', handler);
    return () => window.removeEventListener('delegation-updated', handler);
  }, []);

  if (!isConnected) return null;

  const remaining = delegation ? Math.max(0, delegation.allowance - delegation.spent) : 0;
  const paymentCount = delegation?.payments?.length || 0;

  const handleEnable = async () => {
    if (!address) return;
    setIsApproving(true);
    setTxError(null);
    
    try {
      // On-chain: approve the delegate address to spend user's USDC
      const amountWei = parseUnits(String(approveAmount), 6);
      const txHash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_APPROVE_ABI,
        functionName: 'approve',
        args: [DELEGATE_ADDRESS, amountWei],
        chainId: baseSepolia.id,
      });

      // Persist delegation state
      const newState: DelegationState = {
        enabled: true,
        allowance: approveAmount,
        spent: 0,
        walletAddress: address,
        approveTxHash: txHash,
        payments: [],
      };
      localStorage.setItem('hivemind-delegation', JSON.stringify(newState));
      setDelegation(newState);
      window.dispatchEvent(new Event('delegation-updated'));
    } catch (err: any) {
      console.error('[delegation] Approve failed:', err);
      setTxError(err.shortMessage || err.message || 'Transaction failed');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRevoke = async () => {
    if (!address) return;
    setIsRevoking(true);
    setTxError(null);
    
    try {
      // On-chain: set approval to 0
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_APPROVE_ABI,
        functionName: 'approve',
        args: [DELEGATE_ADDRESS, BigInt(0)],
        chainId: baseSepolia.id,
      });

      // Clear local state
      localStorage.removeItem('hivemind-delegation');
      setDelegation(null);
      window.dispatchEvent(new Event('delegation-updated'));
    } catch (err: any) {
      console.error('[delegation] Revoke failed:', err);
      setTxError(err.shortMessage || err.message || 'Revoke failed');
    } finally {
      setIsRevoking(false);
    }
  };

  const busy = isApproving || isRevoking;

  return (
    <div className="glass-panel-subtle p-3 mt-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {delegation?.enabled ? (
            <ShieldCheck size={14} className="text-green-400" />
          ) : (
            <Shield size={14} className="text-[var(--text-muted)]" />
          )}
          <span className="text-xs font-medium">Auto-Pay Delegation</span>
        </div>
        {delegation?.enabled && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">
            On-Chain ✓
          </span>
        )}
      </div>

      {delegation?.enabled ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">Remaining Budget</span>
            <span className="text-green-400 font-mono">{remaining.toFixed(4)} USDC</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5">
            <div
              className="bg-gradient-to-r from-green-400 to-cyan-400 h-1.5 rounded-full transition-all"
              style={{ width: `${delegation.allowance > 0 ? (remaining / delegation.allowance) * 100 : 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>{delegation.spent.toFixed(4)} spent ({paymentCount} tx{paymentCount !== 1 ? 's' : ''})</span>
            <span>{delegation.allowance.toFixed(2)} approved</span>
          </div>
          
          {/* Approval tx link */}
          {delegation.approveTxHash && (
            <a
              href={`https://sepolia.basescan.org/tx/${delegation.approveTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors font-mono truncate block"
            >
              Approval tx: {delegation.approveTxHash.slice(0, 10)}…{delegation.approveTxHash.slice(-6)}
            </a>
          )}
          
          {/* Recent auto-pay transactions */}
          {delegation.payments.length > 0 && (
            <div className="space-y-1 mt-1 max-h-24 overflow-y-auto">
              {delegation.payments.slice(-3).reverse().map((p, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] text-[var(--text-muted)] px-1">
                  <span className="text-cyan-400/70">{p.specialist}</span>
                  <span className="font-mono">-{p.amount.toFixed(4)} USDC</span>
                </div>
              ))}
            </div>
          )}
          
          <button
            onClick={handleRevoke}
            disabled={busy}
            className="w-full text-xs py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {isRevoking ? (
              <><Loader2 size={12} className="animate-spin" /> Revoking…</>
            ) : (
              <><X size={12} /> Revoke Delegation (On-Chain)</>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] text-[var(--text-muted)]">
            Approve a USDC spending limit on-chain. Agent fees auto-deduct — no popup each time.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={approveAmount}
              onChange={(e) => setApproveAmount(Number(e.target.value))}
              className="flex-1 accent-cyan-400 h-1"
              disabled={busy}
            />
            <span className="text-xs font-mono text-white w-16 text-right">{approveAmount} USDC</span>
          </div>
          <button
            onClick={handleEnable}
            disabled={busy}
            className="w-full text-xs py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {isApproving ? (
              <><Loader2 size={12} className="animate-spin" /> Approving…</>
            ) : (
              <><Zap size={12} /> Approve {approveAmount} USDC</>
            )}
          </button>
        </div>
      )}
      
      {/* Error display */}
      {txError && (
        <p className="text-[10px] text-red-400 mt-2">{txError}</p>
      )}
    </div>
  );
}
