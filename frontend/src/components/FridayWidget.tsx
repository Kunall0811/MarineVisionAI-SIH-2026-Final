import { useState } from 'react';
import { Mic, MicOff, Bot, X, Send, CheckCircle2 } from 'lucide-react';
import { useFriday } from '../hooks/useFriday';

export function FridayWidget() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const friday = useFriday();

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="glass-panel rounded-lg w-80 mb-3 p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-cyan-300">
              <Bot size={16} /> FRIDAY <span className="text-[9px] text-emerald-400">ElevenLabs</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
              <X size={16} />
            </button>
          </div>

          <div className="min-h-[60px] text-xs text-slate-300 bg-white/5 rounded p-3 mb-3">
            {friday.processing
              ? 'FRIDAY is processing…'
              : friday.lastResult?.spokenResponse || "Say: “show all high-risk ghost nets”, “fly to Titanic”, or “generate report”. "}
            {friday.transcript && (
              <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-slate-500">
                Heard: {friday.transcript}
              </div>
            )}
          </div>

          {friday.lastResult?.requiresConfirmation && (
            <button
              onClick={friday.confirmPending}
              className="w-full flex items-center justify-center gap-2 bg-amber-600/80 hover:bg-amber-500 text-white text-xs px-3 py-2 rounded mb-3"
            >
              <CheckCircle2 size={14} /> Confirm action
            </button>
          )}

          {friday.lastResult?.suggestion && (
            <div className="text-[11px] text-cyan-400 bg-cyan-500/10 rounded p-2 mb-3">
              💡 {friday.lastResult.suggestion.text}
            </div>
          )}

          {friday.error && <p className="text-[11px] text-red-400 mb-2">{friday.error}</p>}

          <div className="flex items-center gap-2">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && typed.trim()) {
                  friday.sendTyped(typed.trim());
                  setTyped('');
                }
              }}
              placeholder="Type a command…"
              className="flex-1 bg-white/5 border border-cyan-500/15 rounded px-2 py-1.5 text-xs text-slate-200"
            />
            <button
              onClick={() => {
                if (typed.trim()) {
                  friday.sendTyped(typed.trim());
                  setTyped('');
                }
              }}
              className="p-1.5 rounded bg-cyan-600/80 hover:bg-cyan-500 text-white"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          setOpen(true);
          friday.listening ? friday.stopListening() : friday.startListening();
        }}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-colors ${
          friday.listening ? 'bg-red-600 animate-pulse' : 'bg-cyan-600 hover:bg-cyan-500'
        }`}
        title="Talk to FRIDAY"
      >
        {friday.listening ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
      </button>
    </div>
  );
}
