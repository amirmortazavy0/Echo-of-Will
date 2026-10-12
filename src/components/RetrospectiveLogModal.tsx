import React from 'react';
import type {Journey,Node,Condition} from '../types';
import {CaptureForm} from './CaptureForm';
export function RetrospectiveLogModal({isOpen,onClose,journeys,nodes,onSessionLogged}:{isOpen:boolean;onClose:()=>void;journeys:Journey[];nodes:Node[];currentCondition:Condition;onSessionLogged:()=>void}) {
 if(!isOpen)return null;
 return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4"><div role="dialog" aria-label="Log past work" className="mx-auto max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100"><div className="flex justify-between"><h2>Log past work</h2><button onClick={onClose}>Close</button></div><CaptureForm journeys={journeys} nodes={nodes} onSaved={()=>{onSessionLogged();onClose();}}/></div></div>;
}

