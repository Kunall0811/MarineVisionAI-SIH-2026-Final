import { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UploadCloud, FolderUp, PlayCircle, FileStack, Globe2, BarChart3, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { SonarApi, SurveysApi } from '../api/services';
import { apiErrorMessage } from '../api/client';
import { DataTag } from '../components/DataTag';

const STATUS_COLORS: Record<string, string> = {
  QUEUED: 'text-slate-400',
  PREPROCESSING: 'text-amber-400',
  INFERENCE: 'text-cyan-400',
  COMPLETED: 'text-green-400',
  FAILED: 'text-red-400',
  INVALID_INPUT: 'text-orange-400',
};

const REVIEW_STATUS_COLORS: Record<string, string> = {
  APPROVED: 'text-green-400 border-green-500/30',
  PENDING_REVIEW: 'text-amber-400 border-amber-500/30',
  REJECTED: 'text-red-400 border-red-500/30',
  CORRECTED: 'text-cyan-400 border-cyan-500/30',
};

export default function SurveyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const navInputRef = useRef<HTMLInputElement>(null);

  const [uploadDetails, setUploadDetails] = useState<{ current: number; total: number; percent: number } | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState('');

  const surveyQuery = useQuery({ queryKey: ['survey', id], queryFn: () => SurveysApi.get(id!), enabled: !!id });
  const framesQuery = useQuery({
    queryKey: ['sonar-frames', id],
    queryFn: () => SonarApi.listBySurvey(id!, { limit: 200 }),
    enabled: !!id,
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => {
      setUploadSuccessMsg(null);
      setError('');
      return files.length === 1
        ? SonarApi.uploadSingle(id!, files[0], (pct) => setUploadDetails({ current: 1, total: 1, percent: pct }))
        : SonarApi.uploadBatch(id!, files, (pct, details) => {
            if (details) {
              setUploadDetails({ current: details.current, total: details.total, percent: pct });
            } else {
              setUploadDetails({ current: Math.round((pct / 100) * files.length), total: files.length, percent: pct });
            }
          });
    },
    onSuccess: (data, files) => {
      qc.invalidateQueries({ queryKey: ['sonar-frames', id] });
      qc.invalidateQueries({ queryKey: ['survey', id] });
      setUploadSuccessMsg(`Successfully uploaded ${files.length} sonar frame(s)! Processing queued in background.`);
      setUploadDetails(null);
    },
    onError: (err) => {
      setError(apiErrorMessage(err));
      setUploadDetails(null);
    },
  });

  const navUploadMutation = useMutation({
    mutationFn: (file: File) => SonarApi.uploadNavigationCsv(id!, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sonar-frames', id] }),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const processAllMutation = useMutation({
    mutationFn: () => SonarApi.processAll(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sonar-frames', id] });
      qc.invalidateQueries({ queryKey: ['survey', id] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const survey = surveyQuery.data;

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {survey && (
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
              {survey.code} <span className="text-slate-500 font-normal text-base">- {survey.name}</span>
              <DataTag variant={survey.dataType === 'HISTORICAL' ? 'historical' : 'live'} />
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {survey.waterBodyName || 'Unassigned water body'} &middot; {survey.region} &middot; Status:{' '}
              {survey.status}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <Link
              to="/globe"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 rounded transition"
            >
              <Globe2 size={14} /> View on 3D Globe
            </Link>
            <Link
              to="/analytics"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded transition"
            >
              <BarChart3 size={14} /> Analytics
            </Link>
            <Link
              to="/anomaly-review"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded transition"
            >
              <ShieldAlert size={14} /> Anomaly Review
            </Link>
            <div className="text-right pl-2 border-l border-white/10">
              <div className="font-semibold text-slate-200">
                {survey.processedFrames}/{survey.totalFrames} processed
              </div>
              {survey.failedFrames > 0 && <div className="text-red-400">{survey.failedFrames} failed</div>}
            </div>
          </div>
        </div>
      )}

      {error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-3">{error}</div>}

      {uploadSuccessMsg && (
        <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded p-3 flex items-center gap-2">
          <CheckCircle2 size={16} /> {uploadSuccessMsg}
        </div>
      )}

      {/* Upload Controls */}
      <div className="glass-panel rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Multi-file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.tiff,.tif,.xtf,.jsf"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length) uploadMutation.mutate(files);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium transition-colors rounded px-3.5 py-2 text-xs shadow-md"
          >
            <UploadCloud size={16} /> Select Multiple Sonar Files (1000+)
          </button>

          {/* Entire Folder input */}
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is standard in all modern browsers
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={(e) => {
              const allFiles = Array.from(e.target.files || []);
              // Filter only valid image extensions
              const valid = allFiles.filter((f) => {
                const ext = f.name.split('.').pop()?.toLowerCase();
                return ['png', 'jpg', 'jpeg', 'tif', 'tiff', 'xtf', 'jsf'].includes(ext || '');
              });
              if (valid.length) uploadMutation.mutate(valid);
            }}
          />
          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-white/10 font-medium transition-colors rounded px-3.5 py-2 text-xs"
          >
            <FolderUp size={16} /> Upload Entire Folder (1,000+ files)
          </button>

          {/* Navigation CSV input */}
          <input
            ref={navInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) navUploadMutation.mutate(file);
            }}
          />
          <button
            onClick={() => navInputRef.current?.click()}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 transition-colors rounded px-3.5 py-2 text-xs border border-white/5"
          >
            <FileStack size={16} /> Upload navigation.csv
          </button>

          {/* Process All button */}
          <button
            onClick={() => processAllMutation.mutate()}
            disabled={processAllMutation.isPending}
            className="flex items-center gap-2 bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium transition-colors rounded px-3.5 py-2 text-xs ml-auto shadow-md"
          >
            <PlayCircle size={16} /> Process All Queued Frames
          </button>
        </div>

        {/* Progress Bar for Bulk Uploads */}
        {uploadDetails && (
          <div className="space-y-1.5 pt-2 border-t border-white/5">
            <div className="flex justify-between text-xs text-slate-300">
              <span>
                Uploading batch: <b className="text-cyan-300">{uploadDetails.current}</b> of{' '}
                <b className="text-slate-100">{uploadDetails.total}</b> sonar files
              </span>
              <span className="font-mono text-cyan-400 font-semibold">{uploadDetails.percent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/10">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadDetails.percent}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500">
              Safe chunked transmission in progress. Frames are automatically enqueued into BullMQ parallel processing.
            </div>
          </div>
        )}
      </div>

      {/* Frames Table */}
      <div className="glass-panel rounded-lg divide-y divide-white/5">
        <div className="grid grid-cols-6 gap-2 px-4 py-2.5 text-[11px] uppercase tracking-wide text-slate-400 font-semibold bg-white/[0.02]">
          <div className="col-span-2">Sonar File</div>
          <div>Navigation</div>
          <div>Status</div>
          <div>Uploaded</div>
          <div className="text-right">Action</div>
        </div>
        {(framesQuery.data?.data || []).map((frame: any) => (
          <div key={frame._id} className="grid grid-cols-6 gap-2 px-4 py-2 text-sm items-center hover:bg-white/[0.02]">
            <div className="col-span-2 truncate text-slate-200 font-mono text-xs">{frame.fileName}</div>
            <div>
              <DataTag
                variant={
                  frame.navigationSource === 'REAL'
                    ? 'live'
                    : frame.navigationSource === 'ESTIMATED'
                    ? 'estimated'
                    : 'unavailable'
                }
                label={frame.navigationSource === 'REAL' ? 'GPS OK' : undefined}
              />
            </div>
            <div>
              <div className={`font-semibold text-xs ${STATUS_COLORS[frame.processingStatus]}`}>
                {frame.processingStatus === 'INVALID_INPUT' ? 'INVALID INPUT' : frame.processingStatus}
              </div>
              {frame.reviewStatus && frame.reviewStatus !== 'APPROVED' && (
                <div
                  className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded border ${
                    REVIEW_STATUS_COLORS[frame.reviewStatus]
                  }`}
                >
                  {frame.reviewStatus.replace('_', ' ')}
                </div>
              )}
            </div>
            <div className="text-xs text-slate-500">{new Date(frame.createdAt).toLocaleString()}</div>
            <div className="text-right">
              <Link to={`/sonar/${frame._id}`} className="text-cyan-400 hover:text-cyan-300 font-medium text-xs">
                Inspect Frame &rarr;
              </Link>
            </div>
          </div>
        ))}
        {!framesQuery.data?.data?.length && (
          <div className="p-8 text-sm text-slate-500 italic text-center space-y-1">
            <div>No sonar frames uploaded yet for this survey.</div>
            <div className="text-xs text-slate-600">
              Click &ldquo;Upload Entire Folder&rdquo; or &ldquo;Select Multiple Sonar Files&rdquo; above to load your
              dataset.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
