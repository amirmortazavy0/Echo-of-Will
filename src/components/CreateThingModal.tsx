import React, { useState } from 'react';
import { Journey } from '../types';
import { createJourney } from '../api';
import { FolderPlus, X, Sparkles, AlertCircle } from 'lucide-react';

interface CreateThingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThingCreated: (thing: Journey) => void;
}

export const CreateThingModal: React.FC<CreateThingModalProps> = ({
  isOpen,
  onClose,
  onThingCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'SHARED'>('PRIVATE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for this Thing.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await createJourney({
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        status: 'ACTIVE',
      });
      setName('');
      setDescription('');
      onThingCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create Thing');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 relative space-y-4">
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
            <FolderPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-100 text-base">New Thing</h3>
            <p className="text-xs text-zinc-400">
              Create a primary focus area, project, or long-term endeavor
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">
              Thing Name <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Pist Core, Train Commute, Research & Development"
              className="w-full bg-zinc-950 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">
              Description <span className="text-zinc-500">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this Thing encompass?"
              className="w-full bg-zinc-950 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-xl p-3 text-xs focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">Visibility</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility('PRIVATE')}
                className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                  visibility === 'PRIVATE'
                    ? 'bg-zinc-800 border-zinc-600 text-white'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Private (Only You)
              </button>

            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs transition shadow cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating...' : 'Create Thing'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
