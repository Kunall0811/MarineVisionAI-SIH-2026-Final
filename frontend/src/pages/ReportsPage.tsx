import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Mail, Loader2 } from 'lucide-react';
import { ReportsApi, SurveysApi } from '../api/services';
import { apiErrorMessage } from '../api/client';

const FORMATS = ['PDF', 'CSV', 'JSON', 'GEOJSON'];

export default function ReportsPage() {
  const qc = useQueryClient();
  const [surveyId, setSurveyId] = useState('');
  const [format, setFormat] = useState('PDF');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const surveysQuery = useQuery({ queryKey: ['reports-surveys'], queryFn: () => SurveysApi.list({ limit: 100 }) });
  const reportsQuery = useQuery({ queryKey: ['reports'], queryFn: () => ReportsApi.list({ limit: 50 }) });

  const generate = async () => {
    if (!surveyId) return;
    setGenerating(true);
    setError('');
    try {
      await ReportsApi.generate(surveyId, format);
      qc.invalidateQueries({ queryKey: ['reports'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const emailReport = async (id: string) => {
    await ReportsApi.email(id);
    qc.invalidateQueries({ queryKey: ['reports'] });
  };

  const surveys = surveysQuery.data?.data || [];
  const reports = reportsQuery.data?.data || [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
        <FileText className="text-cyan-400" size={20} /> Reports
      </h1>

      <div className="glass-panel rounded-lg p-4">
        <div className="text-sm font-medium text-slate-200 mb-3">Generate a new report</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1">Survey</label>
            <select
              value={surveyId}
              onChange={(e) => setSurveyId(e.target.value)}
              className="w-full bg-[#0b1a2e] border border-cyan-500/30 rounded px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 outline-none cursor-pointer"
            >
              <option value="" className="bg-[#0b1a2e] text-slate-400">Select a survey…</option>
              {surveys.map((s: any) => (
                <option key={s._id} value={s._id} className="bg-[#0b1a2e] text-slate-100">
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="bg-[#0b1a2e] border border-cyan-500/30 rounded px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 outline-none cursor-pointer"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f} className="bg-[#0b1a2e] text-slate-100">
                  {f}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={generate}
            disabled={!surveyId || generating}
            className="flex items-center gap-2 bg-cyan-600/80 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded transition-colors"
          >
            {generating && <Loader2 size={14} className="animate-spin" />}
            Generate
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      <div className="glass-panel rounded-lg divide-y divide-white/5">
        <div className="px-4 py-3 text-sm font-medium text-slate-200">Generated reports</div>
        {reports.length === 0 && <div className="p-6 text-sm text-slate-500 text-center">No reports generated yet.</div>}
        {reports.map((r: any) => (
          <div key={r._id} className="p-4 flex items-center justify-between gap-4 text-sm">
            <div>
              <div className="text-slate-200 font-medium">
                {r.surveyCode} <span className="text-slate-500">- {r.format}</span>
              </div>
              <div className="text-xs text-slate-500">
                {r.detectionCount} detection{r.detectionCount === 1 ? '' : 's'} &middot; {(r.fileSizeBytes / 1024).toFixed(1)} KB &middot;{' '}
                {new Date(r.createdAt).toLocaleString()}
              </div>
              {r.emailedTo?.length > 0 && <div className="text-[11px] text-cyan-500 mt-0.5">Emailed to {r.emailedTo.join(', ')}</div>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={() => emailReport(r._id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-300">
                <Mail size={14} /> Email
              </button>
              <a
                href={ReportsApi.downloadUrl(r._id)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
              >
                <Download size={14} /> Download
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
