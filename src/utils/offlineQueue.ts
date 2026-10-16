import type { QuickLogPayload } from '../types';
export interface QueuedQuickLog { id:string; owner:string; queuedAt:string; payload:QuickLogPayload; error?:string }
const prefix='eow-pending:';
export function cachedIdentity(): {username:string;token:string}|null {
  try {const v=JSON.parse(localStorage.getItem('eow-verified-owner')||'null');return v?.token===(localStorage.getItem('token')||localStorage.getItem('hd_auth_token'))?v:null;}catch{return null;}
}
export function rememberIdentity(username:string,token:string){localStorage.setItem('eow-verified-owner',JSON.stringify({username,token}));}
export function getQueuedLogs():QueuedQuickLog[]{
  const owner=cachedIdentity()?.username;if(!owner)return [];
  return Object.keys(localStorage).filter(k=>k.startsWith(prefix)).map(k=>{try{return JSON.parse(localStorage.getItem(k)!);}catch{return null;}}).filter(v=>v?.owner===owner && typeof v.id==='string' && typeof v.queuedAt==='string' && v.payload && typeof v.payload==='object').sort((a,b)=>a.queuedAt.localeCompare(b.queuedAt));
}
const changed=()=>window.dispatchEvent(new Event('eow:queue'));
export function enqueueLog(payload:QuickLogPayload):QueuedQuickLog{
 const owner=cachedIdentity()?.username;if(!owner)throw Error('Sign in online once before saving pending reports.');
 const queuedAt=new Date().toISOString();
 const item={id:crypto.randomUUID(),owner,queuedAt,payload:{...structuredClone(payload),client_confirmed_at:queuedAt}};
 // One key per command prevents concurrent tabs from overwriting each other's additions.
 localStorage.setItem(prefix+item.id,JSON.stringify(item));changed();return item;
}
export function removeQueuedLog(id:string){const item=getQueuedLogs().find(q=>q.id===id);if(item){localStorage.removeItem(prefix+id);changed();}}
export function exportPending():string{return JSON.stringify(getQueuedLogs(),null,2);}
async function send(item:QueuedQuickLog):Promise<boolean>{
 const identity=cachedIdentity();if(!identity||identity.username!==item.owner)return false;
 try{
  const res=await fetch('/api/sessions/quick-log',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+identity.token,'Idempotency-Key':item.id},body:JSON.stringify(item.payload),signal:AbortSignal.timeout(15000)});
  if(res.ok){removeQueuedLog(item.id);return true;}
  const body=await res.json().catch(()=>({}));item.error=res.status===401?'Sign in again to send this pending report.':body.detail||'Server rejected this report. Export it for review; it remains on this device.';
 }catch{item.error='Backend unavailable. Saved on this device; retry when connected.';}
 try{localStorage.setItem(prefix+item.id,JSON.stringify(item));}catch{/* The original durable item remains available even if its error message cannot fit. */}changed();return false;
}
export async function flushQueuedLogs(onLogSynced?:(item:QueuedQuickLog)=>void){
 const run=async()=>{let synced=0,failed=0;for(const item of getQueuedLogs()){if(await send(item)){synced++;onLogSynced?.(item);}else {failed++;break;}}return {synced,failed};};
 return navigator.locks?navigator.locks.request('eow-outbox',run):run();
}

export function pendingStorageWarning():boolean {
 try {if(localStorage.getItem('human_drift_queued_logs') && localStorage.getItem('human_drift_queued_logs')!=='[]')return true;
 return Object.keys(localStorage).filter(k=>k.startsWith(prefix)).some(k=>{try{const v=JSON.parse(localStorage.getItem(k)!);return !v?.owner||typeof v.id!=='string'||typeof v.queuedAt!=='string'||!v.payload;}catch{return true;}});
 }catch{return true;}
}
