// User-friendly display helpers, timezone-consistent date formatters, and domain validators for Human Drift

import {
  Condition,
  EnergyLevel,
  EnvironmentType,
  FocusLevel,
  LocationType,
  SessionEndReason,
  SessionQuality,
  SessionStatus,
  VALID_ENERGY_LEVELS,
  VALID_ENVIRONMENT_TYPES,
  VALID_FOCUS_LEVELS,
  VALID_LOCATION_TYPES,
  VALID_SESSION_END_REASONS,
  VALID_SESSION_QUALITIES,
} from '../types';

export function formatEntryType(type?: string | null): string {
  if (!type) return 'Note';
  switch (type) {
    case 'TASK_STARTED':
      return 'Started Work';
    case 'TASK_COMPLETED':
      return 'Completed Work';
    case 'TASK_PAUSED':
      return 'Paused Work';
    case 'CONTEXT_SWITCH':
      return 'Switched Focus';
    case 'CONTEXT_SWITCH_REQUEST':
      return 'Transitioned Thing';
    case 'MILESTONE_REACHED':
      return 'Milestone Reached';
    case 'DISCOVERY':
      return 'Discovery';
    case 'INTENTION_REVISED':
      return 'Revised Plan';
    case 'STOP_DEPARTED':
      return 'Departed Stop';
    case 'STOP_ARRIVED':
      return 'Arrived at Stop';
    case 'NOTE':
      return 'Quick Note';
    default:
      return type
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function formatNodeStatus(status?: string | null): string {
  if (!status) return 'Planned';
  switch (status) {
    case 'PLANNED':
      return 'Planned';
    case 'ACTIVE':
      return 'In Progress';
    case 'PAUSED':
      return 'Paused';
    case 'DORMANT':
      return 'Dormant';
    case 'COMPLETE':
      return 'Complete';
    default:
      return status
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function formatNodeType(type?: string | null): string {
  if (!type) return 'Task';
  switch (type) {
    case 'PROJECT':
      return 'Project';
    case 'TASK':
      return 'Task';
    case 'MILESTONE':
      return 'Milestone';
    case 'NOTE':
      return 'Note';
    case 'ROUTE':
      return 'Route';
    case 'STATION':
      return 'Station';
    default:
      return type
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function formatSessionStatus(status?: string | null): string {
  if (!status) return 'Active';
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'COMPLETE':
      return 'Completed';
    case 'INCOMPLETE':
      return 'Incomplete';
    case 'PAUSED':
      return 'Paused';
    case 'ABANDONED':
      return 'Stopped Early';
    default:
      return status
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function formatEndReason(reason?: string | null): string {
  if (!reason) return 'Natural Completion';
  switch (reason) {
    case 'NATURAL_COMPLETION':
      return 'Natural Completion';
    case 'INTERRUPTED':
      return 'Interrupted';
    case 'DRIFTED':
      return 'Drifted / Off-track';
    case 'ENERGY_DEPLETED':
      return 'Energy Depleted';
    case 'JOURNEY_SWITCH':
      return 'Switched Thing';
    case 'PAUSED':
      return 'Paused';
    case 'INCOMPLETE':
      return 'Incomplete';
    default:
      return reason
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function formatSessionQuality(quality?: string | null): string {
  if (!quality) return 'Unrated';
  switch (quality) {
    case 'EXCELLENT':
      return 'Excellent';
    case 'GOOD':
      return 'Good';
    case 'FAIR':
      return 'Fair';
    case 'POOR':
      return 'Poor';
    default:
      return quality
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function formatConditionValue(val?: string | null): string {
  if (!val) return '—';
  switch (val) {
    case 'LOW':
      return 'Low';
    case 'MEDIUM':
      return 'Medium';
    case 'HIGH':
      return 'High';
    case 'SCATTERED':
      return 'Scattered';
    case 'NORMAL':
      return 'Normal';
    case 'DEEP':
      return 'Deep';
    case 'HOME':
      return 'Home';
    case 'CAFE':
      return 'Cafe';
    case 'OFFICE':
      return 'Office';
    case 'TRANSIT':
      return 'Transit';
    case 'OTHER':
      return 'Other';
    case 'QUIET':
      return 'Quiet';
    case 'AMBIENT':
      return 'Ambient';
    case 'NOISY':
      return 'Noisy';
    default:
      return val
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function formatEventType(eventType?: string | null): string {
  if (!eventType) return 'Activity Recorded';
  switch (eventType) {
    case 'JOURNEY_CREATED':
      return 'Thing Created';
    case 'JOURNEY_UPDATED':
      return 'Thing Updated';
    case 'JOURNEY_PAUSED':
      return 'Thing Paused';
    case 'JOURNEY_RESUMED':
      return 'Thing Resumed';
    case 'JOURNEY_COMPLETED':
      return 'Thing Completed';
    case 'NODE_CREATED':
      return 'Item Created';
    case 'NODE_UPDATED':
      return 'Item Updated';
    case 'NODE_MOVED':
      return 'Item Moved';
    case 'NODE_STATUS_CHANGED':
      return 'Item Status Changed';
    case 'NODE_CLOSED':
      return 'Item Closed';
    case 'NODE_ESTIMATE_SET':
      return 'Estimate Set';
    case 'NODE_ESTIMATE_REVISED':
      return 'Estimate Revised';
    case 'NODE_SEQUENCE_SET':
      return 'Sequence Set';
    case 'NODE_SEQUENCE_CHANGED':
      return 'Sequence Changed';
    case 'NODE_LINKED':
      return 'Discovery Linked';
    case 'SESSION_STARTED':
      return 'Session Started';
    case 'SESSION_INTENTION_LOCKED':
      return 'Intention Recorded';
    case 'SESSION_INTENTION_REVISED':
      return 'Intention Revised';
    case 'SESSION_COMPLETED':
      return 'Session Completed';
    case 'SESSION_PAUSED':
      return 'Session Paused';
    case 'SESSION_RESUMED':
      return 'Session Resumed';
    case 'SESSION_MARKED_INCOMPLETE':
      return 'Session Marked Incomplete';
    case 'SESSION_ABANDONED':
      return 'Session Stopped Early';
    case 'SESSION_REFLECTION_ADDED':
      return 'Reflection Added';
    case 'SESSION_TRANSITION_LINKED':
      return 'Linked Session Transition';
    case 'ENTRY_LOGGED':
      return 'Activity Logged';
    case 'ENTRY_CORRECTED':
      return 'Entry Corrected';
    case 'DISCOVERY_CREATED':
      return 'Discovery Created';
    case 'DISCOVERY_LINKED':
      return 'Discovery Linked';
    case 'CONDITION_CHANGED':
      return 'Condition Changed';
    case 'CONTEXT_SWITCH_REQUESTED':
      return 'Thing Switch Requested';
    case 'CONFLICT_DETECTED':
      return 'Conflict Detected';
    case 'CONFLICT_RESOLVED':
      return 'Conflict Resolved';
    case 'TASK_STARTED':
      return 'Started Work';
    case 'TASK_COMPLETED':
      return 'Completed Work';
    case 'TASK_PAUSED':
      return 'Paused Work';
    default:
      return eventType
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function formatEntityType(entityType?: string | null): string {
  if (!entityType) return 'Item';
  switch (entityType.toUpperCase()) {
    case 'JOURNEY':
      return 'Thing';
    case 'NODE':
      return 'Item';
    case 'SESSION':
      return 'Session';
    case 'SESSIONENTRY':
      return 'Activity Entry';
    case 'CORRECTION':
      return 'Correction';
    case 'CONFLICT':
      return 'Conflict';
    default:
      return entityType;
  }
}

export function formatCorrectionField(field?: string | null): string {
  if (!field) return 'Field';
  switch (field) {
    case 'note':
      return 'Note';
    case 'logged_at':
      return 'Timestamp';
    case 'entry_type':
      return 'Activity Type';
    case 'node_id':
      return 'Linked Item';
    default:
      return field
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

// ==========================================
// TIMEZONE-CONSISTENT DATE & TIME HELPERS
// Strategy:
// 1. Store all timestamps as canonical ISO-8601 UTC strings.
// 2. Convert to local timezone (or explicit IANA timeZone when provided) for display,
//    grouping by calendar date, and generated export filenames.
// 3. Never slice raw UTC ISO strings (.slice(0, 10) or .split('T')[0]) for local calendar dates.
// ==========================================

export function toCanonicalIso(input?: string | Date | number | null): string {
  if (input === undefined || input === null || input === '') {
    return new Date().toISOString();
  }
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid timestamp: ${String(input)}`);
  }
  return d.toISOString();
}

export function getLocalDateParts(
  iso?: string | null,
  timeZone?: string
): { year: string; month: string; day: string; hour: string; minute: string; second: string } | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;

    if (timeZone) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(d);
      const map: Record<string, string> = {};
      for (const p of parts) {
        if (p.type !== 'literal') {
          map[p.type] = p.value;
        }
      }
      const rawHour = map.hour === '24' ? '00' : map.hour || '00';
      return {
        year: map.year || '1970',
        month: map.month || '01',
        day: map.day || '01',
        hour: rawHour,
        minute: map.minute || '00',
        second: map.second || '00',
      };
    }

    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1).padStart(2, '0'),
      day: String(d.getDate()).padStart(2, '0'),
      hour: String(d.getHours()).padStart(2, '0'),
      minute: String(d.getMinutes()).padStart(2, '0'),
      second: String(d.getSeconds()).padStart(2, '0'),
    };
  } catch {
    return null;
  }
}

/**
 * Returns local calendar date as YYYY-MM-DD in the user's local timezone (or specified IANA timeZone).
 * Never slices the UTC ISO string directly.
 */
export function formatLocalDateKey(iso?: string | null, timeZone?: string): string {
  const parts = getLocalDateParts(iso || new Date().toISOString(), timeZone);
  if (!parts) {
    const fallback = getLocalDateParts(new Date().toISOString(), timeZone)!;
    return `${fallback.year}-${fallback.month}-${fallback.day}`;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Returns local time as HHmmss in the user's local timezone (or specified IANA timeZone) for deterministic filenames.
 */
export function formatLocalTimeKey(iso?: string | null, timeZone?: string): string {
  const parts = getLocalDateParts(iso || new Date().toISOString(), timeZone);
  if (!parts) return '000000';
  return `${parts.hour}${parts.minute}${parts.second}`;
}

export function formatLocalDate(iso?: string | null, timeZone?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      ...(timeZone ? { timeZone } : {}),
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function formatLocalTime(iso?: string | null, timeZone?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', {
      ...(timeZone ? { timeZone } : {}),
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function formatLocalDateTime(iso?: string | null, timeZone?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return `${formatLocalDate(iso, timeZone)} at ${formatLocalTime(iso, timeZone)}`;
  } catch {
    return '—';
  }
}

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return 'Never';
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '—';
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    const days = Math.floor(diffSec / 86400);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return formatLocalDate(iso);
  } catch {
    return '—';
  }
}

export function formatMinutes(mins?: number | null): string {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ==========================================
// DOMAIN VALIDATION HELPERS
// ==========================================

const UI_END_REASON_MAP: Record<string, SessionEndReason> = {
  NATURAL_COMPLETION: 'NATURAL_COMPLETION',
  'NATURAL COMPLETION': 'NATURAL_COMPLETION',
  INTERRUPTED: 'INTERRUPTED',
  DRIFTED: 'DRIFTED',
  'DRIFTED / OFF-TRACK': 'DRIFTED',
  OFF_TRACK: 'DRIFTED',
  ENERGY_DEPLETED: 'ENERGY_DEPLETED',
  'ENERGY DEPLETED': 'ENERGY_DEPLETED',
  JOURNEY_SWITCH: 'JOURNEY_SWITCH',
  'SWITCHED THING': 'JOURNEY_SWITCH',
  PAUSED: 'PAUSED',
  INCOMPLETE: 'INCOMPLETE',
};

export function validateSessionEndReason(
  input: unknown,
  defaultValue: SessionEndReason = 'NATURAL_COMPLETION'
): { valid: true; value: SessionEndReason } | { valid: false; error: string } {
  if (input === undefined || input === null || input === '') {
    return { valid: true, value: defaultValue };
  }
  if (typeof input !== 'string') {
    return {
      valid: false,
      error: `Invalid session end_reason. Must be one of: ${VALID_SESSION_END_REASONS.join(', ')}`,
    };
  }
  const normalized = UI_END_REASON_MAP[input.trim().toUpperCase()];
  if (!normalized) {
    return {
      valid: false,
      error: `Invalid session end_reason "${input}". Must be one of: ${VALID_SESSION_END_REASONS.join(', ')}`,
    };
  }
  return { valid: true, value: normalized };
}

export function deriveSessionStatusFromEndReason(
  endReason: SessionEndReason,
  explicitStatus?: string | null
): SessionStatus {
  if (
    explicitStatus === 'COMPLETE' ||
    explicitStatus === 'INCOMPLETE' ||
    explicitStatus === 'PAUSED'
  ) {
    return explicitStatus;
  }
  switch (endReason) {
    case 'NATURAL_COMPLETION':
    case 'JOURNEY_SWITCH':
      return 'COMPLETE';
    case 'PAUSED':
      return 'PAUSED';
    case 'INTERRUPTED':
    case 'DRIFTED':
    case 'ENERGY_DEPLETED':
    case 'INCOMPLETE':
      return 'INCOMPLETE';
  }
}

export function validateSessionQuality(
  input: unknown
): { valid: true; value: SessionQuality | null } | { valid: false; error: string } {
  if (input === undefined || input === null || input === '' || input === 'SKIP') {
    return { valid: true, value: null };
  }
  if (typeof input !== 'string') {
    return {
      valid: false,
      error: `Invalid session quality. Must be one of: ${VALID_SESSION_QUALITIES.join(', ')}`,
    };
  }
  const upper = input.trim().toUpperCase();
  if ((VALID_SESSION_QUALITIES as readonly string[]).includes(upper)) {
    return { valid: true, value: upper as SessionQuality };
  }
  return {
    valid: false,
    error: `Invalid session quality "${input}". Must be one of: ${VALID_SESSION_QUALITIES.join(', ')}`,
  };
}

export function validateCondition(
  input: unknown,
  fallback: Condition = {
    energy: 'MEDIUM',
    focus: 'NORMAL',
    location: 'HOME',
    environment: 'QUIET',
  }
): { valid: true; value: Condition } | { valid: false; error: string } {
  if (input === undefined || input === null) {
    return { valid: true, value: { ...fallback } };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, error: 'Condition must be an object' };
  }
  const raw = input as Record<string, unknown>;
  const energy = raw.energy !== undefined ? String(raw.energy).toUpperCase() : fallback.energy;
  const focus = raw.focus !== undefined ? String(raw.focus).toUpperCase() : fallback.focus;
  const location =
    raw.location !== undefined ? String(raw.location).toUpperCase() : fallback.location;
  const environment =
    raw.environment !== undefined ? String(raw.environment).toUpperCase() : fallback.environment;

  if (!(VALID_ENERGY_LEVELS as readonly string[]).includes(energy)) {
    return {
      valid: false,
      error: `Invalid condition.energy "${String(raw.energy)}". Must be one of: ${VALID_ENERGY_LEVELS.join(', ')}`,
    };
  }
  if (!(VALID_FOCUS_LEVELS as readonly string[]).includes(focus)) {
    return {
      valid: false,
      error: `Invalid condition.focus "${String(raw.focus)}". Must be one of: ${VALID_FOCUS_LEVELS.join(', ')}`,
    };
  }
  if (!(VALID_LOCATION_TYPES as readonly string[]).includes(location)) {
    return {
      valid: false,
      error: `Invalid condition.location "${String(raw.location)}". Must be one of: ${VALID_LOCATION_TYPES.join(', ')}`,
    };
  }
  if (!(VALID_ENVIRONMENT_TYPES as readonly string[]).includes(environment)) {
    return {
      valid: false,
      error: `Invalid condition.environment "${String(raw.environment)}". Must be one of: ${VALID_ENVIRONMENT_TYPES.join(', ')}`,
    };
  }

  return {
    valid: true,
    value: {
      ...fallback,
      ...raw,
      energy: energy as EnergyLevel,
      focus: focus as FocusLevel,
      location: location as LocationType,
      environment: environment as EnvironmentType,
      ...(raw.custom_note ? { custom_note: String(raw.custom_note) } : {}),
    },
  };
}

export const WORK_TYPE_OPTIONS = [
  'Deep Focus Work',
  'Execution & Building',
  'Research & Analysis',
  'Writing & Synthesis',
  'Design & Prototyping',
  'Planning & Strategy',
  'Communication & Coordination',
  'Admin & Maintenance',
];
