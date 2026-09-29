import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  SplitSquareHorizontal,
  Play,
  ArrowLeft,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { DatasetsApi, TrainingApi } from '../api/services';
import { apiErrorMessage } from '../api/client';
import { useAuthStore } from '../store/auth.store';

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const datasetQuery = useQuery({ queryKey: ['dataset', id], queryFn: () => DatasetsApi.get(id!), enabled: !!id });
  const imagesQuery = useQuery({ queryKey: ['dataset-images', id], queryFn: () => DatasetsApi.images(id!, { limit: 60 }), enabled: !!id });

  const [label, setLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  const dataset = datasetQuery.data;
  const images = imagesQuery.data?.data || [];

  const uploadFiles = async (files: FileList | null) => {
    if (!files || !files.length || !id) return;
    const all = Array.from(files);
    const getLabel = (file: File) => {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
      const folder = relativePath.split('/')[0];
      return dataset?.classes.includes(folder) ? folder : label;
    };
    if (all.some((file) => !getLabel(file))) {
      setError('Choose a default label or upload a labelled folder whose folder names match the dataset classes.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress({ done: 0, total: all.length });
    try {
      // The browser can select 1000+ images in one action. Upload them in
      // bounded batches so a large sonar dataset does not exhaust RAM.
      const concurrency = 20;
      let done = 0;
      for (let i = 0; i < all.length; i += concurrency) {
        const batch = all.slice(i, i + concurrency);
        const results = await Promise.allSettled(
          batch.map((file) => DatasetsApi.addImage(id, file, getLabel(file)!)),
        );
        done += results.length;
        setUploadProgress({ done, total: all.length });
        const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
        if (rejected) throw rejected.reason;
      }
      qc.invalidateQueries({ queryKey: ['dataset', id] });
      qc.invalidateQueries({ queryKey: ['dataset-images', id] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const split = async () => {
    if (!id) return;
    await DatasetsApi.split(id, 0.15, 0.15);
    qc.invalidateQueries({ queryKey: ['dataset', id] });
  };

  const startTraining = async () => {
    if (!id) return;
    setStarting(true);
    try {
      const job = await TrainingApi.start({ datasetId: id });
      navigate(`/training/${job._id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState('');

  const seed1000 = async () => {
    if (!id) return;
    setSeeding(true);
    setError('');
    setSeedSuccess('');
    try {
      const res = await DatasetsApi.seed1000(id);
      setSeedSuccess(`Successfully seeded ${res.count || 1000} side-scan sonar waterfall images with 70/15/15 strat-split! Ready to train.`);
      qc.invalidateQueries({ queryKey: ['dataset', id] });
      qc.invalidateQueries({ queryKey: ['dataset-images', id] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSeeding(false);
    }
  };

  const submitToAdmin = async () => {
    if (!id) return;
    const notes = prompt('Enter submission notes for Admin (optional):', 'Survey dataset containing annotated sonar waterfall frames for YOLO review.');
    if (notes === null) return;
    setSubmitting(true);
    setError('');
    setSubmitSuccess('');
    try {
      const res = await DatasetsApi.submitToAdmin(id, notes);
      setSubmitSuccess(res.message || 'Dataset successfully submitted to Admin dashboard with real-time notification and email automation!');
      qc.invalidateQueries({ queryKey: ['dataset', id] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!id) return;
    setReviewing(true);
    setError('');
    try {
      await DatasetsApi.review(id, decision, adminNotes);
      qc.invalidateQueries({ queryKey: ['dataset', id] });
      setAdminNotes('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setReviewing(false);
    }
  };

  if (!dataset) return <div className="p-6 text-sm text-slate-500">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <button onClick={() => navigate('/datasets')} className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-300">
        <ArrowLeft size={14} /> Back to datasets
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-100">{dataset.name}</h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                dataset.status === 'APPROVED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : dataset.status === 'REJECTED'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : dataset.status === 'SUBMITTED_FOR_REVIEW'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
              }`}
            >
              {dataset.status === 'SUBMITTED_FOR_REVIEW'
                ? '⏳ Awaiting Admin Review'
                : dataset.status === 'APPROVED'
                ? '✅ Approved'
                : dataset.status === 'REJECTED'
                ? '❌ Rejected'
                : dataset.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Classes: {dataset.classes.join(', ')} &middot; {dataset.imageCount} image(s)
            {dataset.submittedBy && ` &middot; Submitted by: ${dataset.submittedBy}`}
          </p>
        </div>

        {/* Operator Submit Button */}
        {dataset.status !== 'APPROVED' && (
          <button
            onClick={submitToAdmin}
            disabled={submitting || dataset.imageCount === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-md transition-all cursor-pointer"
          >
            <Send size={14} />
            {submitting ? 'Submitting to Admin...' : 'Send Dataset to Admin for Analysis'}
          </button>
        )}
      </div>

      {submitSuccess && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <Mail size={16} className="text-emerald-400 shrink-0" />
          <span>{submitSuccess}</span>
        </div>
      )}

      {/* Admin Review Console */}
      {isAdmin && (
        <div className="glass-panel p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
              <ShieldCheck size={16} className="text-indigo-400" />
              <span>Admin Dataset Verification & Active Learning Approval</span>
            </div>
            {dataset.submittedAt && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock size={12} /> Submitted: {new Date(dataset.submittedAt).toLocaleString()}
              </span>
            )}
          </div>
          {dataset.reviewNotes && (
            <div className="p-2.5 bg-black/30 rounded-lg text-xs text-slate-300 border border-white/5">
              <span className="text-slate-500 font-mono">Submission Note:</span> {dataset.reviewNotes}
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <input
              type="text"
              placeholder="Admin review notes / feedback (optional)..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full sm:flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-400"
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleReview('APPROVED')}
                disabled={reviewing}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
              >
                <CheckCircle2 size={14} /> Approve Dataset
              </button>
              <button
                onClick={() => handleReview('REJECTED')}
                disabled={reviewing}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
              >
                <XCircle size={14} /> Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {seedSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
          ⚡ {seedSuccess}
        </div>
      )}

      <div className="glass-panel rounded-lg p-4">
        <div className="text-sm font-medium text-slate-200 mb-1 flex items-center gap-2">
          <Upload size={16} className="text-cyan-400" /> Bulk labelled image ingestion
        </div>
        <p className="text-[10px] text-slate-500 mb-3">
          Select 1,000+ images in one action. Use the first picker with the selected label, or the folder picker with folders named exactly like the dataset classes. Upload is chunked automatically.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="bg-[#0b1a2e] border border-cyan-500/30 rounded px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 outline-none cursor-pointer"
          >
            <option value="" className="bg-[#0b1a2e] text-slate-400">Select label…</option>
            {dataset.classes.map((c: string) => (
              <option key={c} value={c} className="bg-[#0b1a2e] text-slate-100">
                {c}
              </option>
            ))}
          </select>
          <input type="file" multiple accept="image/*" disabled={uploading} onChange={(e) => uploadFiles(e.target.files)} className="text-xs text-slate-400" />
          <input
            type="file"
            multiple
            accept="image/*"
            disabled={uploading}
            onChange={(e) => uploadFiles(e.target.files)}
            {...({ webkitdirectory: '', directory: '' } as any)}
            className="text-xs text-slate-400"
            title="Upload class-labelled folders"
          />
          {uploading && <span className="text-xs text-cyan-400">Uploading {uploadProgress.done}/{uploadProgress.total}…</span>}
        </div>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

        {dataset.classDistribution?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {dataset.classDistribution.map((c: any) => (
              <span key={c._id} className="text-[11px] bg-white/5 text-slate-300 px-2 py-1 rounded">
                {c._id}: {c.count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel rounded-lg p-4 flex flex-wrap items-center gap-3">
        <button
          onClick={seed1000}
          disabled={seeding}
          className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm px-4 py-2 rounded-lg shadow-md transition-all"
        >
          <span>⚡</span> {seeding ? 'Generating 1,000 Sonar Images...' : 'Seed 1,000 Sonar Images Dataset'}
        </button>
        <button onClick={split} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-200 text-sm px-4 py-2 rounded">
          <SplitSquareHorizontal size={14} /> Apply 70/15/15 train/val/test split
        </button>
        <button
          onClick={startTraining}
          disabled={starting || dataset.imageCount < dataset.classes.length * 3}
          className="flex items-center gap-2 bg-cyan-600/80 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded"
        >
          <Play size={14} /> Start training
        </button>
        {dataset.imageCount < dataset.classes.length * 3 && (
          <span className="text-[11px] text-amber-400">Upload or seed at least 3 images per class before training.</span>
        )}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {images.map((img: any) => (
          <div key={img._id} className="glass-panel rounded p-1.5 text-[10px] text-slate-400 text-center">
            <div className="truncate">{img.label}</div>
            <div className={`mt-1 rounded px-1 ${img.split === 'TRAIN' ? 'bg-cyan-500/10 text-cyan-300' : img.split === 'VAL' ? 'bg-amber-500/10 text-amber-300' : img.split === 'TEST' ? 'bg-purple-500/10 text-purple-300' : 'bg-slate-500/10'}`}>
              {img.split}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
