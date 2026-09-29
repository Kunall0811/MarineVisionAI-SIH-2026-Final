import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Globe2,
  Map as MapIcon,
  LayoutDashboard,
  Waves,
  ShieldCheck,
  LogOut,
  ShieldAlert,
  BarChart3,
  FileText,
  Cpu,
  Database,
  GraduationCap,
  Users as UsersIcon,
  Bell,
  ScrollText,
  Server,
  Mail,
  Bot,
  User,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useRealtimeStore } from '../store/realtime.store';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NotificationsApi, AuthApi } from '../api/services';
import { AiDetectorBadge } from './AiDetectorBadge';
import { FridayWidget } from './FridayWidget';
import { X, CheckCircle, AlertTriangle, Info, BellRing } from 'lucide-react';

const NAV_ITEMS_ADMIN = [
  { to: '/', label: 'Command Dashboard', icon: LayoutDashboard },
  { to: '/globe', label: 'Global 3D Earth', icon: Globe2 },
  { to: '/surveys', label: 'Surveys', icon: Waves },
  { to: '/map', label: 'GIS Map', icon: MapIcon },
  { to: '/anomaly-review', label: 'Anomaly Review', icon: ShieldAlert },
  { to: '/ai-test', label: 'AI Model Test', icon: Cpu },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/models', label: 'AI Models', icon: Cpu },
  { to: '/datasets', label: 'Datasets', icon: Database },
  { to: '/training', label: 'Training', icon: GraduationCap },
  { to: '/users', label: 'Users', icon: UsersIcon },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { to: '/system-health', label: 'System Health', icon: Server },
  { to: '/mail-automation', label: 'Mail Automation', icon: Mail },
];

const NAV_ITEMS_OPERATOR = [
  { to: '/', label: 'Operator Dashboard', icon: LayoutDashboard },
  { to: '/globe', label: 'Global 3D Earth', icon: Globe2 },
  { to: '/surveys', label: 'My Surveys', icon: Waves },
  { to: '/map', label: 'GIS Map', icon: MapIcon },
  { to: '/anomaly-review', label: 'Anomaly Review', icon: ShieldAlert },
  { to: '/ai-test', label: 'AI Model Test', icon: Cpu },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'Profile', icon: User },
];

export function Layout() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const items = user?.role === 'ADMIN' ? NAV_ITEMS_ADMIN : NAV_ITEMS_OPERATOR;
  const connect = useRealtimeStore(s => s.connect);
  const disconnect = useRealtimeStore(s => s.disconnect);
  const { on, off } = useRealtimeStore();

  const [activeToast, setActiveToast] = useState<{
    id: string;
    title: string;
    message: string;
    severity?: string;
  } | null>(null);

  const notificationsQuery = useQuery({
    queryKey: ['notifications-badge'],
    queryFn: () => NotificationsApi.list({ limit: 1 }),
    refetchInterval: 12000,
    enabled: !!user,
  });

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    const handleNotification = (notif: any) => {
      queryClient.invalidateQueries({ queryKey: ['notifications-badge'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['anomalies-list'] });

      setActiveToast({
        id: notif.id || String(Date.now()),
        title: notif.title || 'System Notification',
        message: notif.message || 'New update recorded on 3D Globe and Operator console.',
        severity: notif.severity || 'INFO',
      });
    };

    const handleAnomalyUpdate = (anomaly: any) => {
      queryClient.invalidateQueries({ queryKey: ['notifications-badge'] });
      queryClient.invalidateQueries({ queryKey: ['anomalies-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['globe-surveys'] });

      const action = anomaly.status === 'verified' ? 'Verified' : anomaly.status === 'rejected' ? 'Rejected' : 'Updated';
      setActiveToast({
        id: String(Date.now()),
        title: `Globe Synchronized: ${anomaly.targetName || anomaly.anomalyId}`,
        message: `Anomaly ${anomaly.anomalyId} (${anomaly.detailedType || anomaly.type}) marked as ${action.toUpperCase()}. Reflected on all operator globes.`,
        severity: anomaly.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'INFO',
      });
    };

    const handleGlobeRefresh = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['anomalies-list'] });
      queryClient.invalidateQueries({ queryKey: ['globe-surveys'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-badge'] });
      setActiveToast({
        id: String(Date.now()),
        title: '3D Globe Map Refreshed',
        message: data?.message || 'New verified anomalies deployed directly to 3D Globe.',
        severity: 'INFO',
      });
    };

    const handleCoordinateUpdate = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['anomalies-list'] });
      queryClient.invalidateQueries({ queryKey: ['globe-anomalies'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-badge'] });
      setActiveToast({
        id: String(Date.now()),
        title: `📍 Coordinates Updated on Globe: ${data.targetName || data.anomalyCode || 'Anomaly'}`,
        message: `Admin moved anomaly to [${data.coordinates?.[1]?.toFixed(5) || data.latitude}, ${data.coordinates?.[0]?.toFixed(5) || data.longitude}]. Instant sync applied to 3D Globe.`,
        severity: 'INFO',
      });
    };

    const handleDatasetSubmitted = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-badge'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setActiveToast({
        id: String(Date.now()),
        title: `📥 Sonar Dataset Submitted: ${data.datasetName}`,
        message: `Operator ${data.submittedBy} submitted ${data.imageCount} sonar frames for Admin analysis.`,
        severity: 'INFO',
      });
    };

    const handleDatasetReviewed = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      queryClient.invalidateQueries({ queryKey: ['dataset'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-badge'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setActiveToast({
        id: String(Date.now()),
        title: `Dataset ${data.decision === 'APPROVED' ? 'Approved ✅' : 'Rejected ❌'}`,
        message: `Admin has ${data.decision.toLowerCase()} the dataset. Notes: ${data.reviewNotes || 'Completed'}`,
        severity: data.decision === 'APPROVED' ? 'INFO' : 'MEDIUM',
      });
    };

    on('notification_created', handleNotification);
    on('anomaly_created', handleAnomalyUpdate);
    on('anomaly_updated', handleAnomalyUpdate);
    on('anomaly_verified', handleAnomalyUpdate);
    on('anomaly_rejected', handleAnomalyUpdate);
    on('globe_refresh', handleGlobeRefresh);
    on('coordinate_updated', handleCoordinateUpdate);
    on('dataset_submitted', handleDatasetSubmitted);
    on('dataset_reviewed', handleDatasetReviewed);

    return () => {
      off('notification_created', handleNotification);
      off('anomaly_created', handleAnomalyUpdate);
      off('anomaly_updated', handleAnomalyUpdate);
      off('anomaly_verified', handleAnomalyUpdate);
      off('anomaly_rejected', handleAnomalyUpdate);
      off('globe_refresh', handleGlobeRefresh);
      off('coordinate_updated', handleCoordinateUpdate);
      off('dataset_submitted', handleDatasetSubmitted);
      off('dataset_reviewed', handleDatasetReviewed);
    };
  }, [on, off, queryClient]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => setActiveToast(null), 7000);
    return () => clearTimeout(timer);
  }, [activeToast]);

  const handleLogout = async () => {
    try {
      await AuthApi.logout();
    } finally {
      clearSession();
      navigate('/login');
    }
  };

  return (
    <div className="h-screen overflow-hidden flex bg-ocean-950 text-slate-200 relative">
      {/* Real-time Global Notification Toast */}
      {activeToast && (
        <div className="fixed top-5 right-5 z-[9999] max-w-sm w-full glass-panel p-4 rounded-xl border border-cyan-500/40 bg-ocean-950/95 shadow-2xl shadow-cyan-500/20 animate-in slide-in-from-top duration-300">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${
              activeToast.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-400'
            }`}>
              {activeToast.severity === 'CRITICAL' ? <AlertTriangle size={18} /> : <BellRing size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>{activeToast.title}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </h5>
              <p className="text-xs text-slate-300 mt-0.5 leading-snug line-clamp-2">
                {activeToast.message}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveToast(null);
                    navigate('/notifications');
                  }}
                  className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline"
                >
                  Open Notification Panel &rarr;
                </button>
              </div>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-slate-200 p-1"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <aside className="w-60 shrink-0 border-r border-cyan-500/10 glass-panel flex flex-col">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-cyan-500/10">
          <img src="/logo.svg" alt="MarineVision AI" className="w-7 h-7 shrink-0" />
          <div>
            <div className="font-semibold tracking-wide text-cyan-300 text-sm">MARINEVISION AI</div>
            <div className="text-[10px] text-slate-500">SIH26057 Command Console</div>
          </div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <item.icon size={16} />
                <span>{item.label}</span>
              </div>
              {item.to === '/notifications' && unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500 text-black shadow-[0_0_8px_#06b6d4]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-cyan-500/10 text-xs">
          <div className="mb-3">
            <AiDetectorBadge />
          </div>
          <div className="flex items-center gap-2 mb-2 text-slate-400">
            <ShieldCheck size={14} className="text-cyan-400" />
            <span>{user?.role}</span>
          </div>
          <div className="truncate text-slate-500 mb-3">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <FridayWidget />
    </div>
  );
}
