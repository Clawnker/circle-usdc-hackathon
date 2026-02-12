'use client';

import React, { useState } from 'react';
import { CheckCircle, Clock, XCircle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MultiHopStep {
  name: string;
  specialist: string;
  status: 'completed' | 'in-progress' | 'failed' | 'pending';
  output: string; // Could be markdown or plain text
  cost?: string;
  durationMs?: number;
}

interface MultiHopCardData {
  workflowName: string;
  steps: MultiHopStep[];
  totalCost?: string;
  totalExecutionTimeMs?: number;
}

interface MultiHopCardProps {
  data: MultiHopCardData;
}

const MultiHopCard: React.FC<MultiHopCardProps> = ({ data }) => {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const toggleStep = (index: number) => {
    setExpandedStep(expandedStep === index ? null : index);
  };

  const getStatusIcon = (status: MultiHopStep['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="text-green-500" size={20} />;
      case 'in-progress': return <Clock className="text-accent-gold animate-spin" size={20} />;
      case 'failed': return <XCircle className="text-red-500" size={20} />;
      case 'pending': return <Clock className="text-gray-500" size={20} />;
      default: return null;
    }
  };

  const formatDuration = (ms: number | undefined) => {
    if (ms === undefined) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="glass-panel p-4 rounded-lg gradient-border flex flex-col gap-4">
      <h3 className="text-xl font-bold text-text-primary">Multi-Hop Workflow: {data.workflowName}</h3>

      {/* Step Timeline */}
      <div className="relative pl-6 border-l-2 border-gray-700">
        {data.steps.map((step, index) => (
          <div key={index} className="mb-6 last:mb-0">
            <div className="absolute -left-3 mt-1 bg-gray-900 rounded-full p-1">
              {getStatusIcon(step.status)}
            </div>
            <div className="ml-4">
              <button
                onClick={() => toggleStep(index)}
                className="w-full text-left flex justify-between items-center text-text-primary hover:text-accent-cyan transition-colors"
              >
                <span className="font-semibold text-lg">Step {index + 1}: {step.name} ({step.specialist})</span>
                {expandedStep === index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              <div className="text-text-secondary text-sm flex gap-4 mt-1">
                {step.cost && <span>Cost: {step.cost}</span>}
                {step.durationMs !== undefined && <span>Duration: {formatDuration(step.durationMs)}</span>}
              </div>
              <AnimatePresence>
                {expandedStep === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="glass-panel-subtle p-3 rounded-md mt-2 text-sm text-text-secondary prose prose-invert"
                  >
                    <p>{step.output}</p> {/* Assuming output is plain text for now, could be ReactMarkdown if needed */}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      {/* Total Cost and Execution Time */}
      {(data.totalCost || data.totalExecutionTimeMs !== undefined) && (
        <div className="glass-panel-subtle p-3 rounded-md flex justify-between font-semibold text-text-primary mt-4">
          {data.totalCost && <span>Total Cost: {data.totalCost}</span>}
          {data.totalExecutionTimeMs !== undefined && <span>Total Time: {formatDuration(data.totalExecutionTimeMs)}</span>}
        </div>
      )}
    </div>
  );
};

export default MultiHopCard;
