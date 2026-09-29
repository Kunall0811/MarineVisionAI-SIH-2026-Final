import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, HelpCircle, PlayCircle } from 'lucide-react';
import { api } from '../api/client';
import { DetectionsApi, SonarApi } from '../api/services';
import { DataTag } from '../components/DataTag';

const RISK_BORDER: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

export default function SonarFramePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showAllHighlights, setShowAllHighlights] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });
  const [displaySize, setDisplaySize] = useState({ w: 1, h: 1 });

  const frameQuery = useQuery({ queryKey: ['sonar-frame', id], queryFn: () => SonarApi.get(id!), enabled: !!id, refetchInterval: 4000 });
  const detectionsQuery = useQuery({
    queryKey: ['frame-detections', id],
    queryFn: async () => {
      const res = await DetectionsApi.list({ sonarFrameId: id, limit: 100 });
      const items = res.data || [];
      return items.filter((d: any) => String(d.sonarFrameId) === String(id) || String(d.id) === String(id));
    },
    enabled: !!id,
    refetchInterval: 4000,
  });

  useEffect(() => {
    let revoke: string | null = null;
    setImageLoading(true);
    setImageError(false);
    api.get(`/sonar/${id}/image`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        revoke = url;
        setImageUrl(url);
        setImageLoading(false);
      })
      .catch((err) => {
        console.warn('Failed to load frame image:', err);
        setImageError(true);
        setImageLoading(false);
      });
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [id]);

  const processMutation = useMutation({
    mutationFn: () => SonarApi.process(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sonar-frame', id] }),
  });

  const verifyMutation = useMutation({
    mutationFn: (params: { detId: string; action: 'verify' | 'reject' | 'review' }) =>
      params.action === 'verify'
        ? DetectionsApi.verify(params.detId)
        : params.action === 'reject'
        ? DetectionsApi.reject(params.detId)
        : DetectionsApi.review(params.detId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['frame-detections', id] }),
  });

  const frame = frameQuery.data;
  const detections = detectionsQuery.data || [];

  const scaleX = displaySize.w / (frame?.imageWidth || naturalSize.w || 1);
  const scaleY = displaySize.h / (frame?.imageHeight || naturalSize.h || 1);

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">{frame?.fileName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <DataTag
                variant={
                  frame?.navigationSource === 'REAL'
                    ? 'live'
                    : frame?.navigationSource === 'ESTIMATED'
                    ? 'estimated'
                    : 'unavailable'
                }
              />
              <span className="text-xs text-slate-500">Status: {frame?.processingStatus}</span>
            </div>
          </div>
          {frame?.processingStatus === 'QUEUED' && (
            <button
              onClick={() => processMutation.mutate()}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 transition-colors rounded px-3 py-2 text-sm"
            >
              <PlayCircle size={16} /> Run AI Detection
            </button>
          )}
        </div>

        {frame?.processingStatus === 'INVALID_INPUT' && (
          <div className="glass-panel rounded-lg p-4 border border-orange-500/40 bg-orange-500/5">
            <div className="text-orange-400 font-semibold text-sm mb-1">⚠ INVALID INPUT</div>
            <div className="text-sm text-slate-300">
              This image does not appear to contain Side-Scan Sonar imagery.
            </div>
            {frame?.domainValidity && (
              <div className="mt-2 text-xs text-slate-400 space-y-1">
                <div>Sonar probability: {Math.round((frame.domainValidity.sonarProbability || 0) * 100)}%</div>
                {frame.domainValidity.reasons?.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5">
                    {frame.domainValidity.reasons.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="mt-2 text-xs text-slate-500">
              This frame was not analysed as a detection and was not added to the training dataset. An admin can
              still inspect it below.
            </div>
          </div>
        )}

        <div className="glass-panel rounded-lg p-3 relative inline-block w-full">
          {imageUrl ? (
            <div className="relative inline-block max-w-full">
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Sonar frame"
                className="max-w-full rounded"
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
                  setDisplaySize({ w: el.clientWidth, h: el.clientHeight });
                }}
              />
              {(showAllHighlights ? detections : detections.slice(0, 3)).map((d: any) => {
                const b = d.bbox || {};
                const bx1 = b.x1 != null ? b.x1 : (b.x != null ? (b.x <= 1 ? b.x * naturalSize.w : b.x) : 0);
                const by1 = b.y1 != null ? b.y1 : (b.y != null ? (b.y <= 1 ? b.y * naturalSize.h : b.y) : 0);
                const bw = b.width != null ? (b.width <= 1 ? b.width * naturalSize.w : b.width) : ((b.x2 ?? 0) - bx1);
                const bh = b.height != null ? (b.height <= 1 ? b.height * naturalSize.h : b.height) : ((b.y2 ?? 0) - by1);

                return (
                  <div
                    key={d._id || d.id}
                    title={`${d.anomalyCode || d.anomalyId} - ${d.class} (${Math.round((d.finalConfidence ?? d.confidence ?? 0) * 100)}%)`}
                    style={{
                      position: 'absolute',
                      left: bx1 * scaleX,
                      top: by1 * scaleY,
                      width: Math.max(20, bw * scaleX),
                      height: Math.max(20, bh * scaleY),
                      border: '2px solid #ea580c',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span
                      className="absolute -top-4 left-0 text-[10px] font-mono font-bold text-orange-400 bg-slate-950/80 px-1 rounded whitespace-nowrap shadow"
                    >
                      {(d.class || d.type || d.anomalyCode || 'ANOMALY').toUpperCase()} {Math.round((d.finalConfidence ?? d.confidence ?? 0) * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : imageLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-cyan-400 space-y-2">
              <span className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs uppercase tracking-wider text-slate-400">Loading Sonar Imagery Telemetry...</span>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-[#071322]/80 border border-slate-700/50 rounded-lg p-6 text-center space-y-2">
              <div className="text-amber-400 font-semibold text-sm">Original sonar image not included in this deployment package.</div>
              <div className="text-xs text-slate-500 max-w-md">
                Original sonar image not included in this deployment package.
              </div>
            </div>
          )}

          {detections.length > 3 && imageUrl && (
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-2">
              <span>Showing {showAllHighlights ? detections.length : 3} of {detections.length} anomaly highlights</span>
              <button
                onClick={() => setShowAllHighlights(!showAllHighlights)}
                className="text-cyan-400 hover:text-cyan-300 font-medium underline"
              >
                {showAllHighlights ? 'Show top 3 only' : `Show all ${detections.length} detections`}
              </button>
            </div>
          )}
        </div>

        {frame?.preprocessingVersion && (
          <div className="text-[11px] text-slate-500">
            Preprocessing: {frame.preprocessingVersion} &middot;{' '}
            {JSON.stringify(frame.preprocessingParameters)}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-slate-200">AI Detections ({detections.length})</h2>
        {detections.map((d: any) => (
          <div key={d._id} className="glass-panel rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-cyan-300">{d.anomalyCode}</span>
              <DataTag
                variant={d.locationStatus === 'REAL' ? 'live' : d.locationStatus === 'ESTIMATED' ? 'estimated' : 'unavailable'}
              />
            </div>
            <div className="capitalize text-slate-200 mb-1">{d.class.replace(/_/g, ' ')}</div>
            <div className="grid grid-cols-2 gap-y-1 text-xs text-slate-400 mb-3">
              <div>Confidence</div>
              <div className="text-slate-200">{Math.round(d.finalConfidence * 100)}%</div>
              <div>Shadow Score</div>
              <div className="text-slate-200">{Math.round(d.shadowScore * 100)}%</div>
              <div>Artificial Prob.</div>
              <div className="text-slate-200">{Math.round(d.artificialProbability * 100)}%</div>
              <div>Risk</div>
              <div className="text-slate-200">{d.riskLevel}</div>
              <div>Lat / Lon</div>
              <div className="text-slate-200 font-mono">
                {d.latitude?.toFixed(5) ?? 'N/A'}, {d.longitude?.toFixed(5) ?? 'N/A'}
              </div>
              <div>Dimensions</div>
              <div className="text-slate-200">
                {d.length ?? '?'}m x {d.width ?? '?'}m
              </div>
              <div>Model</div>
              <div className="text-slate-200">{d.modelVersion}</div>
              <div>Status</div>
              <div className="text-slate-200">{d.status.replace(/_/g, ' ')}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => verifyMutation.mutate({ detId: d._id, action: 'verify' })}
                className="flex-1 flex items-center justify-center gap-1 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded py-1.5 text-xs"
              >
                <CheckCircle2 size={13} /> Verify
              </button>
              <button
                onClick={() => verifyMutation.mutate({ detId: d._id, action: 'reject' })}
                className="flex-1 flex items-center justify-center gap-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded py-1.5 text-xs"
              >
                <XCircle size={13} /> Reject
              </button>
              <button
                onClick={() => verifyMutation.mutate({ detId: d._id, action: 'review' })}
                className="flex-1 flex items-center justify-center gap-1 bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 rounded py-1.5 text-xs"
              >
                <HelpCircle size={13} /> Review
              </button>
            </div>
          </div>
        ))}
        {!detections.length && (
          <div className="glass-panel rounded-lg p-4 text-xs text-slate-500 italic">
            No detections yet. Run AI detection on this frame if it hasn't been processed.
          </div>
        )}
      </div>
    </div>
  );
}
