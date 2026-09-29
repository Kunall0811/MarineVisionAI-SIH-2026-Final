import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldX, ShieldAlert, ListFilter } from 'lucide-react';
import { DetectionsApi } from '../api/services';
import { DataTag } from '../components/DataTag';

const RISK_LEVELS = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'NEEDS_REVIEW'];

export default function AnomalyReviewPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [riskLevel, setRiskLevel] = useState('');
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [klass, setKlass] = useState('');

  const query = useQuery({
    queryKey: ['anomaly-review', riskLevel, status, klass],
    queryFn: () => DetectionsApi.list({ riskLevel: riskLevel || undefined, status: status || undefined, class: klass || undefined, limit: 100 }),
    refetchInterval: 10000,
  });

  const act = async (id: string, action: 'verify' | 'reject' | 'review') => {
    if (action === 'verify') await DetectionsApi.verify(id);
    if (action === 'reject') await DetectionsApi.reject(id);
    if (action === 'review') await DetectionsApi.review(id);
    qc.invalidateQueries({ queryKey: ['anomaly-review'] });
  };

  const items = query.data?.data || [];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
        <ShieldCheck className="text-cyan-400" size={20} /> Anomaly Review
      </h1>

      <div className="glass-panel rounded-lg p-3 flex flex-wrap items-center gap-3">
        <ListFilter size={14} className="text-slate-500" />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-[#0b1a2e] border border-cyan-500/30 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-400 outline-none cursor-pointer"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} className="bg-[#0b1a2e] text-slate-100">
              {s || 'All statuses'}
            </option>
          ))}
        </select>
        <select
          value={riskLevel}
          onChange={(e) => setRiskLevel(e.target.value)}
          className="bg-[#0b1a2e] border border-cyan-500/30 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-400 outline-none cursor-pointer"
        >
          {RISK_LEVELS.map((r) => (
            <option key={r} value={r} className="bg-[#0b1a2e] text-slate-100">
              {r || 'All risk levels'}
            </option>
          ))}
        </select>
        <input
          value={klass}
          onChange={(e) => setKlass(e.target.value)}
          placeholder="class (e.g. ghost_net)"
          className="bg-white/5 border border-cyan-500/15 rounded px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
        />
        <span className="text-xs text-slate-500 ml-auto">{items.length} result(s)</span>
      </div>

      <div className="glass-panel rounded-lg divide-y divide-white/5">
        {items.length === 0 && <div className="p-6 text-sm text-slate-500 text-center">No detections match this filter.</div>}
        {items.map((d: any) => (
          <div key={d._id} className="p-4 flex items-center justify-between gap-4 text-sm">
            <div className="flex-1 cursor-pointer" onClick={() => navigate(`/sonar/${d.sonarFrameId}`)}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-slate-100 font-medium">{d.anomalyCode}</span>
                <span className="text-slate-500">{d.class.replace(/_/g, ' ')}</span>
                <DataTag variant={d.locationStatus.toLowerCase() as any} />
                <DataTag variant={d.dataType.toLowerCase() as any} />
                <span
                  className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                    d.riskLevel === 'CRITICAL' || d.riskLevel === 'HIGH'
                      ? 'text-red-400 border-red-500/30 bg-red-500/10'
                      : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                  }`}
                >
                  {d.riskLevel}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Confidence {(d.finalConfidence * 100).toFixed(1)}% &middot; {d.latitude ?? 'N/A'}, {d.longitude ?? 'N/A'} &middot; Status: {d.status}
              </div>
            </div>
            {d.status === 'PENDING_REVIEW' && (
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => act(d._id, 'verify')} className="p-1.5 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20" title="Verify">
                  <ShieldCheck size={16} />
                </button>
                <button onClick={() => act(d._id, 'review')} className="p-1.5 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" title="Needs review">
                  <ShieldAlert size={16} />
                </button>
                <button onClick={() => act(d._id, 'reject')} className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Reject">
                  <ShieldX size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
