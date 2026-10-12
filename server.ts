import { captureSession } from './server/capture';
import { effectiveData } from './src/domain/evidence';
import { validateMutation, latestEntry, effectiveEntry } from './server/commands';
// Clean up tsx relative __dirname shim so ESM plugins like vite-plugin-pwa can resolve properly
if (typeof (globalThis as any).__dirname !== 'undefined' && (globalThis as any).__dirname === '.') {
  delete (globalThis as any).__dirname;
}

import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { runMarkdownExport } from './server/exportService';
import {
  readAppData,
  writeAppData,
  appendEvent,
  appendAuditLog,
  getCurrentIso,
  DEFAULT_USER_ID,
  STORAGE_FILE,
  getDataDir,
} from './server/storage';
import {
  calculateDurationVsEstimate,
  calculateJourneyProgress,
  calculateSessionSummary,
} from './server/queries';
import {
  parseNaturalLanguageLog,
  checkOllamaHealth,
  getOllamaConfig,
  setOllamaConfig,
  answerQueryChat,
} from './server/aiLogger';
import { computeBoardData } from './server/boardService';
import {
  ConflictLog,
  Correction,
  Journey,
  Node,
  Session,
  SessionEntry,
} from './src/types';
import {
  deriveSessionStatusFromEndReason,
  formatConditionValue,
  toCanonicalIso,
  validateCondition,
  validateSessionEndReason,
  validateSessionQuality,
} from './src/utils/formatters';
import {
  signupUser,
  loginUser,
  expressAuthMiddleware,
  AuthenticatedRequest,
  localBoundary,
} from './server/auth';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || '127.0.0.1';
  if (!['127.0.0.1', '::1', 'localhost'].includes(HOST)) throw new Error('Only loopback hosting is supported in Phase 1');
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  app.use(localBoundary);
  app.use(express.json({ limit: '1mb' }));

  // ==========================================
  // AUTHENTICATION ENDPOINTS (Public & Me)
  // ==========================================

  const handleSignup = async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        res.status(400).json({ detail: 'Username and password are required' });
        return;
      }
      const result = await signupUser(username, password);
      res.status(201).json(result);
    } catch (err: any) {
      const msg = err?.message || 'Signup failed';
      const status = msg.includes('already exists') ? 409 : 400;
      res.status(status).json({ detail: msg });
    }
  };

  const handleLogin = async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        res.status(401).json({ detail: 'Invalid username or password' });
        return;
      }
      const result = await loginUser(username, password);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ detail: err?.message || 'Invalid username or password' });
    }
  };

  // Supported on both root and /api prefixes
  app.post('/auth/signup', handleSignup);
  app.post('/api/auth/signup', handleSignup);
  app.post('/auth/login', handleLogin);
  app.post('/api/auth/login', handleLogin);

  // JWT Middleware to protect all subsequent API endpoints
  app.use(expressAuthMiddleware as any);
  app.use(validateMutation);

  const handleMe = (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ detail: 'Could not validate credentials' });
      return;
    }
    res.json({ username: user.username });
  };

  app.get('/auth/me', handleMe);
  app.get('/api/auth/me', handleMe);

  // ==========================================
  // JOURNEYS ENDPOINTS
  // ==========================================

  app.get('/api/journeys', (_req: Request, res: Response) => {
    const data = readAppData();
    res.json(data.journeys);
  });

  app.post('/api/journeys', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const { name, description, visibility } = req.body;

    if (!name || !String(name).trim()) {
      res.status(400).json({ detail: 'Journey name is required' });
      return;
    }

    const journey: Journey = {
      id: `jrn-${randomUUID()}`,
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      creation_snapshot: { name: String(name).trim(), description: description ? String(description).trim() : null, provenance: 'declared_at_capture' },
      owner_id: DEFAULT_USER_ID,
      visibility: visibility === 'SHARED' ? 'SHARED' : 'PRIVATE',
      status: 'ACTIVE',
      created_at: nowIso,
      completed_at: null,
    };

    data.journeys.push(journey);

    appendEvent(data, {
      entity_type: 'Journey',
      entity_id: journey.id,
      event_type: 'JOURNEY_CREATED',
      payload: journey,
    });

    writeAppData(data);
    res.status(201).json(journey);
  });

  app.get('/api/journeys/:id', (req: Request, res: Response) => {
    const data = readAppData();
    const journey = data.journeys.find((j) => j.id === req.params.id);
    if (!journey) {
      res.status(404).json({ detail: 'Journey not found' });
      return;
    }
    res.json(journey);
  });

  app.put('/api/journeys/:id', (req: Request, res: Response) => {
    const data = readAppData();
    const journey = data.journeys.find((j) => j.id === req.params.id);
    if (!journey) {
      res.status(404).json({ detail: 'Journey not found' });
      return;
    }

    const prevValue = { ...journey };
    const { name, description, visibility, status } = req.body;

    if (name !== undefined) journey.name = String(name).trim();
    if (description !== undefined) journey.description = description ? String(description).trim() : null;
    if (visibility !== undefined) journey.visibility = visibility;

    let eventType = 'JOURNEY_UPDATED';

    if (status !== undefined && status !== journey.status) {
      journey.status = status;
      if (status === 'PAUSED') eventType = 'JOURNEY_PAUSED';
      else if (status === 'ACTIVE') eventType = 'JOURNEY_RESUMED';
      else if (status === 'COMPLETE') {
        eventType = 'JOURNEY_COMPLETED';
        journey.completed_at = getCurrentIso();
      }
    }

    appendEvent(data, {
      entity_type: 'Journey',
      entity_id: journey.id,
      event_type: eventType,
      payload: journey,
      previous_value: prevValue,
    });

    writeAppData(data);
    res.json(journey);
  });

  // ==========================================
  // NODES ENDPOINTS (Flexible Hierarchy)
  // ==========================================

  app.get('/api/nodes', (req: Request, res: Response) => {
    const data = readAppData();
    const { journey_id, parent_id } = req.query as Record<string, string | undefined>;
    let results = [...data.nodes];

    if (journey_id) {
      results = results.filter((n) => n.journey_id === journey_id);
    }
    if (parent_id !== undefined) {
      if (parent_id === 'null' || parent_id === '') {
        results = results.filter((n) => !n.parent_id);
      } else {
        results = results.filter((n) => n.parent_id === parent_id);
      }
    }

    res.json(results);
  });

  app.post('/api/nodes', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const {
      journey_id,
      parent_id,
      node_type,
      name,
      description,
      estimated_minutes,
      done_type,
      due_date,
      sequence,
    } = req.body;

    if (!journey_id) {
      res.status(400).json({ detail: 'journey_id is required' });
      return;
    }
    if (!name || !String(name).trim()) {
      res.status(400).json({ detail: 'Node name is required' });
      return;
    }

    const targetJourney = data.journeys.find((j) => j.id === journey_id);
    if (!targetJourney) {
      res.status(404).json({ detail: 'Journey not found' });
      return;
    }

    if (parent_id) {
      const parentNode = data.nodes.find((n) => n.id === parent_id);
      if (!parentNode) {
        res.status(404).json({ detail: 'Parent node not found' });
        return;
      }
    }

    const node: Node = {
      id: `nod-${randomUUID()}`,
      journey_id,
      parent_id: parent_id || null,
      node_type: node_type || 'TASK',
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      status: req.body.status || 'PLANNED',
      sequence: sequence !== undefined ? Number(sequence) : null,
      estimated_minutes:
        estimated_minutes !== undefined && estimated_minutes !== null
          ? Number(estimated_minutes)
          : null,
      done_type: done_type || null,
      due_date: due_date || null,
      created_at: nowIso,
      completed_at: null,
      note: null,
    };

    data.nodes.push(node);

    appendEvent(data, {
      entity_type: 'Node',
      entity_id: node.id,
      event_type: 'NODE_CREATED',
      payload: node,
    });

    if (node.estimated_minutes !== null) {
      appendEvent(data, {
        entity_type: 'Node',
        entity_id: node.id,
        event_type: 'NODE_ESTIMATE_SET',
        payload: { estimated_minutes: node.estimated_minutes },
      });
    }

    writeAppData(data);
    res.status(201).json(node);
  });

  app.get('/api/nodes/:id', (req: Request, res: Response) => {
    const data = readAppData();
    const node = data.nodes.find((n) => n.id === req.params.id);
    if (!node) {
      res.status(404).json({ detail: 'Node not found' });
      return;
    }
    res.json(node);
  });

  app.put('/api/nodes/:id', (req: Request, res: Response) => {
    const data = readAppData();
    const node = data.nodes.find((n) => n.id === req.params.id);
    if (!node) {
      res.status(404).json({ detail: 'Node not found' });
      return;
    }

    const prevValue = structuredClone(node);
    const { name, description, status, node_type, done_type, due_date, parent_id, note } = req.body;

    if (req.body.estimated_minutes !== undefined) {
      const previous = node.estimated_minutes ?? null;
      node.estimated_minutes = req.body.estimated_minutes;
      data.node_estimate_history!.push({ id: `est-${randomUUID()}`, node_id: node.id, previous_estimated_minutes: previous, new_estimated_minutes: node.estimated_minutes, changed_at: getCurrentIso() });
    }
    if (req.body.sequence !== undefined) node.sequence = req.body.sequence;
    if (name !== undefined) node.name = String(name).trim();
    if (description !== undefined) node.description = description ? String(description).trim() : null;
    if (node_type !== undefined) node.node_type = node_type;
    if (done_type !== undefined) node.done_type = done_type;
    if (due_date !== undefined) node.due_date = due_date;
    if (note !== undefined) node.note = note;

    if (parent_id !== undefined && parent_id !== node.parent_id) {
      const oldParent = node.parent_id;
      node.parent_id = parent_id || null;
      appendEvent(data, {
        entity_type: 'Node',
        entity_id: node.id,
        event_type: 'NODE_MOVED',
        payload: { new_parent_id: node.parent_id },
        previous_value: { old_parent_id: oldParent },
      });
    }

    if (status !== undefined && status !== node.status) {
      node.status = status;
      if (status === 'COMPLETE') {
        node.completed_at = getCurrentIso();
      } else {
        node.completed_at = null;
      }
      appendEvent(data, {
        entity_type: 'Node',
        entity_id: node.id,
        event_type: 'NODE_STATUS_CHANGED',
        payload: { status: node.status, completed_at: node.completed_at },
        previous_value: { status: prevValue.status },
      });
    }

    appendEvent(data, {
      entity_type: 'Node',
      entity_id: node.id,
      event_type: 'NODE_UPDATED',
      payload: node,
      previous_value: prevValue,
    });

    writeAppData(data);
    res.json(node);
  });

  // Explicit node closure with reason (Domain Model v1)
  app.post('/api/nodes/:id/close', (req: Request, res: Response) => {
    const data = readAppData();
    const node = data.nodes.find((n) => n.id === req.params.id);
    if (!node) {
      res.status(404).json({ detail: 'Node not found' });
      return;
    }

    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      res.status(400).json({ detail: 'Reason is required to close a node' });
      return;
    }

    const prevStatus = node.status;
    node.status = 'COMPLETE';
    node.completed_at = getCurrentIso();
    node.note = reason;
    data.node_closures!.push({ id: `cls-${randomUUID()}`, node_id: node.id, reason, previous_status: prevStatus, closed_at: node.completed_at });

    appendEvent(data, {
      entity_type: 'Node',
      entity_id: node.id,
      event_type: 'NODE_CLOSED',
      payload: { reason, completed_at: node.completed_at },
      previous_value: { status: prevStatus },
    });

    writeAppData(data);
    res.json(node);
  });

  // Set or Revise Node Estimate
  app.post('/api/nodes/:id/estimate', (req: Request, res: Response) => {
    const data = readAppData();
    const node = data.nodes.find((n) => n.id === req.params.id);
    if (!node) {
      res.status(404).json({ detail: 'Node not found' });
      return;
    }

    const { estimated_minutes } = req.body;
    const prevEstimate = node.estimated_minutes;
    const newEst = estimated_minutes !== null ? Number(estimated_minutes) : null;
    node.estimated_minutes = newEst;
    data.node_estimate_history!.push({ id: `est-${randomUUID()}`, node_id: node.id, previous_estimated_minutes: prevEstimate ?? null, new_estimated_minutes: newEst, changed_at: getCurrentIso() });

    const eventType = prevEstimate === null ? 'NODE_ESTIMATE_SET' : 'NODE_ESTIMATE_REVISED';

    appendEvent(data, {
      entity_type: 'Node',
      entity_id: node.id,
      event_type: eventType,
      payload: { estimated_minutes: newEst },
      previous_value: { estimated_minutes: prevEstimate },
    });

    writeAppData(data);
    res.json(node);
  });

  // ==========================================
  // SESSIONS ENDPOINTS (Intention Locking & Reality)
  // ==========================================

  app.get('/api/sessions', (req: Request, res: Response) => {
    const raw = readAppData();
    const data = req.query.view === 'effective' ? effectiveData(raw) : raw;
    const { journey_id, status } = req.query as Record<string, string | undefined>;
    let results = [...data.sessions];

    if (journey_id) {
      results = results.filter((s) => s.journey_id === journey_id);
    }
    if (status) {
      results = results.filter((s) => s.status === status);
    }

    results.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    res.json(results);
  });

  app.post('/api/sessions', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const {
      journey_id,
      intention,
      label,
      predecessor_session_id,
      initial_node_id,
      node_id,
      condition,
      started_at,
    } = req.body;

    if (!journey_id) {
      res.status(400).json({ detail: 'journey_id is required' });
      return;
    }
    if (!intention || !String(intention).trim()) {
      res.status(400).json({ detail: 'Initial intention is required to start a session' });
      return;
    }

    const condCheck = validateCondition(condition, {
      energy: 'HIGH',
      focus: 'DEEP',
      location: 'HOME',
      environment: 'QUIET',
    });
    if (condCheck.valid === false) {
      res.status(400).json({ detail: condCheck.error });
      return;
    }

    let startIso = nowIso;
    if (started_at) {
      try {
        startIso = toCanonicalIso(started_at);
      } catch (err: any) {
        res.status(400).json({ detail: err.message });
        return;
      }
    }

    const resolvedInitialNodeId = initial_node_id || node_id || null;

    // Check for active overlapping session in this journey
    const existingActive = data.sessions.find(
      (s) => s.journey_id === journey_id && s.status === 'ACTIVE'
    );

    const sessionId = `ses-${randomUUID()}`;

    const session: Session = {
      id: sessionId,
      journey_id,
      node_id: resolvedInitialNodeId,
      label: label ? String(label).trim() : null,
      intention: String(intention).trim(), // IMMUTABLE
      intention_provenance: started_at ? 'reconstructed' : 'declared_at_capture',
      started_at: startIso,
      ended_at: null,
      status: 'ACTIVE',
      end_reason: null,
      predecessor_session_id: predecessor_session_id || null,
      successor_session_id: null,
      reflection: null,
      quality: null,
      note: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    data.sessions.push(session);

    // Event 1: SESSION_STARTED
    appendEvent(data, {
      entity_type: 'Session',
      entity_id: session.id,
      event_type: 'SESSION_STARTED',
      payload: session,
    });

    // Event 2: SESSION_INTENTION_LOCKED
    appendEvent(data, {
      entity_type: 'Session',
      entity_id: session.id,
      event_type: 'SESSION_INTENTION_LOCKED',
      payload: { intention: session.intention },
    });

    // Record initial SessionEntry capturing starting Condition and active Node if provided
    if (resolvedInitialNodeId) {
      const entryId = `ent-${randomUUID()}`;
      const entry: SessionEntry = {
        id: entryId,
        session_id: session.id,
        node_id: resolvedInitialNodeId,
        entry_type: 'TASK_STARTED',
        logged_at: startIso,
        captured_at: nowIso, time_provenance: started_at ? 'reported' : 'observed',
        note: null,
        condition: condCheck.value,
        discovery_ref: null,
      };
      data.entries.push(entry);
      appendEvent(data, {
        entity_type: 'SessionEntry',
        entity_id: entry.id,
        event_type: 'TASK_STARTED',
        payload: entry,
      });
    } else if (condition) {
      const entryId = `ent-${randomUUID()}`;
      const entry: SessionEntry = {
        id: entryId,
        session_id: session.id,
        node_id: null,
        entry_type: 'NOTE',
        logged_at: startIso,
        captured_at: nowIso, time_provenance: started_at ? 'reported' : 'observed',
        note: 'Initial session condition recorded',
        condition: condCheck.value,
        discovery_ref: null,
      };
      data.entries.push(entry);
      appendEvent(data, {
        entity_type: 'SessionEntry',
        entity_id: entry.id,
        event_type: 'ENTRY_LOGGED',
        payload: entry,
      });
    }

    // Record conflict if overlapping session
    let conflictInfo: ConflictLog | null = null;
    if (existingActive) {
      conflictInfo = {
        id: `cnf-${randomUUID()}`,
        session_id: sessionId,
        conflict_type: 'OVERLAPPING_SESSION',
        description: `Another session (${existingActive.id}) was already active in this Journey when session ${sessionId} started.`,
        resolved: false,
        detected_at: nowIso,
      };
      data.conflicts.push(conflictInfo);
      appendEvent(data, {
        entity_type: 'Session',
        entity_id: sessionId,
        event_type: 'CONFLICT_DETECTED',
        payload: conflictInfo,
      });
    }

    writeAppData(data);
    res.status(201).json({ session, conflict: conflictInfo });
  });

  app.get('/api/sessions/:id', (req: Request, res: Response) => {
    const raw = readAppData();
    const data = req.query.view === 'effective' ? effectiveData(raw) : raw;
    const session = data.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }
    res.json(session);
  });

  app.get('/api/sessions/:id/evidence',(req:Request,res:Response)=>{
    const raw=readAppData(), original=raw.sessions.find(s=>s.id===req.params.id);
    if(!original){res.status(404).json({detail:'Session not found'});return;}
    const effective=effectiveData(raw), entries=raw.entries.filter(e=>e.session_id===original.id);
    res.json({original_session:original,effective_session:effective.sessions.find(s=>s.id===original.id),original_entries:entries,
      reports:(raw.capture_reports||[]).filter(r=>r.session_id===original.id),revisions:(raw.intention_revisions||[]).filter(r=>r.session_id===original.id),
      corrections:raw.corrections.filter(c=>entries.some(e=>e.id===c.entry_id)),amendments:(raw.session_amendments||[]).filter(a=>a.session_id===original.id),conflicts:raw.conflicts.filter(c=>c.session_id===original.id)});
  });

  app.get('/api/sessions/:id/summary', (req: Request, res: Response) => {
    const data = effectiveData(readAppData());
    const session = data.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }

    const sessionEntries = data.entries.filter((e) => e.session_id === session.id);
    const summary = calculateSessionSummary(session, sessionEntries);
    res.json(summary);
  });

  // Complete / End Session
  app.post('/api/sessions/:id/end', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const session = data.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }

    const { reflection, quality, status, note, end_reason, successor_session_id } = req.body;

    const endReasonCheck = validateSessionEndReason(end_reason, 'NATURAL_COMPLETION');
    if (endReasonCheck.valid === false) {
      res.status(400).json({ detail: endReasonCheck.error });
      return;
    }

    const qualityCheck = validateSessionQuality(quality);
    if (qualityCheck.valid === false) {
      res.status(400).json({ detail: qualityCheck.error });
      return;
    }

    const derivedStatus = deriveSessionStatusFromEndReason(endReasonCheck.value, status);

    const prevValue = { ...session };
    session.updated_at = nowIso;
    session.ended_at = req.body.ended_at ? toCanonicalIso(req.body.ended_at) : nowIso;
    session.status = derivedStatus;
    session.end_reason = endReasonCheck.value;
    if (successor_session_id !== undefined) session.successor_session_id = successor_session_id || null;
    session.reflection = reflection ? String(reflection).trim() : null;
    session.quality = qualityCheck.value;
    if (note !== undefined) session.note = note ? String(note).trim() : null;
    if (!session.ended_at) session.updated_at = nowIso;

    let eventType = 'SESSION_COMPLETED';
    if (derivedStatus === 'INCOMPLETE') eventType = 'SESSION_MARKED_INCOMPLETE';
    else if (derivedStatus === 'PAUSED') eventType = 'SESSION_PAUSED';

    appendEvent(data, {
      entity_type: 'Session',
      entity_id: session.id,
      event_type: eventType,
      payload: session,
      previous_value: prevValue,
    });

    if (session.reflection || session.quality) {
      appendEvent(data, {
        entity_type: 'Session',
        entity_id: session.id,
        event_type: 'SESSION_REFLECTION_ADDED',
        payload: {
          reflection: session.reflection,
          quality: session.quality,
        },
      });
    }

    writeAppData(data);
    res.json(session);
  });

  // Update Active Session Condition (Focus, Energy, Location, Environment remain mutable during active session)
  app.post('/api/sessions/:id/condition', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const session = data.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }

    const sessionEntries = data.entries.filter((e) => e.session_id === session.id);
    const lastEntry = latestEntry(data, session.id, req.body.logged_at || nowIso);
    const fallbackCond = lastEntry?.condition || {
      energy: 'MEDIUM',
      focus: 'NORMAL',
      location: 'HOME',
      environment: 'QUIET',
    };

    const condCheck = validateCondition(req.body.condition || req.body, fallbackCond);
    if (condCheck.valid === false) {
      res.status(400).json({ detail: condCheck.error });
      return;
    }

    const newCond = condCheck.value;
    const activeNodeId =
      req.body.node_id !== undefined
        ? req.body.node_id
        : lastEntry?.node_id ?? session.node_id ?? null;

    const noteText =
      req.body.note ||
      `Condition updated: Energy ${formatConditionValue(newCond.energy)}, Focus ${formatConditionValue(newCond.focus)}, Location ${formatConditionValue(newCond.location)}, Environment ${formatConditionValue(newCond.environment)}`;

    const entry: SessionEntry = {
      id: `ent-${randomUUID()}`,
      session_id: session.id,
      node_id: activeNodeId,
      entry_type: 'CONDITION_CHANGED',
      logged_at: req.body.logged_at || nowIso,
      captured_at: nowIso, time_provenance: req.body.logged_at ? 'reported' : 'observed',
      note: noteText,
      condition: newCond,
      discovery_ref: null,
    };

    data.entries.push(entry);

    appendEvent(data, {
      entity_type: 'SessionEntry',
      entity_id: entry.id,
      event_type: 'CONDITION_CHANGED',
      payload: newCond,
      previous_value: lastEntry ? lastEntry.condition : null,
    });

    if (!session.ended_at) session.updated_at = nowIso;
    writeAppData(data);

    res.status(201).json({ session, entry, condition: newCond });
  });

  // Decision 2 — Cross-Journey Session Scope
  // A Session belongs to exactly one Journey. Crossing into another Journey creates a new linked Session, not a cross-Journey Session.
  app.post('/api/sessions/:id/switch-journey', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const sourceSession = data.sessions.find((s) => s.id === req.params.id);
    if (!sourceSession) {
      res.status(404).json({ detail: 'Source session not found' });
      return;
    }

    const { target_journey_id, target_node_id, new_intention, switch_reason, condition } = req.body;

    if (!target_journey_id) {
      res.status(400).json({ detail: 'target_journey_id is required' });
      return;
    }
    const targetJourney = data.journeys.find((j) => j.id === target_journey_id);
    if (!targetJourney) {
      res.status(404).json({ detail: 'Target journey not found' });
      return;
    }

    if (!new_intention || !String(new_intention).trim()) {
      res.status(400).json({ detail: 'New intention is required for target session' });
      return;
    }

    const sourceJourney = data.journeys.find((j) => j.id === sourceSession.journey_id);
    const sourceJourneyName = sourceJourney ? sourceJourney.name : sourceSession.journey_id;
    const targetJourneyName = targetJourney.name;

    // Sticky condition from source session
    const sourceEntries = data.entries.filter((e) => e.session_id === sourceSession.id);
    const lastSourceEntry = latestEntry(data, sourceSession.id, nowIso);
    const defaultCondition = {
      energy: 'MEDIUM' as const,
      focus: 'NORMAL' as const,
      location: 'HOME' as const,
      environment: 'QUIET' as const,
    };
    const effectiveCondition = condition || (lastSourceEntry ? lastSourceEntry.condition : defaultCondition);

    // 1. Record CONTEXT_SWITCH_REQUEST in source session
    const switchEntry: SessionEntry = {
      id: `ent-${randomUUID()}`,
      session_id: sourceSession.id,
      node_id: null,
      entry_type: 'CONTEXT_SWITCH_REQUEST',
      logged_at: nowIso,
      note: switch_reason
        ? `Transition requested to Journey "${targetJourneyName}": ${switch_reason}`
        : `Transition requested to Journey "${targetJourneyName}"`,
      condition: effectiveCondition,
      discovery_ref: null,
    };
    data.entries.push(switchEntry);

    appendEvent(data, {
      entity_type: 'SessionEntry',
      entity_id: switchEntry.id,
      event_type: 'CONTEXT_SWITCH_REQUESTED',
      payload: {
        from_session_id: sourceSession.id,
        from_journey_id: sourceSession.journey_id,
        to_journey_id: target_journey_id,
        target_node_id: target_node_id || null,
        reason: switch_reason || null,
      },
    });

    // 2. End Session A with reason = JOURNEY_SWITCH
    const newSessionId = `ses-${randomUUID()}`;
    const prevSourceVal = { ...sourceSession };
    sourceSession.ended_at = nowIso;
    sourceSession.status = 'COMPLETE';
    sourceSession.end_reason = 'JOURNEY_SWITCH';
    sourceSession.successor_session_id = newSessionId;
    sourceSession.note = sourceSession.note
      ? `${sourceSession.note} | Transitioned to Journey "${targetJourneyName}" (${newSessionId})`
      : `Transitioned to Journey "${targetJourneyName}" (${newSessionId})`;
    sourceSession.updated_at = nowIso;

    appendEvent(data, {
      entity_type: 'Session',
      entity_id: sourceSession.id,
      event_type: 'SESSION_COMPLETED',
      payload: {
        session: sourceSession,
        reason: 'JOURNEY_SWITCH',
        successor_session_id: newSessionId,
      },
      previous_value: prevSourceVal,
    });

    // 3. Create Session B in target journey
    const newSession: Session = {
      id: newSessionId,
      journey_id: target_journey_id,
      label: `Continued from ${sourceJourneyName}`,
      intention: String(new_intention).trim(),
      intention_provenance: 'declared_at_capture',
      started_at: nowIso,
      ended_at: null,
      status: 'ACTIVE',
      end_reason: null,
      predecessor_session_id: sourceSession.id,
      successor_session_id: null,
      reflection: null,
      quality: null,
      note: `Transitioned from Session ${sourceSession.id} in Journey "${sourceJourneyName}"`,
      created_at: nowIso,
      updated_at: nowIso,
    };
    data.sessions.push(newSession);

    appendEvent(data, {
      entity_type: 'Session',
      entity_id: newSession.id,
      event_type: 'SESSION_STARTED',
      payload: newSession,
    });

    appendEvent(data, {
      entity_type: 'Session',
      entity_id: newSession.id,
      event_type: 'SESSION_INTENTION_LOCKED',
      payload: { intention: newSession.intention },
    });

    if (!target_node_id) {
      const carry: SessionEntry = { id: `ent-${randomUUID()}`, session_id: newSession.id, node_id: null, entry_type: 'CONDITION_CHANGED', logged_at: nowIso, condition: structuredClone(effectiveCondition), note: 'Condition carried from predecessor Session' };
      data.entries.push(carry);
      appendEvent(data, { entity_type: 'SessionEntry', entity_id: carry.id, event_type: 'ENTRY_LOGGED', payload: carry });
    }
    // 4. Preserve predecessor/successor link
    appendEvent(data, {
      entity_type: 'Session',
      entity_id: newSession.id,
      event_type: 'SESSION_TRANSITION_LINKED',
      payload: {
        predecessor_session_id: sourceSession.id,
        successor_session_id: newSession.id,
        from_journey_id: sourceSession.journey_id,
        to_journey_id: target_journey_id,
      },
    });

    // If a target node was provided, log initial TASK_STARTED entry in new session
    let initialTargetEntry: SessionEntry | null = null;
    if (target_node_id) {
      const targetNode = data.nodes.find((n) => n.id === target_node_id && n.journey_id === target_journey_id);
      if (targetNode) {
        initialTargetEntry = {
          id: `ent-${randomUUID()}`,
          session_id: newSession.id,
          node_id: target_node_id,
          entry_type: 'TASK_STARTED',
          logged_at: nowIso,
          note: `Auto-started upon journey transition from session ${sourceSession.id}`,
          condition: effectiveCondition,
          discovery_ref: null,
        };
        data.entries.push(initialTargetEntry);

        appendEvent(data, {
          entity_type: 'SessionEntry',
          entity_id: initialTargetEntry.id,
          event_type: 'ENTRY_LOGGED',
          payload: initialTargetEntry,
        });

        if (targetNode.status === 'PLANNED') {
          targetNode.status = 'ACTIVE';
          appendEvent(data, {
            entity_type: 'Node',
            entity_id: targetNode.id,
            event_type: 'NODE_STATUS_CHANGED',
            payload: { status: 'ACTIVE' },
            previous_value: { status: 'PLANNED' },
          });
        }
      }
    }

    writeAppData(data);
    res.status(201).json({
      previous_session: sourceSession,
      new_session: newSession,
      switch_entry: switchEntry,
      initial_entry: initialTargetEntry,
    });
  });

  // Explicit Intention Revision (Rule 2: Never overwrite original intention)
  app.post('/api/sessions/:id/revise-intention', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const session = data.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }

    const { new_intention, reason, condition } = req.body;
    if (!new_intention || !String(new_intention).trim()) {
      res.status(400).json({ detail: 'New intention is required' });
      return;
    }

    const cleanNewIntention = String(new_intention).trim();

    // Log SessionEntry for intention revision
    const entry: SessionEntry = {
      id: `ent-${randomUUID()}`,
      session_id: session.id,
      node_id: null,
      entry_type: 'INTENTION_REVISED',
      logged_at: req.body.logged_at || nowIso,
      captured_at: nowIso, time_provenance: req.body.logged_at ? 'reported' : 'observed',
      note: reason ? `${cleanNewIntention} (Reason: ${reason})` : cleanNewIntention,
      condition: condition || {
        energy: 'MEDIUM',
        focus: 'NORMAL',
        location: 'HOME',
        environment: 'QUIET',
      },
    };

    data.entries.push(entry);

    if (session.ended_at) appendEvent(data, { entity_type: 'Session', entity_id: session.id, event_type: 'RETROSPECTIVE_REVISION_ADDED', payload: { entry_id: entry.id, reason: req.body.amendment_reason, captured_at: nowIso } });
    const revisions = data.intention_revisions!;
    const prior = revisions.filter(r => r.session_id === session.id).at(-1)?.new_intention || session.intention;
    revisions.push({ id: `rev-${randomUUID()}`, session_id: session.id, entry_id: entry.id, previous_intention: prior, new_intention: cleanNewIntention, reason: reason || null, revised_at: entry.logged_at });
    // Append event: SESSION_INTENTION_REVISED
    appendEvent(data, {
      entity_type: 'Session',
      entity_id: session.id,
      event_type: 'SESSION_INTENTION_REVISED',
      payload: {
        original_intention: session.intention,
        revised_intention: cleanNewIntention,
        reason: reason || null,
        entry_id: entry.id,
      },
      previous_value: { intention: prior },
    });

    if (!session.ended_at) session.updated_at = nowIso;
    writeAppData(data);

    res.json({ session, entry });
  });

  // ==========================================
  // SESSION ENTRIES (The moment of the tap)
  // ==========================================

  app.get('/api/entries', (req: Request, res: Response) => {
    const raw = readAppData();
    const data = req.query.view === 'effective' ? effectiveData(raw) : raw;
    const entries = (data.session_entries || data.entries || []).sort(
      (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
    );
    res.json(entries);
  });

  app.get('/api/sessions/:session_id/entries', (req: Request, res: Response) => {
    const raw = readAppData();
    const data = req.query.view === 'effective' ? effectiveData(raw) : raw;
    const entries = data.entries
      .filter((e) => e.session_id === req.params.session_id)
      .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
    res.json(entries);
  });

  app.post('/api/sessions/:session_id/entries', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const sessionId = req.params.session_id;

    const session = data.sessions.find((s) => s.id === sessionId);
    if (!session) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }

    const { entry_type, node_id, note, condition, discovery_node } = req.body;

    if (!entry_type) {
      res.status(400).json({ detail: 'entry_type is required' });
      return;
    }

    let createdDiscoveryNode: Node | null = null;
    let discoveryRef: string | null = null;

    // RULE 4: Discovery creates lineage
    if (entry_type === 'DISCOVERY') {
      if (!discovery_node || !discovery_node.name) {
        res.status(400).json({ detail: 'discovery_node with name is required for DISCOVERY entry' });
        return;
      }

      const newNodeId = `nod-${randomUUID()}`;
      createdDiscoveryNode = {
        id: newNodeId,
        journey_id: session.journey_id,
        parent_id: discovery_node.parent_id || node_id || null,
        node_type: discovery_node.node_type || 'TASK',
        name: String(discovery_node.name).trim(),
        description: discovery_node.description
          ? String(discovery_node.description).trim()
          : `Discovered in session ${session.id} while working on ${node_id || 'initial work'}`,
        status: 'PLANNED',
        sequence: null,
        estimated_minutes: discovery_node.estimated_minutes ?? null,
        done_type: discovery_node.done_type || null,
        due_date: null,
        created_at: nowIso,
        completed_at: null,
        note: null,
      };

      data.nodes.push(createdDiscoveryNode);
      discoveryRef = newNodeId;

      appendEvent(data, {
        entity_type: 'Node',
        entity_id: createdDiscoveryNode.id,
        event_type: 'NODE_CREATED',
        payload: createdDiscoveryNode,
      });

      appendEvent(data, {
        entity_type: 'Node',
        entity_id: createdDiscoveryNode.id,
        event_type: 'DISCOVERY_CREATED',
        payload: {
          node_id: createdDiscoveryNode.id,
          session_id: sessionId,
          parent_id: createdDiscoveryNode.parent_id,
        },
      });
    }

    const defaultCondition = {
      energy: 'MEDIUM' as const,
      focus: 'NORMAL' as const,
      location: 'HOME' as const,
      environment: 'QUIET' as const,
    };

    const sessionEntries = data.entries.filter((e) => e.session_id === sessionId);
    const lastEntry = latestEntry(data, session.id, req.body.logged_at || nowIso);

    // Sticky condition: carry forward from previous entry unless modified, and validate
    const condCheck = validateCondition(
      condition,
      lastEntry ? lastEntry.condition : defaultCondition
    );
    if (condCheck.valid === false) {
      res.status(400).json({ detail: condCheck.error });
      return;
    }
    const effectiveCondition = condCheck.value;

    const entryId = `ent-${randomUUID()}`;
    const entry: SessionEntry = {
      id: entryId,
      session_id: sessionId,
      node_id: node_id || null,
      entry_type,
      logged_at: req.body.logged_at || nowIso,
      captured_at: nowIso, time_provenance: req.body.logged_at ? 'reported' : 'observed',
      note: note ? String(note).trim() : null,
      condition: effectiveCondition,
      discovery_ref: discoveryRef,
    };

    data.entries.push(entry);

    appendEvent(data, {
      entity_type: 'SessionEntry',
      entity_id: entry.id,
      event_type: 'ENTRY_LOGGED',
      payload: entry,
    });

    if (session.ended_at) appendEvent(data, { entity_type: 'SessionEntry', entity_id: entry.id, event_type: 'RETROSPECTIVE_ENTRY_ADDED', payload: { entry_id: entry.id, reason: req.body.amendment_reason, captured_at: nowIso } });
    // Check if condition changed from last entry
    if (
      lastEntry &&
      (lastEntry.condition.energy !== effectiveCondition.energy ||
        lastEntry.condition.focus !== effectiveCondition.focus ||
        lastEntry.condition.location !== effectiveCondition.location ||
        lastEntry.condition.environment !== effectiveCondition.environment)
    ) {
      appendEvent(data, {
        entity_type: 'SessionEntry',
        entity_id: entry.id,
        event_type: 'CONDITION_CHANGED',
        payload: effectiveCondition,
        previous_value: lastEntry.condition,
      });
    }

    // Update node status if applicable
    if (node_id) {
      const targetNode = data.nodes.find((n) => n.id === node_id);
      if (targetNode) {
        if (entry_type === 'TASK_STARTED' && targetNode.status === 'PLANNED') {
          targetNode.status = 'ACTIVE';
          appendEvent(data, {
            entity_type: 'Node',
            entity_id: targetNode.id,
            event_type: 'NODE_STATUS_CHANGED',
            payload: { status: 'ACTIVE' },
            previous_value: { status: 'PLANNED' },
          });
        } else if (entry_type === 'TASK_COMPLETED' && targetNode.status !== 'COMPLETE') {
          const previousStatus = targetNode.status;
          targetNode.status = 'COMPLETE';
          targetNode.completed_at = nowIso;
          appendEvent(data, {
            entity_type: 'Node',
            entity_id: targetNode.id,
            event_type: 'NODE_STATUS_CHANGED',
            payload: { status: 'COMPLETE', completed_at: nowIso },
            previous_value: { status: previousStatus },
          });
        } else if (entry_type === 'TASK_PAUSED' && targetNode.status === 'ACTIVE') {
          targetNode.status = 'PAUSED';
          appendEvent(data, {
            entity_type: 'Node',
            entity_id: targetNode.id,
            event_type: 'NODE_STATUS_CHANGED',
            payload: { status: 'PAUSED' },
            previous_value: { status: 'ACTIVE' },
          });
        }
      }
    }

    if (!session.ended_at) session.updated_at = nowIso;
    writeAppData(data);

    res.status(201).json({
      entry,
      discovery_node: createdDiscoveryNode,
    });
  });

  // ==========================================
  // CORRECTIONS (Historical Integrity)
  // ==========================================

  app.post('/api/sessions/:id/amend', (req: Request, res: Response) => {
    const data = readAppData();
    const session = data.sessions.find(s => s.id === req.params.id)!;
    const { field, value, reason } = req.body;
    const prior = data.session_amendments!.filter(a => a.session_id === session.id && a.field === field).at(-1)?.value ?? (session as any)[field] ?? null;
    const amendment = { id: `amd-${randomUUID()}`, session_id: session.id, field, value, reason, original_value: (session as any)[field] ?? null, previous_value: prior, actor_id: DEFAULT_USER_ID, created_at: getCurrentIso() };
    data.session_amendments!.push(amendment);
    appendEvent(data, { entity_type: 'Session', entity_id: session.id, event_type: 'SESSION_AMENDED', payload: amendment, previous_value: { [field]: prior } });
    writeAppData(data); res.status(201).json(amendment);
  });

  app.get('/api/corrections', (req: Request, res: Response) => {
    const data = readAppData();
    const entryId = req.query.entry_id as string | undefined;
    if (entryId) {
      res.json(data.corrections.filter((c) => c.entry_id === entryId));
      return;
    }
    res.json(data.corrections);
  });

  app.post('/api/entries/:entry_id/corrections', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const entryId = req.params.entry_id;

    const entry = data.entries.find((e) => e.id === entryId);
    if (!entry) {
      res.status(404).json({ detail: 'Entry not found' });
      return;
    }

    const { field, corrected_value, reason } = req.body;
    if (!field || corrected_value === undefined) {
      res.status(400).json({ detail: 'field and corrected_value are required' });
      return;
    }

    const effective = effectiveEntry(data, entry);
    const previousEffective = String((effective as any)[field] ?? '');
    let originalVal = '';
    if (field === 'logged_at') originalVal = entry.logged_at;
    else if (field === 'note') originalVal = entry.note || '';
    else if (field === 'entry_type') originalVal = entry.entry_type;
    else if (field === 'node_id') originalVal = entry.node_id || '';

    const correction: Correction = {
      id: `cor-${randomUUID()}`,
      entry_id: entryId,
      field,
      original_value: String(originalVal),
      corrected_value: String(corrected_value ?? ''),
      previous_value: previousEffective,
      actor_id: DEFAULT_USER_ID,
      sequence: Math.max(0, ...data.corrections.map(c => c.sequence || 0)) + 1,
      reason: reason ? String(reason).trim() : null,
      created_at: nowIso,
    };

    data.corrections.push(correction);

    appendEvent(data, {
      entity_type: 'SessionEntry',
      entity_id: entryId,
      event_type: 'ENTRY_CORRECTED',
      payload: correction,
      previous_value: { [field]: previousEffective },
    });

    writeAppData(data);
    res.status(201).json(correction);
  });

  // ==========================================
  // CONFLICTS
  // ==========================================

  app.get('/api/conflicts', (req: Request, res: Response) => {
    const data = readAppData();
    const resolved = req.query.resolved as string | undefined;
    let list = [...data.conflicts];
    if (resolved !== undefined) {
      const isResolved = resolved === 'true';
      list = list.filter((c) => c.resolved === isResolved);
    }
    list.sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());
    res.json(list);
  });

  app.put('/api/conflicts/:id/resolve', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const conflict = data.conflicts.find((c) => c.id === req.params.id);
    if (!conflict) {
      res.status(404).json({ detail: 'Conflict not found' });
      return;
    }

    const { resolution } = req.body;
    if (!resolution || !String(resolution).trim()) {
      res.status(400).json({ detail: 'Resolution is required' });
      return;
    }

    conflict.resolved = true;
    conflict.resolution = String(resolution).trim();
    conflict.resolved_at = nowIso;

    appendEvent(data, {
      entity_type: 'Session',
      entity_id: conflict.session_id,
      event_type: 'CONFLICT_RESOLVED',
      payload: conflict,
    });

    writeAppData(data);
    res.json(conflict);
  });

  // ==========================================
  // PRIORITY QUERIES (Prototype Spec v1)
  // ==========================================

  // Query 1: Actual duration vs estimate
  app.get('/api/queries/duration-vs-estimate', (req: Request, res: Response) => {
    const data = effectiveData(readAppData());
    const journeyId = req.query.journey_id as string | undefined;
    const nodeId = req.query.node_id as string | undefined;
    const results = calculateDurationVsEstimate(data, journeyId, nodeId);
    res.json(results);
  });

  // Query 2: Journey progress
  app.get('/api/queries/journey-progress', (req: Request, res: Response) => {
    const data = readAppData();
    const journeyId = req.query.journey_id as string;
    if (!journeyId) {
      res.status(400).json({ detail: 'journey_id query parameter is required' });
      return;
    }
    const result = calculateJourneyProgress(data, journeyId);
    res.json(result);
  });

  app.get('/api/queries/journey-progress/:journey_id', (req: Request, res: Response) => {
    const data = effectiveData(readAppData());
    const journeyId = req.params.journey_id;
    const result = calculateJourneyProgress(data, journeyId);
    res.json(result);
  });

  // ==========================================
  // DAILY LOGGER MVP & BOARD ENDPOINTS
  // ==========================================

  app.get(['/api/board', '/api/board/:journey_id'], (req: Request, res: Response) => {
    const data = readAppData();
    const journeyId = req.params.journey_id;
    const board = computeBoardData(data, journeyId);
    res.json(board);
  });

  // AI natural language work logger parser
  app.post('/api/ai/parse-log', async (req: Request, res: Response) => {
    const { message, journey_id } = req.body;
    if (!message || !String(message).trim()) {
      res.status(400).json({ detail: 'Log message is required' });
      return;
    }

    const data = readAppData();
    try {
      const proposal = await parseNaturalLanguageLog(
        String(message).trim(),
        data.journeys,
        data.nodes,
        journey_id
      );
      res.json(proposal);
    } catch (err: any) {
      console.error('[AI Parse] Error parsing log:', err);
      res.status(500).json({ detail: err.message || 'Failed to parse log' });
    }
  });

  // Check Ollama AI layer connection status
  app.get('/api/ai/status', async (_req: Request, res: Response) => {
    try {
      const status = await checkOllamaHealth();
      res.json(status);
    } catch (err: any) {
      res.json({
        status: 'offline',
        url: 'http://localhost:11434',
        model: '',
        available_models: [],
        provider: 'manual',
      });
    }
  });

  // Update Ollama configuration
  app.post('/api/ai/settings', (req: Request, res: Response) => {
    const { url, model } = req.body;
    let config;
    try { config = setOllamaConfig(url, model); } catch (error: any) { res.status(400).json({ detail: error.message }); return; }
    res.json(config);
  });

  // Query Chat: Natural language analytical answers strictly reading JSON data
  app.post('/api/ai/query-chat', async (req: Request, res: Response) => {
    const { question } = req.body;
    if (!question || !String(question).trim()) {
      res.status(400).json({ detail: 'Question is required' });
      return;
    }

    const data = effectiveData(readAppData());
    try {
      const entries = data.session_entries || data.entries || [];
      const response = await answerQueryChat(
        String(question).trim(),
        data.journeys,
        data.nodes,
        data.sessions,
        entries
      );
      res.json(response);
    } catch (err: any) {
      console.error('[Query Chat] Error answering query:', err);
      res.status(500).json({
        answer: 'Failed to answer query. Please try again.',
        provider: 'manual',
        sessions_analyzed: 0,
      });
    }
  });

  // One-tap quick log commit
  app.post('/api/sessions/quick-log', captureSession);

  // ==========================================
  // EVENT LOG & EXPORT
  // ==========================================

  app.get('/api/events', (_req: Request, res: Response) => {
    const data = readAppData();
    const events = [...data.event_log].sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    );
    res.json(events);
  });

  app.get(['/api/export','/api/export/json'], (_req:Request,res:Response)=>{res.attachment('pist_data.json').json(readAppData());});
  app.post('/api/export/markdown', (_req:Request,res:Response)=>{
    const result=runMarkdownExport();
    res.json({success:true,zip_url:'/api/export/download?id='+result.exportId});
  });
  app.get('/api/export/download', (req:Request,res:Response)=>{
    const id=String(req.query.id||'');
    if(!/^[0-9a-f-]{36}$/.test(id)){res.status(400).json({detail:'A generated snapshot ID is required'});return;}
    const zip=path.join(getDataDir(),'exports',id,'human_drift_export.zip');
    if(!fs.existsSync(zip)){res.status(404).json({detail:'Snapshot not found'});return;}
    res.download(zip,'human_drift_markdown_export.zip');
  });

  app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
    const data = readAppData();
    res.json({
      status: 'ok',
      journeys_count: data.journeys.length,
      nodes_count: data.nodes.length,
      sessions_count: data.sessions.length,
      entries_count: (data.session_entries || data.entries || []).length,
      events_count: (data.event_log || []).length,
      audit_count: (data.audit_log || []).length,
    });
  });

  app.use((error: any, _req: Request, res: Response, _next: any) => {
    res.status(error.status || 500).json({ detail: error.status ? error.message : 'Local operation failed; no successful save was reported' });
  });

  // ==========================================
  // VITE DEV MIDDLEWARE / SPA STATIC FALLBACK
  // ==========================================

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Echo of Will running on http://${HOST}:${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
}

startServer().catch((error) => {
  console.error('Startup failed:', error);
  process.exitCode = 1;
});
