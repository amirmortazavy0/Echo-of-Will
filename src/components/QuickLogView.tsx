import React from 'react';
import type {Journey,Node} from '../types';
import {CaptureForm} from './CaptureForm';
export function QuickLogView({journeys,nodes,onLogCommitted,prefilledPrompt}:{journeys:Journey[];nodes:Node[];currentJourney:Journey|null;onLogCommitted:()=>Promise<void>;prefilledPrompt?:string;onClearPrefill?:()=>void}) {
 return <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="mb-4 text-lg">Report past work</h2><CaptureForm key={prefilledPrompt||'capture'} initialText={prefilledPrompt} journeys={journeys} nodes={nodes} onSaved={()=>{void onLogCommitted();}}/></div>;
}

