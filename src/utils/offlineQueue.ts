import type { NodeStatus } from '../types';

export interface QueuedQuickLog {
  id: string;
  queuedAt: string;
  payload: {
    journey_id: string;
    node_id?: string | null;
    node_name: string;
    node_status: NodeStatus;
    work_type: string;
    duration_minutes: number;
    intention: string;
    condition?: any;
  };
}

const STORAGE_KEY = 'human_drift_queued_logs';

export function getQueuedLogs(): QueuedQuickLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function enqueueLog(payload: QueuedQuickLog['payload']): QueuedQuickLog {
  const item: QueuedQuickLog = {
    id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    queuedAt: new Date().toISOString(),
    payload,
  };
  const list = getQueuedLogs();
  list.push(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return item;
}

export function removeQueuedLog(id: string): void {
  const list = getQueuedLogs().filter((i) => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export async function flushQueuedLogs(
  onLogSynced?: (item: QueuedQuickLog) => void
): Promise<{ synced: number; failed: number }> {
  const list = getQueuedLogs();
  if (list.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of [...list]) {
    try {
      const res = await fetch('/api/sessions/quick-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });

      if (res.ok) {
        removeQueuedLog(item.id);
        synced++;
        if (onLogSynced) onLogSynced(item);
      } else {
        failed++;
      }
    } catch {
      failed++;
      break; // Still offline or network drop
    }
  }

  return { synced, failed };
}
