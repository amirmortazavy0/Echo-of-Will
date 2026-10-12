import React from 'react';
import { X, Check, Train, FlaskConical, Plus, Compass, ArrowRight } from 'lucide-react';
import { Journey } from '../types';

interface JourneySwitcherModalProps {
  journeys: Journey[];
  selectedJourneyId: string;
  onSelectJourney: (id: string) => void;
  onClose: () => void;
  onCreateNew: () => void;
}

export const JourneySwitcherModal: React.FC<JourneySwitcherModalProps> = ({
  journeys,
  selectedJourneyId,
  onSelectJourney,
  onClose,
  onCreateNew,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/80">
          <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
            <Compass className="w-4 h-4 text-stone-800" />
            <span>Select Thing context</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200">
            A <strong>Thing context</strong> is a long-lived investigative context. your workspace provides
            two primary reference journeys to test both physical schedule drift and cognitive workflow drift.
          </div>

          <div className="space-y-3">
            {journeys.map((j) => {
              const isSelected = j.id === selectedJourneyId;
              const isTrain =
                j.id === 'jrn-train-commuter-corridor' ||
                j.name.toLowerCase().includes('train');

              return (
                <div
                  key={j.id}
                  onClick={() => {
                    onSelectJourney(j.id);
                    onClose();
                  }}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'border-stone-900 bg-stone-50 shadow-xs'
                      : 'border-stone-200 hover:border-stone-400 hover:bg-stone-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl p-2 bg-white rounded-lg border border-stone-200 shadow-2xs shrink-0">
                      {isTrain ? '🚆' : '🔬'}
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">{j.name}</span>
                        {isSelected && (
                          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-stone-900 text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-2xs text-stone-600 leading-relaxed max-w-sm">
                        {j.description || 'Continuous investigative journey'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 pt-1">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border border-stone-300 flex items-center justify-center text-stone-400">
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-stone-100">
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateNew();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Another Context</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
