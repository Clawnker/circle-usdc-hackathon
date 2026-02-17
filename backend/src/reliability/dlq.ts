import * as fs from 'fs';
import * as path from 'path';

export interface DlqRecord {
  id: string;
  taskId?: string;
  specialist?: string;
  reason: string;
  transient: boolean;
  payload?: Record<string, any>;
  createdAt: string;
}

const DATA_DIR = path.join(__dirname, '../../data');
const DLQ_FILE = path.join(DATA_DIR, 'dlq.json');

const records: DlqRecord[] = [];

function load(): void {
  try {
    if (!fs.existsSync(DLQ_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(DLQ_FILE, 'utf8')) as DlqRecord[];
    records.push(...parsed);
  } catch (error: any) {
    console.error('[DLQ] Failed to load:', error.message);
  }
}

function save(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DLQ_FILE, JSON.stringify(records.slice(-1000), null, 2), 'utf8');
  } catch (error: any) {
    console.error('[DLQ] Failed to save:', error.message);
  }
}

load();

export function enqueueDlq(record: Omit<DlqRecord, 'id' | 'createdAt'>): DlqRecord {
  const item: DlqRecord = {
    id: `dlq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...record,
  };
  records.push(item);
  save();
  return item;
}

export function getDlqRecords(limit = 100): DlqRecord[] {
  return records.slice(-limit).reverse();
}
