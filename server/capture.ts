import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { readAppData, writeAppData, appendEvent, owned, getCurrentIso } from './storage';
import type { AppData, Session, SessionEntry, Node } from '../src/types';
import { validateCommand, selectCondition, CommandError, timestamp, text } from './commands';
import { deriveSessionStatusFromEndReason } from '../src/utils/formatters';

export function validateCapture(body:any,data:AppData) {
  if(body.client_confirmed_at!==undefined)timestamp(body.client_confirmed_at,'client_confirmed_at');
  text(body.original_report,'original_report',body.original_report!==undefined);text(body.uncertainty,'uncertainty');
  if(body.provider!==undefined&&!['manual','ollama','heuristic','local_heuristic'].includes(body.provider))throw new CommandError('Invalid capture provider');
  if(body.boundaries_confirmed!==undefined&&typeof body.boundaries_confirmed!=='boolean')throw new CommandError('Boundary confirmation must be boolean');
  if(body.proposal!==undefined&&JSON.stringify(body.proposal).length>100000)throw new CommandError('Proposal is too large');
  if(body.reviewed_entries!==undefined&&(!Array.isArray(body.reviewed_entries)||body.reviewed_entries.length>100))throw new CommandError('Expected at most 100 reviewed entries');
  const end=body.ended_at||getCurrentIso(), start=body.started_at||new Date(Date.parse(end)-body.duration_minutes*60000).toISOString();
  const copy=structuredClone(data);
  const session={id:'capture-validation',journey_id:body.journey_id,intention:body.intention,started_at:start,ended_at:null,status:'ACTIVE'} as Session;copy.sessions.push(session);
  for(const entry of body.reviewed_entries||[]) {
    if(!entry||!['NOTE','DISCOVERY','INTENTION_REVISED'].includes(entry.entry_type))throw new CommandError('Choose a reviewed note, discovery or intention revision');
    for(const key of Object.keys(entry))if(!['entry_type','note','logged_at','node_id','discovery_node','new_intention','reason'].includes(key))throw new CommandError('Unknown reviewed field: '+key);
    text(entry.note,'reviewed note');
    if(entry.discovery_node && Object.keys(entry.discovery_node).some(key=>!['name','description','parent_id'].includes(key)))throw new CommandError('Unsupported discovery detail');
    const at=entry.logged_at||end; timestamp(at,'reviewed logged_at'); if(Date.parse(at)<Date.parse(start)||Date.parse(at)>Date.parse(end))throw new CommandError('Reviewed entry lies outside the claimed bounds');
    if(entry.entry_type==='INTENTION_REVISED') {
      if(entry.node_id||entry.discovery_node)throw new CommandError('Revision cannot create a discovery');
      validateCommand({path:'/api/sessions/capture-validation/revise-intention',method:'POST',body:{new_intention:entry.new_intention,reason:entry.reason,logged_at:at}},copy);
    } else {
      if(entry.new_intention!==undefined||entry.reason!==undefined)throw new CommandError('Revision details require INTENTION_REVISED');
      validateCommand({path:'/api/sessions/capture-validation/entries',method:'POST',body:{entry_type:entry.entry_type,node_id:entry.node_id,note:entry.note,logged_at:at,...(entry.discovery_node?{discovery_node:entry.discovery_node}:{})}},copy);
    }
  }
}
export function captureSession(req:Request,res:Response) {
 const data=readAppData(), b=req.body, now=getCurrentIso();
 const end=b.ended_at||now,start=b.started_at||new Date(Date.parse(end)-b.duration_minutes*60000).toISOString();
 let node=data.nodes.find(n=>n.id===b.node_id);
 if(!node&&b.node_name?.trim()){
   node={id:'nod-'+randomUUID(),journey_id:b.journey_id,name:b.node_name.trim(),node_type:'TASK',status:b.node_status||'ACTIVE',created_at:now,...owned()};
   data.nodes.push(node);appendEvent(data,{entity_type:'Node',entity_id:node.id,event_type:'NODE_CREATED',payload:node});
 }
 const session:Session={id:'ses-'+randomUUID(),journey_id:b.journey_id,node_id:node?.id||null,intention:b.intention.trim(),intention_provenance:'reconstructed',started_at:start,ended_at:end,status:deriveSessionStatusFromEndReason(b.end_reason||'NATURAL_COMPLETION'),end_reason:b.end_reason||'NATURAL_COMPLETION',quality:b.quality??null,reflection:b.reflection??null,note:b.note??null,created_at:now,updated_at:now,...owned()};
 data.sessions.push(session);
 const reviewed=b.reviewed_entries?.length?b.reviewed_entries:[{entry_type:'NOTE',note:b.note||b.original_report||b.intention,logged_at:end}];
 const report={id:'rep-'+randomUUID(),session_id:session.id,original_text:b.original_report??b.note??b.intention,captured_at:now,confirmed_at:now,client_confirmed_at:b.client_confirmed_at??null,client_command_id:(req as any).captureCommand?.id??null,provider:b.provider||'manual',proposal:structuredClone(b.proposal??null),uncertainty:b.uncertainty||null,claimed_started_at:start,claimed_ended_at:end,boundaries_confirmed:b.boundaries_confirmed===true,accepted_entries:structuredClone(reviewed),...owned()};
 (data.capture_reports??=[]).push(report);
 appendEvent(data,{entity_type:'Session',entity_id:session.id,event_type:'SESSION_STARTED',payload:session});
 appendEvent(data,{entity_type:'Session',entity_id:session.id,event_type:'CAPTURE_CONFIRMED',payload:report});
 const created:SessionEntry[]=[];
 const add=(entry_type:any,at:string,note:string|null,node_id:string|null,extra:any={})=>{
   const entry:SessionEntry={id:'ent-'+randomUUID(),session_id:session.id,entry_type,logged_at:at,note,node_id,condition:selectCondition(data,session.id,at,b.condition),source_report_id:report.id,captured_at:now,time_provenance:'reported',...owned(),...extra};
   data.entries.push(entry);created.push(entry);appendEvent(data,{entity_type:'SessionEntry',entity_id:entry.id,event_type:'ENTRY_LOGGED',payload:entry});return entry;
 };
 if(report.boundaries_confirmed)add('TASK_STARTED',start,'User-confirmed estimated activity boundary',node?.id||null,{time_provenance:'estimated'});
 let previous=session.intention;
 for(const r of reviewed) {
   let discovery:Node|undefined;
   if(r.entry_type==='DISCOVERY'){
     discovery={id:'nod-'+randomUUID(),journey_id:session.journey_id,parent_id:r.discovery_node.parent_id||r.node_id||null,name:r.discovery_node.name.trim(),description:r.discovery_node.description||null,node_type:'TASK',status:'PLANNED',created_at:now,...owned()};
     data.nodes.push(discovery);appendEvent(data,{entity_type:'Node',entity_id:discovery.id,event_type:'DISCOVERY_CREATED',payload:discovery});
   }
   const entry=add(r.entry_type,r.logged_at||end,r.note||r.new_intention||null,r.entry_type==='INTENTION_REVISED'?null:r.node_id??node?.id??null,discovery?{discovery_ref:discovery.id}:{});
   if(r.entry_type==='INTENTION_REVISED') {
     const revision={id:'rev-'+randomUUID(),session_id:session.id,entry_id:entry.id,previous_intention:previous,new_intention:r.new_intention,reason:r.reason||null,revised_at:entry.logged_at,...owned()};
     (data.intention_revisions??=[]).push(revision);appendEvent(data,{entity_type:'Session',entity_id:session.id,event_type:'SESSION_INTENTION_REVISED',payload:revision,previous_value:{intention:previous}});previous=r.new_intention;
   }
 }
 if(report.boundaries_confirmed)add('TASK_PAUSED',end,'User-confirmed estimated activity boundary',node?.id||null,{time_provenance:'estimated'});
 appendEvent(data,{entity_type:'Session',entity_id:session.id,event_type:'SESSION_COMPLETED',payload:session});
 const response={session,node:node||null,entry:created.at(-1),entries:created,report};
 const command=(req as any).captureCommand;
 if(command)((data as any).command_receipts??=[]).push({...command,response:structuredClone(response),accepted_at:now,...owned()});
 writeAppData(data);res.status(201).json(response);
}

