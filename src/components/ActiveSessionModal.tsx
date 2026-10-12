import React,{useEffect,useState} from 'react';
import type {Condition,EntryType,Journey,Node,Session,SessionEntry,SessionQuality} from '../types';
import {logSessionEntry,completeSession,reviseIntention,switchJourneySession,getSessionEntries} from '../api';
import {CorrectionModal} from './CorrectionModal';
export function ActiveSessionModal({isOpen,onClose,session,journey,node,nodes,journeys,currentCondition,onSessionEnded,onEntryAdded,onSessionSwitched}:{isOpen:boolean;onClose:()=>void;session:Session;journey?:Journey;node?:Node;nodes:Node[];journeys:Journey[];currentCondition:Condition;onConditionChange?:(c:Condition)=>void;onSessionEnded:()=>void;onEntryAdded:()=>void;onSessionSwitched:(s:Session)=>void}) {
 const [kind,setKind]=useState<EntryType>('NOTE'),[note,setNote]=useState(''),[target,setTarget]=useState(node?.id||''),[discovery,setDiscovery]=useState(''),[parent,setParent]=useState('');
 const [condition,setCondition]=useState(currentCondition),[entries,setEntries]=useState<SessionEntry[]>([]),[correcting,setCorrecting]=useState<SessionEntry|null>(null);
 const [revision,setRevision]=useState(''),[reason,setReason]=useState(''),[destination,setDestination]=useState(''),[destNode,setDestNode]=useState('');
 const [ending,setEnding]=useState(false),[quality,setQuality]=useState<SessionQuality|null>(null),[endReason,setEndReason]=useState<any>('NATURAL_COMPLETION'),[reflection,setReflection]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const input='w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-zinc-100';
 const refresh=async()=>{const list=await getSessionEntries(session.id);setEntries(list);if(list.length)setCondition(list.at(-1)!.condition);};
 useEffect(()=>{if(isOpen){setTarget(node?.id||'');setNote('');setRevision('');setReason('');setEnding(false);void refresh().catch(e=>setError(e.message));}},[session.id,isOpen]);
 if(!isOpen)return null;
 const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action();}catch(e:any){setError(e.message);}finally{setBusy(false);}};
 const submit=(e:React.FormEvent)=>{e.preventDefault();void run(async()=>{
  await logSessionEntry(session.id,{entry_type:kind,node_id:target||null,note:note||null,condition,...(kind==='DISCOVERY'?{discovery_node:{name:discovery,parent_id:parent||null,description:note}}:{})});
  setNote('');setDiscovery('');await refresh();onEntryAdded();
 });};
 return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4"><div role="dialog" aria-label="Tracking Session" className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100">
 <div className="flex justify-between"><h2>Tracking Session</h2><button onClick={onClose} aria-label="Close">Close</button></div>
 <p>{journey?.name}</p><h3>"{session.intention}"</h3><p className="text-xs text-zinc-400">Original intention is preserved. Revisions are appended below.</p>
 {error&&<p role="alert" className="text-red-300">{error}</p>}
 <fieldset className="grid grid-cols-2 gap-2"><legend>Condition for next entry</legend>{Object.entries({energy:['UNKNOWN','LOW','MEDIUM','HIGH'],focus:['UNKNOWN','SCATTERED','NORMAL','DEEP'],location:['UNKNOWN','HOME','OFFICE','CAFE','TRANSIT','OTHER'],environment:['UNKNOWN','QUIET','AMBIENT','NOISY']}).map(([field,values])=><label key={field}>{field}<select aria-label={'Live '+field} className={input} value={condition[field]} onChange={e=>setCondition({...condition,[field]:e.target.value})}>{values.map(v=><option key={v}>{v}</option>)}</select></label>)}</fieldset>
 <form onSubmit={submit} className="space-y-3">
 <div className="flex flex-wrap gap-2">{[['NOTE','Quick Note'],['TASK_STARTED','Start task'],['TASK_PAUSED','Pause task'],['TASK_COMPLETED','Complete task'],['DISCOVERY','Discovery'],['CONTEXT_SWITCH','Switch Node'],['CONDITION_CHANGED','Condition change']].map(([value,label])=><button key={value} type="button" aria-pressed={kind===value} className="rounded border p-2" onClick={()=>setKind(value as EntryType)}>{label}</button>)}</div>
 <label>Node / switch destination<select aria-label="Live Node" className={input} required={kind==='CONTEXT_SWITCH'} value={target} onChange={e=>setTarget(e.target.value)}><option value="">No Node</option>{nodes.filter(n=>n.journey_id===session.journey_id).map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
 {kind==='DISCOVERY'&&<><input required aria-label="Live discovery name" className={input} value={discovery} onChange={e=>setDiscovery(e.target.value)} placeholder="Discovery name"/><select aria-label="Live discovery parent" className={input} value={parent} onChange={e=>setParent(e.target.value)}><option value="">No parent</option>{nodes.filter(n=>n.journey_id===session.journey_id).map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></>}
 <textarea className={input} placeholder="What happened or what did you accomplish?" value={note} onChange={e=>setNote(e.target.value)}/>
 <button disabled={busy} type="submit" className="rounded bg-amber-400 p-2 text-zinc-950">Record Entry</button>
 </form>
 <details><summary>Revise intention or move to another Thing</summary><div className="space-y-2 pt-3">
 <input aria-label="New intention" className={input} placeholder="New intention" value={revision} onChange={e=>setRevision(e.target.value)}/>
 <input aria-label="Change reason" className={input} placeholder="Why is it changing?" value={reason} onChange={e=>setReason(e.target.value)}/>
 <button disabled={busy||!revision.trim()} onClick={()=>run(async()=>{await reviseIntention(session.id,{new_intention:revision,reason,condition});setRevision('');setReason('');await refresh();onEntryAdded();})}>Append intention revision</button>
 <select aria-label="Destination Thing" className={input} value={destination} onChange={e=>{setDestination(e.target.value);setDestNode('');}}><option value="">Choose another Thing</option>{journeys.filter(j=>j.id!==session.journey_id).map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select>
 <select aria-label="Destination Node" className={input} value={destNode} onChange={e=>setDestNode(e.target.value)}><option value="">No Node</option>{nodes.filter(n=>n.journey_id===destination).map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select>
 <button disabled={busy||!destination||!revision.trim()} onClick={()=>run(async()=>{const result=await switchJourneySession(session.id,{target_journey_id:destination,target_node_id:destNode||null,new_intention:revision,switch_reason:reason,condition});onSessionSwitched(result.new_session);})}>Move to selected Thing</button>
 </div></details>
 <details><summary>Entries and corrections ({entries.length})</summary>{entries.map(e=><div key={e.id} className="border-b border-zinc-700 py-2"><p>{e.entry_type}: {e.note}</p><button onClick={()=>setCorrecting(e)}>Correct entry</button></div>)}</details>
 <button onClick={()=>setEnding(!ending)}>Conclude Tracking</button>
 {ending&&<div className="space-y-3"><label>End reason<select aria-label="End reason" className={input} value={endReason} onChange={e=>setEndReason(e.target.value)}>{['NATURAL_COMPLETION','INTERRUPTED','DRIFTED','ENERGY_DEPLETED','PAUSED','INCOMPLETE'].map(v=><option key={v}>{v}</option>)}</select></label><textarea aria-label="Reflection" className={input} value={reflection} onChange={e=>setReflection(e.target.value)}/>
 <div className="flex gap-2">{[['','Skip Rating'],['POOR','Struggled'],['FAIR','Fair'],['GOOD','Good'],['EXCELLENT','Excellent']].map(([v,label])=><button key={v} aria-pressed={quality===v} onClick={()=>setQuality(v as SessionQuality||null)}>{label}</button>)}</div>
 <button disabled={busy} onClick={()=>run(async()=>{await completeSession(session.id,{end_reason:endReason,quality,reflection});onSessionEnded();onClose();})}>End Session</button></div>}
 {correcting&&<CorrectionModal entry={correcting} onClose={()=>setCorrecting(null)} onSaved={()=>{void refresh();onEntryAdded();}}/>}
 </div></div>;
}

