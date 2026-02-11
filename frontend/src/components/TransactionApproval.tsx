'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, ArrowRightLeft, Send, Wallet, Info } from 'lucide-react';

export interface TransactionDetails {
  type: 'swap' | 'transfer';
  amount: string;
  from?: string;
  to?: string;
  asset: string;
  estimatedOutput?: string;
  route?: string;
  feeEstimate?: string;
  currentBalance?: string;
}

interface TransactionApprovalProps {
  isOpen: boolean;
  details: TransactionDetails | null;
  onApprove: () => void;
  onReject: () => void;
}

export function TransactionApproval({
  isOpen,
  details,
  onApprove,
  onReject,
}: TransactionApprovalProps) {
  if (!isOpen || !details) return null;

  const isSwap = details.type === 'swap';
  const isHighValue = parseFloat(details.amount) > 10 && details.asset === 'USDC';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onReject}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-gray-900 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 px-6 py-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                      {isSwap ? <ArrowRightLeft className="w-5 h-5 text-white" /> : <Send className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Confirm {isSwap ? 'Swap' : 'Transfer'}
                      </h3>
                      <p className="text-sm text-gray-400">
                        Transaction Approval Required
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onReject}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-4">
                {/* Transaction Details */}
                <div className="bg-black/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Action</span>
                    <span className="text-white font-medium capitalize">{details.type}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Amount</span>
                    <span className="text-white font-medium">{details.amount} {details.asset}</span>
                  </div>

                  {isSwap ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Estimated Output</span>
                        <span className="text-cyan-400 font-medium">~{details.estimatedOutput} {details.to}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Route</span>
                        <span className="text-gray-300 text-xs text-right max-w-[200px] truncate">{details.route}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">To</span>
                      <span className="text-gray-300 text-xs font-mono">{details.to?.slice(0, 8)}...{details.to?.slice(-8)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs flex items-center gap-1">
                        <Wallet className="w-3 h-3" /> Available Balance
                      </span>
                      <span className="text-gray-300 text-xs">{details.currentBalance} {details.asset}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs flex items-center gap-1">
                        <Info className="w-3 h-3" /> Est. Network Fee
                      </span>
                      <span className="text-gray-300 text-xs">{details.feeEstimate}</span>
                    </div>
                  </div>
                </div>

                {/* Warnings */}
                {isHighValue && (
                  <div className="flex items-start gap-2 text-amber-400/80 text-sm bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>
                      High value transaction detected. Please verify all details before approving.
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-black/20 border-t border-white/5 flex gap-3">
                <button
                  onClick={onReject}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-colors font-medium text-sm"
                >
                  Reject
                </button>
                <button
                  onClick={onApprove}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirm & Execute
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
