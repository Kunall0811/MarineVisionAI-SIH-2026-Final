import { useQuery } from '@tanstack/react-query';
import { Server, Database, HardDrive, Cpu, Mail, Waves } from 'lucide-react';
import { DashboardApi } from '../api/services';

function HealthCard({ icon: Icon, label, status, detail }: { icon: any; label: string; status: string; detail?: string }) {
  const ok = ['ONLINE', 'CONFIGURED'].includes(status);
  return (
    <div className="glass-panel rounded-lg p-4 flex items-start gap-3">
      <div className={`p-2 rounded ${ok ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-sm text-slate-200 font-medium">{label}</div>
        <div className={`text-xs mt-0.5 ${ok ? 'text-green-400' : 'text-amber-400'}`}>{status}</div>
        {detail && <div className="text-[11px] text-slate-500 mt-1">{detail}</div>}
      </div>
    </div>
  );
}

export default function SystemHealthPage() {
  const query = useQuery({ queryKey: ['system-health'], queryFn: DashboardApi.systemHealth, refetchInterval: 10000 });
  const h = query.data;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
        <Server className="text-cyan-400" size={20} /> System Health
      </h1>
      <p className="text-xs text-slate-500 -mt-4">Live status, checked every 10 seconds. Last check: {h ? new Date(h.checkedAt).toLocaleTimeString() : '-'}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HealthCard icon={Cpu} label="AI Inference Engine" status={h?.aiEngine?.status || 'UNKNOWN'} detail={`Model: ${h?.aiEngine?.modelVersion || 'N/A'} (${h?.aiEngine?.mode || 'N/A'})`} />
        <HealthCard icon={Database} label="Database (MongoDB)" status={h?.database?.status || 'UNKNOWN'} detail={`Ready state: ${h?.database?.readyState ?? '-'}`} />
        <HealthCard icon={HardDrive} label="Storage" status={h?.storage?.status || 'UNKNOWN'} detail={`Driver: ${h?.storage?.driver || 'N/A'}`} />
        <HealthCard icon={Waves} label="Processing Queue (BullMQ)" status={h?.queue?.status || 'UNKNOWN'} />
        <HealthCard icon={Mail} label="Email Service (SMTP)" status={h?.emailService?.status || 'UNKNOWN'} detail={h?.emailService?.status === 'NOT_CONFIGURED' ? 'Configure SMTP_HOST/SMTP_USER in .env to enable real sending.' : undefined} />
      </div>

      {h?.aiEngine?.mode === 'PLACEHOLDER_HEURISTIC' && (
        <div className="glass-panel rounded-lg p-4 border border-amber-500/30 text-xs text-amber-300">
          The detection engine is currently running the labelled placeholder heuristic detector (not a trained neural network). Train and activate a
          model via AI Models / Training, or drop a real YOLO ONNX file at the configured ONNX_MODEL_PATH, to switch to real inference.
        </div>
      )}
    </div>
  );
}
