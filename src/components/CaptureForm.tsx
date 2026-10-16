import React,{useState} from 'react';
import type {Journey,Node,Condition,QuickLogPayload,ParsedLogProposal} from '../types';
import {quickLogSession,parseLogWithAI} from '../api';
type Reviewed=NonNullable<QuickLogPayload['reviewed_entries']>[number];
export function CaptureForm({journeys,nodes,onSaved,initialText=''}:{journeys:Journey[];nodes:Node[];onSaved:()=>void;initialText?:string}) {
 const [report,setReport]=useState(initialText),[intention,setIntention]=useState(''),[journey,setJourney]=useState(''),[node,setNode]=useState('');
 const [duration,setDuration]=useState<number | ''>(45),[ended,setEnded]=useState(''),[uncertainty,setUncertainty]=useState(''),[bounds,setBounds]=useState(false);
 const [quality,setQuality]=useState(''),[proposal,setProposal]=useState<ParsedLogProposal|null>(null),[reviewed,setReviewed]=useState<Reviewed[]>([{entry_type:'NOTE',note:''}]);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [condition,setCondition]=useState<Condition>({energy:'UNKNOWN',focus:'UNKNOWN',location:'UNKNOWN',environment:'UNKNOWN'});
 const input='w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-zinc-100';
 const update=(i:number,patch:Partial<Reviewed>)=>setReviewed(items=>items.map((item,index)=>index===i?{...item,...patch}:item));
 const assist=async()=>{setBusy(true);setError('');setNotice('');try{
   const p=await parseLogWithAI(report,journey||undefined);setProposal(p);setIntention(p.intention);setDuration(p.duration_minutes ?? '');setCondition(p.condition);
   if(journeys.some(j=>j.id===p.journey_id))setJourney(p.journey_id);
   setNode(nodes.some(n=>n.id===p.node_id&&n.journey_id===p.journey_id)?p.node_id!:'');
   setReviewed([{entry_type:'NOTE',note:p.summary||report}]);
 }catch(e:any){setError(e.message);}finally{setBusy(false);}};
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{
   const end=ended?new Date(ended).toISOString():new Date().toISOString();
   const saved=await quickLogSession({journey_id:journey,node_id:node||null,intention,original_report:report,provider:proposal?.provider||'manual',proposal,uncertainty,boundaries_confirmed:bounds,duration_minutes:Number(duration),started_at:new Date(Date.parse(end)-Number(duration)*60000).toISOString(),ended_at:end,quality:quality as any||null,condition,
   reviewed_entries:reviewed.map(r=>({...r,logged_at:r.logged_at?new Date(r.logged_at).toISOString():end,...(r.entry_type==='NOTE'?{note:r.note||report}:{})}))});
   setNotice(saved.pending?'Saved on this device — pending server acceptance.':'Saved to the local backend.');
   setReport('');setIntention('');setProposal(null);setReviewed([{entry_type:'NOTE',note:''}]);setUncertainty('');setBounds(false);setQuality('');setEnded('');onSaved();
 }catch(e:any){setError(e.message);}finally{setBusy(false);}};
 return <form onSubmit={submit} className="space-y-4">
  <fieldset disabled={busy} className="space-y-4">
  <p className="text-sm text-zinc-400">Record a report manually, or ask local AI for an editable suggestion. Nothing is saved until you confirm.</p>
  {notice&&<p role="status">{notice}</p>}
  {error&&<p role="alert" className="text-red-300">{error}</p>}
  <label className="block">Original report<textarea required aria-label="Original report" className={input} placeholder="What happened, in your own words?" value={report} onChange={e=>{setNotice('');setReport(e.target.value);if(proposal){setProposal(null);setIntention('');setDuration('');setCondition({energy:'UNKNOWN',focus:'UNKNOWN',location:'UNKNOWN',environment:'UNKNOWN'});setReviewed([{entry_type:'NOTE',note:''}]);}}}/></label>
  <button type="button" disabled={busy||!report.trim()} onClick={assist} className="rounded border p-2">Suggest with local AI</button>
  {proposal&&<p role="status">Suggestion from {proposal.provider}. {proposal.model && ` (${proposal.model})`}. Review every field; the original report is retained. {proposal.fallback_reason} {proposal.duration_minutes === null && 'Duration was not reported; enter it before saving.'}</p>}
  <label className="block">Thing<select required aria-label="Capture Thing" className={input} value={journey} onChange={e=>{setJourney(e.target.value);setNode('');}}><option value="">Choose a Thing</option>{journeys.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select></label>
  <label className="block">Node (optional)<select aria-label="Capture Node" className={input} value={node} onChange={e=>setNode(e.target.value)}><option value="">No Node</option>{nodes.filter(n=>n.journey_id===journey).map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
  <label className="block">Reconstructed intention<input required className={input} placeholder="e.g. Debugging storage synchronization, writing test cases" value={intention} onChange={e=>setIntention(e.target.value)}/></label>
  <div className="grid grid-cols-2 gap-3"><label>Reported duration (minutes)<input type="number" min="1" max="10000000" required className={input} value={duration} onChange={e=>setDuration(e.target.value === '' ? '' : Number(e.target.value))}/></label><label>Reported end (blank means now)<input type="datetime-local" aria-label="Reported end" className={input} value={ended} onChange={e=>setEnded(e.target.value)}/></label></div>
  <label className="block"><input type="checkbox" checked={bounds} onChange={e=>setBounds(e.target.checked)}/> I confirm these estimated bounds represent continuous activity. Otherwise the interval remains unclassified.</label>
  <label className="block">Uncertainty<input aria-label="Uncertainty" className={input} value={uncertainty} onChange={e=>setUncertainty(e.target.value)} placeholder="What is approximate or unknown?"/></label>
  <fieldset className="space-y-3"><legend>Reviewed entries</legend>{reviewed.map((r,i)=><div key={i} className="rounded border border-zinc-700 p-3 space-y-2">
   <select aria-label={'Entry semantics '+(i+1)} className={input} value={r.entry_type} onChange={e=>setReviewed(items=>items.map((item,index)=>index===i?{entry_type:e.target.value as any,note:''}:item))}><option value="NOTE">Note</option><option value="DISCOVERY">Discovery</option><option value="INTENTION_REVISED">Intention revision</option></select>
   <label>Reported entry time (blank means reported end)<input aria-label={'Entry time '+(i+1)} className={input} type="datetime-local" value={r.logged_at||''} onChange={e=>update(i,{logged_at:e.target.value})}/></label>
   {r.entry_type!=='INTENTION_REVISED'&&<textarea aria-label={'Entry note '+(i+1)} className={input} value={r.note||''} onChange={e=>update(i,{note:e.target.value})} placeholder="Reported detail"/>}
   {r.entry_type==='DISCOVERY'&&<><input required aria-label="Discovery name" className={input} placeholder="Discovery name" value={r.discovery_node?.name||''} onChange={e=>update(i,{discovery_node:{...r.discovery_node,name:e.target.value}})}/><select aria-label="Discovery parent" className={input} value={r.discovery_node?.parent_id||''} onChange={e=>update(i,{discovery_node:{name:r.discovery_node?.name||'',parent_id:e.target.value||null}})}><option value="">No parent</option>{nodes.filter(n=>n.journey_id===journey).map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></>}
   {r.entry_type==='INTENTION_REVISED'&&<><input required aria-label="Revised intention" className={input} value={r.new_intention||''} onChange={e=>update(i,{new_intention:e.target.value})}/><input aria-label="Revision reason" className={input} value={r.reason||''} onChange={e=>update(i,{reason:e.target.value})}/></>}
   {reviewed.length>1&&<button type="button" onClick={()=>setReviewed(items=>items.filter((_,index)=>index!==i))}>Remove entry</button>}
  </div>)}<button type="button" onClick={()=>setReviewed(items=>[...items,{entry_type:'NOTE',note:''}])}>Add reviewed entry</button></fieldset>
  <fieldset className="grid grid-cols-2 gap-2"><legend>Reported Condition (unknown until supplied)</legend>{Object.entries({energy:['UNKNOWN','LOW','MEDIUM','HIGH'],focus:['UNKNOWN','SCATTERED','NORMAL','DEEP'],location:['UNKNOWN','HOME','OFFICE','CAFE','TRANSIT','OTHER'],environment:['UNKNOWN','QUIET','AMBIENT','NOISY']}).map(([field,values])=><label key={field}>{field}<select aria-label={`Reported ${field}`} className={input} value={condition[field]} onChange={e=>setCondition({...condition,[field]:e.target.value})}>{values.map(v=><option key={v}>{v}</option>)}</select></label>)}</fieldset>
  <fieldset><legend>Session quality (optional)</legend><div className="flex gap-2">{[['','Skip Rating'],['POOR','Struggled'],['FAIR','Fair'],['GOOD','Good'],['EXCELLENT','Excellent']].map(([v,label])=><button type="button" key={v} aria-pressed={quality===v} onClick={()=>setQuality(v)} className={'rounded border p-2 '+(quality===v?'border-amber-400':'border-zinc-700')}>{label}</button>)}</div></fieldset>
  <button disabled={busy} type="submit" className="rounded bg-amber-400 px-4 py-2 font-bold text-zinc-950">{busy?'Please wait...':'Log Completed Work'}</button>
  </fieldset>
 </form>;
}

