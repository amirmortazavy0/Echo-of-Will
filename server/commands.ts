import { validateCapture } from './capture';
import { effectiveEntry } from '../src/domain/evidence';
import type { Request, Response, NextFunction } from 'express';
import type { AppData, Condition, Session, SessionEntry } from '../src/types';
import { VALID_ENTRY_TYPES, VALID_SESSION_END_REASONS, VALID_SESSION_QUALITIES, VALID_ENERGY_LEVELS, VALID_FOCUS_LEVELS, VALID_LOCATION_TYPES, VALID_ENVIRONMENT_TYPES } from '../src/types';
import { readAppData, owned } from './storage';
import { deriveSessionStatusFromEndReason } from '../src/utils/formatters';

export class CommandError extends Error { constructor(message: string, public status = 400) { super(message); } }
const fail = (message: string): never => { throw new CommandError(message); };
export function text(value: any, name: string, required = false) {
  if (value === undefined || value === null) { if (required) fail(`${name} is required`); return; }
  if (typeof value !== 'string' || value.length > 20000 || required && !value.trim()) fail(`${name} must be a${required ? ' non-empty' : ''} string`);
}
function choice(value: any, name: string, values: readonly string[], nullable = false) {
  if (value === undefined || nullable && value === null) return;
  if (!values.includes(value)) fail(`Invalid ${name}; expected ${values.join(', ')}`);
}
export function timestamp(value: any, name: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) fail(`${name} must be an ISO timestamp with timezone`);
  const date = value.slice(0,10);
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date) fail(`Invalid calendar date in ${name}`);
  const time = Date.parse(value);
  if (time < Date.UTC(1900,0,1) || time > Date.now() + 60000) fail(`${name} is outside supported historical bounds`);
  return time;
}
function numeric(value: any, name: string, min = 0, integer = false) {
  if (value === undefined || value === null) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > 1e7 || integer && !Number.isInteger(value)) fail(`${name} must be a finite ${integer ? 'integer' : 'number'} between ${min} and 10000000`);
}
export { effectiveEntry } from '../src/domain/evidence';
export function latestEntry(data: AppData, sessionId: string, at: string) {
  return data.entries.map((raw,index) => ({ raw, entry: effectiveEntry(data,raw), index }))
    .filter(item => item.entry.session_id === sessionId && Date.parse(item.entry.logged_at) <= Date.parse(at))
    .sort((a,b) => Date.parse(b.entry.logged_at)-Date.parse(a.entry.logged_at) || b.index-a.index || b.entry.id.localeCompare(a.entry.id))[0]?.entry;
}
export function selectCondition(data: AppData, sessionId: string | undefined, at: string, input?: any): Condition {
  const last = sessionId ? latestEntry(data,sessionId,at) : undefined;
  const fallback: Condition = last?.condition || { energy:'UNKNOWN', focus:'UNKNOWN', location:'UNKNOWN', environment:'UNKNOWN', provenance:'unknown' };
  if (input !== undefined && input !== null && (typeof input !== 'object' || Array.isArray(input))) fail('condition must be an object');
  const raw = input || {};
  const fields = {energy:VALID_ENERGY_LEVELS,focus:VALID_FOCUS_LEVELS,location:VALID_LOCATION_TYPES,environment:VALID_ENVIRONMENT_TYPES};
  for (const [key, values] of Object.entries(fields)) choice(raw[key],`condition.${key}`,values);
  text(raw.custom_note,'condition.custom_note');
  for (const key of Object.keys(raw)) if (![...Object.keys(fields),'custom_note','owner_id','visibility','provenance','inherited_from_entry_id','migration_provenance'].includes(key)) fail(`Unknown condition field: ${key}`);
  const values = Object.fromEntries(Object.keys(fields).map(key => [key,raw[key] ?? fallback[key]]));
  const reported = Object.keys(fields).some(key => raw[key] !== undefined) || raw.custom_note !== undefined;
  return { ...values, custom_note: raw.custom_note !== undefined ? raw.custom_note : fallback.custom_note ?? null, ...owned(), provenance: reported ? 'reported' : last ? 'inherited' : 'unknown', inherited_from_entry_id: !reported && last ? last.id : null } as Condition;
}
function thing(data: AppData, id: any) { text(id,'journey_id',true); if (!data.journeys.some(j => j.id === id)) fail('Thing does not exist'); }
function nodeRef(data: AppData, id: any, journeyId: string) {
  if (id === undefined || id === null || id === '') return;
  text(id,'node_id',true);
  if (!data.nodes.some(n => n.id === id && n.journey_id === journeyId)) fail('Node must exist in the selected Thing');
}
function within(session: Session, value: string) {
  const time = timestamp(value,'logged_at');
  if (time < Date.parse(session.started_at) || session.ended_at && time > Date.parse(session.ended_at)) fail('Entry time must lie within Session bounds');
}
function fields(body: any, allowed: string[]) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Expected a JSON command object');
  for (const key of Object.keys(body)) if (!allowed.includes(key)) fail(`Unsupported or immutable field: ${key}`);
  for (const key of ['note','description','label','reason','reflection','switch_reason','work_type','amendment_reason']) text(body[key],key);
  if ('visibility' in body && body.visibility !== 'PRIVATE') fail('Phase 1 supports PRIVATE local records only');
}
function nodeFields(data: AppData,b: any,journeyId: string,id?: string) {
  if (b.name !== undefined) text(b.name,'name',true);
  nodeRef(data,b.parent_id,journeyId);
  let ancestor = b.parent_id; const seen = new Set<string>();
  while (ancestor) { if (ancestor === id || seen.has(ancestor)) fail('Node parent would create a cycle'); seen.add(ancestor); ancestor = data.nodes.find(n => n.id === ancestor)?.parent_id; }
  choice(b.node_type,'node_type',['ROUTE','STATION','PROJECT','TASK','MILESTONE','NOTE']);
  choice(b.status,'status',['PLANNED','ACTIVE','PAUSED','DORMANT','COMPLETE']);
  choice(b.done_type,'done_type',['DELIVERABLE','TIME_TARGET','MILESTONE_SEQUENCE','OPEN_ENDED'],true);
  numeric(b.estimated_minutes,'estimated_minutes'); numeric(b.sequence,'sequence',0,true);
  if (b.due_date !== undefined && b.due_date !== null && (typeof b.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.due_date) || !Number.isFinite(Date.parse(b.due_date)) || new Date(b.due_date).toISOString().slice(0,10) !== b.due_date)) fail('Invalid due_date');
}
const nodeKeys = ['name','description','node_type','status','parent_id','estimated_minutes','done_type','due_date','sequence','note'];
export function validateCommand(req: Pick<Request,'path'|'method'|'body'>,data: AppData): any {
  const p=req.path, b=req.body, method=req.method; const now=new Date().toISOString();
  if (p === '/api/journeys' || /^\/api\/journeys\/[^/]+$/.test(p)) {
    fields(b,['name','description','status','visibility']);
    text(b.name,'name',method==='POST'); choice(b.status,'status',['ACTIVE','PAUSED','COMPLETE']); return;
  }
  if (p === '/api/nodes' || /^\/api\/nodes\/[^/]+$/.test(p)) {
    fields(b,method==='POST' ? ['journey_id',...nodeKeys] : nodeKeys);
    const current=method==='POST' ? undefined : data.nodes.find(n=>n.id===p.split('/')[3]);
    if (method!=='POST' && !current) fail('Node does not exist');
    const journeyId=current?.journey_id || b.journey_id; thing(data,journeyId);
    if (method==='POST') text(b.name,'name',true);
    nodeFields(data,b,journeyId,current?.id); return;
  }
  if (/^\/api\/nodes\/[^/]+\/(close|estimate)$/.test(p)) {
    const estimate=p.endsWith('/estimate'); fields(b,estimate?['estimated_minutes']:['reason']);
    if (estimate) { if (!('estimated_minutes' in b)) fail('estimated_minutes is required'); numeric(b.estimated_minutes,'estimated_minutes'); } else text(b.reason,'reason',true);
    return;
  }
  if (p==='/api/sessions' || p==='/api/sessions/quick-log') {
    const quick=p.endsWith('/quick-log');
    fields(b,quick ? ['journey_id','node_id','node_name','node_status','work_type','duration_minutes','intention','condition','started_at','ended_at','quality','end_reason','reflection','note','status','entry_types','original_report','provider','proposal','uncertainty','boundaries_confirmed','reviewed_entries','client_confirmed_at'] : ['journey_id','intention','label','initial_node_id','node_id','condition','predecessor_session_id','started_at']);
    thing(data,b.journey_id); nodeRef(data,b.node_id,b.journey_id); nodeRef(data,b.initial_node_id,b.journey_id); text(b.intention,'intention',true);
    if (b.predecessor_session_id) fail('Use the linked switch command to set predecessor_session_id');
    if (b.initial_node_id && b.node_id && b.initial_node_id!==b.node_id) fail('Initial node aliases disagree');
    if (b.started_at !== undefined) timestamp(b.started_at,'started_at');
    if (quick) {
      numeric(b.duration_minutes,'duration_minutes',1); if (b.duration_minutes==null) fail('duration_minutes is required');
      text(b.node_name,'node_name',b.node_name!==undefined);
      choice(b.node_status,'node_status',['PLANNED','ACTIVE','PAUSED','DORMANT','COMPLETE']);
      choice(b.quality,'quality',VALID_SESSION_QUALITIES,true); choice(b.end_reason,'end_reason',VALID_SESSION_END_REASONS,true);
      choice(b.status,'status',['COMPLETE','INCOMPLETE','PAUSED']);
      if (b.end_reason==='JOURNEY_SWITCH') fail('Use the linked switch command');
      if (b.status && b.status!==deriveSessionStatusFromEndReason(b.end_reason||'NATURAL_COMPLETION')) fail('Status disagrees with end_reason');
      if (b.ended_at !== undefined) timestamp(b.ended_at,'ended_at');
      const end=b.ended_at || now; timestamp(end,'ended_at');
      const start=b.started_at || new Date(Date.parse(end)-b.duration_minutes*60000).toISOString(); timestamp(start,'started_at');
      if (Date.parse(end)<=Date.parse(start)) fail('Quick-log end must follow start');
      if (Math.abs((Date.parse(end)-Date.parse(start))/60000-b.duration_minutes)>0.001) fail('Duration disagrees with claimed bounds');
      if (b.entry_types !== undefined && (!Array.isArray(b.entry_types) || b.entry_types.some(t=>!['TASK_STARTED','TASK_PAUSED','TASK_COMPLETED','NOTE'].includes(t)))) fail('Structured discovery/revision semantics require their explicit commands');
    }
    if (quick) validateCapture(b,data);
    b.condition=selectCondition(data,undefined,b.started_at||now,b.condition); return;
  }
  const match=p.match(/^\/api\/sessions\/([^/]+)\/(end|entries|condition|revise-intention|switch-journey|amend)$/);
  if (match) {
    const session=data.sessions.find(s=>s.id===match[1]); if (!session) throw new CommandError('Session not found',404);
    const action=match[2];
    const keys: Record<string,string[]> = {
      end:['reflection','quality','status','note','end_reason','ended_at'],
      entries:['entry_type','node_id','note','condition','discovery_node','logged_at','amendment_reason'],
      condition:['condition','node_id','note','logged_at'],
      'revise-intention':['new_intention','reason','condition','logged_at','amendment_reason'],
      'switch-journey':['target_journey_id','target_node_id','new_intention','switch_reason','condition'],
      amend:['field','value','reason'],
    };
    fields(b,keys[action]);
    if (action==='end') {
      choice(b.quality,'quality',VALID_SESSION_QUALITIES,true); choice(b.status,'status',['COMPLETE','INCOMPLETE','PAUSED']); choice(b.end_reason,'end_reason',VALID_SESSION_END_REASONS,true);
      if (b.end_reason==='JOURNEY_SWITCH') fail('Use the linked switch command');
      if (session.ended_at) {
        const proposed={...b};
        for (const key of Object.keys(proposed)) {
          const v=typeof proposed[key]==='string'?proposed[key].trim():proposed[key];
          if ((session as any)[key] !== v && !((session as any)[key]==null && v===null)) throw new CommandError('Session already ended; differing closure requires an explicit amendment',409);
        }
        return { response:session };
      }
      const end=b.ended_at||now; timestamp(end,'ended_at');
      if (Date.parse(end)<Date.parse(session.started_at) || data.entries.some(e=>e.session_id===session.id && Date.parse(effectiveEntry(data,e).logged_at)>Date.parse(end))) fail('End precedes Session activity');
      const derived=deriveSessionStatusFromEndReason(b.end_reason||'NATURAL_COMPLETION');
      if (b.status && b.status!==derived) fail('Status disagrees with end_reason');
      return;
    }
    if (action==='amend') {
      if (!session.ended_at) fail('Amendments target ended Sessions'); text(b.reason,'reason',true);
      choice(b.field,'field',['note','reflection','quality','ended_at']);
      if (!b.field || !('value' in b)) fail('field and value are required');
      if (b.field==='quality') choice(b.value,'quality',VALID_SESSION_QUALITIES,true);
      else if (b.field==='ended_at') {
        timestamp(b.value,'ended_at'); if (Date.parse(b.value)<Date.parse(session.started_at) || data.entries.some(e=>e.session_id===session.id && Date.parse(effectiveEntry(data,e).logged_at)>Date.parse(b.value))) fail('Amended end precedes activity');
      } else text(b.value,'value');
      return;
    }
    if (session.ended_at && (!['entries','revise-intention'].includes(action) || !b.amendment_reason)) throw new CommandError('Session is closed; use an explicit retrospective amendment',409);
    const at=b.logged_at===undefined?now:b.logged_at; within(session,at);
    nodeRef(data,b.node_id,session.journey_id);
    if (action==='switch-journey') {
      thing(data,b.target_journey_id); if (b.target_journey_id===session.journey_id) fail('Cross-Thing switch must target another Thing'); nodeRef(data,b.target_node_id,b.target_journey_id); text(b.new_intention,'new_intention',true);
    }
    if (action==='revise-intention') text(b.new_intention,'new_intention',true);
    if (action==='entries') {
      choice(b.entry_type,'entry_type',VALID_ENTRY_TYPES); if (!b.entry_type) fail('entry_type is required');
      if (['INTENTION_REVISED','CONTEXT_SWITCH_REQUEST'].includes(b.entry_type)) fail('Use the structured revision or linked-switch command');
      if (b.entry_type==='CONTEXT_SWITCH' && !b.node_id) fail('Within-Thing switch requires a destination node');
      if (b.entry_type==='DISCOVERY') { fields(b.discovery_node,['name','description','node_type','parent_id','estimated_minutes','done_type']); text(b.discovery_node.name,'discovery_node.name',true); nodeFields(data,b.discovery_node,session.journey_id); }
      else if (b.discovery_node!==undefined) fail('discovery_node requires DISCOVERY');
    }
    b.condition=selectCondition(data,session.id,at,b.condition); return;
  }
  const correction=p.match(/^\/api\/entries\/([^/]+)\/corrections$/);
  if (correction) {
    fields(b,['field','corrected_value','reason']); const raw=data.entries.find(e=>e.id===correction[1]); if (!raw) fail('Entry not found');
    const entry=effectiveEntry(data,raw); const session=data.sessions.find(s=>s.id===entry.session_id); if (!session) fail('Session not found');
    choice(b.field,'field',['note','node_id','entry_type','logged_at']); if (!b.field || !('corrected_value' in b)) fail('Correction field/value required');
    text(b.corrected_value,'corrected_value');
    if (b.field==='logged_at') within(session,b.corrected_value);
    if (b.field==='node_id') nodeRef(data,b.corrected_value,session.journey_id);
    if (b.field==='entry_type') { choice(b.corrected_value,'entry_type',VALID_ENTRY_TYPES); if (!b.corrected_value) fail('entry_type cannot be empty'); if (['DISCOVERY','INTENTION_REVISED','CONTEXT_SWITCH_REQUEST'].includes(entry.entry_type) || ['DISCOVERY','INTENTION_REVISED','CONTEXT_SWITCH_REQUEST'].includes(b.corrected_value)) fail('Structured semantic records cannot be retyped'); }
    if (b.corrected_value===null && !['note','node_id'].includes(b.field)) fail('This correction cannot be null');
    return;
  }
  if (/^\/api\/conflicts\/[^/]+\/resolve$/.test(p)) { fields(b,['resolution','resolution_note']); text(b.resolution??b.resolution_note,'resolution',true); b.resolution=b.resolution??b.resolution_note; return; }
}
export function validateMutation(req: Request,res: Response,next: NextFunction) {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method) || !/^\/api\/(journeys|nodes|sessions|entries|conflicts)(\/|$)/.test(req.path)) return next();
  try { const result=validateCommand(req,readAppData()); if (result?.response) { res.json(result.response); return; } next(); } catch(error) { next(error); }
}
