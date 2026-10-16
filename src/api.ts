import { cachedIdentity, rememberIdentity, enqueueLog, flushQueuedLogs, getQueuedLogs } from './utils/offlineQueue';
import {
  BoardData,
  ConflictLog,
  Correction,
  DurationVsEstimateResult,
  EventLogEntry,
  Journey,
  JourneyProgressResult,
  Node,
  ParsedLogProposal,
  QuickLogPayload,
  QuickLogResponse,
  Session,
  SessionEntry,
  SessionSummaryResult,
} from './types';

const API_BASE = '/api';

// --- Auth Token Management ---
export function getStoredToken(): string | null {
  return localStorage.getItem('token') || localStorage.getItem('hd_auth_token');
}

export function setStoredToken(token: string): void {
  localStorage.setItem('token', token);
  localStorage.setItem('hd_auth_token', token);
}

export function removeStoredToken(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('hd_auth_token');
}

// Authenticated fetch wrapper
async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const identity=cachedIdentity();
  const cacheKey=identity?'eow-cache:'+encodeURIComponent(identity.username)+':'+url:null;
  let res:Response;
  try { res=await fetch(url,{...init,headers,signal:init?.signal||AbortSignal.timeout(url.includes('/ai/parse-log')?310000:15000)}); }
  catch(error){
    if ((!init?.method||init.method==='GET') && cacheKey && !url.includes('/ai/')) {
      const cached=localStorage.getItem(cacheKey);if(cached)return new Response(cached,{headers:{'Content-Type':'application/json','X-Local-Snapshot':'true'}});
    }
    throw error;
  }
  if(res.ok&&(!init?.method||init.method==='GET')&&cacheKey&&!url.includes('/ai/')&&!url.includes('/export')) {
    try {localStorage.setItem(cacheKey,await res.clone().text());} catch { /* A cache failure must not hide a live read. */ }
  }

  if (res.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/signup')) {
    window.dispatchEvent(new CustomEvent('hd:unauthorized'));
  }

  return res;
}

// --- Auth Endpoints ---
export async function authSignup(payload: {
  username: string;
  password: string;
}): Promise<{ token: string; username: string }> {
  const res = await fetch('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Signup failed (${res.status})`);
  }
  const data=await res.json();rememberIdentity(data.username,data.token);return data;
}

export async function authLogin(payload: {
  username: string;
  password: string;
}): Promise<{ token: string; username: string }> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Invalid username or password');
  }
  const data=await res.json();rememberIdentity(data.username,data.token);return data;
}

export async function authMe(tokenOverride?: string): Promise<{username:string}> {
 const token=tokenOverride||getStoredToken();if(!token)throw new Error('No authentication token found');
 let res:Response;
 try{res=await fetch('/auth/me',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});}
 catch(error){const prior=cachedIdentity();if(prior&&prior.token===token)return {username:prior.username};throw error;}
 if(!res.ok){if(res.status===401)removeStoredToken();throw new Error('Owner verification failed ('+res.status+')');}
 const data=await res.json();rememberIdentity(data.username,token);return data;
}

// --- Journeys ---
export async function getJourneys(): Promise<Journey[]> {
  const res = await apiFetch(`${API_BASE}/journeys`);
  if (!res.ok) throw new Error(`Failed to fetch journeys: ${res.statusText}`);
  return res.json();
}

export async function createJourney(payload: {
  name: string;
  description?: string | null;
  visibility?: 'PRIVATE' | 'SHARED';
  status?: string;
}): Promise<Journey> {
  const res = await apiFetch(`${API_BASE}/journeys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create journey: ${res.statusText}`);
  return res.json();
}

export async function getJourney(id: string): Promise<Journey> {
  const res = await apiFetch(`${API_BASE}/journeys/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch journey: ${res.statusText}`);
  return res.json();
}

export async function updateJourney(
  id: string,
  payload: Partial<Journey>
): Promise<Journey> {
  const res = await apiFetch(`${API_BASE}/journeys/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update journey: ${res.statusText}`);
  return res.json();
}

// --- Nodes ---
export async function getNodes(params?: {
  journey_id?: string;
  parent_id?: string | null;
}): Promise<Node[]> {
  const query = new URLSearchParams();
  if (params?.journey_id) query.set('journey_id', params.journey_id);
  if (params?.parent_id !== undefined) query.set('parent_id', params.parent_id ?? 'null');

  const qs = query.toString();
  const url = qs ? `${API_BASE}/nodes?${qs}` : `${API_BASE}/nodes`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch nodes: ${res.statusText}`);
  return res.json();
}

export async function createNode(payload: {
  journey_id: string;
  parent_id?: string | null;
  node_type?: import('./types').NodeType;
  name: string;
  description?: string | null;
  estimated_minutes?: number | null;
  done_type?: import('./types').DoneType | null;
  due_date?: string | null;
  sequence?: number | null;
}): Promise<Node> {
  const res = await apiFetch(`${API_BASE}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create node: ${res.statusText}`);
  return res.json();
}

export async function getNode(id: string): Promise<Node> {
  const res = await apiFetch(`${API_BASE}/nodes/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch node: ${res.statusText}`);
  return res.json();
}

export async function updateNode(id: string, payload: Partial<Node>): Promise<Node> {
  const res = await apiFetch(`${API_BASE}/nodes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update node: ${res.statusText}`);
  return res.json();
}

export async function closeNode(id: string, reason: string): Promise<Node> {
  const res = await apiFetch(`${API_BASE}/nodes/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`Failed to close node: ${res.statusText}`);
  return res.json();
}

export async function setNodeEstimate(
  id: string,
  estimated_minutes: number | null
): Promise<Node> {
  const res = await apiFetch(`${API_BASE}/nodes/${id}/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estimated_minutes }),
  });
  if (!res.ok) throw new Error(`Failed to set node estimate: ${res.statusText}`);
  return res.json();
}

// --- Sessions ---
export async function getSessions(params?: {
  journey_id?: string;
  status?: string;
}): Promise<Session[]> {
  const query = new URLSearchParams({view:'effective'});
  if (params?.journey_id) query.set('journey_id', params.journey_id);
  if (params?.status) query.set('status', params.status);

  const qs = query.toString();
  const url = qs ? `${API_BASE}/sessions?${qs}` : `${API_BASE}/sessions`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.statusText}`);
  return res.json();
}

export async function createSession(payload: {
  journey_id: string;
  intention: string;
  label?: string | null;
  initial_node_id?: string | null;
  node_id?: string | null;
  condition?: import('./types').Condition | null;
  predecessor_session_id?: string | null;
  started_at?: string | null;
}): Promise<{ session: Session; conflict?: ConflictLog | null }> {
  const res = await apiFetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create session: ${res.statusText}`);
  }
  return res.json();
}

export async function startSession(payload: {
  journey_id: string;
  intention: string;
  label?: string | null;
  node_id?: string | null;
  condition?: import('./types').Condition | null;
  started_at?: string | null;
}): Promise<Session> {
  const res = await createSession({
    journey_id: payload.journey_id,
    intention: payload.intention,
    label: payload.label,
    initial_node_id: payload.node_id,
    node_id: payload.node_id,
    condition: payload.condition,
    started_at: payload.started_at,
  });
  return res.session;
}

export async function getSession(id: string): Promise<Session> {
  const res = await apiFetch(`${API_BASE}/sessions/${id}?view=effective`);
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.statusText}`);
  return res.json();
}

export async function getSessionSummary(id: string): Promise<SessionSummaryResult> {
  const res = await apiFetch(`${API_BASE}/sessions/${id}/summary`);
  if (!res.ok) throw new Error(`Failed to fetch session summary: ${res.statusText}`);
  return res.json();
}

export async function endSession(
  id: string,
  payload: {
    reflection?: string | null;
    quality?: import('./types').SessionQuality | null;
    status?: import('./types').SessionStatus;
    end_reason?: import('./types').SessionEndReason | string | null;
    successor_session_id?: string | null;
    note?: string | null;
  }
): Promise<Session> {
  const res = await apiFetch(`${API_BASE}/sessions/${id}/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to end session: ${res.statusText}`);
  }
  return res.json();
}

export async function completeSession(
  id: string,
  payload: {
    reflection?: string | null;
    quality?: import('./types').SessionQuality | null;
    end_reason?: import('./types').SessionEndReason | string | null;
    status?: import('./types').SessionStatus;
  }
): Promise<Session> {
  return endSession(id, {
    reflection: payload.reflection,
    quality: payload.quality,
    status: payload.status,
    end_reason: payload.end_reason || 'NATURAL_COMPLETION',
  });
}

export async function updateSessionCondition(
  sessionId: string,
  condition: import('./types').Condition,
  nodeId?: string | null,
  note?: string | null
): Promise<{
  session: Session;
  entry: SessionEntry;
  condition: import('./types').Condition;
}> {
  const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/condition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ condition, node_id: nodeId, note }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update condition: ${res.statusText}`);
  }
  return res.json();
}

// Decision 2: Cross-Journey Session Transition
export async function switchJourneySession(
  sourceSessionId: string,
  payload: {
    target_journey_id: string;
    target_node_id?: string | null;
    new_intention: string;
    switch_reason?: string | null;
    condition?: import('./types').Condition;
  }
): Promise<{
  previous_session: Session;
  new_session: Session;
  switch_entry: SessionEntry;
  initial_entry?: SessionEntry | null;
}> {
  const res = await apiFetch(`${API_BASE}/sessions/${sourceSessionId}/switch-journey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to switch journey: ${res.statusText}`);
  return res.json();
}

export async function reviseIntention(
  id: string,
  payload: {
    new_intention: string;
    reason?: string | null;
    condition?: import('./types').Condition;
  }
): Promise<{ session: Session; entry: SessionEntry }> {
  const res = await apiFetch(`${API_BASE}/sessions/${id}/revise-intention`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to revise intention: ${res.statusText}`);
  return res.json();
}

// --- Session Entries ---
export async function getAllEntries(): Promise<SessionEntry[]> {
  const res = await apiFetch(`${API_BASE}/entries?view=effective`);
  if (!res.ok) throw new Error(`Failed to fetch entries: ${res.statusText}`);
  return res.json();
}

export async function getSessionEntries(sessionId: string): Promise<SessionEntry[]> {
  const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/entries?view=effective`);
  if (!res.ok) throw new Error(`Failed to fetch entries: ${res.statusText}`);
  return res.json();
}

export async function createSessionEntry(
  sessionId: string,
  payload: {
    entry_type: import('./types').EntryType;
    node_id?: string | null;
    note?: string | null;
    condition?: import('./types').Condition;
    discovery_node?: {
      name: string;
      node_type?: import('./types').NodeType;
      parent_id?: string | null;
      description?: string | null;
      estimated_minutes?: number | null;
      done_type?: import('./types').DoneType | null;
    };
  }
): Promise<{ entry: SessionEntry; discovery_node?: Node | null }> {
  const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create session entry: ${res.statusText}`);
  return res.json();
}

export const logSessionEntry = createSessionEntry;

// --- Corrections ---
export async function createCorrection(
  entryId: string,
  payload: {
    field: string;
    corrected_value: string;
    reason?: string | null;
  }
): Promise<Correction> {
  const res = await apiFetch(`${API_BASE}/entries/${entryId}/corrections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create correction: ${res.statusText}`);
  return res.json();
}

export async function getCorrections(entryId?: string): Promise<Correction[]> {
  const url = entryId
    ? `${API_BASE}/corrections?entry_id=${encodeURIComponent(entryId)}`
    : `${API_BASE}/corrections`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch corrections: ${res.statusText}`);
  return res.json();
}

// --- Conflicts ---
export async function getConflicts(resolved?: boolean): Promise<ConflictLog[]> {
  const url = resolved !== undefined ? `${API_BASE}/conflicts?resolved=${resolved}` : `${API_BASE}/conflicts`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch conflicts: ${res.statusText}`);
  return res.json();
}

export async function resolveConflict(id: string, resolution: string): Promise<ConflictLog> {
  const res = await apiFetch(`${API_BASE}/conflicts/${id}/resolve`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolution }),
  });
  if (!res.ok) throw new Error(`Failed to resolve conflict: ${res.statusText}`);
  return res.json();
}

// --- Priority Queries ---
export async function getDurationVsEstimate(params?: {
  journey_id?: string;
  node_id?: string;
}): Promise<DurationVsEstimateResult[]> {
  const query = new URLSearchParams();
  if (params?.journey_id) query.set('journey_id', params.journey_id);
  if (params?.node_id) query.set('node_id', params.node_id);
  const qs = query.toString();
  const url = qs ? `${API_BASE}/queries/duration-vs-estimate?${qs}` : `${API_BASE}/queries/duration-vs-estimate`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch duration vs estimate query: ${res.statusText}`);
  return res.json();
}

export async function getJourneyProgress(journeyId: string): Promise<JourneyProgressResult> {
  const res = await apiFetch(`${API_BASE}/queries/journey-progress?journey_id=${encodeURIComponent(journeyId)}`);
  if (!res.ok) throw new Error(`Failed to fetch journey progress: ${res.statusText}`);
  return res.json();
}

// --- Event Log & System ---
export async function getEventLog(): Promise<EventLogEntry[]> {
  const res = await apiFetch(`${API_BASE}/events`);
  if (!res.ok) throw new Error(`Failed to fetch event log: ${res.statusText}`);
  return res.json();
}

export async function getHealth(): Promise<{
  status: string;
  journeys_count: number;
  nodes_count: number;
  sessions_count: number;
  entries_count: number;
  events_count: number;
}> {
  const res = await apiFetch('/health');
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

// --- Daily Logger MVP & Board API ---

export async function getBoard(journeyId?: string): Promise<BoardData> {
  const url = journeyId ? `${API_BASE}/board/${encodeURIComponent(journeyId)}` : `${API_BASE}/board`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch board data: ${res.statusText}`);
  return res.json();
}

export async function parseLogWithAI(
  message: string,
  journeyId?: string
): Promise<ParsedLogProposal> {
  const res = await apiFetch(`${API_BASE}/ai/parse-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, journey_id: journeyId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to parse log with AI: ${res.statusText}`);
  }
  return res.json();
}

export async function quickLogSession(payload: QuickLogPayload): Promise<{pending:boolean}> {
 const item=enqueueLog(payload);
 await flushQueuedLogs();
 return {pending:getQueuedLogs().some(q=>q.id===item.id)};
}

// --- Ollama & AI Layer ---
export async function getOllamaStatus(): Promise<import('./types').OllamaStatus> {
  const res = await apiFetch(`${API_BASE}/ai/status`);
  if (!res.ok) throw new Error('Failed to get Ollama status');
  return res.json();
}

export async function updateOllamaSettings(url: string, model: string): Promise<{ url: string; model: string }> {
  const res = await apiFetch(`${API_BASE}/ai/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, model }),
  });
  if (!res.ok) throw new Error('Failed to update Ollama settings');
  return res.json();
}

export async function askQueryChat(question: string): Promise<import('./types').QueryChatResponse> {
  const res = await apiFetch(`${API_BASE}/ai/query-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to get query answer');
  }
  return res.json();
}

// --- Export Markdown ---
export async function triggerMarkdownExport(): Promise<{
  success: boolean;
  message: string;
  export_dir: string;
  zip_url: string;
}> {
  const res = await apiFetch(`${API_BASE}/export/markdown`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Export generation failed');
  }
  return res.json();
}

// --- Board View ---
export async function getBoardData(journeyId?: string): Promise<BoardData> {
  const url = journeyId && journeyId !== 'ALL'
    ? `${API_BASE}/board/${encodeURIComponent(journeyId)}`
    : `${API_BASE}/board`;
  const res = await apiFetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch board data');
  }
  return res.json();
}



export async function downloadExport(url:string) { const response=await apiFetch(url); if(!response.ok)throw new Error('Export download failed'); const blob=await response.blob(); const href=URL.createObjectURL(blob);const link=document.createElement('a');link.href=href;link.download='human_drift_markdown_export.zip';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000); }

export async function getSessionEvidence(id:string) {const res=await apiFetch(`/api/sessions/${id}/evidence`);if(!res.ok)throw new Error('Could not load original evidence');return res.json();}
