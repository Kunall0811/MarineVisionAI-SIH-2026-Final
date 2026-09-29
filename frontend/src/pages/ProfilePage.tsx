import { User, ShieldCheck, Mail, Calendar } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  const permissions = user.operatorPermissions
    ? Object.entries(user.operatorPermissions).filter(([, v]) => typeof v === 'boolean')
    : [];

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
        <User className="text-cyan-400" size={20} /> Profile
      </h1>

      <div className="glass-panel rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-cyan-500/15 flex items-center justify-center text-cyan-300 font-semibold text-lg">
            {user.fullName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div className="text-slate-100 font-medium">{user.fullName}</div>
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <Mail size={12} /> {user.email}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-white/5">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1">
              <ShieldCheck size={11} /> Role
            </div>
            <div className="text-slate-200 mt-0.5">{user.role}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1">
              <Calendar size={11} /> Account status
            </div>
            <div className="text-slate-200 mt-0.5">Active</div>
          </div>
        </div>

        {user.role === 'OPERATOR' && permissions.length > 0 && (
          <div className="pt-2 border-t border-white/5">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Your permissions</div>
            <div className="flex flex-wrap gap-2">
              {permissions.map(([key, value]) => (
                <span
                  key={key}
                  className={`text-[11px] px-2 py-1 rounded border ${
                    value ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-slate-500 border-slate-600/30 bg-slate-500/5'
                  }`}
                >
                  {key} {value ? '✓' : '✗'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
