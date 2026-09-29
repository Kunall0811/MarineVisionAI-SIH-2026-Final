import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DatasetsApi } from '../api/services';
import { apiErrorMessage } from '../api/client';

export default function DatasetsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['datasets'], queryFn: DatasetsApi.list });
  const [form, setForm] = useState({ name: '', description: '', classesText: '' });
  const [error, setError] = useState('');

  const create = async () => {
    setError('');
    const classes = form.classesText.split(',').map((c) => c.trim()).filter(Boolean);
    if (classes.length < 2) {
      setError('Provide at least 2 comma-separated classes.');
      return;
    }
    try {
      const dataset = await DatasetsApi.create({ name: form.name, description: form.description, classes });
      setForm({ name: '', description: '', classesText: '' });
      qc.invalidateQueries({ queryKey: ['datasets'] });
      navigate(`/datasets/${dataset._id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this dataset and all its images?')) return;
    await DatasetsApi.remove(id);
    qc.invalidateQueries({ queryKey: ['datasets'] });
  };

  const datasets = query.data?.data || [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
        <Database className="text-cyan-400" size={20} /> Datasets
      </h1>
      <p className="text-xs text-slate-500 -mt-4">
        Upload labelled sonar image crops here to train a real (lightweight) classifier - see the Training page for details on what this pipeline
        can and can't do.
      </p>

      <div className="glass-panel rounded-lg p-4">
        <div className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
          <Plus size={16} className="text-cyan-400" /> New dataset
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/5 border border-cyan-500/15 rounded px-3 py-2 text-sm text-slate-200 flex-1 min-w-[160px]" />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-white/5 border border-cyan-500/15 rounded px-3 py-2 text-sm text-slate-200 flex-1 min-w-[200px]" />
          <input placeholder="Classes (comma separated)" value={form.classesText} onChange={(e) => setForm({ ...form, classesText: e.target.value })} className="bg-white/5 border border-cyan-500/15 rounded px-3 py-2 text-sm text-slate-200 flex-1 min-w-[220px]" />
          <button onClick={create} disabled={!form.name} className="bg-cyan-600/80 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded">
            Create
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      <div className="glass-panel rounded-lg divide-y divide-white/5">
        {datasets.length === 0 && <div className="p-6 text-sm text-slate-500 text-center">No datasets yet.</div>}
        {datasets.map((d: any) => (
          <div key={d._id} className="p-4 flex items-center justify-between gap-4 text-sm cursor-pointer hover:bg-white/5" onClick={() => navigate(`/datasets/${d._id}`)}>
            <div>
              <div className="text-slate-100 font-medium">{d.name}</div>
              <div className="text-xs text-slate-500">
                {d.classes.join(', ')} &middot; {d.imageCount} image(s) &middot; {d.status}
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); remove(d._id); }} className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
