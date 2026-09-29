import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Mic, MicOff, Send, CheckCircle2, History, Sparkles,
  Power, PowerOff, Globe, Cpu, BarChart3, Map, Anchor,
  Radar, FileText, Settings, ChevronRight, Activity, Volume2, VolumeX,
} from 'lucide-react';
import { useFriday } from '../hooks/useFriday';
import { FridayApi } from '../api/services';

const EXAMPLE_COMMANDS = [
  'Switch to Command Dashboard',
  'Open 3D Globe',
  'Navigate to GIS Map',
  'Switch to AI Model Test',
  'Switch to Analytics',
  'Switch to Surveys',
  'How many unverified detections are there?',
  'Show all high-risk ghost nets',
  'Open the latest anomaly',
  'Generate the report for GOA-2026',
  'Train AI model',
  'Test AI model',
  'Zoom the globe to this anomaly',
  'Help',
];

const PANEL_SHORTCUTS = [
  { label: 'Dashboard', icon: Radar, route: '/', color: 'text-cyan-400' },
  { label: '3D Globe', icon: Globe, route: '/globe', color: 'text-blue-400' },
  { label: 'GIS Map', icon: Map, route: '/map', color: 'text-emerald-400' },
  { label: 'AI Test', icon: Cpu, route: '/ai-test', color: 'text-purple-400' },
  { label: 'Analytics', icon: BarChart3, route: '/analytics', color: 'text-orange-400' },
  { label: 'Surveys', icon: Anchor, route: '/surveys', color: 'text-sky-400' },
  { label: 'Reports', icon: FileText, route: '/reports', color: 'text-yellow-400' },
  { label: 'Training', icon: Settings, route: '/training', color: 'text-pink-400' },
];

export default function FridayPage() {
  const friday = useFriday();
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const [fridayEnabled, setFridayEnabled] = useState(true);
  const [muted, setMuted] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const historyQuery = useQuery({ queryKey: ['friday-history'], queryFn: () => FridayApi.history(20) });
  const insightsQuery = useQuery({ queryKey: ['friday-insights'], queryFn: FridayApi.insights });

  const insights = insightsQuery.data;

  // Animate FRIDAY orb when listening
  useEffect(() => {
    setPulseActive(friday.listening || friday.processing);
  }, [friday.listening, friday.processing]);

  const handleSendTyped = () => {
    if (!typed.trim() || !fridayEnabled) return;
    friday.sendTyped(typed.trim());
    setTyped('');
  };

  const handleToggleFriday = () => {
    setFridayEnabled((prev) => {
      if (!prev) {
        // Turning on
        return true;
      } else {
        // Turning off - stop listening if active
        if (friday.listening) friday.stopListening();
        return false;
      }
    });
  };

  const handlePanelShortcut = (route: string, label: string) => {
    if (!fridayEnabled) return;
    friday.sendTyped(`Switch to ${label}`);
    setTimeout(() => navigate(route), 600);
  };

  return (
    <div className="p-6 space-y-6">
      {/* FRIDAY Header with ON/OFF Control */}
      <div className="glass-panel rounded-xl p-5 border border-cyan-500/30 bg-[#050e1c]/90">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* FRIDAY Orb / Status Indicator */}
            <div className="relative">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 ${
                  fridayEnabled
                    ? pulseActive
                      ? 'bg-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.6)] border-2 border-cyan-400'
                      : 'bg-cyan-500/15 shadow-[0_0_20px_rgba(6,182,212,0.3)] border-2 border-cyan-500/50'
                    : 'bg-slate-800 border-2 border-slate-700'
                }`}
              >
                <Bot className={fridayEnabled ? 'text-cyan-400' : 'text-slate-600'} size={24} />
                {fridayEnabled && pulseActive && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-cyan-500/20" />
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-100 tracking-wider">
                  F.R.I.D.A.Y
                </h1>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-mono ${
                    fridayEnabled
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-red-500/20 text-red-400 border border-red-500/40'
                  }`}
                >
                  {fridayEnabled ? '● ONLINE' : '○ OFFLINE'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Female Replacement Intelligent Digital Assistant Youth — MarineVision AI Command Agent
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Voice/text commands · Panel navigation · AI training · Real-time analytics
              </p>
            </div>
          </div>

          {/* ON/OFF Toggle Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMuted(!muted)}
              className={`p-2.5 rounded-lg border transition-all ${
                muted
                  ? 'bg-slate-800 border-slate-700 text-slate-500'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
              title={muted ? 'Unmute FRIDAY' : 'Mute FRIDAY voice'}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <button
              onClick={handleToggleFriday}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                fridayEnabled
                  ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-red-500/30 border border-red-500/40'
                  : 'bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white shadow-cyan-500/30 border border-cyan-500/40'
              }`}
            >
              {fridayEnabled ? (
                <><PowerOff size={16} /> FRIDAY OFF</>
              ) : (
                <><Power size={16} /> FRIDAY ON</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Panel Quick-Switch Shortcuts */}
      <div className="glass-panel rounded-xl p-4 border border-white/5">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Sparkles size={13} className="text-cyan-400" /> Quick Panel Switch — say "Switch to [panel]" or click
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {PANEL_SHORTCUTS.map((panel) => {
            const Icon = panel.icon;
            return (
              <button
                key={panel.route}
                onClick={() => handlePanelShortcut(panel.route, panel.label)}
                disabled={!fridayEnabled}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center ${
                  fridayEnabled
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-cyan-500/30 cursor-pointer'
                    : 'bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed'
                }`}
              >
                <Icon size={20} className={fridayEnabled ? panel.color : 'text-slate-600'} />
                <span className="text-[10px] text-slate-400">{panel.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Command Interface */}
        <div className="glass-panel rounded-xl p-5 lg:col-span-2 space-y-4 border border-cyan-500/20">
          {/* Response Display */}
          <div
            className={`min-h-[120px] text-sm rounded-lg p-4 border transition-all ${
              fridayEnabled
                ? 'bg-white/5 border-cyan-500/10 text-slate-200'
                : 'bg-black/20 border-slate-800 text-slate-600'
            }`}
          >
            {!fridayEnabled ? (
              <div className="flex items-center gap-2 text-slate-600">
                <PowerOff size={16} /> FRIDAY is offline. Press FRIDAY ON to activate.
              </div>
            ) : friday.processing ? (
              <div className="flex items-center gap-2 text-cyan-400">
                <Activity size={16} className="animate-pulse" /> Processing command...
              </div>
            ) : friday.lastResult?.spokenResponse ? (
              <div>
                <div className="text-xs text-cyan-400 font-mono mb-2 flex items-center gap-1">
                  <Bot size={12} /> FRIDAY:
                </div>
                <div className="text-slate-100">{friday.lastResult.spokenResponse}</div>
              </div>
            ) : (
              <div className="text-slate-500 flex items-center gap-2">
                <Bot size={16} className="text-cyan-400/50" />
                Say "FRIDAY ON" or click the button above, then ask me anything.
                Try: "Switch to 3D Globe" or "Train AI model"
              </div>
            )}
          </div>

          {/* Confirm Action */}
          {fridayEnabled && friday.lastResult?.requiresConfirmation && (
            <button
              onClick={friday.confirmPending}
              className="w-full flex items-center justify-center gap-2 bg-amber-600/80 hover:bg-amber-500 text-white text-sm px-3 py-2 rounded-lg border border-amber-500/50 transition-all"
            >
              <CheckCircle2 size={16} /> Confirm action
            </button>
          )}

          {/* Suggestion */}
          {fridayEnabled && friday.lastResult?.suggestion && (
            <div className="text-xs text-cyan-400 bg-cyan-500/10 rounded-lg p-3 flex items-start gap-2 border border-cyan-500/20">
              <Sparkles size={14} className="shrink-0 mt-0.5" />
              <div>
                <div>{friday.lastResult.suggestion.text}</div>
                <div className="text-[10px] text-cyan-600 mt-1">{friday.lastResult.suggestion.basedOn}</div>
              </div>
            </div>
          )}

          {friday.error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {friday.error}
            </p>
          )}

          {/* Input Row */}
          <div className="flex items-center gap-2">
            <button
              disabled={!fridayEnabled}
              onClick={() => fridayEnabled && (friday.listening ? friday.stopListening() : friday.startListening())}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-white font-medium transition-all flex-shrink-0 ${
                !fridayEnabled
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                  : friday.listening
                  ? 'bg-red-600 animate-pulse border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                  : 'bg-cyan-600/80 hover:bg-cyan-500 border border-cyan-500/40'
              }`}
            >
              {friday.listening ? <MicOff size={16} /> : <Mic size={16} />}
              {friday.listening ? 'Stop' : 'Speak'}
            </button>

            <input
              ref={inputRef}
              disabled={!fridayEnabled}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendTyped();
              }}
              placeholder={fridayEnabled ? "…or type a command (e.g. 'Switch to 3D Globe')" : 'FRIDAY is offline…'}
              className="flex-1 bg-white/5 border border-cyan-500/15 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            />

            <button
              disabled={!fridayEnabled || !typed.trim()}
              onClick={handleSendTyped}
              className="p-2.5 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white border border-cyan-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </div>

          {/* Example Commands */}
          <div>
            <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-2 font-semibold">
              Example commands:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_COMMANDS.map((c) => (
                <button
                  key={c}
                  disabled={!fridayEnabled}
                  onClick={() => {
                    if (!fridayEnabled) return;
                    friday.sendTyped(c);
                  }}
                  className="text-[11px] bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg border border-white/5 hover:border-cyan-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronRight size={10} className="text-cyan-500" />
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: History & Patterns */}
        <div className="space-y-4">
          <div className="glass-panel rounded-xl p-4 border border-white/5">
            <div className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-cyan-400" /> Your patterns
            </div>
            {insights?.frequentCommands?.length ? (
              <div className="space-y-1.5">
                {insights.frequentCommands.map((c: any) => (
                  <div key={c._id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 truncate max-w-[140px]">{c._id}</span>
                    <span className="text-cyan-400 font-mono font-bold">{c.count}x</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No command history yet — your patterns will show up here as you use FRIDAY.</p>
            )}
          </div>

          <div className="glass-panel rounded-xl p-4 border border-white/5">
            <div className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
              <History size={14} className="text-cyan-400" /> Recent commands
            </div>
            <div className="space-y-2 max-h-64 overflow-auto">
              {(historyQuery.data || []).map((h: any) => (
                <div key={h._id} className="text-xs border-b border-white/5 pb-2">
                  <div className="text-slate-300">"{h.transcript}"</div>
                  <div className="text-slate-600">{h.intent} · {new Date(h.createdAt).toLocaleTimeString()}</div>
                </div>
              ))}
              {!historyQuery.data?.length && <p className="text-xs text-slate-500">No commands yet.</p>}
            </div>
          </div>

          {/* Status Card */}
          <div className="glass-panel rounded-xl p-4 border border-white/5 space-y-2">
            <div className="text-sm font-medium text-slate-200 mb-2 flex items-center gap-2">
              <Activity size={14} className="text-cyan-400" /> FRIDAY Status
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-white/5">
                <span className="text-slate-400">Voice Engine</span>
                <span className={`font-mono ${fridayEnabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {fridayEnabled ? friday.voiceProvider : 'OFFLINE'}
                </span>
              </div>
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-white/5">
                <span className="text-slate-400">Mic Support</span>
                <span className={`font-mono ${friday.micSupported ? 'text-emerald-400' : 'text-red-400'}`}>
                  {friday.micSupported ? 'READY' : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-white/5">
                <span className="text-slate-400">State</span>
                <span className={`font-mono ${
                  !fridayEnabled ? 'text-slate-600' :
                  friday.listening ? 'text-red-400 animate-pulse' :
                  friday.processing ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {!fridayEnabled ? 'OFFLINE' : friday.listening ? 'LISTENING' : friday.processing ? 'PROCESSING' : 'STANDBY'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
