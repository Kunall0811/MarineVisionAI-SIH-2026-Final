import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { AuditApi } from '../api/services';

export default function AuditLogsPage() {
  const [category, setCategory] = useState('');
  const categoriesQuery = useQuery({ queryKey: ['audit-categories'], queryFn: AuditApi.categories });
  const logsQuery = useQuery({
    queryKey: ['audit-logs', category],
    queryFn: () => AuditApi.list({ category: category || undefined, limit: 100 }),
  });

  const logs = logsQuery.data?.data || [];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
        <ScrollText className="text-cyan-400" size={20} /> Audit Logs
      </h1>

      <div className="glass-panel rounded-lg p-3 flex items-center gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-[#0b1a2e] border border-cyan-500/30 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-400 outline-none cursor-pointer"
        >
          <option value="" className="bg-[#0b1a2e] text-slate-400">All categories</option>
          {(categoriesQuery.data || []).map((c: string) => (
            <option key={c} value={c} className="bg-[#0b1a2e] text-slate-100">
              {c}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500 ml-auto">{logsQuery.data?.meta?.total ?? 0} total</span>
      </div>

      <div className="glass-panel rounded-lg divide-y divide-white/5 max-h-[70vh] overflow-auto">
        {logs.length === 0 && <div className="p-6 text-sm text-slate-500 text-center">No audit entries yet.</div>}
        {logs.map((l: any) => (
          <div key={l._id} className="p-3 text-xs flex items-start justify-between gap-4">
            <div>
              <div className="text-slate-200">
                <span className="font-medium">{l.userEmail}</span> <span className="text-slate-500">({l.userRole})</span> &middot;{' '}
                <span className="text-cyan-400">{l.action}</span>
              </div>
              <div className="text-slate-500 mt-0.5">
                {l.category}
                {l.targetType ? ` · ${l.targetType}${l.targetId ? ` (${l.targetId})` : ''}` : ''}
              </div>
              {Object.keys(l.metadata || {}).length > 0 && (
                <div className="text-slate-600 mt-0.5 font-mono text-[10px] truncate max-w-xl">{JSON.stringify(l.metadata)}</div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className={`text-[10px] uppercase ${l.outcome === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}`}>{l.outcome}</div>
              <div className="text-slate-600">{new Date(l.createdAt).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
