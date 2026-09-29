import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users as UsersIcon, UserPlus, Trash2 } from 'lucide-react';
import { UsersApi } from '../api/services';
import { apiErrorMessage } from '../api/client';

export default function UsersPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin-users'], queryFn: () => UsersApi.list({ limit: 100 }) });
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'OPERATOR' });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const users = query.data?.data || [];

  const create = async () => {
    setError('');
    setCreating(true);
    try {
      await UsersApi.create(form);
      setForm({ fullName: '', email: '', password: '', role: 'OPERATOR' });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await UsersApi.update(id, { isActive: !isActive });
    qc.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this user account? This cannot be undone.')) return;
    await UsersApi.remove(id);
    qc.invalidateQueries({ queryKey: ['admin-users'] });
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
        <UsersIcon className="text-cyan-400" size={20} /> Users
      </h1>

      <div className="glass-panel rounded-lg p-4">
        <div className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
          <UserPlus size={16} className="text-cyan-400" /> Add user
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <input placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="bg-white/5 border border-cyan-500/15 rounded px-3 py-2 text-sm text-slate-200 flex-1 min-w-[160px]" />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-white/5 border border-cyan-500/15 rounded px-3 py-2 text-sm text-slate-200 flex-1 min-w-[200px]" />
          <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-white/5 border border-cyan-500/15 rounded px-3 py-2 text-sm text-slate-200 flex-1 min-w-[160px]" />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="bg-[#0b1a2e] border border-cyan-500/30 rounded px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 outline-none cursor-pointer"
          >
            <option value="OPERATOR" className="bg-[#0b1a2e] text-slate-100">OPERATOR</option>
            <option value="ADMIN" className="bg-[#0b1a2e] text-slate-100">ADMIN</option>
          </select>
          <button onClick={create} disabled={creating || !form.fullName || !form.email || !form.password} className="bg-cyan-600/80 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded">
            Create
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      <div className="glass-panel rounded-lg divide-y divide-white/5">
        {users.map((u: any) => (
          <div key={u.id} className="p-4 flex items-center justify-between gap-4 text-sm">
            <div>
              <div className="text-slate-100 font-medium">{u.fullName} <span className="text-slate-500">({u.email})</span></div>
              <div className="text-xs text-slate-500 mt-0.5">
                {u.role} &middot; {u.isActive ? 'Active' : 'Disabled'} &middot; Last login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={() => toggleActive(u.id, u.isActive)} className="text-xs text-slate-400 hover:text-cyan-300">
                {u.isActive ? 'Disable' : 'Enable'}
              </button>
              <button onClick={() => remove(u.id)} className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
