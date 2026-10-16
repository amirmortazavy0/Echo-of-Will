// ==========================================
// AUTHORITATIVE DOMAIN MODEL v1 — HUMAN DRIFT
// ==========================================

export type Visibility = 'PRIVATE' | 'SHARED' | 'PUBLIC';
export interface Custody { owner_id?: string; visibility?: Visibility; migration_provenance?: { source_sha256: string; defaulted_fields: string[] }; }
export type JourneyStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETE';

export interface Journey extends Custody {
  creation_snapshot?: { name?: string; description?: string | null; intention?: string | null; provenance: string };
  id: string;
  name: string;
  description?: string | null;
  owner_id?: string;
  visibility?: Visibility;
  status: JourneyStatus;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
}

export type NodeType = 'ROUTE' | 'STATION' | 'PROJECT' | 'TASK' | 'MILESTONE' | 'NOTE';
export type NodeStatus = 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'DORMANT' | 'COMPLETE';
export type DoneType = 'DELIVERABLE' | 'TIME_TARGET' | 'MILESTONE_SEQUENCE' | 'OPEN_ENDED';

export interface Node extends Custody {
  id: string;
  journey_id: string;
  parent_id?: string | null;
  node_type: NodeType;
  name: string;
  description?: string | null;
  status: NodeStatus;
  sequence?: number | null;
  estimated_minutes?: number | null;
  done_type?: DoneType | null;
  due_date?: string | null;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
  note?: string | null;
}

export const VALID_SESSION_STATUSES = [
  'ACTIVE',
  'COMPLETE',
  'INCOMPLETE',
  'PAUSED',
] as const;
export type SessionStatus = (typeof VALID_SESSION_STATUSES)[number] | 'ABANDONED'; // Read-only legacy compatibility.

// Authoritative Session Quality values per Domain Model v1
export const VALID_SESSION_QUALITIES = ['POOR', 'FAIR', 'GOOD', 'EXCELLENT'] as const;
export type SessionQuality = (typeof VALID_SESSION_QUALITIES)[number];

// Coherent Session End Reasons bridging UI choices, domain persistence, and exports
export const VALID_SESSION_END_REASONS = [
  'NATURAL_COMPLETION',
  'INTERRUPTED',
  'DRIFTED',
  'ENERGY_DEPLETED',
  'JOURNEY_SWITCH',
  'PAUSED',
  'INCOMPLETE',
] as const;
export type SessionEndReason = (typeof VALID_SESSION_END_REASONS)[number];

export interface Session extends Custody {
  intention_provenance?: 'declared_at_capture' | 'reconstructed' | 'legacy_unknown';
  id: string;
  journey_id: string;
  node_id?: string | null;
  label?: string | null;
  intention: string; // Locked at session start; NEVER modified
  started_at: string;
  ended_at?: string | null;
  status: SessionStatus;
  end_reason?: SessionEndReason | null;
  predecessor_session_id?: string | null;
  successor_session_id?: string | null;
  reflection?: string | null;
  quality?: SessionQuality | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export const VALID_ENTRY_TYPES = [
  'TASK_STARTED',
  'TASK_COMPLETED',
  'TASK_PAUSED',
  'CONTEXT_SWITCH',
  'CONTEXT_SWITCH_REQUEST',
  'MILESTONE_REACHED',
  'DISCOVERY',
  'INTENTION_REVISED',
  'STOP_DEPARTED',
  'STOP_ARRIVED',
  'NOTE',
  'CONDITION_CHANGED',
] as const;
export type EntryType = (typeof VALID_ENTRY_TYPES)[number];

export const VALID_ENERGY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'] as const;
export type EnergyLevel = (typeof VALID_ENERGY_LEVELS)[number];

export const VALID_FOCUS_LEVELS = ['SCATTERED', 'NORMAL', 'DEEP', 'UNKNOWN'] as const;
export type FocusLevel = (typeof VALID_FOCUS_LEVELS)[number];

export const VALID_LOCATION_TYPES = ['HOME', 'CAFE', 'OFFICE', 'TRANSIT', 'OTHER', 'UNKNOWN'] as const;
export type LocationType = (typeof VALID_LOCATION_TYPES)[number];

export const VALID_ENVIRONMENT_TYPES = ['QUIET', 'AMBIENT', 'NOISY', 'UNKNOWN'] as const;
export type EnvironmentType = (typeof VALID_ENVIRONMENT_TYPES)[number];

export interface Condition extends Custody {
  provenance?: 'reported' | 'inherited' | 'unknown' | 'legacy_unknown';
  inherited_from_entry_id?: string | null;
  energy: EnergyLevel;
  focus: FocusLevel;
  location: LocationType;
  environment: EnvironmentType;
  custom_note?: string | null;
}

export interface SessionEntry extends Custody {
  source_report_id?: string;
  captured_at?: string;
  time_provenance?: 'observed' | 'reported' | 'estimated';
  id: string;
  session_id: string;
  node_id?: string | null;
  entry_type: EntryType;
  logged_at: string;
  note?: string | null;
  condition: Condition;
  discovery_ref?: string | null;
}

export interface AuditLogEntry extends Custody {
  actor_id?: string;
  id: string;
  timestamp: string;
  entity_type: 'JOURNEY' | 'NODE' | 'SESSION' | 'SESSIONENTRY' | 'CORRECTION' | 'CONFLICT';
  entity_id: string;
  action: string;
  details: any;
  previous_value?: any;
}

export interface EventLogEntry extends Custody {
  id: string;
  entity_type: 'Journey' | 'Node' | 'Session' | 'SessionEntry';
  entity_id: string;
  event_type: string;
  actor_id: string;
  payload: any;
  previous_value?: any | null;
  occurred_at: string;
}

export interface Correction extends Custody {
  actor_id?: string;
  previous_value?: string;
  sequence?: number;
  id: string;
  entry_id: string;
  field: string;
  original_value: string;
  corrected_value: string;
  reason?: string | null;
  created_at: string;
}

export type ConflictType =
  | 'OVERLAPPING_SESSION'
  | 'INTENTION_NEVER_STARTED'
  | 'TASK_STARTED_NOT_CLOSED'
  | 'ENTRY_OUT_OF_ORDER'
  | 'STOP_SEQUENCE_VIOLATED'
  | 'DUPLICATE_SESSION'
  | 'OTHER';

export interface ConflictLog extends Custody {
  id: string;
  session_id: string;
  conflict_type: ConflictType;
  description: string;
  resolved: boolean;
  resolution?: string | null;
  detected_at: string;
  resolved_at?: string | null;
}

export interface IntentionRevision extends Custody {
  id: string;
  session_id: string;
  entry_id: string;
  previous_intention: string;
  new_intention: string;
  reason?: string | null;
  revised_at: string;
}

export interface NodeEstimateHistory extends Custody {
  id: string;
  node_id: string;
  previous_estimated_minutes: number | null;
  new_estimated_minutes: number | null;
  changed_at: string;
}

export interface NodeClosure extends Custody {
  id: string;
  node_id: string;
  reason: string;
  previous_status: NodeStatus;
  closed_at: string;
}

export interface AppData {
  capture_reports?: CaptureReport[];
  schema_version?: number;
  session_amendments?: any[];
  migrations?: any[];
  journeys: Journey[];
  nodes: Node[];
  sessions: Session[];
  session_entries: SessionEntry[];
  audit_log: AuditLogEntry[];
  // Backwards-compatible aliases
  entries: SessionEntry[];
  event_log: EventLogEntry[];
  corrections: Correction[];
  conflicts: ConflictLog[];
  intention_revisions?: IntentionRevision[];
  node_estimate_history?: NodeEstimateHistory[];
  node_closures?: NodeClosure[];
}

// ==========================================
// DAILY WORK LOGGER & AI PARSER TYPES
// ==========================================

export type WorkType = string;

export interface ParsedLogProposal {
  journey_id: string;
  journey_name?: string;
  node_id?: string | null;
  node_name: string;
  is_new_node?: boolean;
  node_status: NodeStatus;
  work_type: string;
  duration_minutes: number | null;
  model?: string;
  fallback_reason?: string;
  intention: string;
  summary?: string;
  entry_types?: EntryType[];
  condition: Condition;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  provider: 'ollama' | 'heuristic' | 'local_heuristic';
  reasoning?: string;
}

export interface QuickLogPayload {
  client_confirmed_at?: string;
  original_report?: string;
  provider?: 'manual' | 'ollama' | 'heuristic' | 'local_heuristic';
  proposal?: unknown;
  uncertainty?: string;
  boundaries_confirmed?: boolean;
  reviewed_entries?: { entry_type:'NOTE'|'DISCOVERY'|'INTENTION_REVISED'; note?:string; logged_at?:string; node_id?:string|null; discovery_node?:{name:string;description?:string;parent_id?:string|null}; new_intention?:string; reason?:string }[];
  journey_id?: string;
  node_id?: string | null;
  node_name?: string;
  node_status?: NodeStatus;
  work_type?: string;
  duration_minutes: number;
  intention: string;
  condition?: Condition;
  started_at?: string;
  ended_at?: string;
  quality?: SessionQuality | null;
  end_reason?: SessionEndReason | null;
  reflection?: string | null;
  note?: string | null;
  entry_types?: EntryType[];
}

export interface CaptureReport extends Custody {
  id:string; session_id:string; original_text:string; captured_at:string; confirmed_at:string;
  provider:string; proposal:unknown; uncertainty:string|null; claimed_started_at:string; claimed_ended_at:string;
  boundaries_confirmed:boolean; accepted_entries:unknown[];
}

export interface QuickLogResponse {
  session: Session;
  node?: Node | null;
  entries?: SessionEntry[];
  entry?: SessionEntry;
}

export interface BoardNodeItem {
  id: string;
  journey_id: string;
  parent_id?: string | null;
  name: string;
  description?: string | null;
  status: NodeStatus;
  node_type: NodeType;
  total_logged_minutes: number;
  session_count: number;
  last_activity_at: string;
  recent_sessions: {
    id: string;
    intention: string;
    duration_minutes: number;
    logged_at: string;
  }[];
  recent_logs: {
    id: string;
    logged_at: string;
    entry_type: EntryType;
    note: string | null;
  }[];
}

export interface BoardRecentEntry {
  id: string;
  session_id: string;
  journey_id: string;
  journey_name: string;
  node_id: string | null;
  node_name: string | null;
  entry_type: EntryType;
  logged_at: string;
  note: string;
  duration_minutes?: number;
  condition?: Condition;
}

export interface BoardData {
  columns: {
    planned: BoardNodeItem[];
    in_progress: BoardNodeItem[];
    done: BoardNodeItem[];
    paused: BoardNodeItem[];
  };
  total_nodes: number;
  total_active_minutes: number;
  recent_entries: BoardRecentEntry[];
}

export interface OllamaStatus {
  status: 'online' | 'offline';
  reachable?: boolean;
  url: string;
  model: string;
  model_name?: string;
  available_models: string[];
  provider: 'ollama' | 'manual';
}

export interface QueryChatResponse {
  answer: string;
  provider: 'ollama' | 'deterministic' | 'manual';
  sessions_analyzed: number;
}

export type NavTab =
  | 'LOG'
  | 'QUERY'
  | 'ASK'
  | 'TASKS'
  | 'DRIFT'
  | 'BOARD'
  | 'HISTORY'
  | 'FAST_LOG'
  | 'GUIDE'
  | 'HIERARCHY'
  | 'SESSION'
  | 'QUERIES'
  | 'AUDIT';

// Priority Query Result Types (Prototype Spec v1)
export interface DurationVsEstimateResult {
  node_id: string;
  node_name: string;
  node_type: NodeType;
  status: NodeStatus;
  estimated_minutes: number | null;
  actual_minutes: number;
  estimation_error_minutes: number | null;
  sessions_touched_count: number;
}

export interface JourneyProgressResult {
  journey_id: string;
  journey_name: string;
  total_sessions: number;
  completed_sessions: number;
  active_sessions: number;
  total_nodes: number;
  nodes_by_status: Record<NodeStatus, number>;
  nodes_completed_count: number;
  nodes_started_count: number;
  completion_rate: number;
  discoveries_count: number;
  revisions_count: number;
}

export interface SessionPauseInterval {
  start: string;
  end: string;
  duration_minutes: number;
  classification: 'UNCLASSIFIED_CONTEXT_PAUSE';
}

export interface SessionSummaryResult {
  sessionDurationMinutes: number;
  activeMinutes: number;
  unclassifiedPauseMinutes: number;
  pauseIntervals: SessionPauseInterval[];
  entriesCount: number;
  discoveriesCount: number;
  revisionsCount: number;
  touchedNodeIds: string[];
}
