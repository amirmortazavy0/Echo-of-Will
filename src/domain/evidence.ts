import type { AppData, Session, SessionEntry, SessionSummaryResult } from '../types';

export function effectiveEntry(data: AppData, entry: SessionEntry): SessionEntry {
  const output = structuredClone(entry);
  for (const c of [...data.corrections].filter(c => c.entry_id === entry.id).sort((a,b) => (a.sequence??0)-(b.sequence??0) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))) {
    if (['note','node_id','logged_at','entry_type'].includes(c.field)) (output as any)[c.field] = c.field==='node_id' && c.corrected_value==='' ? null : c.corrected_value;
  }
  return output;
}
export function effectiveData(raw: AppData): AppData {
  const data=structuredClone(raw);
  data.entries=(raw.session_entries || raw.entries).map(e=>effectiveEntry(raw,e));
  data.session_entries=data.entries;
  for(const {amendment} of (raw.session_amendments||[]).map((amendment,index)=>({amendment,index})).sort((a,b)=>(a.amendment.sequence??a.index+1)-(b.amendment.sequence??b.index+1)||a.index-b.index)) {
    const session=data.sessions.find(s=>s.id===amendment.session_id);
    if(session && ['note','reflection','quality','ended_at'].includes(amendment.field)) (session as any)[amendment.field]=amendment.value;
  }
  return data;
}
export interface EvidenceInterval { start:string; end:string; minutes:number; classification:'SUPPORTED_ACTIVITY'|'UNCLASSIFIED_CONTEXT_PAUSE'; node_id:string|null }
export function interpretSession(session:Session, entries:SessionEntry[], now=new Date()) {
  const start=Date.parse(session.started_at), end=session.ended_at?Date.parse(session.ended_at):session.status==='ACTIVE'?now.getTime():NaN;
  const issues:string[]=[];
  const intervals:EvidenceInterval[]=[];
  const nodeMinutes=new Map<string,number>();
  const validBounds=Number.isFinite(start)&&Number.isFinite(end)&&end>=start;
  if(!validBounds) issues.push('Unknown or invalid Session bounds; no duration inferred.');
  let cursor=start, active=false, node:string|null=null;
  const add=(to:number)=>{
    if(to>cursor) {
      const minutes=(to-cursor)/60000;
      intervals.push({start:new Date(cursor).toISOString(),end:new Date(to).toISOString(),minutes,classification:active?'SUPPORTED_ACTIVITY':'UNCLASSIFIED_CONTEXT_PAUSE',node_id:active?node:null});
      if(active&&node) nodeMinutes.set(node,(nodeMinutes.get(node)||0)+minutes);
    }
    cursor=to;
  };
  const sorted=entries.map((entry,index)=>({entry,index})).sort((a,b)=>Date.parse(a.entry.logged_at)-Date.parse(b.entry.logged_at)||a.index-b.index||a.entry.id.localeCompare(b.entry.id));
  if(validBounds) for(const {entry:e} of sorted) {
    const at=Date.parse(e.logged_at);
    if(!Number.isFinite(at)||at<start||at>end) {issues.push('Entry '+e.id+' has an invalid or out-of-bounds time; retained but excluded from intervals.');continue;}
    const opens=['TASK_STARTED','CONTEXT_SWITCH','STOP_ARRIVED'].includes(e.entry_type);
    const closes=['TASK_PAUSED','TASK_COMPLETED','CONTEXT_SWITCH_REQUEST','STOP_DEPARTED'].includes(e.entry_type);
    if(!opens&&!closes) continue; // Notes, discoveries and revisions never imply a boundary.
    add(at);
    if(opens){if(active && e.entry_type!=='CONTEXT_SWITCH')issues.push('Activity reopened without a recorded stop at '+e.id);active=true;node=e.node_id??null;}
    else {if(!active)issues.push('Stop without an active interval at '+e.id);active=false;node=null;}
  }
  if(validBounds)add(end);
  const activeMinutes=intervals.filter(i=>i.classification==='SUPPORTED_ACTIVITY').reduce((sum,i)=>sum+i.minutes,0);
  const unclassifiedPauseMinutes=intervals.filter(i=>i.classification==='UNCLASSIFIED_CONTEXT_PAUSE').reduce((sum,i)=>sum+i.minutes,0);
  const summary:SessionSummaryResult={sessionDurationMinutes:validBounds?(end-start)/60000:0,activeMinutes,unclassifiedPauseMinutes,
    pauseIntervals:intervals.filter(i=>i.classification==='UNCLASSIFIED_CONTEXT_PAUSE').map(i=>({start:i.start,end:i.end,duration_minutes:i.minutes,classification:'UNCLASSIFIED_CONTEXT_PAUSE'})),
    entriesCount:entries.length,discoveriesCount:entries.filter(e=>e.entry_type==='DISCOVERY').length,revisionsCount:entries.filter(e=>e.entry_type==='INTENTION_REVISED').length,touchedNodeIds:[...new Set(entries.map(e=>e.node_id).filter((id):id is string=>Boolean(id)))]};
  return {...summary,validBounds,open:!session.ended_at,asOf:now.toISOString(),issues,intervals,nodeMinutes};
}

