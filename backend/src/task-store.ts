import * as fs from 'fs';
import * as path from 'path';
import { Task } from './types';

const DATA_DIR = path.join(__dirname, '../data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

const tasks: Map<string, Task> = new Map();

function loadTasks(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(TASKS_FILE)) {
      const data = fs.readFileSync(TASKS_FILE, 'utf8');
      const parsed = JSON.parse(data);

      Object.values(parsed).forEach((task: any) => {
        task.createdAt = new Date(task.createdAt);
        task.updatedAt = new Date(task.updatedAt);
        if (task.result?.timestamp) {
          task.result.timestamp = new Date(task.result.timestamp);
        }
        task.payments?.forEach((payment: any) => {
          payment.timestamp = new Date(payment.timestamp);
        });
        tasks.set(task.id, task);
      });

      console.log(`[TaskStore] Loaded ${tasks.size} tasks from persistence`);
    }
  } catch (error: any) {
    console.error('[TaskStore] Failed to load tasks:', error.message);
  }
}

let saveTimer: NodeJS.Timeout | null = null;

function saveTasks(): void {
  if (saveTimer) clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    try {
      const allTasks = Array.from(tasks.entries())
        .sort(([, a], [, b]) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 100);

      const data = JSON.stringify(Object.fromEntries(allTasks), null, 2);
      fs.writeFile(TASKS_FILE, data, 'utf8', (err) => {
        if (err) {
          console.error('[TaskStore] Failed to save tasks:', err.message);
        }
      });
    } catch (error: any) {
      console.error('[TaskStore] Failed to save tasks:', error.message);
    }
  }, 2000);
}

loadTasks();

export function upsertTask(task: Task): void {
  tasks.set(task.id, task);
  saveTasks();
}

export function getTask(taskId: string): Task | undefined {
  return tasks.get(taskId);
}

export function getTasksByUser(userId: string): Task[] {
  return Array.from(tasks.values()).filter((task) => task.userId === userId);
}

export function getRecentTasks(limit = 10): Task[] {
  return Array.from(tasks.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
