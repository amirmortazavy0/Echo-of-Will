import React, { useState, useEffect } from 'react';
import { OllamaStatus } from '../types';
import { updateOllamaSettings, getOllamaStatus } from '../api';
import { Cpu, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';

interface OllamaSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: OllamaStatus | null;
  onStatusUpdated: (status: OllamaStatus) => void;
}

export const OllamaSettingsModal: React.FC<OllamaSettingsModalProps> = ({
  isOpen,
  onClose,
  status,
  onStatusUpdated,
}) => {
  const [url, setUrl] = useState(status?.url || 'http://localhost:11434');
  const [model, setModel] = useState(status?.model || '');
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => { if (isOpen) { setUrl(status?.url || 'http://127.0.0.1:11434'); setModel(status?.model || ''); setTestResult(null); } }, [isOpen, status?.url, status?.model]);
  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTestResult(null);

    try {
      await updateOllamaSettings(url, model);
      const newStatus = await getOllamaStatus();
      onStatusUpdated(newStatus);

      if (newStatus.status === 'online') {
        setTestResult(`Connected to the selected local model. Detected ${newStatus.available_models.length} model(s).`);
      } else {
        setTestResult('Settings applied for this running app. Manual mode is active: the model is blank, missing, or Ollama is unavailable.');
      }
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200">
            <Cpu className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100 text-base">Ollama AI Configuration</h3>
            <p className="text-xs text-zinc-400">Local AI provider</p>
          </div>
        </div>

        {/* Live Status indicator */}
        <div className="mb-4 p-3 rounded-lg border flex items-center gap-2.5 text-xs bg-zinc-950/60 border-zinc-800">
          {status?.status === 'online' ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-emerald-400 font-medium">
                Ollama Online & Ready ({status.available_models.length} models detected)
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-amber-400 font-medium">
                AI offline — using manual mode & deterministic heuristics
              </span>
            </>
          )}
        </div>

        <form onSubmit={handleTestAndSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Ollama Server Endpoint
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Default: http://localhost:11434. App works seamlessly in manual mode if offline.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Default Model
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="llama3.2:3b"
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Use an installed local model, such as llama3.2:3b. Leave blank for manual mode. Changes apply until restart; .env supplies startup settings.
            </p>
          </div>

          {testResult && (
            <div className="p-2.5 rounded text-xs bg-zinc-950 border border-zinc-800 text-zinc-300">
              {testResult}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save & Verify</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
