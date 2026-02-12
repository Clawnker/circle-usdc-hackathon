'use client';

import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Zap } from 'lucide-react';
import { useAccount } from 'wagmi';

interface DelegationState {
  enabled: boolean;
  allowance: number;
  spent: number;
  walletAddress: string;
  payments: { amount: number; specialist: string; txHash: string; timestamp: string }[];
}

export function getDelegationState(): DelegationState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('hivemind-delegation');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate old format: ensure payments array exists
      if (!parsed.payments) parsed.payments = [];
      return parsed;
    }
  } catch {}
  return null;
}

export function recordDelegationSpend(amount: number, specialist?: string, txHash?: string) {
  const state = getDelegationState();
  if (!state) return;
  
  // Record the individual payment
  state.payments.push({
    amount,
    specialist: specialist || 'unknown',
    txHash: txHash || '',
    timestamp: new Date().toISOString(),
  });
  
  // Recalculate spent from the actual payment records (prevents drift)
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
  const [delegation, setDelegation] = useState<DelegationState | null>(null);
  const [approveAmount, setApproveAmount] = useState(5);

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

  const handleEnable = () => {
    if (!address) return;
    const newState: DelegationState = {
      enabled: true,
      allowance: approveAmount,
      spent: 0,
      walletAddress: address,
      payments: [],
    };
    localStorage.setItem('hivemind-delegation', JSON.stringify(newState));
    setDelegation(newState);
    window.dispatchEvent(new Event('delegation-updated'));
  };

  const handleRevoke = () => {
    localStorage.removeItem('hivemind-delegation');
    setDelegation(null);
    window.dispatchEvent(new Event('delegation-updated'));
  };

  return (
    <div className="glass-panel-subtle p-3 mt-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {delegation?.enabled ? (
            <ShieldCheck size={14} className="text-green-400" />
          ) : (
            <Shield size={14} className="text-[var(--text-muted)]" />
          )}
          <span className="text-xs font-medium">Auto-Pay</span>
        </div>
        {delegation?.enabled && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">
            Active
          </span>
        )}
      </div>

      {delegation?.enabled ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">Remaining</span>
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
            className="w-full text-xs py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Revoke Delegation
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] text-[var(--text-muted)]">
            Set a spending limit. Queries auto-deduct fees — no popup each time.
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
            />
            <span className="text-xs font-mono text-white w-16 text-right">{approveAmount} USDC</span>
          </div>
          <button
            onClick={handleEnable}
            className="w-full text-xs py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center justify-center gap-1"
          >
            <Zap size={12} />
            Enable Auto-Pay ({approveAmount} USDC)
          </button>
        </div>
      )}
    </div>
  );
}
