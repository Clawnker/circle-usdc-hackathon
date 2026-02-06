'use client';

import { motion } from 'framer-motion';
import { UserPlus, X, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface AddToSwarmBannerProps {
  specialist: string;
  specialistName: string;
  onAdd: (specialist: string) => void;
  onDismiss: () => void;
}

export function AddToSwarmBanner({
  specialist,
  specialistName,
  onAdd,
  onDismiss,
}: AddToSwarmBannerProps) {
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    setAdded(true);
    onAdd(specialist);
    // Auto-dismiss after showing confirmation
    setTimeout(onDismiss, 2000);
  };

  if (added) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 flex items-center gap-3"
      >
        <CheckCircle className="w-5 h-5 text-green-400" />
        <span className="text-green-300 font-medium">
          {specialistName} added to your swarm!
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-xl p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400/20 to-purple-500/20 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className="text-white font-medium">
              Add {specialistName} to your swarm?
            </p>
            <p className="text-gray-400 text-sm">
              Hire them permanently for future tasks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm"
          >
            Not now
          </button>
          <button
            onClick={handleAdd}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium text-sm hover:shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            Add to Swarm
          </button>
        </div>
      </div>
    </motion.div>
  );
}
