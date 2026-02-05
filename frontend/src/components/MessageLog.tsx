'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ChevronDown, ChevronRight, Clock } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(false);
  
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

  const formatPayload = (payload: unknown): string => {
    if (!payload) return '(no payload)';
    if (typeof payload === 'string') return payload || '(empty string)';
    
    if (typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;
      // Check for common message fields
      if (obj.content) return String(obj.content);
      if (obj.message) return String(obj.message);
      if (obj.result) return String(obj.result);
      
      try {
        const json = JSON.stringify(payload, null, 2);
        return json || '(empty object)';
      } catch {
        return String(payload) || '(unknown)';
      }
    }
    return String(payload);
  };

  const getPreview = (payload: unknown): string => {
    if (payload === undefined || payload === null) return '';
    const str = typeof payload === 'string' 
      ? payload 
      : JSON.stringify(payload) || '';
    return str.length > 60 ? str.slice(0, 60) + '...' : str;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="glass-panel-subtle mb-2 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-left 
          hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Expand icon */}
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight size={14} className="text-[var(--text-muted)]" />
          </motion.div>
          
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
          
          {/* Preview */}
          {!isExpanded && (
            <span className="text-xs text-[var(--text-muted)] truncate ml-2">
              {getPreview(message.payload)}
            </span>
          )}
        </div>
        
        {/* Timestamp */}
        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] shrink-0 ml-2">
          <Clock size={10} />
          <span>{formatTime(message.timestamp)}</span>
        </div>
      </button>
      
      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              <pre className="p-3 rounded-lg bg-black/30 text-xs min-h-[40px]
                font-mono text-gray-200 overflow-x-auto whitespace-pre-wrap border border-white/10">
                {formatPayload(message.payload)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function MessageLog({ messages, className = '' }: MessageLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Disable auto-scroll if user scrolls up
    setAutoScroll(scrollTop + clientHeight >= scrollHeight - 50);
  };

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
        onScroll={handleScroll}
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

      {/* Auto-scroll indicator */}
      {!autoScroll && messages.length > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 
            px-3 py-1 rounded-full glass-panel text-xs text-[var(--text-secondary)]
            hover:text-[var(--text-primary)] transition-colors"
        >
          <ChevronDown size={12} />
          <span>New messages</span>
        </motion.button>
      )}
    </div>
  );
}
