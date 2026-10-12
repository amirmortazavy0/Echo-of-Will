import { effectiveData, interpretSession } from '../src/domain/evidence';
import {
  AppData,
  DurationVsEstimateResult,
  JourneyProgressResult,
  NodeStatus,
  Session,
  SessionEntry,
  SessionPauseInterval,
  SessionSummaryResult,
} from '../src/types';

export function parseIso(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function calculateSessionNodeDurations(session:Session,entries:SessionEntry[],now=new Date()):Map<string,number> { return interpretSession(session,entries,now).nodeMinutes; }

// Calculate active duration for a specific node across all session entries
export function calculateNodeActiveMinutes(
  nodeId: string,
  allEntries: SessionEntry[],
  sessions: Session[] = [],
  now: Date = new Date()
): { activeMinutes: number; sessionIds: Set<string>; perSessionMinutes: Map<string, number> } {
  const sessionIds = new Set<string>();
  const perSessionMinutes = new Map<string, number>();

  // Group entries by session
  const entriesBySession = new Map<string, SessionEntry[]>();
  for (const entry of allEntries || []) {
    if (!entry.session_id) continue;
    if (!entriesBySession.has(entry.session_id)) {
      entriesBySession.set(entry.session_id, []);
    }
    entriesBySession.get(entry.session_id)!.push(entry);
  }

  const sessionsMap = new Map((sessions || []).map((s) => [s.id, s]));
  let totalMinutes = 0;

  for (const [sessionId, sEntries] of entriesBySession.entries()) {
    const s = sessionsMap.get(sessionId);
    if (!s) continue; // Missing Session bounds never become synthetic activity.

    const touchedInSession = sEntries.some(
      (e) => e.node_id === nodeId
    );
    if (touchedInSession) {
      sessionIds.add(sessionId);
    }

    const durationsByNode = calculateSessionNodeDurations(s, sEntries, now);
    const nodeMins = durationsByNode.get(nodeId) || 0;
    if (nodeMins > 0) {
      sessionIds.add(sessionId);
      perSessionMinutes.set(sessionId, nodeMins);
      totalMinutes += nodeMins;
    } else if (touchedInSession) {
      perSessionMinutes.set(sessionId, 0);
    }
  }

  return {
    activeMinutes: totalMinutes,
    sessionIds,
    perSessionMinutes,
  };
}

// Priority Query 1: Actual duration vs estimate (Prototype Spec v1)
export function calculateDurationVsEstimate(
  appData: AppData,
  journeyId?: string,
  nodeId?: string
): DurationVsEstimateResult[] {
  appData = effectiveData(appData);
  let targetNodes = appData.nodes || [];
  if (journeyId) {
    targetNodes = targetNodes.filter((n) => n.journey_id === journeyId);
  }
  if (nodeId) {
    targetNodes = targetNodes.filter((n) => n.id === nodeId);
  }

  const entries = Array.from(
    new Map(
      [
        ...(Array.isArray(appData.session_entries) ? appData.session_entries : []),
        ...(Array.isArray(appData.entries) ? appData.entries : []),
      ].map((e) => [e.id, e])
    ).values()
  );

  const results: DurationVsEstimateResult[] = [];

  for (const node of targetNodes) {
    const { activeMinutes, sessionIds } = calculateNodeActiveMinutes(
      node.id,
      entries,
      appData.sessions || []
    );

    const error =
      node.estimated_minutes !== null && node.estimated_minutes !== undefined
        ? Math.round((activeMinutes - node.estimated_minutes) * 10) / 10
        : null;

    results.push({
      node_id: node.id,
      node_name: node.name,
      node_type: node.node_type,
      status: node.status,
      estimated_minutes: node.estimated_minutes ?? null,
      actual_minutes: activeMinutes,
      estimation_error_minutes: error,
      sessions_touched_count: sessionIds.size,
    });
  }

  // Sort by actual duration descending
  results.sort((a, b) => b.actual_minutes - a.actual_minutes);
  return results;
}

// Priority Query 2: Journey progress (Prototype Spec v1)
export function calculateJourneyProgress(
  appData: AppData,
  journeyId: string
): JourneyProgressResult {
  appData = effectiveData(appData);
  const journey = (appData.journeys || []).find((j) => j.id === journeyId);
  const journeyName = journey ? journey.name : 'Unknown Thing';

  const journeySessions = (appData.sessions || []).filter((s) => s.journey_id === journeyId);
  const journeyNodes = (appData.nodes || []).filter((n) => n.journey_id === journeyId);

  const completedSessions = journeySessions.filter((s) => s.status === 'COMPLETE').length;
  const activeSessions = journeySessions.filter((s) => s.status === 'ACTIVE').length;

  const nodesByStatus: Record<NodeStatus, number> = {
    PLANNED: 0,
    ACTIVE: 0,
    PAUSED: 0,
    DORMANT: 0,
    COMPLETE: 0,
  };

  for (const node of journeyNodes) {
    if (nodesByStatus[node.status] !== undefined) {
      nodesByStatus[node.status]++;
    }
  }

  const allEntries = Array.from(
    new Map(
      [
        ...(Array.isArray(appData.session_entries) ? appData.session_entries : []),
        ...(Array.isArray(appData.entries) ? appData.entries : []),
      ].map((e) => [e.id, e])
    ).values()
  );

  // Nodes touched in sessions
  const journeySessionIds = new Set(journeySessions.map((s) => s.id));
  const entriesInJourney = allEntries.filter((e) => journeySessionIds.has(e.session_id));

  const startedNodeIds = new Set<string>();
  const completedNodeIds = new Set<string>();
  let discoveriesCount = 0;
  let revisionsCount = 0;

  for (const entry of entriesInJourney) {
    if (entry.entry_type === 'TASK_STARTED' && entry.node_id) {
      startedNodeIds.add(entry.node_id);
    } else if (entry.entry_type === 'TASK_COMPLETED' && entry.node_id) {
      completedNodeIds.add(entry.node_id);
    } else if (entry.entry_type === 'DISCOVERY') {
      discoveriesCount++;
    } else if (entry.entry_type === 'INTENTION_REVISED') {
      revisionsCount++;
    }
  }

  const nodesCompletedCount = completedNodeIds.size;
  const nodesStartedCount = startedNodeIds.size;
  const completionRate =
    nodesStartedCount > 0
      ? Math.round((nodesCompletedCount / nodesStartedCount) * 1000) / 10
      : 0;

  return {
    journey_id: journeyId,
    journey_name: journeyName,
    total_sessions: journeySessions.length,
    completed_sessions: completedSessions,
    active_sessions: activeSessions,
    total_nodes: journeyNodes.length,
    nodes_by_status: nodesByStatus,
    nodes_completed_count: nodesCompletedCount,
    nodes_started_count: nodesStartedCount,
    completion_rate: completionRate,
    discoveries_count: discoveriesCount,
    revisions_count: revisionsCount,
  };
}

// Session Detailed Breakdown (calculated fields from Domain Model v1 & Architecture Decision 1)
export function calculateSessionSummary(session:Session,entries:SessionEntry[],now=new Date()) { const {nodeMinutes,...result}=interpretSession(session,entries,now); return {...result,nodeMinutes:Object.fromEntries(nodeMinutes)}; }
