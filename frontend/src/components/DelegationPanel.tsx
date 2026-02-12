'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, ShieldCheck, Zap, AlertTriangle } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, encodeFunctionData } from 'viem';
import { baseSepolia } from 'wagmi/chains';

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
// This must match the address that calls transferFrom on the backend (DEMO_WALLET_PRIVATE_KEY)
const DELEGATE_ADDRESS = '0x4a9948159B7e6c19301ebc388E72B1EdFf87187B' as `0x${string}`;

// ERC-20 ABI for approve
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

interface DelegationState {
  enabled: boolean;
  allowance: number;  // Total approved
  spent: number;      // Total spent so far
  txHash: string;     // Approval tx
}

export function getDelegationState(): DelegationState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('hivemind-delegation');
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export function recordDelegationSpend(amount: number) {
  const state = getDelegationState();
  if (!state) return;
  state.spent += amount;
  if (state.spent >= state.allowance) {
    state.enabled = false; // Exhausted
  }
  localStorage.setItem('hivemind-delegation', JSON.stringify(state));
  // Trigger re-render in DelegationPanel via storage event
  window.dispatchEvent(new Event('delegation-updated'));
}

export function DelegationPanel() {
  const { address, isConnected } = useAccount();
  const [delegation, setDelegation] = useState<DelegationState | null>(null);
  const [approveAmount, setApproveAmount] = useState(5);
  const [isApproving, setIsApproving] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    setDelegation(getDelegationState());
  }, []);

  // Re-read state when delegation spend happens
  useEffect(() => {
    const handler = () => setDelegation(getDelegationState());
    window.addEventListener('delegation-updated', handler);
    return () => window.removeEventListener('delegation-updated', handler);
  }, []);

  useEffect(() => {
    if (isSuccess && hash) {
      if (isRevoking) {
        // Revoke confirmed — clear state
        localStorage.removeItem('hivemind-delegation');
        setDelegation(null);
        setIsRevoking(false);
      } else {
        // Approve confirmed — set delegation
        const newState: DelegationState = {
          enabled: true,
          allowance: approveAmount,
          spent: 0,
          txHash: hash,
        };
        localStorage.setItem('hivemind-delegation', JSON.stringify(newState));
        setDelegation(newState);
        setIsApproving(false);
      }
    }
  }, [isSuccess, hash, approveAmount, isRevoking]);

  if (!isConnected) return null;

  const remaining = delegation ? Math.max(0, delegation.allowance - delegation.spent) : 0;

  const handleApprove = () => {
    setIsApproving(true);
    writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [DELEGATE_ADDRESS, parseUnits(String(approveAmount), 6)],
      chainId: baseSepolia.id,
    });
  };

  const handleRevoke = () => {
    setIsRevoking(true);
    localStorage.removeItem('hivemind-delegation');
    setDelegation(null);
    // Revoke on-chain approval
    writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [DELEGATE_ADDRESS, BigInt(0)],
      chainId: baseSepolia.id,
    });
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
            <span className="text-green-400 font-mono">{remaining.toFixed(2)} USDC</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5">
            <div
              className="bg-gradient-to-r from-green-400 to-cyan-400 h-1.5 rounded-full transition-all"
              style={{ width: `${(remaining / delegation.allowance) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>{delegation.spent.toFixed(2)} spent</span>
            <span>{delegation.allowance.toFixed(2)} approved</span>
          </div>
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
            Approve a USDC spending limit. Queries auto-deduct — no popup each time.
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
            onClick={handleApprove}
            disabled={isPending || isConfirming}
            className="w-full text-xs py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {isPending || isConfirming ? (
              <>Approving...</>
            ) : (
              <>
                <Zap size={12} />
                Enable Auto-Pay ({approveAmount} USDC)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
