import React from 'react';
import { Condition, EnergyLevel, EnvironmentType, FocusLevel, LocationType, Session } from '../types';
import { BatteryCharging, Brain, MapPin, Volume2, Square, PlusCircle, Clock } from 'lucide-react';

interface StickyConditionBarProps {
  activeSession: Session | null;
  currentCondition: Condition;
  onUpdateCondition: (newCond: Condition) => void;
  onEndSession?: () => void;
  onQuickEntry?: () => void;
  elapsedMinutes?: number;
}

export const StickyConditionBar: React.FC<StickyConditionBarProps> = ({
  activeSession,
  currentCondition,
  onUpdateCondition,
  onEndSession,
  onQuickEntry,
  elapsedMinutes = 0,
}) => {
  if (!activeSession) return null;

  const energyOptions: EnergyLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
  const focusOptions: FocusLevel[] = ['SCATTERED', 'NORMAL', 'DEEP'];
  const locationOptions: LocationType[] = ['HOME', 'CAFE', 'OFFICE', 'TRANSIT', 'OTHER'];
  const envOptions: EnvironmentType[] = ['QUIET', 'AMBIENT', 'NOISY'];

  const cycleEnergy = () => {
    const nextIdx = (energyOptions.indexOf(currentCondition.energy) + 1) % energyOptions.length;
    onUpdateCondition({ ...currentCondition, energy: energyOptions[nextIdx] });
  };

  const cycleFocus = () => {
    const nextIdx = (focusOptions.indexOf(currentCondition.focus) + 1) % focusOptions.length;
    onUpdateCondition({ ...currentCondition, focus: focusOptions[nextIdx] });
  };

  const cycleLocation = () => {
    const nextIdx = (locationOptions.indexOf(currentCondition.location) + 1) % locationOptions.length;
    onUpdateCondition({ ...currentCondition, location: locationOptions[nextIdx] });
  };

  const cycleEnv = () => {
    const nextIdx = (envOptions.indexOf(currentCondition.environment) + 1) % envOptions.length;
    onUpdateCondition({ ...currentCondition, environment: envOptions[nextIdx] });
  };

  const energyColors: Record<EnergyLevel, string> = {
    UNKNOWN: 'text-zinc-400 border-zinc-700',
    LOW: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    MEDIUM: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    HIGH: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
  };

  const focusColors: Record<FocusLevel, string> = {
    UNKNOWN: 'text-zinc-400 border-zinc-700',
    SCATTERED: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
    NORMAL: 'text-zinc-300 border-zinc-700 bg-zinc-800',
    DEEP: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
  };

  return (
    <aside aria-label="Active Session Condition Bar" className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 px-3 py-2 text-xs shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Active Session Info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="flex h-2 w-2 relative flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-semibold text-zinc-200 truncate">
              {activeSession.intention}
            </span>
            <span className="text-zinc-500 flex items-center gap-0.5 text-[11px]">
              <Clock className="w-3 h-3 inline" /> {elapsedMinutes}m
            </span>
          </div>
        </div>

        {/* Sticky 1-Tap Condition Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={cycleEnergy}
            title="Tap to cycle Energy"
            className={`px-2 py-1 rounded border flex items-center gap-1 transition-all ${energyColors[currentCondition.energy]}`}
          >
            <BatteryCharging className="w-3 h-3" />
            <span className="font-mono text-[11px]">{currentCondition.energy}</span>
          </button>

          <button
            onClick={cycleFocus}
            title="Tap to cycle Focus"
            className={`px-2 py-1 rounded border flex items-center gap-1 transition-all ${focusColors[currentCondition.focus]}`}
          >
            <Brain className="w-3 h-3" />
            <span className="font-mono text-[11px]">{currentCondition.focus}</span>
          </button>

          <button
            onClick={cycleLocation}
            title="Tap to cycle Location"
            className="px-2 py-1 rounded border border-zinc-700 bg-zinc-800 text-zinc-300 flex items-center gap-1 hover:border-zinc-500 transition-all"
          >
            <MapPin className="w-3 h-3 text-zinc-400" />
            <span className="font-mono text-[11px]">{currentCondition.location}</span>
          </button>

          <button
            onClick={cycleEnv}
            title="Tap to cycle Environment"
            className="px-2 py-1 rounded border border-zinc-700 bg-zinc-800 text-zinc-300 flex items-center gap-1 hover:border-zinc-500 transition-all"
          >
            <Volume2 className="w-3 h-3 text-zinc-400" />
            <span className="font-mono text-[11px]">{currentCondition.environment}</span>
          </button>

          {/* Quick Entry / End Session */}
          {onQuickEntry && (
            <button
              onClick={onQuickEntry}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1 border border-zinc-700"
              title="Add quick event entry"
            >
              <PlusCircle className="w-3 h-3 text-emerald-400" />
              <span>Log Event</span>
            </button>
          )}

          {onEndSession && (
            <button
              onClick={onEndSession}
              className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 flex items-center gap-1 font-medium"
              title="End active session"
            >
              <Square className="w-3 h-3" />
              <span>End</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
