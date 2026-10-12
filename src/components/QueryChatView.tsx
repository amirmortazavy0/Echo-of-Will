import { useIdentity } from '../Identity';
import React, { useState } from 'react';
import { OllamaStatus, QueryChatResponse } from '../types';
import { askQueryChat } from '../api';
import {
  HelpCircle,
  Send,
  Sparkles,
  Cpu,
  AlertCircle,
  Clock,
  BatteryCharging,
  Layers,
  History,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

interface QueryChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  provider?: string;
  sessionsAnalyzed?: number;
  timestamp: string;
}

interface QueryChatViewProps {
  ollamaStatus: OllamaStatus | null;
  onOpenSettings: () => void;
}

export const QueryChatView: React.FC<QueryChatViewProps> = ({
  ollamaStatus,
  onOpenSettings,
}) => {
  const { name: workspaceName } = useIdentity();
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<QueryChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Ask me anything about your logged intentions, sessions, and reported conditions over the last 30 days. I read strictly from your JSON database for descriptive summaries.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const quickQueries = [
    'How much total time did I log across all journeys?',
    'What was my energy like during my recent sessions?',
    'What intentions did I work on yesterday?',
    'Which tasks have reported context switches?',
  ];

  const handleSend = async (questionText?: string) => {
    const q = (questionText || inputQuestion).trim();
    if (!q || isLoading) return;

    const userMsg: QueryChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setIsLoading(true);

    try {
      const res: QueryChatResponse = await askQueryChat(q);
      const assistantMsg: QueryChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: res.answer,
        provider: res.provider,
        sessionsAnalyzed: res.sessions_analyzed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: QueryChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `Error retrieving answer: ${err.message || 'Check server connection'}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>Ask {workspaceName}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono font-normal">
              View 2
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Query your logged intention history & conditions. Read-only intelligence.
          </p>
        </div>

        {/* AI Layer Indicator */}
        <div className="flex items-center gap-2">
          {ollamaStatus?.status === 'online' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-950/60 border border-emerald-800/80 text-emerald-300">
              <Cpu className="w-3.5 h-3.5" />
              <span className="font-mono">Ollama [{ollamaStatus.model}]</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-amber-950/50 border border-amber-800/60 text-amber-300">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>AI offline — using local analytics</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages Thread Container */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 min-h-[380px] max-h-[540px] overflow-y-auto space-y-4 shadow-xl flex flex-col">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.sender === 'user' ? 'items-end' : 'items-start'
            } space-y-1`}
          >
            <div
              className={`max-w-2xl rounded-2xl px-4 py-3 text-sm shadow-md leading-relaxed whitespace-pre-line ${
                m.sender === 'user'
                  ? 'bg-zinc-100 text-zinc-900 font-medium rounded-br-sm'
                  : 'bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-zinc-500 px-1">
              <span>{m.timestamp}</span>
              {m.provider && (
                <>
                  <span>•</span>
                  <span className="font-mono uppercase">{m.provider}</span>
                </>
              )}
              {m.sessionsAnalyzed !== undefined && m.sessionsAnalyzed > 0 && (
                <>
                  <span>•</span>
                  <span>{m.sessionsAnalyzed} sessions scanned</span>
                </>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 p-3 bg-zinc-950 border border-zinc-800 rounded-xl max-w-sm text-zinc-400 text-xs animate-pulse">
            <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
            <span>Scanning 30-day session logs...</span>
          </div>
        )}
      </div>

      {/* Suggested Query Chips */}
      <div className="space-y-1.5">
        <div className="text-[11px] text-zinc-500 font-medium">Quick Queries:</div>
        <div className="flex flex-wrap gap-1.5">
          {quickQueries.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={isLoading}
              className="text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors text-left flex items-center gap-1.5 disabled:opacity-50"
            >
              <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
              <span>{q}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-2 shadow-lg"
      >
        <input
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          placeholder="Ask a question about your sessions, time spent, or reported conditions..."
          className="flex-1 bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
        />

        <button
          type="submit"
          disabled={!inputQuestion.trim() || isLoading}
          className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
};
