import React, { useState, useEffect } from 'react';
import {
  Lock,
  Play,
  CheckCircle,
  Pause,
  Shuffle,
  Lightbulb,
  Edit3,
  MessageSquare,
  Square,
  Zap,
  Target,
  MapPin,
  Volume2,
  Clock,
  History,
  AlertCircle,
  Plus,
} from 'lucide-react';
import {
  Condition,
  EnergyLevel,
  EnvironmentType,
  FocusLevel,
  Journey,
  LocationType,
  Node,
  NodeType,
  Session,
  SessionEntry,
  SessionQuality,
  SessionSummaryResult,
} from '../types';
import {
  createSessionEntry,
  endSession,
  getSessionEntries,
  getSessionSummary,
  reviseIntention,
  switchJourneySession,
} from '../api';
import { formatEntryType, formatLocalTime } from '../utils/formatters';
import { CorrectionModal } from './CorrectionModal';

interface ActiveSessionLoggerProps {
  session: Session;
  journey: Journey;
  nodes: Node[];
  journeys?: Journey[];
  onSessionEnded: () => Promise<void>;
  onSessionSwitched?: (newSession: Session, targetJourney: Journey) => Promise<void>;
  onRefreshNodes: () => Promise<void>;
}

export const ActiveSessionLogger: React.FC<ActiveSessionLoggerProps> = ({
  session,
  journey,
  nodes,
  journeys = [],
  onSessionEnded,
  onSessionSwitched,
  onRefreshNodes,
}) => {
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryResult | null>(null);

  // Active Task Tracking
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Sticky Condition state (Rule: carries forward, only changes when tapped)
  const [condition, setCondition] = useState<Condition>({
    energy: 'HIGH',
    focus: 'DEEP',
    location: 'HOME',
    environment: 'QUIET',
  });

  // Elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Modals / Action states
  const [modalType, setModalType] = useState<
    | 'START_TASK'
    | 'SWITCH_CONTEXT'
    | 'DISCOVERY'
    | 'REVISE_INTENTION'
    | 'ADD_NOTE'
    | 'END_SESSION'
    | 'SWITCH_JOURNEY'
    | null
  >(null);

  // Correction Modal
  const [correctingEntry, setCorrectingEntry] = useState<SessionEntry | null>(null);

  // Action Form Inputs
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [quickNewNodeName, setQuickNewNodeName] = useState('');
  const [quickNewNodeType, setQuickNewNodeType] = useState<NodeType>('TASK');
  const [actionNote, setActionNote] = useState('');

  // Discovery Form Inputs
  const [discoveryName, setDiscoveryName] = useState('');
  const [discoveryType, setDiscoveryType] = useState<NodeType>('TASK');
  const [discoveryParentId, setDiscoveryParentId] = useState<string>('');
  const [discoveryDescription, setDiscoveryDescription] = useState('');

  // Intention Revision Form Inputs
  const [newIntention, setNewIntention] = useState('');
  const [revisionReason, setRevisionReason] = useState('');

  // Journey Switch Form Inputs (Decision 2)
  const [targetJourneyId, setTargetJourneyId] = useState('');
  const [targetNodeId, setTargetNodeId] = useState('');
  const [switchIntention, setSwitchIntention] = useState('');
  const [switchReason, setSwitchReason] = useState('');

  // End Tracking Form Inputs
  const [reflection, setReflection] = useState('');
  const [quality, setQuality] = useState<SessionQuality>('GOOD');
  const [endStatus, setEndStatus] = useState<'COMPLETE' | 'INCOMPLETE'>('COMPLETE');

  // Submitting state
  const [submitting, setSubmitting] = useState(false);

  // Load entries and summary (Decision 1)
  const refreshEntries = async () => {
    try {
      const [data, summary] = await Promise.all([
        getSessionEntries(session.id),
        getSessionSummary(session.id).catch(() => null),
      ]);
      setEntries(data);
      if (summary) setSessionSummary(summary);

      if (data.length > 0) {
        // Update sticky condition from most recent entry
        const latest = data[data.length - 1];
        setCondition(latest.condition);

        // Find current active task
        for (let i = data.length - 1; i >= 0; i--) {
          const e = data[i];
          if (e.entry_type === 'TASK_STARTED' || e.entry_type === 'CONTEXT_SWITCH') {
            setActiveNodeId(e.node_id || null);
            break;
          } else if (
            e.entry_type === 'TASK_COMPLETED' ||
            e.entry_type === 'TASK_PAUSED'
          ) {
            setActiveNodeId(null);
            break;
          }
        }
      }
    } catch (err) {
      console.error('Failed to load session entries:', err);
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    refreshEntries();
  }, [session.id]);

  // Timer
  useEffect(() => {
    const startMs = new Date(session.started_at).getTime();
    if (session.ended_at) {
      const endMs = new Date(session.ended_at).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((endMs - startMs) / 1000)));
      return;
    }
    const updateElapsed = () => {
      const nowMs = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((nowMs - startMs) / 1000)));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [session.started_at, session.ended_at]);

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${m}m ${s}s`;
  };

  // Condition toggles (sticky)
  const updateStickyCondition = (updates: Partial<Condition>) => {
    setCondition((prev) => ({ ...prev, ...updates }));
  };

  // --- ACTIONS ---

  // 1. Start Thing
  const handleStartTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let targetNodeId = selectedNodeId;

      // Quick create node if selected
      if (!targetNodeId && quickNewNodeName.trim()) {
        const res = await createSessionEntry(session.id, {
          entry_type: 'TASK_STARTED',
          note: actionNote.trim() || undefined,
          condition,
          discovery_node: {
            name: quickNewNodeName.trim(),
            node_type: quickNewNodeType,
          },
        });
        targetNodeId = res.discovery_node?.id || '';
        await onRefreshNodes();
      } else {
        await createSessionEntry(session.id, {
          entry_type: 'TASK_STARTED',
          node_id: targetNodeId || undefined,
          note: actionNote.trim() || undefined,
          condition,
        });
      }

      setActiveNodeId(targetNodeId || null);
      setModalType(null);
      resetActionForm();
      await refreshEntries();
    } catch (err: any) {
      alert(`Error starting task: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Complete Task
  const handleCompleteTask = async () => {
    if (!activeNodeId) return;
    setSubmitting(true);
    try {
      await createSessionEntry(session.id, {
        entry_type: 'TASK_COMPLETED',
        node_id: activeNodeId,
        condition,
      });
      setActiveNodeId(null);
      await refreshEntries();
      await onRefreshNodes();
    } catch (err: any) {
      alert(`Error completing task: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Pause Task
  const handlePauseTask = async () => {
    if (!activeNodeId) return;
    setSubmitting(true);
    try {
      await createSessionEntry(session.id, {
        entry_type: 'TASK_PAUSED',
        node_id: activeNodeId,
        condition,
      });
      setActiveNodeId(null);
      await refreshEntries();
      await onRefreshNodes();
    } catch (err: any) {
      alert(`Error pausing task: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Switch Context
  const handleSwitchContext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNodeId) return;
    setSubmitting(true);
    try {
      await createSessionEntry(session.id, {
        entry_type: 'CONTEXT_SWITCH',
        node_id: selectedNodeId,
        note: actionNote.trim() || undefined,
        condition,
      });
      setActiveNodeId(selectedNodeId);
      setModalType(null);
      resetActionForm();
      await refreshEntries();
    } catch (err: any) {
      alert(`Error switching context: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Log Discovery (Rule 4: Creates node and preserves lineage via discovery_ref)
  const handleLogDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discoveryName.trim()) return;
    setSubmitting(true);
    try {
      await createSessionEntry(session.id, {
        entry_type: 'DISCOVERY',
        node_id: activeNodeId,
        note: actionNote.trim() || undefined,
        condition,
        discovery_node: {
          name: discoveryName.trim(),
          node_type: discoveryType,
          parent_id: discoveryParentId || activeNodeId || undefined,
          description: discoveryDescription.trim() || undefined,
        },
      });
      await onRefreshNodes();
      setModalType(null);
      setDiscoveryName('');
      setDiscoveryDescription('');
      setActionNote('');
      await refreshEntries();
    } catch (err: any) {
      alert(`Error recording discovery: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Revise Plan (Rule 2: Never overwrite original intention)
  const handleReviseIntention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIntention.trim()) return;
    setSubmitting(true);
    try {
      await reviseIntention(session.id, {
        new_intention: newIntention.trim(),
        reason: revisionReason.trim() || undefined,
        condition,
      });
      setModalType(null);
      setNewIntention('');
      setRevisionReason('');
      await refreshEntries();
    } catch (err: any) {
      alert(`Error revising intention: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 7. Add Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionNote.trim()) return;
    setSubmitting(true);
    try {
      await createSessionEntry(session.id, {
        entry_type: 'NOTE',
        node_id: activeNodeId,
        note: actionNote.trim(),
        condition,
      });
      setModalType(null);
      setActionNote('');
      await refreshEntries();
    } catch (err: any) {
      alert(`Error adding note: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 8. End Tracking
  const handleEndSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await endSession(session.id, {
        reflection: reflection.trim() || undefined,
        quality,
        status: endStatus,
        end_reason: 'NATURAL_COMPLETION',
      });
      await onSessionEnded();
    } catch (err: any) {
      alert(`Error completing session: ${err.message}`);
      setSubmitting(false);
    }
  };

  // 9. Switch context (Architecture Decision 2: Cross-Journey Session Scope)
  const handleSwitchJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetJourneyId || !switchIntention.trim()) return;
    setSubmitting(true);
    try {
      const res = await switchJourneySession(session.id, {
        target_journey_id: targetJourneyId,
        target_node_id: targetNodeId || undefined,
        new_intention: switchIntention.trim(),
        switch_reason: switchReason.trim() || undefined,
        condition,
      });

      setModalType(null);
      const targetJourney = journeys.find((j) => j.id === targetJourneyId) || {
        id: targetJourneyId,
        name: 'Target Journey',
        description: null,
        status: 'ACTIVE' as const,
        visibility: 'PRIVATE' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (onSessionSwitched) {
        await onSessionSwitched(res.new_session, targetJourney);
      } else {
        await onSessionEnded();
      }
    } catch (err: any) {
      alert(`Error transitioning journey session: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetActionForm = () => {
    setSelectedNodeId('');
    setQuickNewNodeName('');
    setActionNote('');
  };

  // Find all revisions in entries
  const intentionRevisions = (entries || []).filter((e) => e.entry_type === 'INTENTION_REVISED');
  const activeNode = (nodes || []).find((n) => n.id === activeNodeId);

  return (
    <div className="space-y-4">
      {/* Top Banner: Locked Intention & Revisions */}
      <div className="bg-stone-900 text-stone-100 rounded-xl p-5 shadow-md border border-stone-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3.5 mb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs uppercase tracking-wider font-semibold text-stone-300">
              Active Session
            </span>
            <span className="text-stone-500">·</span>
            <span className="text-xs text-stone-400">{journey.name}</span>
            {session.predecessor_session_id && (
              <span className="text-3xs font-mono px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800" title={`Continued from ${session.predecessor_session_id}`}>
                ↰ Linked Successor
              </span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-3 text-xs font-mono">
            {/* Decision 1: Live Duration Breakdown */}
            <div className="flex items-center gap-3 bg-stone-800/80 px-2.5 py-1 rounded-md border border-stone-700/60">
              <div className="text-emerald-400 font-semibold" title="Active task time">
                Active: {sessionSummary ? `${sessionSummary.activeMinutes}m` : '0m'}
              </div>
              <span className="text-stone-600">|</span>
              <div className="text-amber-400 font-semibold" title="Unclassified context pause">
                Pause: {sessionSummary ? `${sessionSummary.unclassifiedPauseMinutes}m` : '0m'}
              </div>
              <span className="text-stone-600">|</span>
              <div className="flex items-center gap-1 text-stone-300">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span>Elapsed: {formatDuration(elapsedSeconds)}</span>
              </div>
            </div>

            {/* Decision 2: Switch context Action */}
            <button
              onClick={() => {
                const otherJourneys = (journeys || []).filter((j) => j.id !== journey.id);
                if (otherJourneys.length > 0) {
                  setTargetJourneyId(otherJourneys[0].id);
                }
                setSwitchIntention(`Continue work transitioned from ${journey.name}`);
                setSwitchReason('');
                setTargetNodeId('');
                setModalType('SWITCH_JOURNEY');
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-md text-xs font-medium transition-colors cursor-pointer"
              title="End this session (reason: JOURNEY_SWITCH) and start a linked successor session in another Journey"
            >
              <Shuffle className="w-3 h-3" />
              <span>Switch context</span>
            </button>

            <button
              onClick={() => setModalType('END_SESSION')}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium transition-colors cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>End Tracking</span>
            </button>
          </div>
        </div>

        {/* Intention Display */}
        <div>
          <div className="flex items-start gap-2 mb-1">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
            <div>
              <div className="text-2xs uppercase tracking-wider text-amber-400/90 font-mono">
                Original Locked Intention
              </div>
              <div className="text-lg font-serif text-white tracking-tight leading-snug">
                "{session.intention}"
              </div>
            </div>
          </div>

          {/* Intention Revisions Lineage */}
          {intentionRevisions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-800/80 space-y-2">
              <div className="text-2xs uppercase tracking-wider text-stone-400 font-mono">
                Intention Revisions ({intentionRevisions.length})
              </div>
              {intentionRevisions.map((rev) => (
                <div
                  key={rev.id}
                  className="p-2.5 bg-stone-800/60 rounded-lg text-xs border border-stone-700/60 flex items-start gap-2"
                >
                  <Edit3 className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-stone-200 font-medium">"{rev.note}"</span>
                    <span className="text-stone-500 text-2xs block mt-0.5 font-mono">
                      Logged at {new Date(rev.logged_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Condition Bar */}
      <div className="bg-white border border-stone-200 rounded-xl p-3.5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xs font-semibold uppercase tracking-wider text-stone-500">
            Current Condition (Sticky Defaults · Carries Forward)
          </span>
          <span className="text-2xs text-stone-400">Tap to toggle circumstance</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Energy */}
          <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
            <div className="text-2xs text-stone-500 flex items-center gap-1 mb-1 font-medium">
              <Zap className="w-3 h-3 text-amber-500" /> Energy
            </div>
            <div className="flex gap-1">
              {(['LOW', 'MEDIUM', 'HIGH'] as EnergyLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => updateStickyCondition({ energy: lvl })}
                  className={`flex-1 py-1 text-2xs font-mono font-medium rounded-sm transition-colors ${
                    condition.energy === lvl
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {lvl[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Focus */}
          <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
            <div className="text-2xs text-stone-500 flex items-center gap-1 mb-1 font-medium">
              <Target className="w-3 h-3 text-sky-500" /> Focus
            </div>
            <div className="flex gap-1">
              {(['SCATTERED', 'NORMAL', 'DEEP'] as FocusLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => updateStickyCondition({ focus: lvl })}
                  className={`flex-1 py-1 text-2xs font-mono font-medium rounded-sm transition-colors ${
                    condition.focus === lvl
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-white text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {lvl === 'SCATTERED' ? 'S' : lvl === 'NORMAL' ? 'N' : 'D'}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
            <div className="text-2xs text-stone-500 flex items-center gap-1 mb-1 font-medium">
              <MapPin className="w-3 h-3 text-rose-500" /> Location
            </div>
            <select
              value={condition.location}
              onChange={(e) => updateStickyCondition({ location: e.target.value as LocationType })}
              className="w-full py-1 px-1.5 text-2xs font-medium bg-white border border-stone-200 rounded-sm text-stone-800"
            >
              <option value="HOME">Home</option>
              <option value="CAFE">Cafe</option>
              <option value="OFFICE">Office</option>
              <option value="TRANSIT">Transit</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Environment */}
          <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
            <div className="text-2xs text-stone-500 flex items-center gap-1 mb-1 font-medium">
              <Volume2 className="w-3 h-3 text-emerald-500" /> Environment
            </div>
            <select
              value={condition.environment}
              onChange={(e) => updateStickyCondition({ environment: e.target.value as EnvironmentType })}
              className="w-full py-1 px-1.5 text-2xs font-medium bg-white border border-stone-200 rounded-sm text-stone-800"
            >
              <option value="QUIET">Quiet</option>
              <option value="AMBIENT">Ambient</option>
              <option value="NOISY">Noisy</option>
            </select>
          </div>
        </div>
      </div>

      {/* Primary Tap Action Controls */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-stone-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">
              Moment of the Tap
            </span>
            {activeNode ? (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                <Play className="w-3 h-3 fill-current text-emerald-600" />
                <span>Active Thing: {activeNode.name}</span>
              </span>
            ) : (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                <Pause className="w-3 h-3 text-amber-600" />
                <span>Unclassified Context Pause</span>
              </span>
            )}
          </div>
          <span className="text-2xs text-stone-400 font-mono">
            {activeNode ? 'Time actively logged to task' : 'Gap-time defaults to Unclassified Context Pause (AD-001)'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {/* Start Thing */}
          <button
            onClick={() => {
              setSelectedNodeId(activeNodeId || '');
              setModalType('START_TASK');
            }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 text-emerald-600 mb-1" />
            <span className="text-2xs font-semibold">Start Thing</span>
          </button>

          {/* Complete Task */}
          <button
            disabled={!activeNodeId || submitting}
            onClick={handleCompleteTask}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4 text-sky-600 mb-1" />
            <span className="text-2xs font-semibold">Complete</span>
          </button>

          {/* Pause Task */}
          <button
            disabled={!activeNodeId || submitting}
            onClick={handlePauseTask}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Pause className="w-4 h-4 text-amber-600 mb-1" />
            <span className="text-2xs font-semibold">Pause</span>
          </button>

          {/* Context Switch */}
          <button
            onClick={() => {
              setSelectedNodeId('');
              setModalType('SWITCH_CONTEXT');
            }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 transition-colors cursor-pointer"
          >
            <Shuffle className="w-4 h-4 text-purple-600 mb-1" />
            <span className="text-2xs font-semibold">Switch Context</span>
          </button>

          {/* Switch context (AD-002) */}
          <button
            onClick={() => {
              const otherJourneys = (journeys || []).filter((j) => j.id !== journey.id);
              if (otherJourneys.length > 0) {
                setTargetJourneyId(otherJourneys[0].id);
              }
              setSwitchIntention(`Continue work transitioned from ${journey.name}`);
              setSwitchReason('');
              setTargetNodeId('');
              setModalType('SWITCH_JOURNEY');
            }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 transition-colors cursor-pointer"
            title="Switch context (AD-002): completes session and starts linked successor in new journey"
          >
            <Shuffle className="w-4 h-4 text-purple-700 mb-1" />
            <span className="text-2xs font-semibold text-purple-800">Switch context</span>
          </button>

          {/* Discovery */}
          <button
            onClick={() => {
              setDiscoveryName('');
              setModalType('DISCOVERY');
            }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-amber-50/60 hover:bg-amber-100/70 border border-amber-200 text-amber-900 transition-colors cursor-pointer"
          >
            <Lightbulb className="w-4 h-4 text-amber-600 mb-1" />
            <span className="text-2xs font-semibold">Log Discovery</span>
          </button>

          {/* Revise Plan */}
          <button
            onClick={() => {
              setNewIntention('');
              setModalType('REVISE_INTENTION');
            }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 transition-colors cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-stone-600 mb-1" />
            <span className="text-2xs font-semibold">Revise Plan</span>
          </button>

          {/* Note */}
          <button
            onClick={() => {
              setActionNote('');
              setModalType('ADD_NOTE');
            }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-stone-600 mb-1" />
            <span className="text-2xs font-semibold">Add Note</span>
          </button>
        </div>
      </div>

      {/* Live Chronological Entry Stream */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-stone-100">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Tracking Evidence Log</h3>
            <p className="text-2xs text-stone-500">
              Atomic SessionEntries with attached condition snapshots
            </p>
          </div>
          <span className="text-xs font-mono text-stone-500">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {loadingEntries ? (
          <div className="text-center py-8 text-xs text-stone-400">Loading entries...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-xs">
            No entries logged yet. Tap a button above to record reality.
          </div>
        ) : (
          <div className="space-y-2.5">
            {[...entries].reverse().map((entry) => {
              const node = nodes.find((n) => n.id === entry.node_id);
              const discoveryNode = entry.discovery_ref
                ? nodes.find((n) => n.id === entry.discovery_ref)
                : null;

              return (
                <div
                  key={entry.id}
                  className="p-3 bg-stone-50/80 hover:bg-stone-100/80 border border-stone-200/80 rounded-lg flex items-start justify-between gap-3 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-2xs text-stone-500">
                        {formatLocalTime(entry.logged_at)}
                      </span>

                      <span
                        className={`text-2xs font-semibold px-2 py-0.5 rounded-md font-mono ${
                          entry.entry_type === 'TASK_STARTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : entry.entry_type === 'TASK_COMPLETED'
                            ? 'bg-sky-100 text-sky-800'
                            : entry.entry_type === 'TASK_PAUSED'
                            ? 'bg-amber-100 text-amber-800'
                            : entry.entry_type === 'DISCOVERY'
                            ? 'bg-purple-100 text-purple-800'
                            : entry.entry_type === 'INTENTION_REVISED'
                            ? 'bg-rose-100 text-rose-800'
                            : entry.entry_type === 'CONTEXT_SWITCH'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-stone-200 text-stone-800'
                        }`}
                      >
                        {formatEntryType(entry.entry_type)}
                      </span>

                      {node && (
                        <span className="text-xs font-medium text-stone-900">
                          {node.name}
                        </span>
                      )}

                      {discoveryNode && (
                        <span className="text-xs font-medium text-purple-900 bg-purple-50 px-1.5 py-0.5 rounded-sm border border-purple-200">
                          ✦ Discovery Node: {discoveryNode.name}
                        </span>
                      )}
                    </div>

                    {entry.note && (
                      <p className="text-xs text-stone-700 font-serif leading-relaxed">
                        {entry.note}
                      </p>
                    )}

                    {/* Condition Chips */}
                    <div className="flex items-center gap-2 pt-1 text-2xs text-stone-500 font-mono">
                      <span>⚡ {entry.condition.energy}</span>
                      <span>🎯 {entry.condition.focus}</span>
                      <span>📍 {entry.condition.location}</span>
                      <span>🔊 {entry.condition.environment}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setCorrectingEntry(entry)}
                    title="Correct this entry (preserves original history)"
                    className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200 shrink-0"
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- ACTION MODALS --- */}

      {/* Start Thing Modal */}
      {modalType === 'START_TASK' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl shadow-xl p-5">
            <h3 className="text-sm font-semibold text-stone-900 mb-2">Start Thing</h3>
            <form onSubmit={handleStartTask} className="space-y-3">
              <div>
                <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                  Select Existing Node
                </label>
                <select
                  value={selectedNodeId}
                  onChange={(e) => setSelectedNodeId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                >
                  <option value="">-- Or quick-create new node below --</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      [{n.node_type}] {n.name}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedNodeId && (
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
                  <div className="text-2xs font-semibold text-stone-500 uppercase">
                    Quick Create New Node
                  </div>
                  <input
                    type="text"
                    value={quickNewNodeName}
                    onChange={(e) => setQuickNewNodeName(e.target.value)}
                    placeholder="New Node Name"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md"
                  />
                  <select
                    value={quickNewNodeType}
                    onChange={(e) => setQuickNewNodeType(e.target.value as NodeType)}
                    className="w-full px-2 py-1 text-xs bg-white border border-stone-300 rounded-md"
                  >
                    <option value="TASK">Task</option>
                    <option value="PROJECT">Project</option>
                    <option value="MILESTONE">Milestone</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                  Optional Note
                </label>
                <input
                  type="text"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="What specifically are you starting?"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3 py-1.5 text-xs text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!selectedNodeId && !quickNewNodeName.trim())}
                  className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  Start Thing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Switch Context Modal */}
      {modalType === 'SWITCH_CONTEXT' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl shadow-xl p-5">
            <h3 className="text-sm font-semibold text-stone-900 mb-1">Switch Context</h3>
            <p className="text-xs text-stone-500 mb-3">
              R&D work frequently moves between units of work. A context switch pauses the current task
              and logs the transition without losing lineage.
            </p>

            <form onSubmit={handleSwitchContext} className="space-y-3">
              <div>
                <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                  Switch to Node
                </label>
                <select
                  value={selectedNodeId}
                  onChange={(e) => setSelectedNodeId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                  required
                >
                  <option value="">Select target node...</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      [{n.node_type}] {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                  Reason / Context Note (Optional)
                </label>
                <input
                  type="text"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="e.g. Blocked on API; moving to write documentation"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3 py-1.5 text-xs text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedNodeId || submitting}
                  className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  Switch Context
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Discovery Modal (Rule 4) */}
      {modalType === 'DISCOVERY' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl shadow-xl p-5">
            <div className="flex items-center gap-2 text-purple-900 font-medium text-sm mb-1">
              <Lightbulb className="w-4 h-4" />
              <span>Log Emergent Discovery</span>
            </div>
            <p className="text-xs text-stone-500 mb-3">
              Domain Model v1: When new work emerges mid-session, it becomes a first-class Node with
              permanent lineage back to this SessionEntry.
            </p>

            <form onSubmit={handleLogDiscovery} className="space-y-3">
              <div>
                <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                  Discovery Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={discoveryName}
                  onChange={(e) => setDiscoveryName(e.target.value)}
                  placeholder="e.g. Discovered flexible hierarchy edge case"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                    Node Type
                  </label>
                  <select
                    value={discoveryType}
                    onChange={(e) => setDiscoveryType(e.target.value as NodeType)}
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
                  >
                    <option value="TASK">Task</option>
                    <option value="PROJECT">Project</option>
                    <option value="NOTE">Note</option>
                    <option value="MILESTONE">Milestone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                    Parent Node (Optional)
                  </label>
                  <select
                    value={discoveryParentId}
                    onChange={(e) => setDiscoveryParentId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
                  >
                    <option value="">Current work ({activeNode?.name || 'Top level'})</option>
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                  Description / Insight
                </label>
                <textarea
                  value={discoveryDescription}
                  onChange={(e) => setDiscoveryDescription(e.target.value)}
                  rows={2}
                  placeholder="What surfaced? Why is this work required?"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3 py-1.5 text-xs text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!discoveryName.trim() || submitting}
                  className="px-4 py-2 bg-purple-900 hover:bg-purple-800 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  Log Discovery Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revise Plan Modal (Rule 2) */}
      {modalType === 'REVISE_INTENTION' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl shadow-xl p-5">
            <div className="flex items-center gap-2 text-stone-900 font-medium text-sm mb-1">
              <Edit3 className="w-4 h-4 text-sky-600" />
              <span>Revise Plan</span>
            </div>
            <p className="text-xs text-stone-500 mb-3">
              Domain Model v1: The original intention is locked and preserved. This revision records
              your conscious pivot so the drift is legible.
            </p>

            <form onSubmit={handleReviseIntention} className="space-y-3">
              <div>
                <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                  New Intention Direction <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newIntention}
                  onChange={(e) => setNewIntention(e.target.value)}
                  rows={2}
                  placeholder="e.g. Pivoting to test R&D Work logger against User Journey 002"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg font-serif"
                  required
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                  Reason for Revision
                </label>
                <input
                  type="text"
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  placeholder="e.g. Blocked by dependencies; priority shifted"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3 py-1.5 text-xs text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newIntention.trim() || submitting}
                  className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  Record Revision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {modalType === 'ADD_NOTE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl shadow-xl p-5">
            <h3 className="text-sm font-semibold text-stone-900 mb-2">Add Note to Session</h3>
            <form onSubmit={handleAddNote} className="space-y-3">
              <div>
                <textarea
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  rows={3}
                  placeholder="Record an observation, thought, or checkpoint..."
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg font-serif"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3 py-1.5 text-xs text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!actionNote.trim() || submitting}
                  className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  Add Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Tracking Modal */}
      {modalType === 'END_SESSION' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl shadow-xl p-5">
            <h3 className="text-base font-semibold text-stone-900 mb-1">End Tracking</h3>
            <p className="text-xs text-stone-500 mb-3">
              Record final reflection and subjective quality of the work period.
            </p>

            <form onSubmit={handleEndSession} className="space-y-3">
              <div>
                <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                  End Status
                </label>
                <select
                  value={endStatus}
                  onChange={(e) => setEndStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                >
                  <option value="COMPLETE">Complete</option>
                  <option value="INCOMPLETE">Incomplete (did not finish intention)</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                  Quality Rating
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as SessionQuality)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                >
                  <option value="EXCELLENT">Excellent (Deep flow, high clarity)</option>
                  <option value="GOOD">Good (Productive, on track)</option>
                  <option value="FAIR">Fair (Some friction or distraction)</option>
                  <option value="POOR">Poor (Frequent blocks / scattered)</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                  Reflection / Takeaways
                </label>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={3}
                  placeholder="How did reality compare to what you intended? Any insights?"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg font-serif"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3 py-1.5 text-xs text-stone-600 cursor-pointer"
                >
                  Resume Session
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer"
                >
                  Complete & Save Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Switch context Modal (Architecture Decision 2) */}
      {modalType === 'SWITCH_JOURNEY' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white border border-stone-200 rounded-xl shadow-xl p-6">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1.5 rounded-md bg-purple-100 text-purple-700">
                <Shuffle className="w-4 h-4" />
              </span>
              <h3 className="text-base font-semibold text-stone-900">
                Switch context (Linked Session Transition)
              </h3>
            </div>

            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg text-xs text-purple-900 mb-4 space-y-1">
              <div className="font-semibold text-purple-800">
                Architecture Decision 2 — Cross-Journey Session Scope
              </div>
              <p className="text-2xs text-purple-800/90 leading-relaxed font-serif">
                A Session belongs to exactly one Journey. Crossing into another Journey completes this
                session with reason <code className="font-mono bg-purple-100 px-1 py-0.5 rounded text-purple-900">JOURNEY_SWITCH</code>,
                records a <code className="font-mono bg-purple-100 px-1 py-0.5 rounded text-purple-900">CONTEXT_SWITCH_REQUEST</code> entry,
                and creates a linked successor session in the destination journey.
              </p>
            </div>

            {(journeys || []).filter((j) => j.id !== journey.id).length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-xs text-stone-600">
                  No other journeys exist yet. Create another Journey in the Work Hierarchy view to test cross-journey session transitions.
                </p>
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-medium"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSwitchJourney} className="space-y-3.5">
                <div>
                  <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                    Destination Journey <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={targetJourneyId}
                    onChange={(e) => setTargetJourneyId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                    required
                  >
                    {(journeys || [])
                      .filter((j) => j.id !== journey.id)
                      .map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.name} ({j.status})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                    Transition Reason / Context (Recorded in source session entry)
                  </label>
                  <input
                    type="text"
                    value={switchReason}
                    onChange={(e) => setSwitchReason(e.target.value)}
                    placeholder="e.g., Unblocking dependent subsystem in target journey"
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                    New Locked Intention for Successor Session <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={switchIntention}
                    onChange={(e) => setSwitchIntention(e.target.value)}
                    rows={2}
                    placeholder="Declare what you intend to do in the destination journey session..."
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg font-serif"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-3 py-1.5 text-xs text-stone-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !targetJourneyId || !switchIntention.trim()}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    Complete & Start Linked Session
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Correction Modal */}
      {correctingEntry && (
        <CorrectionModal
          entry={correctingEntry}
          onClose={() => setCorrectingEntry(null)}
          onSaved={refreshEntries}
        />
      )}
    </div>
  );
};
