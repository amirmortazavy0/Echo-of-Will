import { getSessionEvidence } from '../api';
import { interpretSession } from '../domain/evidence';
import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Lock,
  Edit3,
  Star,
  ChevronRight,
  X,
  History,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { Journey, Node, Session, SessionEntry } from '../types';
import { getCorrections, getSessionEntries, getSessionSummary } from '../api';
import { CorrectionModal } from './CorrectionModal';
import {
  formatEntryType,
  formatLocalDateTime,
  formatLocalTime,
  formatMinutes,
} from '../utils/formatters';

interface SessionHistoryViewProps {
  sessions?: Session[];
  journeys?: Journey[];
  nodes?: Node[];
  onRefresh?: () => Promise<void>;
  onOpenRetrospectiveModal?: () => void;
}

export const SessionHistoryView: React.FC<SessionHistoryViewProps> = ({
  sessions = [],
  journeys = [],
  nodes = [],
  onRefresh = async () => {},
  onOpenRetrospectiveModal,
}) => {
  const [evidence,setEvidence]=useState<any>(null);
  const [detailError,setDetailError]=useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionEntries, setSessionEntries] = useState<SessionEntry[]>([]);
  const [sessionSummary, setSessionSummary] = useState<any | null>(null);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [correctingEntry, setCorrectingEntry] = useState<SessionEntry | null>(null);

  const [filterJourneyId, setFilterJourneyId] = useState<string>('ALL');

  const filteredSessions = (sessions || []).filter((s) =>
    filterJourneyId === 'ALL' ? true : s.journey_id === filterJourneyId
  );

  const openSessionDetail = async (session: Session) => {
    setSelectedSession(session);
    setLoadingDetail(true);setEvidence(null);setDetailError('');setSessionSummary(null);setSessionEntries([]);setCorrections([]);
    try {
      const [entries, summary, corr, original] = await Promise.all([
        getSessionEntries(session.id),
        getSessionSummary(session.id),
        getCorrections(),
        getSessionEvidence(session.id),
      ]);
      const safeEntries = Array.isArray(entries) ? entries : [];
      const safeCorr = Array.isArray(corr) ? corr : [];
      setEvidence(original);
      setSessionEntries(safeEntries);
      setSessionSummary(summary);
      setCorrections(safeCorr.filter((c) => safeEntries.some((e) => e.id === c.entry_id)));
    } catch (err:any) {
      setDetailError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const getQualityBadge = (quality?: string | null) => {
    switch (quality) {
      case 'EXCELLENT':
      case 'GOOD':
        return 'text-emerald-300 bg-emerald-950/60 border-emerald-800';
      case 'FAIR':
        return 'text-sky-300 bg-sky-950/60 border-sky-800';
      case 'POOR':
        return 'text-rose-300 bg-rose-950/60 border-rose-800';
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 pb-16">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Audit Trail & History</h3>
            <p className="text-xs text-zinc-400">
              Chronological log of working sessions and reality as recorded
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs text-zinc-400">Filter Thing:</span>
              <select
                value={filterJourneyId}
                onChange={(e) => setFilterJourneyId(e.target.value)}
                className="py-1 px-3 text-xs bg-zinc-950 border border-zinc-700 rounded-xl text-zinc-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Things ({journeys.length})</option>
                {journeys.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </div>

            {onOpenRetrospectiveModal && (
              <button
                type="button"
                onClick={onOpenRetrospectiveModal}
                className="flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs rounded-xl font-medium transition cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>+ Log Past Work</span>
              </button>
            )}
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-xs">
            No sessions recorded yet. Start tracking or use Quick Log to capture work.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filteredSessions.map((session) => {
              const journey = journeys.find((j) => j.id === session.journey_id);
              const start = new Date(session.started_at);
              const interpreted = interpretSession(session, []);
              const durationMins = session.ended_at && interpreted.validBounds ? Math.round(interpreted.sessionDurationMinutes) : null;

              return (
                <div
                  key={session.id}
                  onClick={() => openSessionDetail(session)}
                  className="py-3 px-3 hover:bg-zinc-800/40 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-semibold text-zinc-200">
                        {formatLocalDateTime(session.started_at)}
                      </span>

                      {/* Explicit Thing Attribution */}
                      {journey && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                          Thing: {journey.name}
                        </span>
                      )}

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md font-mono ${
                          session.status === 'COMPLETE'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : session.status === 'ACTIVE'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {session.status}
                      </span>

                      {session.end_reason === 'JOURNEY_SWITCH' && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-purple-950/60 text-purple-300 border border-purple-800">
                          Transitioned
                        </span>
                      )}

                      {session.quality && (
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                            getQualityBadge(session.quality) || ''
                          }`}
                        >
                          {session.quality}
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-zinc-100 font-medium truncate">
                      "{session.intention}"
                    </div>

                    {session.reflection && (
                      <div className="text-xs text-zinc-400 truncate italic">
                        Reflection: {session.reflection}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {durationMins !== null && (
                      <span className="text-xs font-mono text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        {durationMins}m
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-zinc-100">Session Evidence Detail</h3>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md font-mono ${
                      selectedSession.status === 'COMPLETE'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {selectedSession.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  ID: {selectedSession.id} · {formatLocalDateTime(selectedSession.started_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[calc(85vh-80px)] overflow-y-auto">
              {/* Intention statement */}
              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    Intention (Immutable Record)
                  </span>
                  <span className="text-zinc-400 font-semibold">
                    Thing: {journeys.find((j) => j.id === selectedSession.journey_id)?.name || 'Unknown'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-zinc-100 pt-1">
                  "{selectedSession.intention}"
                </p>
              </div>

              <p className="text-xs text-zinc-400">Intention provenance: {selectedSession.intention_provenance||'legacy_unknown'}. Times and entries below use accepted corrections; originals are retained.</p>
              {detailError&&<p role="alert">{detailError}</p>}
              {evidence&&<details><summary>Original reports, revisions, corrections and conflicts</summary><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(evidence,null,2)}</pre></details>}
              {sessionSummary?.issues?.map((issue:string)=><p key={issue} className="text-amber-300 text-xs">{issue}</p>)}
              {/* Summary Stats */}
              {sessionSummary && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-center">
                      <span className="text-[10px] uppercase text-zinc-500 font-medium block">
                        Active Time
                      </span>
                      <span className="text-base font-semibold font-mono text-emerald-400">
                        {formatMinutes(sessionSummary.activeMinutes)}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-center">
                      <span className="text-[10px] uppercase text-zinc-500 font-medium block">
                        Unclassified
                      </span>
                      <span className="text-base font-semibold font-mono text-amber-400">
                        {formatMinutes(sessionSummary.unclassifiedPauseMinutes)}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-center">
                      <span className="text-[10px] uppercase text-zinc-500 font-medium block">
                        Elapsed
                      </span>
                      <span className="text-base font-semibold font-mono text-zinc-100">
                        {sessionSummary.validBounds ? formatMinutes(sessionSummary.sessionDurationMinutes) : 'Unknown bounds'}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-center">
                      <span className="text-[10px] uppercase text-zinc-500 font-medium block">
                        Discoveries
                      </span>
                      <span className="text-base font-semibold font-mono text-purple-400">
                        {sessionSummary.discoveriesCount}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Reflection & Quality */}
              {(selectedSession.reflection || selectedSession.quality) && (
                <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300">
                      Session Reflection
                    </span>
                    {selectedSession.quality && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                          getQualityBadge(selectedSession.quality) || ''
                        }`}
                      >
                        Quality: {selectedSession.quality}
                      </span>
                    )}
                  </div>
                  {selectedSession.reflection && (
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      {selectedSession.reflection}
                    </p>
                  )}
                </div>
              )}

              {/* Entry Stream */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-300 tracking-wider mb-2.5">
                  Chronological Entry Stream ({sessionEntries.length})
                </h4>

                {loadingDetail ? (
                  <div className="text-center py-4 text-xs text-zinc-500">Loading entries...</div>
                ) : (
                  <div className="space-y-2">
                    {sessionEntries.map((entry) => {
                      const node = nodes.find((n) => n.id === entry.node_id);
                      const discoveryNode = entry.discovery_ref
                        ? nodes.find((n) => n.id === entry.discovery_ref)
                        : null;
                      const entryCorrections = (corrections || []).filter((c) => c.entry_id === entry.id);

                      return (
                        <div
                          key={entry.id}
                          className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-zinc-400">
                                {formatLocalTime(entry.logged_at)}
                              </span>
                              {/* PRODUCT FRIENDLY ENTRY TYPE (NOT RAW TASK_STARTED) */}
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                {formatEntryType(entry.entry_type)}
                              </span>
                              {node && (
                                <span className="text-xs font-medium text-zinc-200">
                                  Task: {node.name}
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => setCorrectingEntry(entry)}
                              className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                            >
                              <History className="w-3 h-3" />
                              <span>Correct</span>
                            </button>
                          </div>

                          {entry.note && (
                            <p className="text-xs text-zinc-300">{entry.note}</p>
                          )}

                          {discoveryNode && (
                            <div className="text-[11px] text-purple-300 bg-purple-950/60 px-2 py-1 rounded border border-purple-800 flex items-center gap-1">
                              <Lightbulb className="w-3 h-3 text-purple-400" />
                              <span>
                                Created Discovery: <strong>{discoveryNode.name}</strong>
                              </span>
                            </div>
                          )}

                          {/* Condition Snapshot */}
                          {entry.condition && (
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono pt-1">
                              <span>⚡ {entry.condition.energy}</span>
                              <span>🎯 {entry.condition.focus}</span>
                              <span>📍 {entry.condition.location}</span>
                              <span>🔊 {entry.condition.environment}</span>
                            </div>
                          )}

                          {/* Applied Corrections */}
                          {entryCorrections.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-zinc-800 space-y-1">
                              <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                <History className="w-3 h-3" />
                                <span>Corrections Layered On Top:</span>
                              </div>
                              {entryCorrections.map((c) => (
                                <div
                                  key={c.id}
                                  className="text-[10px] font-mono p-1.5 bg-amber-950/40 border border-amber-800/80 rounded text-amber-300"
                                >
                                  <span>{c.field}: </span>
                                  <span className="line-through opacity-70">
                                    "{c.original_value}"
                                  </span>{' '}
                                  → <strong>"{c.corrected_value}"</strong>{' '}
                                  {c.reason && (
                                    <span className="text-zinc-400">({c.reason})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Correction Modal */}
      {correctingEntry && (
        <CorrectionModal
          entry={correctingEntry}
          onClose={() => setCorrectingEntry(null)}
          onSaved={() => {
            if (selectedSession) openSessionDetail(selectedSession);
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
