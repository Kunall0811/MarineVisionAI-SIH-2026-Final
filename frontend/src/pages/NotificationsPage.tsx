import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ArrowRight, ExternalLink } from 'lucide-react';
import { NotificationsApi } from '../api/services';

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-400 border-red-500/30 bg-red-500/10',
  HIGH: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  MEDIUM: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  LOW: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  INFO: 'text-slate-300 border-slate-500/30 bg-slate-500/10',
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['notifications'], queryFn: () => NotificationsApi.list({ limit: 50 }), refetchInterval: 15000 });

  const markRead = async (id: string) => {
    await NotificationsApi.markRead(id);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const markAllRead = async () => {
    await NotificationsApi.markAllRead();
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const items = query.data?.data || [];
  const unreadCount = query.data?.meta?.unreadCount ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
          <Bell className="text-cyan-400" size={20} /> Notifications
          {unreadCount > 0 && <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">{unreadCount} unread</span>}
        </h1>
        <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors">
          <CheckCheck size={14} /> Mark all read
        </button>
      </div>

      <div className="glass-panel rounded-lg divide-y divide-white/5">
        {items.length === 0 && <div className="p-6 text-sm text-slate-500 text-center">No notifications yet.</div>}
        {items.map((n: any) => (
          <div key={n._id} className={`p-4 flex items-start justify-between gap-4 ${n.isRead ? 'opacity-60' : ''}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${SEVERITY_COLOR[n.severity] || SEVERITY_COLOR.INFO}`}>
                  {n.severity}
                </span>
                <span className="text-sm text-slate-100 font-medium">{n.title}</span>
              </div>
              <p className="text-xs text-slate-400">{n.message}</p>
              
              {/* Linked Record Actions (User Requirement 34) */}
              <div className="flex items-center gap-2 mt-2">
                {n.metadata?.datasetId && (
                  <button
                    onClick={() => {
                      if (!n.isRead) markRead(n._id);
                      navigate(`/datasets/${n.metadata.datasetId}`);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded transition-colors"
                  >
                    <span>Open Dataset Review</span>
                    <ExternalLink size={11} />
                  </button>
                )}
                {n.metadata?.anomalyId && (
                  <button
                    onClick={() => {
                      if (!n.isRead) markRead(n._id);
                      navigate('/anomalies-review');
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded transition-colors"
                  >
                    <span>Inspect Anomaly</span>
                    <ArrowRight size={11} />
                  </button>
                )}
                {n.metadata?.coordinates && (
                  <button
                    onClick={() => {
                      if (!n.isRead) markRead(n._id);
                      const [lon, lat] = n.metadata.coordinates;
                      navigate(`/globe?lat=${lat}&lon=${lon}`);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded transition-colors"
                  >
                    <span>View on 3D Globe</span>
                    <ExternalLink size={11} />
                  </button>
                )}
              </div>

              <p className="text-[10px] text-slate-600 mt-2">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
            {!n.isRead && (
              <button onClick={() => markRead(n._id)} className="text-[11px] text-cyan-400 hover:text-cyan-300 shrink-0">
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
