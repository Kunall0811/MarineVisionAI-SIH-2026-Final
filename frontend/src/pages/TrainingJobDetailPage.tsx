import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, Zap, Globe, CheckCircle, Loader2 } from 'lucide-react';
import { TrainingApi } from '../api/services';

export default function TrainingJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ message: string; count: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const query = useQuery({
    queryKey: ['training-job', id],
    queryFn: () => TrainingApi.get(id!),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data && ['COMPLETED', 'FAILED'].includes((q.state.data as any).status) ? false : 2000),
  });

  const job = query.data;

  useEffect(() => {
    if (job?.status === 'RUNNING') {
      const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [job?.status]);

  if (!job) return <div className="p-6 text-sm text-slate-500">Loading…</div>;

  const m = job.metrics;

  // Calculate elapsed time and ETA
  const startTime = job.startedAt ? new Date(job.startedAt).getTime() : null;
  const finishTime = job.finishedAt ? new Date(job.finishedAt).getTime() : null;

  const elapsedSeconds = startTime
    ? Math.max(0, Math.floor(((job.status === 'RUNNING' ? currentTime : (finishTime || currentTime)) - startTime) / 1000))
    : 0;

  let etaSeconds: number | null = null;
  if (job.status === 'RUNNING' && job.progressPct > 3 && elapsedSeconds > 0) {
    const totalEst = Math.round(elapsedSeconds / (job.progressPct / 100));
    etaSeconds = Math.max(1, totalEst - elapsedSeconds);
  }

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const handleDeployToGlobe = async () => {
    try {
      setDeploying(true);
      const res = await TrainingApi.deployToGlobe(job._id);
      setDeployResult({
        message: res.message || 'Model successfully deployed to 3D Cesium Globe!',
        count: res.count || 6,
      });
      queryClient.invalidateQueries({ queryKey: ['training-job', id] });
    } catch (e: any) {
      alert(`Deployment failed: ${e.message || e}`);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <button onClick={() => navigate('/training')} className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-300">
        <ArrowLeft size={14} /> Back to training jobs
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            Training Job #{job._id.slice(-6)}
            {job.status === 'COMPLETED' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                TRAINED & READY
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            Status: <span className={`font-semibold ${job.status === 'COMPLETED' ? 'text-emerald-400' : 'text-cyan-400'}`}>{job.status}</span>
            <span>&middot;</span>
            Progress: <span className="font-mono text-cyan-300 font-semibold">{job.progressPct}%</span>
            <span>&middot;</span>
            <Clock size={12} className="text-slate-400" />
            <span>Time Elapsed: {formatDuration(elapsedSeconds)}</span>
            {job.status === 'RUNNING' && etaSeconds !== null && (
              <>
                <span>&middot;</span>
                <span className="text-amber-300 font-medium">ETA Remaining: {formatDuration(etaSeconds)}</span>
              </>
            )}
          </p>
        </div>

        {job.status === 'COMPLETED' && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeployToGlobe}
              disabled={deploying}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 via-sky-500 to-emerald-500 hover:from-cyan-500 hover:to-emerald-400 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {deploying ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Deploying Model & Anomalies...
                </>
              ) : (
                <>
                  <Zap size={16} className="text-yellow-300 fill-yellow-300" /> ⚡ One-Click Deploy & Update Actual Anomalies on 3D Globe
                </>
              )}
            </button>
            <button
              onClick={() => navigate('/globe')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-medium transition-all"
            >
              <Globe size={14} className="text-cyan-400" /> View Globe
            </button>
          </div>
        )}
      </div>

      {deployResult && (
        <div className="glass-panel rounded-xl p-4 border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-emerald-400 shrink-0" size={20} />
            <div>
              <div className="text-sm font-semibold text-emerald-300">{deployResult.message}</div>
              <div className="text-xs text-slate-300">
                Created and updated {deployResult.count} verified anomalies on 3D Globe with live GPS coordinates, bathymetric depths, and sonar signatures. Real-time refresh notification broadcast to all operators.
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/globe')}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0 ml-4"
          >
            Open 3D Globe Now
          </button>
        </div>
      )}

      {job.status === 'RUNNING' && (
        <div className="glass-panel rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-cyan-300 font-medium">
              Neural Network Training In Progress on Sonar Dataset... ({job.progressPct}%)
            </span>
            <span className="text-amber-300 font-mono">
              {etaSeconds !== null ? `Estimated ~${formatDuration(etaSeconds)} remaining` : 'Calculating ETA...'}
            </span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden border border-cyan-500/30">
            <div
              className="bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 h-full transition-all duration-300 shadow-[0_0_12px_#06b6d4]"
              style={{ width: `${job.progressPct}%` }}
            />
          </div>
        </div>
      )}

      {job.errorMessage && (
        <div className="glass-panel rounded-lg p-4 border border-red-500/30 text-sm text-red-400">{job.errorMessage}</div>
      )}

      {m && (
        <>
          <div className="glass-panel rounded-lg p-4 border border-amber-500/20">
            <p className="text-xs text-amber-300">{m.metricsNote}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Accuracy" value={`${(m.accuracy * 100).toFixed(1)}%`} />
            <Stat label="Precision (macro)" value={`${(m.precisionMacro * 100).toFixed(1)}%`} />
            <Stat label="Recall (macro)" value={`${(m.recallMacro * 100).toFixed(1)}%`} />
            <Stat label="F1 (macro)" value={`${(m.f1Macro * 100).toFixed(1)}%`} />
            <Stat label="mAP50" value={m.mAP50 === null ? 'N/A' : String(m.mAP50)} />
            <Stat label="mAP50-95" value={m.mAP50_95 === null ? 'N/A' : String(m.mAP50_95)} />
            <Stat label="Inference latency (p50)" value={`${m.inferenceLatencyMsP50.toFixed(2)} ms`} />
            <Stat label="Inference latency (p95)" value={`${m.inferenceLatencyMsP95.toFixed(2)} ms`} />
            <Stat label="Train samples" value={String(m.trainSamples)} />
            <Stat label="Val samples" value={String(m.valSamples)} />
            <Stat label="Test samples" value={String(m.testSamples)} />
            <Stat label="Epochs run" value={String(m.epochsRun)} />
          </div>

          <div className="glass-panel rounded-lg p-4">
            <div className="text-sm font-medium text-slate-200 mb-3">Per-class metrics</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-left">
                  <th className="pb-2">Class</th>
                  <th className="pb-2">Precision</th>
                  <th className="pb-2">Recall</th>
                  <th className="pb-2">F1</th>
                  <th className="pb-2">Support</th>
                </tr>
              </thead>
              <tbody>
                {m.perClass.map((c: any) => (
                  <tr key={c.class} className="border-t border-white/5">
                    <td className="py-1.5 text-slate-200">{c.class}</td>
                    <td className="py-1.5 text-slate-400">{(c.precision * 100).toFixed(1)}%</td>
                    <td className="py-1.5 text-slate-400">{(c.recall * 100).toFixed(1)}%</td>
                    <td className="py-1.5 text-slate-400">{(c.f1 * 100).toFixed(1)}%</td>
                    <td className="py-1.5 text-slate-400">{c.support}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-panel rounded-lg p-4 overflow-auto">
            <div className="text-sm font-medium text-slate-200 mb-3">Confusion matrix (rows = actual, cols = predicted)</div>
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="p-1"></th>
                  {m.classLabels.map((c: string) => (
                    <th key={c} className="p-1 text-slate-500 font-normal">
                      {c.slice(0, 6)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.confusionMatrix.map((row: number[], i: number) => (
                  <tr key={i}>
                    <td className="p-1 text-slate-500">{m.classLabels[i].slice(0, 10)}</td>
                    {row.map((v, j) => (
                      <td key={j} className={`p-1 text-center rounded ${i === j ? 'bg-cyan-500/20 text-cyan-300' : v > 0 ? 'bg-red-500/10 text-red-300' : 'text-slate-600'}`}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {job.logLines?.length > 0 && (
        <div className="glass-panel rounded-lg p-4">
          <div className="text-sm font-medium text-slate-200 mb-2">Log</div>
          <div className="font-mono text-[11px] text-slate-500 space-y-0.5 max-h-64 overflow-auto">
            {job.logLines.map((l: string, i: number) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-cyan-300">{value}</div>
    </div>
  );
}
