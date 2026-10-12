import React from 'react';
import type {Journey,Node,OllamaStatus} from '../types';
import {CaptureForm} from './CaptureForm';
export function LogChatView({journeys=[],nodes=[],onSessionLogged=()=>{},onOpenSettings}: {journeys?:Journey[];nodes?:Node[];ollamaStatus?:OllamaStatus|null;onOpenSettings?:()=>void;onSessionLogged?:()=>void;onNavigateToTasks?:()=>void;onOpenNewThingModal?:()=>void}) {
 return <section className="mx-auto max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="mb-4 flex justify-between"><h2>Report past work</h2><button onClick={onOpenSettings}>Local AI settings</button></div><CaptureForm journeys={journeys} nodes={nodes} onSaved={onSessionLogged}/></section>;
}

