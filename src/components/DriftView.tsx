import React from 'react';
import { interpretSession } from '../domain/evidence';
import type { Journey, Node, Session, SessionEntry } from '../types';
import { formatLocalDateTime, formatMinutes } from '../utils/formatters';
interface Props { journeys:Journey[]; nodes:Node[]; sessions:Session[]; entries:SessionEntry[] }
export const DriftView: React.FC<Props> = ({journeys,sessions,entries}) => (
  <section className="space-y-4">
    <header><h2 className="text-lg font-semibold">Evidence review</h2><p className="text-sm text-zinc-400">Recorded intentions, reports and transitions. Counts and elapsed Session bounds do not classify drift or explain motivation.</p></header>
    {!sessions.length && <p className="text-zinc-400">No Sessions recorded yet.</p>}
    {[...sessions].sort((a,b)=>b.started_at.localeCompare(a.started_at)).map(session=>{
      const records=entries.filter(e=>e.session_id===session.id);
      const switches=records.filter(e=>['CONTEXT_SWITCH','CONTEXT_SWITCH_REQUEST'].includes(e.entry_type)).length;
      const revisions=records.filter(e=>e.entry_type==='INTENTION_REVISED').length;
      const summary=interpretSession(session,records);
      const elapsed=session.ended_at && summary.validBounds ? summary.sessionDurationMinutes : null;
      return <article key={session.id} className="rounded-xl border border-zinc-800 p-4 space-y-2">
        <h3 className="font-medium">{journeys.find(j=>j.id===session.journey_id)?.name || 'Unknown Thing'}</h3>
        <p>{session.intention}</p>
        <p className="text-xs text-zinc-400">{formatMinutes(summary.activeMinutes)} supported activity · {formatMinutes(summary.unclassifiedPauseMinutes)} unclassified · intention: {session.intention_provenance||'legacy_unknown'}</p>
        <p className="text-xs text-zinc-400">{formatLocalDateTime(session.started_at)} · {elapsed===null?'Open Session':`${formatMinutes(elapsed)} bounded elapsed time`} · {records.length} entries · {switches} reported switches · {revisions} intention revisions</p>
        {session.end_reason==='DRIFTED' && <p className="text-xs">User-authored end reason: “Drifted / Off-track”</p>}
        {session.reflection && <blockquote className="text-sm text-zinc-300">User reflection: {session.reflection}</blockquote>}
      </article>;
    })}
  </section>
);
