import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { AppData, AuditLogEntry, EventLogEntry } from '../src/types';

export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';
export const getCurrentIso = () => new Date().toISOString();
export const getDataDir = () => path.resolve(process.env.PIST_DATA_DIR || path.join('backend', 'data'));
export const getCanonicalStoragePath = () => path.join(getDataDir(), 'pist_data.json');
export const getBackupStoragePath = () => `${getCanonicalStoragePath()}.bak`;
export const STORAGE_FILE = getCanonicalStoragePath();
export const BACKEND_STORAGE_FILE = STORAGE_FILE;
export class StorageError extends Error { status = 503; }
const collections = ['journeys', 'nodes', 'sessions', 'session_entries', 'audit_log', 'event_log', 'corrections', 'conflicts', 'intention_revisions', 'node_estimate_history', 'node_closures', 'session_amendments', 'capture_reports'] as const;
const revisions = new WeakMap<AppData, string | null>();
const originals = new WeakMap<AppData, AppData>();
export const fileHash = (file: string) => fs.existsSync(file) ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
export const owned = () => ({ owner_id: DEFAULT_USER_ID, visibility: 'PRIVATE' as const });

export function validateStoredData(value: any): AppData {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !collections.some(key => key in value) && !('entries' in value)) throw new StorageError('Unrecognized storage document');
  const data: any = structuredClone(value);
  for (const key of [...collections, 'entries']) {
    if (key in data && !Array.isArray(data[key])) throw new StorageError(`Invalid collection: ${key}`);
    const ids = new Set<string>();
    for (const record of data[key] || []) {
      if (!record || typeof record !== 'object' || Array.isArray(record) || typeof record.id !== 'string' || !record.id || ids.has(record.id)) throw new StorageError(`Invalid or duplicate record in ${key}; original bytes retained`);
      ids.add(record.id);
    }
  }
  const entries = [...(data.session_entries || [])];
  for (const entry of data.entries || []) {
    const existing = entries.find(e => e.id === entry.id);
    if (existing && !isDeepStrictEqual(existing, entry)) throw new StorageError('Conflicting entry aliases; explicit reconciliation required');
    if (!existing) entries.push(entry);
  }
  for (const key of collections) data[key] ??= [];
  data.session_entries = entries;
  data.entries = entries;
  return data;
}
function load(file: string) { return validateStoredData(JSON.parse(fs.readFileSync(file, 'utf8'))); }
function candidates() {
  const legacyRoot = process.env.PIST_DATA_DIR ? path.join(getDataDir(), 'legacy_root') : path.resolve('data');
  return [path.join(getDataDir(), 'human_drift.json'), path.join(legacyRoot, 'pist_data.json'), path.join(legacyRoot, 'human_drift.json')].filter(fs.existsSync);
}
export function readAppData(): AppData {
  const canonical = getCanonicalStoragePath();
  const backup = getBackupStoragePath();
  let data: AppData | undefined;
  if (fs.existsSync(canonical)) { try { data = load(canonical); } catch { /* evaluate backup without modifying originals */ } }
  if (!data && fs.existsSync(backup)) {
    try { data = load(backup); console.warn('Storage recovery candidate: validated backup is being read; canonical bytes remain preserved until a successful write.'); } catch { /* fail closed below */ }
  }
  if (!data) {
    if (fs.existsSync(canonical) || fs.existsSync(backup)) throw new StorageError('Canonical and backup are unusable. Preserve originals and run storage inspection; automatic legacy import is disabled.');
    if (candidates().length) throw new StorageError('Legacy data exists. Explicit storage migration preview and selection required.');
    if (fs.existsSync(getDataDir()) && fs.readdirSync(getDataDir()).some(name => /^pist_data\..*\.tmp$/.test(name))) throw new StorageError('Interrupted initialization found; inspect retained temporary files before initializing.');
    data = validateStoredData({ schema_version: 2, ...Object.fromEntries(collections.map(key => [key, []])) });
  }
  revisions.set(data, fileHash(canonical));
  originals.set(data, structuredClone(data));
  return data;
}
export const ensureStorageFile = readAppData; // Compatibility name: reads never migrate or initialize disk.
function durable(file: string, bytes: string | Buffer) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function preserve(file: string, suffix: string) {
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.${suffix}-${randomUUID()}`, fs.constants.COPYFILE_EXCL);
}
export function writeAppData(data: AppData): void {
  if ((data as any).schema_version !== 2) throw new StorageError('Legacy schema is read-only until explicit migration is reviewed and applied');
  const previous = originals.get(data);
  if (!revisions.has(data)) throw new StorageError('Write requires a freshly read storage snapshot');
  // Keep reported overlaps/backfills as evidence; never discard or silently reorder them.
  const conflict = (session_id: string, conflict_type: 'OVERLAPPING_SESSION' | 'ENTRY_OUT_OF_ORDER', description: string) => {
    if (data.conflicts.some(c => c.session_id === session_id && c.conflict_type === conflict_type && c.description === description)) return;
    const record = { id: `cnf-${randomUUID()}`, session_id, conflict_type, description, resolved: false, detected_at: getCurrentIso(), ...owned() };
    data.conflicts.push(record);
    appendEvent(data, { entity_type: 'Session', entity_id: session_id, event_type: 'CONFLICT_DETECTED', payload: record });
  };
  if (previous) {
    for (const session of data.sessions.filter(s => !previous.sessions.some(old => old.id === s.id))) {
      for (const other of previous.sessions) if (Date.parse(session.started_at) < (other.ended_at ? Date.parse(other.ended_at) : Infinity) && Date.parse(other.started_at) < (session.ended_at ? Date.parse(session.ended_at) : Infinity)) {
        conflict(session.id, 'OVERLAPPING_SESSION', `Reported bounds overlap Session ${other.id}; retain both reports for review.`);
      }
    }
    for (const entry of data.entries.filter(e => !previous.entries.some(old => old.id === e.id))) {
      if (previous.entries.some(old => old.session_id === entry.session_id && Date.parse(old.logged_at) > Date.parse(entry.logged_at))) conflict(entry.session_id, 'ENTRY_OUT_OF_ORDER', `Entry ${entry.id} was captured after an entry with a later reported time; original capture order retained.`);
    }
  }
  // Custody defaults apply only to new entities, never to historical event actors/payloads.
  for (const key of collections) {
    const oldIds = new Set(((previous as any)?.[key] || []).map((r: any) => r.id));
    for (const record of (data as any)[key] || []) {
      if (!oldIds.has(record.id)) {
        Object.assign(record, owned());
        if (key === 'session_entries') { if (record.condition) Object.assign(record.condition, owned()); record.captured_at ??= getCurrentIso(); record.time_provenance ??= 'observed'; }
      }
    }
  }
  for (const key of ['audit_log', 'event_log', 'corrections', 'intention_revisions', 'node_estimate_history', 'node_closures', 'session_amendments', 'capture_reports', 'session_entries']) {
    for (const old of (previous as any)?.[key] || []) {
      if (!isDeepStrictEqual(old, (data as any)[key]?.find((r: any) => r.id === old.id))) throw new StorageError(`Historical ${key} records are immutable; append an amendment/correction`);
    }
  }
  for (const old of previous?.sessions || []) {
    const current = data.sessions.find(s => s.id === old.id);
    if (!current || current.intention !== old.intention || current.journey_id !== old.journey_id || current.started_at !== old.started_at || old.ended_at && !isDeepStrictEqual(old, current)) throw new StorageError('Original Session identity, intention and closed state are immutable');
  }
  for (const old of previous?.journeys || []) {
    const current = data.journeys.find(j => j.id === old.id);
    if (!current || !isDeepStrictEqual((old as any).creation_snapshot, (current as any).creation_snapshot)) throw new StorageError('Thing creation snapshot is immutable');
  }
  const valid = validateStoredData(data);
  const canonical = getCanonicalStoragePath();
  const backup = getBackupStoragePath();
  fs.mkdirSync(getDataDir(), { recursive: true });
  const lockPath = path.join(getDataDir(), '.write.lock');
  let lock: number;
  try { lock = fs.openSync(lockPath, 'wx', 0o600); } catch { throw new StorageError('Storage is locked; inspect the writer before clearing a stale lock'); }
  const temp = path.join(getDataDir(), `pist_data.${randomUUID()}.tmp`);
  const backupTemp = `${temp}.backup`;
  try {
    if (fileHash(canonical) !== revisions.get(data)) throw new StorageError('Storage changed since read; reload before retrying');
    const output: any = { ...valid };
    delete output.entries; // Canonical alias boundary; records were compared above, never silently deduplicated.
    durable(temp, JSON.stringify(output, null, 2));
    if (fs.existsSync(canonical)) {
      let validOld = false;
      try { load(canonical); validOld = true; } catch { preserve(canonical, 'damaged'); }
      if (validOld) {
        durable(backupTemp, fs.readFileSync(canonical));
        if (fs.existsSync(backup)) { try { load(backup); } catch { preserve(backup, 'damaged'); } }
        fs.renameSync(backupTemp, backup);
      }
    }
    fs.renameSync(temp, canonical);
    revisions.set(data, fileHash(canonical));
    originals.set(data, structuredClone(data));
  } finally {
    // Failed commits retain their temporary bytes for diagnosis; the last canonical/backup survives.
    fs.closeSync(lock);
    fs.unlinkSync(lockPath);
  }
}

export function inspectStorageFile(file: string) {
  const data = load(path.resolve(file));
  const defects: string[] = [];
  for (const node of data.nodes) {
    if (!data.journeys.some(j => j.id === node.journey_id)) defects.push(`Node ${node.id}: missing Thing`);
    let current = node; const seen = new Set<string>();
    while (current?.parent_id) {
      if (seen.has(current.id)) { defects.push(`Node ${node.id}: cycle`); break; }
      seen.add(current.id);
      const parent = data.nodes.find(n => n.id === current.parent_id);
      if (!parent || parent.journey_id !== node.journey_id) { defects.push(`Node ${node.id}: invalid parent`); break; }
      current = parent;
    }
  }
  for (const session of data.sessions) {
    if (!data.journeys.some(j => j.id === session.journey_id)) defects.push(`Session ${session.id}: missing Thing`);
    if (!Number.isFinite(Date.parse(session.started_at)) || session.ended_at && (!Number.isFinite(Date.parse(session.ended_at)) || Date.parse(session.ended_at) < Date.parse(session.started_at))) defects.push(`Session ${session.id}: invalid bounds`);
  }
  for (const entry of data.session_entries) {
    const session = data.sessions.find(s => s.id === entry.session_id);
    if (!session || entry.node_id && !data.nodes.some(n => n.id === entry.node_id && n.journey_id === session.journey_id) || !Number.isFinite(Date.parse(entry.logged_at))) defects.push(`Entry ${entry.id}: invalid reference/time`);
  }
  return { source: path.resolve(file), sha256: fileHash(file), data, defects, unknown_fields: Object.keys(data).filter(k => ![...collections, 'entries', 'schema_version', 'migrations'].includes(k as any)), candidates: candidates() };
}
export function migrateStorageFile(file: string, expectedHash: string, apply = false, expectedCanonicalHash?: string) {
  const report = inspectStorageFile(file);
  if (report.sha256 !== expectedHash) throw new StorageError('Migration source changed; preview again');
  const data: any = report.data;
  const defaults: { collection: string; id: string; fields: string[] }[] = [];
  for (const key of collections) for (const record of data[key]) {
    const fields: string[] = [];
    for (const [field, value] of Object.entries(owned())) if (!(field in record)) { record[field] = value; fields.push(field); }
    if (key === 'session_entries' && !record.condition) {
      record.condition = { energy: 'UNKNOWN', focus: 'UNKNOWN', location: 'UNKNOWN', environment: 'UNKNOWN', provenance: 'legacy_unknown' };
      fields.push('condition');
    }
    if (key === 'session_entries' && record.condition) {
      const conditionFields: string[] = [];
      for (const [field, value] of Object.entries(owned())) if (!(field in record.condition)) { record.condition[field] = value; conditionFields.push(field); }
      if (conditionFields.length) record.condition.migration_provenance = { source_sha256: expectedHash, defaulted_fields: conditionFields };
      record.condition.provenance ??= 'legacy_unknown';
    }
    if (fields.length) { record.migration_provenance = { source_sha256: expectedHash, defaulted_fields: fields }; defaults.push({ collection: key, id: record.id, fields }); }
    if (key === 'sessions') record.intention_provenance ??= 'legacy_unknown';
    if (key === 'journeys' && !record.creation_snapshot) record.creation_snapshot = { intention: null, provenance: 'legacy_unknown' };
  }
  if (apply) {
    if (report.defects.length) throw new StorageError('Migration has unresolved relationships or bounds; review the dry-run report');
    const canonical = getCanonicalStoragePath();
    let current: any;
    if (fs.existsSync(canonical)) { try { current = load(canonical); } catch { if (expectedCanonicalHash !== fileHash(canonical)) throw new StorageError('Damaged canonical requires its explicit reviewed SHA-256 before replacement'); } }
    if (current?.migrations?.some((m: any) => m.source_sha256 === expectedHash) || data.schema_version === 2 && path.resolve(file) === canonical) return { ...report, data: undefined, defaults, applied: false, already_applied: true };
    if (current && path.resolve(file) !== canonical && expectedCanonicalHash !== fileHash(canonical)) throw new StorageError('Canonical exists; explicit reviewed canonical SHA-256 is required to replace the selected candidate');
    fs.mkdirSync(getDataDir(), { recursive: true });
    const snapshot = path.join(getDataDir(), `migration-source-${expectedHash}.json`);
    if (!fs.existsSync(snapshot)) fs.copyFileSync(file, snapshot, fs.constants.COPYFILE_EXCL);
    if (fileHash(snapshot) !== expectedHash) throw new StorageError('Migration source snapshot mismatch');
    data.schema_version = 2;
    data.migrations = [...(data.migrations || []), { id: randomUUID(), source_sha256: expectedHash, applied_at: getCurrentIso(), defaults }];
    revisions.set(data, fileHash(canonical));
    originals.set(data, structuredClone(data));
    writeAppData(data);
  }
  return { ...report, data: undefined, defaults, applied: apply, already_applied: false };
}
export function appendAuditLog(data: AppData, params: { entity_type: AuditLogEntry['entity_type'] | 'SESSION_ENTRY'; entity_id: string; action: string; details: any; previous_value?: any; actor_id?: string }): AuditLogEntry {
  const timestamp = getCurrentIso();
  const actor = params.actor_id || DEFAULT_USER_ID;
  const entity_type = params.entity_type === 'SESSION_ENTRY' ? 'SESSIONENTRY' : params.entity_type;
  const entry: AuditLogEntry = { ...owned(), id: `aud-${randomUUID()}`, timestamp, entity_type, entity_id: params.entity_id, action: params.action, details: structuredClone(params.details), previous_value: structuredClone(params.previous_value ?? null), actor_id: actor };
  data.audit_log.push(entry);
  const map = { JOURNEY: 'Journey', NODE: 'Node', SESSION: 'Session', SESSIONENTRY: 'SessionEntry', CORRECTION: 'SessionEntry', CONFLICT: 'Session' } as const;
  data.event_log.push({ ...owned(), id: `evt-${randomUUID()}`, entity_type: map[entity_type], entity_id: params.entity_id, event_type: params.action, actor_id: actor, payload: structuredClone(params.details), previous_value: structuredClone(params.previous_value ?? null), occurred_at: timestamp });
  return entry;
}
export function appendEvent(data: AppData, params: { entity_type: EventLogEntry['entity_type']; entity_id: string; event_type: string; payload: any; previous_value?: any; actor_id?: string }): EventLogEntry {
  const collection = { Journey: data.journeys, Node: data.nodes, Session: data.sessions, SessionEntry: data.entries }[params.entity_type];
  const record = collection.find((item: any) => item.id === params.entity_id);
  const prior = originals.get(data);
  const wasPresent = prior && collections.some(key => ((prior as any)[key] || []).some((item: any) => item.id === params.entity_id));
  if (record && !wasPresent) {
    Object.assign(record, owned());
    if ((record as any).condition) Object.assign((record as any).condition, owned());
    if (params.entity_type === 'SessionEntry') { (record as any).captured_at ??= getCurrentIso(); (record as any).time_provenance ??= 'observed'; }
  }
  appendAuditLog(data, { entity_type: params.entity_type.toUpperCase() as any, entity_id: params.entity_id, action: params.event_type, details: params.payload, previous_value: params.previous_value, actor_id: params.actor_id });
  return data.event_log[data.event_log.length - 1];
}
