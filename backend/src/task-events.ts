import { Task } from './types';

export type TaskUpdateCallback = (task: Task) => void;

const subscribers: Map<string, TaskUpdateCallback[]> = new Map();

export function subscribeToTask(taskId: string, callback: TaskUpdateCallback): () => void {
  const existing = subscribers.get(taskId) || [];
  existing.push(callback);
  subscribers.set(taskId, existing);

  return () => {
    const callbacks = subscribers.get(taskId) || [];
    subscribers.set(taskId, callbacks.filter((cb) => cb !== callback));
  };
}

export function emitTaskUpdate(task: Task): void {
  const callbacks = subscribers.get(task.id) || [];
  callbacks.forEach((callback) => callback(task));
}

export function addMessage(task: Task, from: string, to: string, content: string): void {
  console.log(`[Dispatcher] Adding message from ${from} to ${to}: ${content}`);
  task.messages.push({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    from,
    to,
    content,
    timestamp: new Date().toISOString(),
  });
  emitTaskUpdate(task);
}
