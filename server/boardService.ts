import { effectiveData, interpretSession } from '../src/domain/evidence';
import {
  AppData,
  BoardData,
  BoardNodeItem,
  BoardRecentEntry,
  Session,
  SessionEntry,
} from '../src/types';
import { calculateNodeActiveMinutes, calculateSessionNodeDurations } from './queries';

export type { BoardNodeItem, BoardData };

/**
 * Computes Board view state (columns, per-node durations, total active minutes, recent entries).
 *
 * Duration calculation rules:
 * - Each Node's `total_logged_minutes` is derived strictly from recorded SessionEntry boundaries
 *   for that specific Node via `calculateNodeActiveMinutes` / `calculateSessionNodeDurations`.
 * - A multi-Node Session's total duration is never duplicated across every Node touched.
 * - Sessions or Nodes with no entries receive 0 minutes (no synthetic 30-minute fallback).
 */
export function computeBoardData(
  data: AppData,
  targetJourneyId?: string,
  now: Date = new Date()
): BoardData {
  data = effectiveData(data);
  const isAll = !targetJourneyId || targetJourneyId === 'ALL';

  const filteredNodes = isAll
    ? data.nodes || []
    : (data.nodes || []).filter((n) => n.journey_id === targetJourneyId);

  const entries: SessionEntry[] = Array.from(
    new Map(
      [
        ...(Array.isArray(data.session_entries) ? data.session_entries : []),
        ...(Array.isArray(data.entries) ? data.entries : []),
      ].map((e) => [e.id, e])
    ).values()
  );

  const sessions = data.sessions || [];
  const journeys = data.journeys || [];
  const nodes = data.nodes || [];

  const sessionsById = new Map<string, Session>(sessions.map((s) => [s.id, s]));
  const journeysById = new Map(journeys.map((j) => [j.id, j]));
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  // Group entries by session for per-session-per-node duration lookup
  const entriesBySession = new Map<string, SessionEntry[]>();
  for (const e of entries) {
    if (!e.session_id) continue;
    if (!entriesBySession.has(e.session_id)) {
      entriesBySession.set(e.session_id, []);
    }
    entriesBySession.get(e.session_id)!.push(e);
  }

  const sessionNodeDurationsMap = new Map<string, Map<string, number>>();
  for (const s of sessions) {
    const sEntries = entriesBySession.get(s.id) || [];
    sessionNodeDurationsMap.set(s.id, calculateSessionNodeDurations(s, sEntries, now));
  }

  // Index entries by resolved node_id
  const entriesByNode = new Map<string, SessionEntry[]>();
  for (const entry of entries) {
    const s = entry.session_id ? sessionsById.get(entry.session_id) : null;
    const resolvedNodeId = entry.node_id || null;
    if (resolvedNodeId) {
      if (!entriesByNode.has(resolvedNodeId)) {
        entriesByNode.set(resolvedNodeId, []);
      }
      entriesByNode.get(resolvedNodeId)!.push(entry);
    }
  }

  let grandTotalMinutes = 0;

  const nodeItems: BoardNodeItem[] = filteredNodes.map((node) => {
    const nodeEntries = [...(entriesByNode.get(node.id) || [])].sort(
      (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
    );

    const { activeMinutes, sessionIds, perSessionMinutes } = calculateNodeActiveMinutes(
      node.id,
      entries,
      sessions,
      now
    );

    const recentSessions: BoardNodeItem['recent_sessions'] = [];
    const recentLogs: BoardNodeItem['recent_logs'] = nodeEntries.slice(0, 5).map((entry) => ({
      id: entry.id,
      logged_at: entry.logged_at,
      entry_type: entry.entry_type,
      note: entry.note || null,
    }));

    const seenSessions = new Set<string>();
    for (const entry of nodeEntries) {
      if (!entry.session_id || seenSessions.has(entry.session_id)) continue;
      seenSessions.add(entry.session_id);

      const s = sessionsById.get(entry.session_id);
      const nodeDurInSession = perSessionMinutes.get(entry.session_id) ?? 0;

      if (recentSessions.length < 4) {
        recentSessions.push({
          id: entry.session_id,
          intention: s?.intention || entry.note || 'Logged work',
          duration_minutes: nodeDurInSession,
          logged_at: entry.logged_at,
        });
      }
    }

    grandTotalMinutes += activeMinutes;

    return {
      id: node.id,
      journey_id: node.journey_id,
      parent_id: node.parent_id,
      name: node.name,
      description: node.description,
      status: node.status,
      node_type: node.node_type,
      total_logged_minutes: activeMinutes,
      session_count: sessionIds.size,
      last_activity_at: nodeEntries[0]?.logged_at || node.created_at,
      recent_sessions: recentSessions,
      recent_logs: recentLogs,
    };
  });

  const columns: BoardData['columns'] = {
    planned: [],
    in_progress: [],
    done: [],
    paused: [],
  };

  for (const item of nodeItems) {
    if (item.status === 'ACTIVE') {
      columns.in_progress.push(item);
    } else if (item.status === 'COMPLETE') {
      columns.done.push(item);
    } else if (item.status === 'PAUSED') {
      columns.paused.push(item);
    } else {
      columns.planned.push(item);
    }
  }

  // Sort each column by most recent activity
  for (const key of Object.keys(columns) as Array<keyof BoardData['columns']>) {
    columns[key].sort((a, b) => {
      const tA = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      const tB = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      return tB - tA;
    });
  }

  // Build Board Recent Entries stream
  const filteredEntries = entries.filter((e) => {
    if (isAll) return true;
    const sess = e.session_id ? sessionsById.get(e.session_id) : null;
    const entryNode = e.node_id ? nodesById.get(e.node_id) : null;
    const jId = sess?.journey_id || entryNode?.journey_id;
    return jId === targetJourneyId;
  });

  filteredEntries.sort(
    (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
  );

  const recent_entries: BoardRecentEntry[] = filteredEntries.slice(0, 50).map((e) => {
    const s = e.session_id ? sessionsById.get(e.session_id) : null;
    const resolvedNodeId = e.node_id || null;
    const n = resolvedNodeId ? nodesById.get(resolvedNodeId) : null;
    const jId = s?.journey_id || n?.journey_id || '';
    const j = journeysById.get(jId);

    const perNodeMap = e.session_id ? sessionNodeDurationsMap.get(e.session_id) : undefined;
    const nodeDuration =
      resolvedNodeId && perNodeMap ? perNodeMap.get(resolvedNodeId) : undefined;

    return {
      id: e.id,
      session_id: e.session_id,
      journey_id: jId,
      journey_name: j ? j.name : 'Unassigned Thing',
      node_id: n ? n.id : null,
      node_name: n ? n.name : null,
      entry_type: e.entry_type,
      logged_at: e.logged_at,
      note: e.note || s?.intention || 'Logged activity',
      // An atomic report does not itself have a duration.
      condition: e.condition,
    };
  });

  return {
    columns,
    total_nodes: nodeItems.length,
    total_active_minutes: sessions.filter(s=>isAll||s.journey_id===targetJourneyId).reduce((sum,s)=>sum+interpretSession(s,entries.filter(e=>e.session_id===s.id),now).activeMinutes,0),
    recent_entries,
  };
}
