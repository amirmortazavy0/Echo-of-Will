import React, { useState } from 'react';
import {
  DoneType,
  Journey,
  Node,
  NodeStatus,
  NodeType,
  Session,
  SessionEntry,
} from '../types';
import { formatLocalDate } from '../utils/formatters';
import { createJourney, createNode, updateNode, updateJourney } from '../api';
import {
  FolderPlus,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronDown,
  Layers,
  Calendar,
  AlertCircle,
  Hash,
  Activity,
  Pause,
  Compass,
} from 'lucide-react';

interface TaskViewProps {
  journeys?: Journey[];
  nodes?: Node[];
  sessions?: Session[];
  entries?: SessionEntry[];
  onRefreshData?: () => void;
  onStartSession: (node: Node, journey: Journey) => void;
}

export const TaskView: React.FC<TaskViewProps> = ({
  journeys = [],
  nodes = [],
  sessions = [],
  entries = [],
  onRefreshData,
  onStartSession,
}) => {
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>(
    journeys[0]?.id || ''
  );
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Auto-select first journey when journeys load
  React.useEffect(() => {
    if (!selectedJourneyId && journeys.length > 0) {
      setSelectedJourneyId(journeys[0].id);
    }
  }, [journeys, selectedJourneyId]);

  // Modals & Forms
  const [isCreatingJourney, setIsCreatingJourney] = useState(false);
  const [newJourneyName, setNewJourneyName] = useState('');
  const [newJourneyDesc, setNewJourneyDesc] = useState('');

  const [addingChildToNodeId, setAddingChildToNodeId] = useState<string | null>(null);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeDesc, setNewNodeDesc] = useState('');
  const [newNodeEst, setNewNodeEst] = useState<number | ''>('');
  const [newNodeType, setNewNodeType] = useState<NodeType>('TASK');

  const selectedJourney =
    journeys.find((j) => j.id === selectedJourneyId) || journeys[0];

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleCreateJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJourneyName.trim()) return;

    try {
      let context = selectedJourney;
      if (!context) {
        context = await createJourney({
          name: 'My Things',
          description: 'Default context for your Things.',
        });
      }

      const createdThing = await createNode({
        journey_id: context.id,
        parent_id: null,
        node_type: 'TASK',
        name: newJourneyName.trim(),
        description: newJourneyDesc.trim() || null,
      });

      setNewJourneyName('');
      setNewJourneyDesc('');
      setIsCreatingJourney(false);
      onRefreshData();
      setSelectedJourneyId(context.id);
      setExpandedNodes((prev) => ({ ...prev, [createdThing.id]: true }));
    } catch (err: any) {
      alert(`Error creating Thing: ${err.message}`);
    }
  };

  const handleCreateNode = async (parentId: string | null = null) => {
    if (!newNodeName.trim() || !selectedJourney) return;

    try {
      await createNode({
        journey_id: selectedJourney.id,
        parent_id: parentId,
        name: newNodeName.trim(),
        description: newNodeDesc.trim() || null,
        estimated_minutes: newNodeEst === '' ? null : Number(newNodeEst),
        node_type: newNodeType,
      });

      setNewNodeName('');
      setNewNodeDesc('');
      setNewNodeEst('');
      setAddingChildToNodeId(null);
      onRefreshData();
      if (parentId) {
        setExpandedNodes((prev) => ({ ...prev, [parentId]: true }));
      }
    } catch (err: any) {
      alert(`Error creating node: ${err.message}`);
    }
  };

  const handleStatusChange = async (node: Node, newStatus: NodeStatus) => {
    try {
      await updateNode(node.id, { status: newStatus });
      onRefreshData();
    } catch (err: any) {
      alert(`Error updating node: ${err.message}`);
    }
  };

  // Node Calculations (Estimated vs Actual, Session Count, Last Active)
  const getNodeStats = (nodeId: string) => {
    const nodeEntries = (entries || []).filter((e) => e.node_id === nodeId);
    const nodeSessions = (sessions || []).filter((s) => {
      return (
        s.node_id === nodeId ||
        nodeEntries.some((e) => e.session_id === s.id)
      );
    });

    let actualMinutes = 0;
    let lastActiveIso: string | null = null;

    for (const s of nodeSessions) {
      if (s.started_at && s.ended_at) {
        const d1 = new Date(s.started_at).getTime();
        const d2 = new Date(s.ended_at).getTime();
        actualMinutes += Math.max(0, Math.round((d2 - d1) / 60000));
      }
      if (s.started_at) {
        if (!lastActiveIso || s.started_at > lastActiveIso) {
          lastActiveIso = s.started_at;
        }
      }
    }

    return {
      sessionCount: nodeSessions.length,
      actualMinutes,
      lastActiveDate: lastActiveIso ? formatLocalDate(lastActiveIso) : null,
    };
  };

  const statusColors: Record<NodeStatus, string> = {
    PLANNED: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    ACTIVE: 'bg-cyan-950 text-cyan-300 border-cyan-800',
    PAUSED: 'bg-amber-950 text-amber-300 border-amber-800',
    COMPLETE: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    DORMANT: 'bg-zinc-900 text-zinc-500 border-zinc-800',
  };

  // Recursive Node Renderer for Unlimited Depth
  const renderNodeTree = (parentId: string | null = null, depth: number = 0) => {
    const currentNodes = (nodes || []).filter(
      (n) =>
        n.journey_id === selectedJourney?.id &&
        (parentId === null ? !n.parent_id : n.parent_id === parentId)
    );

    if (currentNodes.length === 0) return null;

    return (
      <div className={`space-y-2 ${depth > 0 ? 'ml-4 pl-3 border-l border-zinc-800' : ''}`}>
        {currentNodes.map((node) => {
          const stats = getNodeStats(node.id);
          const childNodes = (nodes || []).filter((n) => n.parent_id === node.id);
          const hasChildren = childNodes.length > 0;
          const isExpanded = expandedNodes[node.id] ?? true;

          return (
            <div
              key={node.id}
              className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 transition-all shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {hasChildren && (
                    <button
                      onClick={() => toggleExpand(node.id)}
                      className="text-zinc-400 hover:text-zinc-200 p-0.5"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-zinc-100">{node.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${
                          statusColors[node.status]
                        }`}
                      >
                        {node.status}
                      </span>
                    </div>

                    {node.description && (
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">
                        {node.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Metrics & Actions */}
                <div className="flex items-center gap-3 text-xs flex-shrink-0">
                  {/* Estimated vs Actual */}
                  <div className="flex items-center gap-1 text-zinc-400 text-[11px] font-mono">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{stats.actualMinutes}m logged</span>
                    {node.estimated_minutes && (
                      <span className="text-zinc-500">
                        / {node.estimated_minutes}m est
                      </span>
                    )}
                  </div>

                  {/* Sessions & Last Active */}
                  <div className="hidden sm:flex items-center gap-2 text-zinc-500 text-[11px]">
                    <span>{stats.sessionCount} sessions</span>
                    {stats.lastActiveDate && <span>• {stats.lastActiveDate}</span>}
                  </div>

                  {/* Status Dropdown */}
                  <select
                    value={node.status}
                    onChange={(e) => handleStatusChange(node, e.target.value as NodeStatus)}
                    className="bg-zinc-950 border border-zinc-700 text-zinc-300 rounded px-2 py-0.5 text-xs focus:outline-none"
                  >
                    <option value="PLANNED">PLANNED</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="COMPLETE">COMPLETE</option>
                    <option value="DORMANT">DORMANT</option>
                  </select>

                  {/* Add Child Node button */}
                  <button
                    onClick={() =>
                      setAddingChildToNodeId(
                        addingChildToNodeId === node.id ? null : node.id
                      )
                    }
                    className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded"
                    title="Add child Thing"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  {/* Start Tracking on this Node */}
                  <button
                    onClick={() => onStartSession(node, selectedJourney!)}
                    className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded flex items-center gap-1 text-xs font-medium transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Start Tracking</span>
                  </button>
                </div>
              </div>

              {/* Add Child Inline Form */}
              {addingChildToNodeId === node.id && (
                <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap gap-2 items-center bg-zinc-950 p-2.5 rounded-lg">
                  <input
                    type="text"
                    value={newNodeName}
                    onChange={(e) => setNewNodeName(e.target.value)}
                    placeholder="Child Thing name..."
                    className="flex-1 min-w-[140px] bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                  />
                  <input
                    type="number"
                    value={newNodeEst}
                    onChange={(e) =>
                      setNewNodeEst(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="Est mins"
                    className="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                  />
                  <button
                    onClick={() => handleCreateNode(node.id)}
                    className="px-3 py-1 bg-zinc-200 text-zinc-900 rounded text-xs font-semibold hover:bg-white"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAddingChildToNodeId(null)}
                    className="px-2 py-1 text-zinc-400 hover:text-zinc-200 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Recursive Children */}
              {hasChildren && isExpanded && (
                <div className="mt-2">{renderNodeTree(node.id, depth + 1)}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>Things</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono font-normal">
              View 3
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Hierarchical Thing & Sub-item trees. Unlimited depth. Status tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreatingJourney(true)}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>+ New Thing</span>
          </button>
        </div>
      </div>

      {/* Thing Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {journeys.map((j) => (
          <button
            key={j.id}
            onClick={() => setSelectedJourneyId(j.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border cursor-pointer ${
              selectedJourneyId === j.id
                ? 'bg-zinc-100 text-zinc-900 border-zinc-100 shadow-md font-semibold'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            {j.name}
          </button>
        ))}
      </div>

      {/* Create Thing Modal */}
      {isCreatingJourney && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-100 mb-3">Create New Thing</h3>
            <form onSubmit={handleCreateJourney} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Thing Name *</label>
                <input
                  type="text"
                  required
                  value={newJourneyName}
                  onChange={(e) => setNewJourneyName(e.target.value)}
                  placeholder="e.g. App Architecture, Deep Work, Writing"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                <textarea
                  value={newJourneyDesc}
                  onChange={(e) => setNewJourneyDesc(e.target.value)}
                  placeholder="What is this Thing about?"
                  rows={2}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingJourney(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Create Thing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Thing context & Add Thing Form */}
      {selectedJourney ? (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-400" />
                <span>{selectedJourney.name}</span>
              </h3>
              {selectedJourney.description && (
                <p className="text-xs text-zinc-400 mt-1">{selectedJourney.description}</p>
              )}
            </div>

            {/* Quick Add Thing */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={addingChildToNodeId === 'root' ? newNodeName : ''}
                onChange={(e) => {
                  setAddingChildToNodeId('root');
                  setNewNodeName(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateNode(null);
                }}
                placeholder="+ Add Thing / Task..."
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none min-w-[200px]"
              />
              {addingChildToNodeId === 'root' && newNodeName.trim() && (
                <button
                  onClick={() => handleCreateNode(null)}
                  className="px-3 py-1.5 bg-zinc-200 text-zinc-900 rounded-lg text-xs font-semibold hover:bg-white"
                >
                  Add
                </button>
              )}
            </div>
          </div>

          {/* Node Tree Hierarchy */}
          <div className="space-y-2">
            {renderNodeTree(null, 0) || (
              <div className="p-8 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-xl">
                <Layers className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">
                  No nodes added to this journey yet. Add your first root node above!
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center space-y-3">
          <FolderPlus className="w-10 h-10 text-emerald-500 mx-auto opacity-80" />
          <h3 className="text-sm font-semibold text-zinc-100">No Things created yet</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Journeys are long-lived areas of responsibility or multi-month goals. Create your first Journey to start adding hierarchical tasks.
          </p>
          <button
            onClick={() => setIsCreatingJourney(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg text-xs font-bold transition-all shadow-md inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Thing</span>
          </button>
        </div>
      )}
    </div>
  );
};
