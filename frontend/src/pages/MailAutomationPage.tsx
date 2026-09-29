import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Trash2, Plus } from 'lucide-react';
import { MailApi } from '../api/services';
import { apiErrorMessage } from '../api/client';

const EVENTS = ['HIGH_RISK_ANOMALY', 'REPORT_GENERATED', 'SURVEY_COMPLETED', 'PROCESSING_FAILURE', 'ANOMALY_VERIFIED'];

export default function MailAutomationPage() {
  const qc = useQueryClient();
  const recipientsQuery = useQuery({ queryKey: ['mail-recipients'], queryFn: MailApi.recipients });
  const logsQuery = useQuery({ queryKey: ['mail-logs'], queryFn: () => MailApi.logs({ limit: 30 }) });

  const [form, setForm] = useState({ name: '', email: '', organization: '', subscribedEvents: [...EVENTS] });
  const [error, setError] = useState('');

  const toggleEvent = (event: string) => {
    setForm((f) => ({
      ...f,
      subscribedEvents: f.subscribedEvents.includes(event) ? f.subscribedEvents.filter((e) => e !== event) : [...f.subscribedEvents, event],
    }));
  };

  const add = async () => {
    setError('');
    try {
      await MailApi.addRecipient(form);
      setForm({ name: '', email: '', organization: '', subscribedEvents: [...EVENTS] });
      qc.invalidateQueries({ queryKey: ['mail-recipients'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const remove = async (id: string) => {
    await MailApi.removeRecipient(id);
    qc.invalidateQueries({ queryKey: ['mail-recipients'] });
  };

  const recipients = recipientsQuery.data || [];
  const logs = logsQuery.data?.data || [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
        <Mail className="text-cyan-400" size={20} /> Mail Automation
      </h1>
      <p className="text-xs text-slate-500 -mt-4">
        Authorized recipients configured here receive automatic alert emails via SMTP + a BullMQ queue. If SMTP isn't configured, sends are logged
        instead of failing silently - see the log below.
      </p>

      <div className="glass-panel rounded-lg p-4">
        <div className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
          <Plus size={16} className="text-cyan-400" /> Add authorized recipient
        </div>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/5 border border-cyan-500/15 rounded px-3 py-2 text-sm text-slate-200 flex-1 min-w-[160px]" />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-white/5 border border-cyan-500/15 rounded px-3 py-2 text-sm text-slate-200 flex-1 min-w-[200px]" />
          <input placeholder="Organization" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="bg-white/5 border border-cyan-500/15 rounded px-3 py-2 text-sm text-slate-200 flex-1 min-w-[160px]" />
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {EVENTS.map((e) => (
            <label key={e} className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-white/5 px-2 py-1 rounded cursor-pointer">
              <input type="checkbox" checked={form.subscribedEvents.includes(e)} onChange={() => toggleEvent(e)} />
              {e.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
        <button onClick={add} disabled={!form.name || !form.email} className="bg-cyan-600/80 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded">
          Add recipient
        </button>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      <div className="glass-panel rounded-lg divide-y divide-white/5">
        <div className="px-4 py-3 text-sm font-medium text-slate-200">Authorized recipients</div>
        {recipients.length === 0 && <div className="p-6 text-sm text-slate-500 text-center">No recipients configured yet - alerts will be logged only.</div>}
        {recipients.map((r: any) => (
          <div key={r._id} className="p-4 flex items-center justify-between gap-4 text-sm">
            <div>
              <div className="text-slate-100 font-medium">{r.name} <span className="text-slate-500">({r.email})</span></div>
              <div className="text-xs text-slate-500">{r.organization || 'No organization'} &middot; {r.subscribedEvents.length} event(s)</div>
            </div>
            <button onClick={() => remove(r._id)} className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-lg divide-y divide-white/5">
        <div className="px-4 py-3 text-sm font-medium text-slate-200">Recent email log</div>
        {logs.length === 0 && <div className="p-6 text-sm text-slate-500 text-center">No emails logged yet.</div>}
        {logs.map((l: any) => (
          <div key={l._id} className="p-3 text-xs flex items-center justify-between gap-4">
            <div>
              <div className="text-slate-200">{l.subject}</div>
              <div className="text-slate-500">To: {l.to} &middot; Trigger: {l.triggerEvent}</div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-[10px] uppercase ${l.status === 'SENT' ? 'text-green-400' : l.status === 'FAILED' ? 'text-red-400' : 'text-amber-400'}`}>{l.status}</div>
              <div className="text-slate-600">{new Date(l.createdAt).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
