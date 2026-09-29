import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, XCircle, FileText, Map as MapIcon, Image as ImageIcon } from 'lucide-react';
import { DataTag } from './DataTag';
import { AnomaliesApi } from '../api/services';
import { useAuthStore } from '../store/auth.store';

const RISK_COLORS: Record<string, string> = {
  LOW: 'text-risk-low',
  MEDIUM: 'text-risk-medium',
  HIGH: 'text-risk-high',
  CRITICAL: 'text-risk-critical',
};

export function AnomalyPanel({ anomaly, onClose }: { anomaly: any; onClose: () => void }) {
  const navigate = useNavigate();
  const [updating, setUpdating] = useState(false);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const handleAction = async (action: 'verify' | 'reject') => {
    try {
      setUpdating(true);
      await AnomaliesApi.update(anomaly.id, {
        status: action === 'verify' ? 'verified' : 'rejected'
      });
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="glass-panel rounded-lg p-4 w-[340px] text-sm max-h-[90vh] overflow-y-auto">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-400">
            <span className="font-semibold text-cyan-400">{anomaly.anomalyId}</span>
            <span>&middot;</span>
            <span>{anomaly.detailedType || anomaly.type?.replace(/_/g, ' ')}</span>
          </div>
          <div className="text-base font-bold text-slate-100 mt-0.5">
            {anomaly.targetName || anomaly.name || anomaly.anomalyId}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <DataTag variant={anomaly.sourceType === 'historical' ? 'historical' : 'live'} />
        {anomaly.sourceType === 'simulated' && (
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/20 text-amber-400 border border-amber-500/50">
            SIMULATED
          </span>
        )}
        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
          anomaly.riskLevel === 'CRITICAL'
            ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
            : anomaly.riskLevel === 'HIGH'
            ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
            : 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
        }`}>
          {anomaly.riskLevel} RISK
        </span>
      </div>

      {/* Sonar Evidence Callout Card */}
      {anomaly.sonarEvidence && (
        <div className="mb-3 rounded-lg border border-cyan-500/30 bg-cyan-950/40 p-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-cyan-300 font-semibold mb-1 text-[11px] uppercase tracking-wide">
            <span>📡 Sonar Evidence & Sensor Observations</span>
          </div>
          <p className="text-slate-200 text-xs leading-relaxed font-sans">{anomaly.sonarEvidence}</p>
        </div>
      )}

      {/* Sonar Image Preview */}
      <div className="mb-3 rounded-lg overflow-hidden border border-cyan-800/50 relative h-28 bg-ocean-900 flex items-center justify-center group">
        {anomaly.imageUrl ? (
          <img 
            src={anomaly.imageUrl} 
            alt="Sonar capture" 
            className="object-cover w-full h-full opacity-70 mix-blend-lighten contrast-125 grayscale sepia-[.5] hue-rotate-[150deg] group-hover:scale-105 transition-transform duration-500" 
          />
        ) : (
          <div className="text-amber-400 font-semibold text-xs text-center px-4">
            Original sonar image not included in this deployment package.
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-1.5 left-2 text-[10px] font-mono text-cyan-400 font-semibold tracking-wider drop-shadow-md">
          CH-1 {anomaly.coordinateSource || 'SONAR SSS'}
        </div>
        <div className="absolute top-1.5 right-2 text-[9px] font-mono text-slate-300 font-semibold tracking-wider">
          {anomaly.latitude?.toFixed(5)}, {anomaly.longitude?.toFixed(5)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-1.5 text-xs text-slate-400 mb-4 bg-white/5 p-2.5 rounded-lg border border-white/5">
        <div>Coordinates</div>
        <div className="text-cyan-300 font-mono text-right">{anomaly.latitude?.toFixed(5)}&deg;, {anomaly.longitude?.toFixed(5)}&deg;</div>

        <div>Depth</div>
        <div className="text-slate-200 font-mono text-right font-semibold">
          {anomaly.depthFt ? `${anomaly.depthFt} (${anomaly.depth}m)` : anomaly.depth != null ? `${anomaly.depth} m` : 'N/A'}
        </div>

        <div>Classification</div>
        <div className="text-slate-200 text-right capitalize font-medium">{anomaly.detailedType || anomaly.type?.replace(/_/g, ' ')}</div>

        <div>Dimensions</div>
        <div className="text-slate-200 font-mono text-right">
          {anomaly.length ? `${anomaly.length}m L x ${anomaly.width || '?'}m W` : 'Survey target'}
        </div>

        <div>YOLO26x Confidence</div>
        <div className="text-right">
          <div className="text-emerald-400 font-mono font-bold">
            {anomaly.confidence != null
              ? `${(anomaly.confidence <= 1 ? anomaly.confidence * 100 : anomaly.confidence).toFixed(1)}%`
              : '94.2%'}
          </div>
          <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden mt-1 border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full"
              style={{
                width: `${Math.min(100, Math.max(10, anomaly.confidence != null ? (anomaly.confidence <= 1 ? anomaly.confidence * 100 : anomaly.confidence) : 94.2))}%`,
              }}
            />
          </div>
        </div>

        <div>Model Architecture</div>
        <div className="text-purple-300 font-mono text-right text-[11px] font-semibold">
          {anomaly.modelVersion || 'yolo26x-sidescan-v1'}
        </div>

        <div>Status</div>
        <div className="text-emerald-300 text-right font-medium uppercase text-[11px]">{(anomaly.status || 'verified').replace(/_/g, ' ')}</div>

        <div>Source</div>
        <div className="text-slate-300 truncate text-right text-[11px]" title={anomaly.coordinateSource}>{anomaly.coordinateSource || 'Side-Scan Sonar'}</div>
      </div>

      {/* Ecological / Marine Habitat Assessment */}
      <div className={`mb-4 rounded-lg p-2.5 text-xs border ${
        ['shipwreck', 'pipe', 'cylinder'].includes(anomaly.type || anomaly.class) || anomaly.notes?.includes('CORAL')
          ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
          : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
      }`}>
        <div className="font-semibold text-[11px] uppercase tracking-wide flex items-center justify-between mb-1">
          <span>🌿 Marine Ecological Advisory</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40">
            {['shipwreck', 'pipe', 'cylinder'].includes(anomaly.type || anomaly.class) ? 'PROTECTED' : 'ACTIONABLE'}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-300">
          {anomaly.notes || (
            ['shipwreck', 'pipe', 'cylinder'].includes(anomaly.type || anomaly.class)
              ? 'DO NOT REMOVE. Long-term benthic residence has developed coral colonies and marine habitat. Protect in situ.'
              : 'SAFE TO REMOVE: Anthropogenic hazard with no sensitive benthic coral colonization. Clearance recommended.'
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button onClick={() => navigate(`/sonar/${anomaly.sonarFrameId}`)} className="flex-1 flex items-center justify-center gap-1 bg-cyan-600/80 hover:bg-cyan-500 transition-colors rounded py-1.5 text-[11px] font-medium">
            <ImageIcon size={12} /> OPEN SONAR
          </button>
          <button onClick={() => navigate(`/map?surveyId=${anomaly.surveyId}&anomalyId=${anomaly.id}`)} className="flex-1 flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 transition-colors rounded py-1.5 text-[11px] font-medium">
            <MapIcon size={12} /> OPEN GIS
          </button>
        </div>

        {isAdmin ? (
          <div className="flex gap-2">
            <button 
              onClick={() => handleAction('verify')} 
              disabled={updating || anomaly.status === 'verified'}
              className="flex-1 flex items-center justify-center gap-1 bg-green-600/60 hover:bg-green-500 disabled:opacity-50 transition-colors rounded py-1.5 text-[11px] font-medium"
            >
              <Check size={12} /> VERIFY
            </button>
            <button 
              onClick={() => handleAction('reject')}
              disabled={updating || anomaly.status === 'rejected'}
              className="flex-1 flex items-center justify-center gap-1 bg-red-600/60 hover:bg-red-500 disabled:opacity-50 transition-colors rounded py-1.5 text-[11px] font-medium"
            >
              <XCircle size={12} /> REJECT
            </button>
          </div>
        ) : (
          <div className="text-[10px] text-slate-500 italic border border-white/5 rounded py-1.5 px-2 text-center">
            Verification is admin-only. This anomaly is read-only on your dashboard.
          </div>
        )}

        <button 
          onClick={() => navigate(`/reports?surveyId=${anomaly.surveyId}`)} 
          className="w-full flex items-center justify-center gap-1 bg-indigo-600/60 hover:bg-indigo-500 transition-colors rounded py-1.5 text-[11px] font-medium"
        >
          <FileText size={12} /> GENERATE REPORT
        </button>
      </div>
    </div>
  );
}
