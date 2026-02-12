import { WebSocketServer, WebSocket } from 'ws';
import { Request } from 'express';
import { dispatch, getTask, subscribeToTask } from './dispatcher';
import { Task, WSEvent } from './types';

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  userId?: string;
  subscriptions?: Map<string, () => void>; // taskId -> unsubscribe function
}

const wsClients: Map<ExtendedWebSocket, Set<string>> = new Map();

export function setupWebSocket(server: any) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: ExtendedWebSocket, req: Request) => {
    console.log('[WS] Client connected');
    wsClients.set(ws, new Set());
    ws.subscriptions = new Map();

    // Heartbeat state
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleWSMessage(ws, message);
      } catch (error) {
        ws.send(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
      // Cleanup subscriptions
      if (ws.subscriptions) {
        ws.subscriptions.forEach(unsub => unsub());
        ws.subscriptions.clear();
      }
      wsClients.delete(ws);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to Hivemind Protocol. Please authenticate.',
      timestamp: new Date().toISOString(),
    }));
  });

  // Periodic heartbeat check (every 30s)
  const interval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const extWs = ws as ExtendedWebSocket;
      if (extWs.isAlive === false) {
        wsClients.delete(extWs);
        return extWs.terminate();
      }
      extWs.isAlive = false;
      extWs.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

function handleWSMessage(ws: ExtendedWebSocket, message: any) {
  console.log('[WS] Received message:', message.type, message.taskId || '');
  
  // Authentication handler
  if (message.type === 'auth') {
    const apiKey = message.apiKey;
    const apiKeysEnv = process.env.API_KEYS || '';
    const validKeys = apiKeysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);

    if (apiKey && validKeys.includes(apiKey)) {
      ws.userId = apiKey;
      console.log('[WS] Client authenticated:', apiKey);
      ws.send(JSON.stringify({ type: 'authenticated', userId: ws.userId }));
    } else {
      console.log('[WS] Auth failed for key:', apiKey);
      ws.send(JSON.stringify({ error: 'Authentication failed' }));
    }
    return;
  }

  // Ensure client is authenticated for other messages
  if (!ws.userId) {
    ws.send(JSON.stringify({ error: 'Unauthorized: Please authenticate with an API Key' }));
    return;
  }

  switch (message.type) {
    case 'subscribe':
      // Subscribe to task updates
      if (message.taskId) {
        const task = getTask(message.taskId);
        if (!task) {
          ws.send(JSON.stringify({ error: 'Task not found' }));
          return;
        }

        // Security: only allow task owner to subscribe
        if (task.userId !== ws.userId) {
          ws.send(JSON.stringify({ error: 'Access denied: not your task' }));
          return;
        }

        // Cleanup existing subscription for this task if it exists
        if (ws.subscriptions?.has(message.taskId)) {
          ws.subscriptions.get(message.taskId)!();
        }

        const subscriptions = wsClients.get(ws) || new Set();
        subscriptions.add(message.taskId);
        wsClients.set(ws, subscriptions);

        // Set up subscription for future updates
        const unsubscribe = subscribeToTask(message.taskId, (updatedTask: Task) => {
          sendToClient(ws, {
            type: 'task_update',
            taskId: updatedTask.id,
            payload: updatedTask,
            timestamp: new Date(),
          });
        });

        // Store unsubscribe function
        if (ws.subscriptions) {
          ws.subscriptions.set(message.taskId, unsubscribe);
        }

        // IMMEDIATELY send current task state (fixes race condition)
        const currentTask = getTask(message.taskId);
        if (currentTask) {
          sendToClient(ws, {
            type: 'task_update',
            taskId: currentTask.id,
            payload: currentTask,
            timestamp: new Date(),
          });
        }

        ws.send(JSON.stringify({
          type: 'subscribed',
          taskId: message.taskId,
        }));
      }
      break;

    case 'dispatch':
      // Handle dispatch via WebSocket
      dispatch({
        prompt: message.prompt,
        userId: ws.userId, // Use verified userId from socket
        preferredSpecialist: message.preferredSpecialist,
        dryRun: message.dryRun,
      }).then(result => {
        ws.send(JSON.stringify({
          type: 'dispatch_result',
          ...result,
        }));
      }).catch(error => {
        ws.send(JSON.stringify({
          type: 'error',
          message: error.message,
        }));
      });
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;

    default:
      ws.send(JSON.stringify({ error: 'Unknown message type' }));
  }
}

function sendToClient(ws: WebSocket, event: WSEvent) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}
