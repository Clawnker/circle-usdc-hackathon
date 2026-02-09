'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Clock } from 'lucide-react';
import type { AgentMessage } from '@/types';

interface MessageLogProps {
  messages: AgentMessage[];
  className?: string;
}

// Agent colors
const AGENT_COLORS: Record<string, string> = {
  dispatcher: 'var(--accent-cyan)',
  aura: 'var(--accent-purple)',
  magos: 'var(--accent-pink)',
  bankr: 'var(--accent-green)',
};

function MessageItem({ message, index }: { message: AgentMessage; index: number }) {
  const fromColor = AGENT_COLORS[message.from.toLowerCase()] || 'var(--text-secondary)';
  const toColor = AGENT_COLORS[message.to.toLowerCase()] || 'var(--text-secondary)';
  
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="glass-panel-subtle mb-2 overflow-hidden"
    >
      <div className="w-full p-3 text-left">
        <div className="flex items-center justify-between mb-1">
          {/* From → To */}
          <div className="flex items-center gap-1 text-sm shrink-0">
            <span style={{ color: fromColor }} className="font-medium capitalize">
              {message.from}
            </span>
            <span className="text-[var(--text-muted)]">→</span>
            <span style={{ color: toColor }} className="font-medium capitalize">
              {message.to}
            </span>
          </div>
        
          {/* Timestamp */}
          <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] shrink-0 ml-2">
            <Clock size={10} />
            <span>{formatTime(message.timestamp)}</span>
          </div>
        </div>

        {/* Message Content */}
        <div className="text-sm text-[var(--text-secondary)] break-words">
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}

export function MessageLog({ messages, className = '' }: MessageLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className={`glass-panel overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-[var(--accent-orange)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Agent Messages</span>
        </div>
        {messages.length > 0 && (
          <span className="text-xs text-[var(--text-muted)]">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Messages List */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3"
        style={{ maxHeight: '300px' }}
      >
        <AnimatePresence mode="popLayout">
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center py-8"
            >
              <MessageSquare size={32} className="text-[var(--text-muted)] mb-2" />
              <p className="text-sm text-[var(--text-muted)]">
                No messages yet
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Inter-agent communication will appear here
              </p>
            </motion.div>
          ) : (
            messages.map((message, index) => (
              <MessageItem 
                key={message.id} 
                message={message} 
                index={index}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
