import React,{useEffect,useState} from 'react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';
import {flushQueuedLogs,getQueuedLogs,exportPending,pendingStorageWarning} from '../utils/offlineQueue';
export function OfflineIndicator({onSyncComplete}:{onSyncComplete?:()=>void}){
 const online=useOnlineStatus(),[items,setItems]=useState(getQueuedLogs),[busy,setBusy]=useState(false);
 useEffect(()=>{const update=()=>setItems(getQueuedLogs());window.addEventListener('eow:queue',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('eow:queue',update);window.removeEventListener('storage',update);};},[]);
 const retry=async()=>{if(busy)return;setBusy(true);try{const r=await flushQueuedLogs();setItems(getQueuedLogs());if(r.synced)onSyncComplete?.();}finally{setBusy(false);}};
 useEffect(()=>{if(online)void retry();},[online]);
 const warning=pendingStorageWarning();
 if(online&&!items.length&&!warning)return null;
 const download=()=>{const url=URL.createObjectURL(new Blob([exportPending()],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='pending-reports.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <aside aria-label="Pending reports" className="fixed bottom-4 left-4 z-50 max-w-sm rounded-xl bg-zinc-900 border border-amber-600 text-zinc-100 p-3 text-sm">
 <p>{warning&&'Some older or unreadable pending records need explicit recovery review. Their bytes are retained; do not clear browser storage. '}</p>
 <p>{online?'Backend connected':'Backend unavailable — showing last verified local snapshot'}. {items.length} pending report(s).</p>
 {items[0]?.error&&<p role="status">{items[0].error}</p>}
 {!!items.length&&<><button type="button" disabled={busy} onClick={retry} className="underline m-2">{busy?'Sending…':'Retry pending reports'}</button><button type="button" onClick={download} className="underline m-2">Export pending reports</button><p>Rejected reports stay here. Export for recovery; do not resubmit uncertain deliveries as new reports.</p></>}
 </aside>;
}
