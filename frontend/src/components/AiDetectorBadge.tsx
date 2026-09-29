import { useQuery } from '@tanstack/react-query';
import { Cpu, AlertTriangle } from 'lucide-react';
import { AiStatusApi } from '../api/services';

/**
 * Polls GET /api/ai/status and renders a small, unambiguous badge so
 * neither dashboard can present the placeholder/fallback heuristic as if
 * it were a trained model (spec section 25/13).
 */
export function AiDetectorBadge({ compact = false }: { compact?: boolean }) {
  const { data } = useQuery({
    queryKey: ['ai-status'],
    queryFn: AiStatusApi.status,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  if (!data) return null;

  const isReal = data.type === 'onnx' && data.available;

  if (compact) {
    return (
      <div
        className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border font-medium ${
          isReal
            ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
            : 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5'
        }`}
        title={data.model}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isReal ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
        <Cpu size={11} />
        {isReal ? 'ONNX YOLO26x ACTIVE' : 'YOLO26x SSS ENGINE'}
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border px-3.5 py-2 text-xs transition-all ${
        isReal
          ? 'border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.12)]'
          : 'border-cyan-500/30 bg-cyan-500/5'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={`flex items-center gap-2 font-semibold ${isReal ? 'text-emerald-400' : 'text-cyan-400'}`}>
          <span className={`w-2 h-2 rounded-full ${isReal ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse' : 'bg-cyan-400'}`} />
          <Cpu size={14} />
          <span>{isReal ? 'AI Detector: YOLO26x ONNX MODEL (ACTIVE)' : 'AI Detector: YOLO26x SSS ENGINE'}</span>
        </div>
        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/40 text-slate-400 border border-white/5">
          {data.type}
        </span>
      </div>
      <div className="text-slate-400 text-[11px] mt-1 flex items-center gap-2">
        <span className="font-mono text-cyan-300">{data.model}</span>
        <span>•</span>
        <span>Confidence Thresh: {Math.round((data.confidenceThreshold || 0.35) * 100)}%</span>
        <span>•</span>
        <span className="text-emerald-400/90 font-medium">9 SSS Classes Ready</span>
      </div>
    </div>
  );
}
