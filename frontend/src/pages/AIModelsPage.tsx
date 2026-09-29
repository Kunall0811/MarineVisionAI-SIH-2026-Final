import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, CheckCircle2 } from 'lucide-react';
import { ModelsApi } from '../api/services';
import { apiErrorMessage } from '../api/client';

const QUALITY_STATE_STYLE: Record<string, string> = {
  EXPERIMENTAL: 'text-slate-400 border-slate-500/30 bg-slate-500/5',
  VALIDATED: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5',
  PRODUCTION_CANDIDATE: 'text-amber-400 border-amber-500/30 bg-amber-500/5',
  ACTIVE: 'text-green-400 border-green-500/30 bg-green-500/10',
};

export default function AIModelsPage() {
  const qc = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['model-versions'], queryFn: ModelsApi.list });
  const versions = query.data || [];

  const activate = async (id: string) => {
    setActionError(null);
    try {
      await ModelsApi.activate(id);
      qc.invalidateQueries({ queryKey: ['model-versions'] });
    } catch (e) {
      setActionError(apiErrorMessage(e));
    }
  };

  const promote = async (id: string) => {
    setActionError(null);
    try {
      await ModelsApi.promote(id);
      qc.invalidateQueries({ queryKey: ['model-versions'] });
    } catch (e) {
      setActionError(apiErrorMessage(e));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
        <Cpu className="text-cyan-400" size={20} /> AI Models
      </h1>
      <p className="text-xs text-slate-500 -mt-4 max-w-3xl">
        These are lightweight classifiers produced by the Training pipeline, each exported as a real, structurally-valid ONNX file. Activating a
        version here marks it as the active classifier for triage/tagging - it does <span className="text-amber-400">not</span> replace the live
        sonar bounding-box detector, which requires a trained YOLO ONNX model placed at the server's configured ONNX_MODEL_PATH.
      </p>

      {actionError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2 max-w-3xl">
          {actionError}
        </div>
      )}

      <div className="glass-panel rounded-lg divide-y divide-white/5">
        {versions.length === 0 && <div className="p-6 text-sm text-slate-500 text-center">No trained model versions yet. Run a training job first.</div>}
        {versions.map((v: any) => (
          <div key={v._id} className="p-4 flex items-center justify-between gap-4 text-sm">
            <div>
              <div className="text-slate-100 font-medium flex items-center gap-2">
                {v.version}
                {v.isActive && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/30 flex items-center gap-1">
                    <CheckCircle2 size={10} /> Active
                  </span>
                )}
                <span
                  className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                    QUALITY_STATE_STYLE[v.qualityState] || QUALITY_STATE_STYLE.EXPERIMENTAL
                  }`}
                >
                  {v.qualityState || 'EXPERIMENTAL'}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {v.architecture} &middot; classes: {v.classLabels.join(', ')} &middot; accuracy{' '}
                {v.metricsSnapshot?.accuracy != null ? `${(v.metricsSnapshot.accuracy * 100).toFixed(1)}%` : 'N/A'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {v.qualityState === 'VALIDATED' && !v.isActive && (
                <button onClick={() => promote(v._id)} className="text-xs bg-amber-600/70 hover:bg-amber-500 text-white px-3 py-1.5 rounded">
                  Mark candidate
                </button>
              )}
              {!v.isActive && (
                <button onClick={() => activate(v._id)} className="text-xs bg-cyan-600/80 hover:bg-cyan-500 text-white px-3 py-1.5 rounded">
                  Activate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
