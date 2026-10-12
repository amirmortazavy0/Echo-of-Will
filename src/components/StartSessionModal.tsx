import React, { useState, useEffect } from 'react';
import { Condition, Journey, Node, Session } from '../types';
import { startSession, createJourney } from '../api';
import { Play, X, Plus, Clock, Sparkles, AlertCircle } from 'lucide-react';

interface StartSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNode?: Node | null;
  targetJourney?: Journey | null;
  journeys?: Journey[];
  nodes?: Node[];
  currentCondition: Condition;
  onSessionStarted: (session: Session) => void;
  onThingCreated?: (thing: Journey) => void;
}

export const StartSessionModal: React.FC<StartSessionModalProps> = ({
  isOpen,
  onClose,
  targetNode,
  targetJourney,
  journeys = [],
  nodes = [],
  currentCondition,
  onSessionStarted,
  onThingCreated,
}) => {
  const [journeyId, setJourneyId] = useState<string>('');
  const [nodeId, setNodeId] = useState<string>('');
  const [intention, setIntention] = useState<string>('');
  const [condition, setCondition] = useState<Condition>(currentCondition);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // New Thing inline creation
  const [isCreatingThingInline, setIsCreatingThingInline] = useState(false);
  const [newThingName, setNewThingName] = useState('');

  // Retrospective logging (optional past time)
  const [isRetrospective, setIsRetrospective] = useState(false);
  const [pastMinutesAgo, setPastMinutesAgo] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const activeThing = targetJourney || (targetNode ? journeys.find((j) => j.id === targetNode.journey_id) : null) || journeys.find((j) => j.status === 'ACTIVE') || journeys[0] || null;
      setJourneyId(activeThing ? activeThing.id : '');
      setNodeId(targetNode ? targetNode.id : '');
      setIntention(targetNode ? `Work on ${targetNode.name}` : '');
      setCondition(currentCondition);
      setValidationError(null);
      setIsCreatingThingInline(journeys.length === 0);
      setNewThingName('');
      setIsRetrospective(false);
      setPastMinutesAgo(0);
    }
  }, [isOpen, targetNode, targetJourney, journeys, currentCondition]);

  useEffect(() => {
    if (!isOpen) return;
    setJourneyId(targetJourney?.id || targetNode?.journey_id || journeys.find((j) => j.status === 'ACTIVE')?.id || journeys[0]?.id || '');
    setNodeId(targetNode?.id || '');
    setIntention(targetNode ? `Work on ${targetNode.name}` : '');
    setCondition(currentCondition);
  }, [isOpen, targetJourney?.id, targetNode?.id, targetNode?.journey_id, journeys, currentCondition]);

  if (!isOpen) return null;

  const journeyNodes = (nodes || []).filter((n) => n.journey_id === journeyId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    let activeJId = journeyId;

    // If user is creating a Thing inline
    if (isCreatingThingInline || (!activeJId && newThingName.trim())) {
      if (!newThingName.trim()) {
        setValidationError('Please enter a name for the new Thing.');
        return;
      }
      try {
        const created = await createJourney({
          name: newThingName.trim(),
          status: 'ACTIVE',
          visibility: 'PRIVATE',
        });
        activeJId = created.id;
        setJourneyId(created.id);
        setIsCreatingThingInline(false);
        if (onThingCreated) onThingCreated(created);
      } catch (err: any) {
        setValidationError(`Could not create Thing: ${err.message}`);
        return;
      }
    }

    if (!activeJId) {
      setValidationError('Please select or create a Thing to track work under.');
      return;
    }

    if (!intention.trim()) {
      setValidationError('Please enter what you are intending to work on.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedNode = nodes.find((n) => n.id === nodeId);
      const created = await startSession({
        journey_id: activeJId,
        node_id: nodeId || null,
        intention: intention.trim(),
        label: selectedNode ? selectedNode.name : 'Focus Session',
        condition,
      });

      onSessionStarted(created);
      onClose();
    } catch (err: any) {
      setValidationError(`Failed to start tracking: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 relative space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Play className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-100 text-base">Start Tracking</h3>
            <p className="text-xs text-zinc-400">
              Direct your focus on a Thing — reality will be logged as it unfolds
            </p>
          </div>
        </div>

        {validationError && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Target Thing Picker or Inline Creator */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-zinc-300 font-medium">
                Thing <span className="text-amber-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingThingInline(!isCreatingThingInline)}
                className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium text-[11px]"
              >
                {isCreatingThingInline ? (
                  'Select existing Thing'
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    <span>Create New Thing</span>
                  </>
                )}
              </button>
            </div>

            {isCreatingThingInline || journeys.length === 0 ? (
              <div className="space-y-1">
                <input
                  type="text"
                  autoFocus={journeys.length === 0}
                  value={newThingName}
                  onChange={(e) => setNewThingName(e.target.value)}
                  placeholder="Enter name for new Thing (e.g. App Development, Python Study)..."
                  className="w-full bg-zinc-950 border border-amber-500/50 text-zinc-100 placeholder-zinc-500 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-400"
                />
                {journeys.length === 0 && (
                  <p className="text-[11px] text-amber-300/80">
                    No Things exist yet. Give your first Thing a name to begin.
                  </p>
                )}
              </div>
            ) : (
              <select
                value={journeyId}
                onChange={(e) => {
                  setJourneyId(e.target.value);
                  setNodeId('');
                }}
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
              >
                {journeys.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name} {j.status !== 'ACTIVE' ? `(${j.status})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Sub-item / Node (optional) */}
          {!isCreatingThingInline && journeyNodes.length > 0 && (
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">
                Sub-item / Task <span className="text-zinc-500">(optional)</span>
              </label>
              <select
                value={nodeId}
                onChange={(e) => {
                  setNodeId(e.target.value);
                  const n = nodes.find((node) => node.id === e.target.value);
                  if (n && (!intention || intention.startsWith('Work on '))) {
                    setIntention(`Work on ${n.name}`);
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="">(No specific task — general session)</option>
                {journeyNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} [{n.status}]
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Focus Goal Input */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">
              What are you working on? <span className="text-amber-400">*</span>
            </label>
            <textarea
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              placeholder="What do you plan to work on during this session?"
              rows={2}
              required
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-amber-500 resize-none font-medium"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Your starting focus is recorded as reality unfolds.
            </p>
          </div>

          {/* Initial Condition State */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="text-zinc-300 font-medium">Starting Condition</label>
              <span className="text-[11px] text-zinc-500">Tap to toggle anytime</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-[10px] text-zinc-500 block mb-1">Energy</span>
                <select
                  value={condition.energy}
                  onChange={(e) => setCondition({ ...condition, energy: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-700 text-zinc-300 rounded-lg p-1.5 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="UNKNOWN">Unknown</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 block mb-1">Focus</span>
                <select
                  value={condition.focus}
                  onChange={(e) => setCondition({ ...condition, focus: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-700 text-zinc-300 rounded-lg p-1.5 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="UNKNOWN">Unknown</option>
                  <option value="SCATTERED">Scattered</option>
                  <option value="NORMAL">Normal</option>
                  <option value="DEEP">Deep</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 block mb-1">Location</span>
                <select
                  value={condition.location}
                  onChange={(e) => setCondition({ ...condition, location: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-700 text-zinc-300 rounded-lg p-1.5 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="UNKNOWN">Unknown</option>
                  <option value="HOME">Home</option>
                  <option value="OFFICE">Office</option>
                  <option value="CAFE">Cafe</option>
                  <option value="TRANSIT">Transit</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 block mb-1">Environment</span>
                <select
                  value={condition.environment}
                  onChange={(e) =>
                    setCondition({ ...condition, environment: e.target.value as any })
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 text-zinc-300 rounded-lg p-1.5 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="UNKNOWN">Unknown</option>
                  <option value="QUIET">Quiet</option>
                  <option value="AMBIENT">Ambient</option>
                  <option value="NOISY">Noisy</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !intention.trim() || (!journeyId && !newThingName.trim())}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs transition shadow cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isSubmitting ? 'Starting...' : 'Start Tracking'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
