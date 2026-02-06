'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Coins, TrendingUp, User } from 'lucide-react';

interface SpecialistInfo {
  name: string;
  description: string;
  fee: string;
  feeCurrency: string;
  successRate?: number;
}

interface ApprovalPopupProps {
  isOpen: boolean;
  specialist: string;
  specialistInfo: SpecialistInfo;
  prompt: string;
  onApprove: () => void;
  onCancel: () => void;
}

export function ApprovalPopup({
  isOpen,
  specialist,
  specialistInfo,
  prompt,
  onApprove,
  onCancel,
}: ApprovalPopupProps) {
  if (!isOpen) return null;

  const feeDisplay = parseFloat(specialistInfo.fee) === 0 
    ? 'Free' 
    : `${specialistInfo.fee} ${specialistInfo.feeCurrency}`;

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
            onClick={onCancel}
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
              <div className="bg-gradient-to-r from-cyan-500/20 to-purple-500/20 px-6 py-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Hire {specialistInfo.name}?
                      </h3>
                      <p className="text-sm text-gray-400">
                        This agent is not in your swarm
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onCancel}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-4">
                {/* Agent Info */}
                <div className="bg-black/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Specialist</span>
                    <span className="text-white font-medium">{specialistInfo.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Description</span>
                    <span className="text-gray-300 text-sm">{specialistInfo.description}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm flex items-center gap-1">
                      <Coins className="w-4 h-4" /> Price per request
                    </span>
                    <span className="text-cyan-400 font-medium">{feeDisplay}</span>
                  </div>
                  {specialistInfo.successRate && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> Success rate
                      </span>
                      <span className="text-green-400 font-medium">
                        {(specialistInfo.successRate * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Your Request */}
                <div>
                  <p className="text-gray-400 text-sm mb-2">Your request:</p>
                  <p className="text-white bg-black/30 rounded-lg px-3 py-2 text-sm italic">
                    "{prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt}"
                  </p>
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 text-amber-400/80 text-sm bg-amber-500/10 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>
                    This is a one-time hire. You can add this agent to your swarm after the task completes.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-black/20 border-t border-white/5 flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={onApprove}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve & Run
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
