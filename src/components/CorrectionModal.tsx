import React, { useState } from 'react';
import { X, CheckCircle2, History } from 'lucide-react';
import { SessionEntry } from '../types';
import { createCorrection } from '../api';

interface CorrectionModalProps {
  entry: SessionEntry;
  onClose: () => void;
  onSaved: () => void;
}

export const CorrectionModal: React.FC<CorrectionModalProps> = ({ entry, onClose, onSaved }) => {
  const [field, setField] = useState<'logged_at' | 'note' | 'entry_type'>('note');
  const [correctedValue, setCorrectedValue] = useState(
    field === 'note' ? entry.note || '' : entry.logged_at
  );
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFieldChange = (newField: 'logged_at' | 'note' | 'entry_type') => {
    setField(newField);
    if (newField === 'note') setCorrectedValue(entry.note || '');
    else if (newField === 'logged_at') setCorrectedValue(entry.logged_at);
    else if (newField === 'entry_type') setCorrectedValue(entry.entry_type);
  };

  const getOriginalValue = () => {
    if (field === 'note') return entry.note || '(empty)';
    if (field === 'logged_at') return entry.logged_at;
    if (field === 'entry_type') return entry.entry_type;
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A reason is required to preserve historical integrity.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createCorrection(entry.id, {
        field,
        corrected_value: correctedValue,
        reason: reason.trim(),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record correction.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2 text-stone-900 font-medium">
            <History className="w-4 h-4 text-stone-600" />
            <span>Record Entry Correction</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
            <strong>Historical Integrity Rule:</strong> The original logged event is never overwritten.
            This correction is layered on top with the explicit reason recorded in the audit trail.
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Field to Correct
            </label>
            <select
              value={field}
              onChange={(e) => handleFieldChange(e.target.value as any)}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-400"
            >
              <option value="note">Note Content</option>
              <option value="logged_at">Timestamp (logged_at)</option>
              <option value="entry_type">Entry Type</option>
            </select>
          </div>

          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs text-stone-600">
            <span className="font-semibold text-stone-700">Current effective value (original preserved): </span>
            <span className="font-mono">{getOriginalValue()}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Corrected Value
            </label>
            <input
              type="text"
              value={correctedValue}
              onChange={(e) => setCorrectedValue(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-400 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Reason for Correction <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Typo in notes, logged 5 minutes after actual departure"
              rows={2}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-400"
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Record Correction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
