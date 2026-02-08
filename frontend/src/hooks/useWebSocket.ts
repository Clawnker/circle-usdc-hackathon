'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { AgentMessage, Payment, TaskStatus } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/ws';

interface WSEvent {
  type: 'task:status' | 'task_update' | 'agent:message' | 'payment' | 'task:complete' | 'welcome' | 'subscribed';
  taskId?: string;
  status?: TaskStatus;
  step?: { specialist: string; action: string };
  from?: string;
  to?: string;
  payload?: any;
  amount?: number;
  token?: string;
  txSignature?: string;
  result?: unknown;
  message?: string;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  taskStatus: TaskStatus | null;
  currentStep: { specialist: string; action: string } | null;
  messages: AgentMessage[];
  payments: Payment[];
  result: unknown;
  subscribe: (taskId: string) => void;
  unsubscribe: (taskId: string) => void;
  reset: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [currentStep, setCurrentStep] = useState<{ specialist: string; action: string } | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const subscribedTaskRef = useRef<string | null>(null);

  useEffect(() => {
    const connect = () => {
      try {
        const socket = new WebSocket(WS_URL);

        socket.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          
          // Authenticate immediately
          const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'demo-key';
          socket.send(JSON.stringify({ 
            type: 'auth', 
            apiKey 
          }));

          // Re-subscribe if we had a task
          if (subscribedTaskRef.current) {
            socket.send(JSON.stringify({ 
              type: 'subscribe', 
              taskId: subscribedTaskRef.current 
            }));
          }
        };

        socket.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          // Attempt reconnect after 2 seconds
          setTimeout(connect, 2000);
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        socket.onmessage = (event) => {
          try {
            const data: WSEvent = JSON.parse(event.data);
            console.log('WS Event:', data);

            switch (data.type) {
              case 'welcome':
                console.log('WebSocket welcome:', data.message);
                break;

              case 'subscribed':
                console.log('Subscribed to task:', data.taskId);
                break;

              case 'task:status':
                if (data.status) setTaskStatus(data.status);
                if (data.step) setCurrentStep(data.step);
                break;

              case 'task_update':
                // Handle backend task_update format
                if (data.payload) {
                  const task = data.payload;
                  setTaskStatus(task.status as TaskStatus);
                  
                  // Use activeSpecialist from metadata if available (for multi-hop)
                  const specialist = task.metadata?.activeSpecialist || task.specialist;
                  
                  if (specialist) {
                    setCurrentStep({ specialist, action: 'processing' });
                  }
                  if (task.status === 'completed' && task.result) {
                    setResult(task.result);
                  }
                  // Add payments if present
                  if (task.payments?.length > 0) {
                    setPayments(task.payments.map((p: any, i: number) => ({
                      id: `${Date.now()}-${i}`,
                      from: 'dispatcher',
                      to: task.specialist || 'unknown',
                      amount: parseFloat(p.amount) || 0,
                      token: p.currency || 'ETH',
                      txSignature: p.txHash || '',
                      timestamp: p.timestamp || new Date().toISOString(),
                    })));
                  }
                  // Add messages if present
                  if (task.messages?.length > 0) {
                    setMessages(task.messages.map((m: any) => ({
                      id: m.id || `${Date.now()}-${Math.random()}`,
                      from: m.from || 'unknown',
                      to: m.to || 'unknown',
                      content: m.content || '',
                      timestamp: m.timestamp || new Date().toISOString(),
                    })));
                  }
                }
                break;

              case 'agent:message':
                setMessages(prev => [...prev, {
                  id: `${Date.now()}`,
                  from: data.from || 'unknown',
                  to: data.to || 'unknown',
                  content: typeof data.payload === 'string' 
                    ? data.payload 
                    : JSON.stringify(data.payload),
                  timestamp: new Date().toISOString(),
                }]);
                break;

              case 'payment':
                setPayments(prev => [...prev, {
                  id: `${Date.now()}`,
                  from: data.from || 'unknown',
                  to: data.to || 'unknown',
                  amount: data.amount || 0,
                  token: data.token || 'USDC',
                  txSignature: data.txSignature || '',
                  timestamp: new Date().toISOString(),
                }]);
                break;

              case 'task:complete':
                setTaskStatus('completed');
                setResult(data.result);
                break;
            }
          } catch (err) {
            console.error('Failed to parse WS message:', err);
          }
        };

        socketRef.current = socket;
      } catch (err) {
        console.error('Failed to create WebSocket:', err);
        setTimeout(connect, 2000);
      }
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const subscribe = useCallback((taskId: string) => {
    subscribedTaskRef.current = taskId;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'subscribe', taskId }));
    }
  }, []);

  const unsubscribe = useCallback((taskId: string) => {
    subscribedTaskRef.current = null;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'unsubscribe', taskId }));
    }
  }, []);

  const reset = useCallback(() => {
    setTaskStatus(null);
    setCurrentStep(null);
    setMessages([]);
    setPayments([]);
    setResult(null);
  }, []);

  return {
    isConnected,
    taskStatus,
    currentStep,
    messages,
    payments,
    result,
    subscribe,
    unsubscribe,
    reset,
  };
}
