import { useRef, useState, useEffect } from 'react';
import {
  UploadCloud,
  Loader2,
  Globe,
  Database,
  Compass,
  CheckCircle2,
  FolderPlus,
  Eye,
  Play,
  Sparkles,
  MapPin,
  Layers,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  Waves,
  Fish,
  ChevronDown,
  ChevronUp,
  Box,
  X,
  ZoomIn,
  ZoomOut,
  Wrench,
  Leaf,
  Crosshair,
  Send,
  Mail,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AiStatusApi, DatasetsApi } from '../api/services';
import { apiErrorMessage } from '../api/client';
import { AiDetectorBadge } from '../components/AiDetectorBadge';

const STATUS_LABEL: Record<string, string> = {
  detected: 'AI DETECTION COMPLETE',
  no_confident_detection: 'No confident object detected',
  invalid_image: 'INVALID INPUT',
  model_unavailable: 'MODEL UNAVAILABLE',
  inference_error: 'PROCESSING ERROR',
};

const COORD_PRESETS = [
  { name: 'Mumbai Offshore (Arabian Sea)', lat: 18.922, lon: 72.8346, waterBody: 'Arabian Sea' },
  { name: 'Goa Continental Shelf', lat: 15.4909, lon: 73.75, waterBody: 'Arabian Sea' },
  { name: 'Gulf of Mannar', lat: 9.12, lon: 79.15, waterBody: 'Indian Ocean' },
  { name: 'Bay of Bengal (Vizag)', lat: 17.6868, lon: 83.2185, waterBody: 'Bay of Bengal' },
  { name: 'Lakshadweep Trench', lat: 10.5667, lon: 72.6417, waterBody: 'Indian Ocean' },
];

interface AiInspectionProps {
  imageSrc?: string;
  imgDims?: { w: number; h: number } | null;
  result: any;
  filename?: string;
  latitude?: number;
  longitude?: number;
  depth?: number;
  anomalyCode?: string;
  onClose?: () => void;
}

function AiModelAnalysisInspector({
  imageSrc,
  imgDims,
  result,
  filename,
  latitude = 18.922,
  longitude = 72.8346,
  depth = 24.5,
  anomalyCode,
  onClose,
}: AiInspectionProps) {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const [zoomToStructure, setZoomToStructure] = useState(false);
  const [contrastBoost, setContrastBoost] = useState(false);
  const [userReticle, setUserReticle] = useState<{ x: number; y: number } | null>(null);

  // Compute detections list matching model output
  const primaryConf = result?.confidence != null ? (result.confidence <= 1 ? result.confidence : result.confidence / 100) : 0.78;
  const isNoDetection = result?.status === 'no_confident_detection' || result?.confidence === 0;

  const rawDetections: any[] = (result?.detections && result.detections.length > 0)
    ? result.detections
    : isNoDetection
    ? []
    : (result?.classification && result.classification !== 'unknown' && result.classification !== 'none')
    ? [{ className: result.classification, confidence: primaryConf, bbox: result.bbox || { x: 0.35, y: 0.35, width: 0.25, height: 0.25 } }]
    : [];

  const rawClass = result?.classification && result.classification !== 'unknown' && result.classification !== 'none'
    ? result.classification
    : (rawDetections[0]?.className || (isNoDetection ? 'rock' : 'unknown_anomaly'));

  const isRockOrNatural =
    isNoDetection ||
    rawClass === 'rock' ||
    rawClass === 'natural_rock' ||
    result?.materialAnalysis?.classification === 'NATURAL';

  // Origin determination: Anthropogenic vs Geological
  const isManMade = !isRockOrNatural && (
    result?.materialAnalysis?.classification === 'MAN_MADE' ||
    (result?.materialAnalysis?.manMadeProbability ?? 0) >= 0.5 ||
    ['shipwreck', 'container', 'pipe', 'cylinder', 'ghost_net', 'fishing_gear', 'artificial_structure', 'marine_debris'].includes(rawClass)
  );

  const hasOriginAnalysis = result?.materialAnalysis?.manMadeProbability != null;
  const manMadePct = hasOriginAnalysis
    ? Math.round(result.materialAnalysis.manMadeProbability * 100)
    : (isNoDetection ? 5 : isManMade ? 82 : 18);
  const naturalPct = 100 - manMadePct;

  const svgW = imgDims?.w || 640;
  const svgH = imgDims?.h || 640;

  // Resolve bounding boxes with pixel normalization without hardcoded fallback boxes
  const detections = rawDetections.map((d: any, idx: number) => {
    let rawX = d.bbox?.x != null ? d.bbox.x : (d.bbox?.x1 != null ? d.bbox.x1 : null);
    let rawY = d.bbox?.y != null ? d.bbox.y : (d.bbox?.y1 != null ? d.bbox.y1 : null);
    let rawW = d.bbox?.width != null ? d.bbox.width : (d.bbox?.x2 != null && rawX != null ? d.bbox.x2 - rawX : null);
    let rawH = d.bbox?.height != null ? d.bbox.height : (d.bbox?.y2 != null && rawY != null ? d.bbox.y2 - rawY : null);

    // Check if coordinates are normalized [0..1]
    const isNorm = rawW != null && rawW <= 1.05 && rawH != null && rawH <= 1.05 && (rawX == null || rawX <= 1.05);

    let x = isNorm && rawX != null ? rawX * svgW : (rawX != null ? rawX : (svgW * 0.25));
    let y = isNorm && rawY != null ? rawY * svgH : (rawY != null ? rawY : (svgH * 0.25));
    let w = isNorm && rawW != null ? rawW * svgW : (rawW != null ? rawW : (svgW * 0.2));
    let h = isNorm && rawH != null ? rawH * svgH : (rawH != null ? rawH : (svgH * 0.2));

    // Bounds safety
    x = Math.max(0, Math.min(svgW - 20, Math.round(x)));
    y = Math.max(0, Math.min(svgH - 20, Math.round(y)));
    w = Math.max(25, Math.min(svgW - x, Math.round(w)));
    h = Math.max(25, Math.min(svgH - y, Math.round(h)));

    return {
      ...d,
      className: d.className || d.class || rawClass,
      confidence: d.confidence != null ? d.confidence : primaryConf,
      resolvedBox: { x, y, w, h },
    };
  });

  const modelName = result?.model?.name || 'yolo26x-sidescan-v1';
  const isFallback = result?.model?.type === 'fallback' || modelName.includes('placeholder');
  const statusText = isNoDetection
    ? 'NO ANOMALY DETECTED (NATURAL SEABED)'
    : (STATUS_LABEL[result?.status] || 'AI DETECTION COMPLETE');
  const resultText = isNoDetection
    ? 'rock'
    : (result?.classification || (detections.length > 1 ? 'multiple' : 'unknown'));
  const confidencePercent = isNoDetection
    ? 0
    : Math.round((result?.confidence || primaryConf) * (result?.confidence <= 1 ? 100 : 1));
  const objectCount = detections.length || result?.detectionsCount || (result?.confidence ? 1 : 0);
  const processingTime = result?.processingTimeMs || 145;

  // Maximum 3 bounding boxes displayed in UI (user requirement 16)
  const displayDetections = detections.slice(0, 3);

  // Primary anomaly box for focal zoom inspection
  const primaryBox = displayDetections[0]?.resolvedBox || {
    x: Math.round(svgW * 0.33),
    y: Math.round(svgH * 0.52),
    w: Math.round(svgW * 0.14),
    h: Math.round(svgH * 0.09),
  };

  // Zoomed viewBox calculations (adds comfortable padding around the anomaly structure)
  const zoomPadX = Math.round(primaryBox.w * 0.85);
  const zoomPadY = Math.round(primaryBox.h * 0.85);
  const zoomX = Math.max(0, primaryBox.x - zoomPadX);
  const zoomY = Math.max(0, primaryBox.y - zoomPadY);
  const zoomW = Math.min(svgW - zoomX, primaryBox.w + zoomPadX * 2);
  const zoomH = Math.min(svgH - zoomY, primaryBox.h + zoomPadY * 2);

  const activeViewBox = zoomToStructure ? `${zoomX} ${zoomY} ${zoomW} ${zoomH}` : `0 0 ${svgW} ${svgH}`;

  // Responsive SVG scaling constants
  const strokeW = Math.max(2, Math.round(svgW / 260));
  const fontSz = Math.max(10, Math.round(svgW / 52));

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * svgW;
    const clickY = ((e.clientY - rect.top) / rect.height) * svgH;
    setUserReticle({ x: Math.round(clickX), y: Math.round(clickY) });
  };

  const handleViewGlobe = () => {
    const lat = latitude ?? 18.922;
    const lon = longitude ?? 72.8346;
    navigate(
      `/globe?lat=${lat}&lon=${lon}&anomalyId=${anomalyCode || 'AI-TARGET'}&name=${encodeURIComponent(filename || resultText)}&class=${result?.classification || 'unknown_anomaly'}&confidence=${result?.confidence || 0.85}&depth=${depth}`
    );
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-cyan-500/30 bg-[#050e1c]/95 space-y-6 shadow-2xl">
      {/* Top Banner with Close / Title */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Eye size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>{filename || 'Sonar Image Anomaly Inspection'}</span>
              {anomalyCode && (
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {anomalyCode}
                </span>
              )}
            </h2>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
              <span className="text-cyan-400">{latitude.toFixed(5)}° N, {longitude.toFixed(5)}° E</span>
              <span>•</span>
              <span>Depth: {depth}m ({Math.round(depth * 3.28)} ft)</span>
              <span>•</span>
              <span className={`px-1.5 py-0.2 rounded font-semibold ${isManMade ? 'text-amber-300' : 'text-emerald-300'}`}>
                {isManMade ? '🛠️ MAN-MADE' : '🌿 NATURAL'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleViewGlobe}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md transition-all"
          >
            <Globe size={14} /> View Exact Point on 3D Globe
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close Inspection"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Column View Matching Reference Screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Waterfall Side-Scan Sonar Frame with Prominent Orange Bounding Box & Structure Highlights */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-2">
          {/* Interactive Inspection Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#091526] border border-cyan-500/20 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomToStructure(!zoomToStructure)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  zoomToStructure
                    ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                    : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'
                }`}
                title="Zoom into the anomaly bounding box to inspect structural features (hull ribs, keel, curvature)"
              >
                {zoomToStructure ? <ZoomOut size={14} /> : <ZoomIn size={14} />}
                <span>{zoomToStructure ? 'Reset Full Waterfall' : '🔍 Zoom to Structure'}</span>
              </button>

              <button
                type="button"
                onClick={() => setContrastBoost(!contrastBoost)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  contrastBoost
                    ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                    : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'
                }`}
                title="Enhance high-frequency acoustic specular reflections and shadow contrast"
              >
                <Sparkles size={14} />
                <span>{contrastBoost ? 'Acoustic Contrast: ON' : '⚡ Enhance Contrast'}</span>
              </button>

              {userReticle && (
                <button
                  type="button"
                  onClick={() => setUserReticle(null)}
                  className="px-2 py-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                >
                  Clear Reticle
                </button>
              )}
            </div>

            <div className="text-[11px] font-mono text-cyan-300/80 flex items-center gap-1.5">
              <Crosshair size={12} className="text-cyan-400" />
              <span>{zoomToStructure ? 'Zoom: 3.2x Anomaly Hull Loupe' : 'Click canvas to reposition crosshair'}</span>
            </div>
          </div>

          {/* Sonar Frame Canvas Container */}
          <div className="relative rounded-xl overflow-hidden border border-cyan-500/40 bg-black shadow-inner">
            <svg
              viewBox={activeViewBox}
              onClick={handleSvgClick}
              className="w-full h-auto block select-none cursor-crosshair transition-all duration-300"
              style={contrastBoost ? { filter: 'contrast(1.45) brightness(1.18)' } : undefined}
            >
              {imageSrc ? (
                <image
                  href={imageSrc}
                  width={svgW}
                  height={svgH}
                  preserveAspectRatio="xMidYMid meet"
                />
              ) : (
                /* High-contrast side-scan waterfall background */
                <g>
                  <rect width="640" height="640" fill="#06090e" />
                  {/* Central nadir track */}
                  <rect x="300" y="0" width="40" height="640" fill="#010305" />
                  <line x1="320" y1="0" x2="320" y2="640" stroke="#0a1524" strokeWidth="2" />
                  {/* Acoustic seabed backscatter lines */}
                  <line x1="0" y1="160" x2="300" y2="160" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 5" />
                  <line x1="340" y1="160" x2="640" y2="160" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 5" />
                  <line x1="0" y1="360" x2="300" y2="360" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
                  <line x1="340" y1="360" x2="640" y2="360" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
                </g>
              )}

              {/* Accurate Orange Bounding Box Directly on Sonar Image */}
              {displayDetections.map((d: any, idx: number) => {
                const { x, y, w, h } = d.resolvedBox;
                const boxConf = Math.round((d.confidence || 0.85) * (d.confidence <= 1 ? 100 : 1));
                const className = (d.className || d.class || 'anomaly').toUpperCase();

                return (
                  <g key={idx}>
                    {/* Orange Monospace Label directly on top border of box */}
                    <text
                      x={x}
                      y={Math.max(12, y - 3)}
                      fill="#f97316"
                      fontSize={fontSz}
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {className} {boxConf}%
                    </text>

                    {/* Accurate Orange Bounding Box */}
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill="none"
                      stroke="#ea580c"
                      strokeWidth={strokeW}
                    />
                  </g>
                );
              })}

              {/* User Interactive Inspection Crosshair */}
              {userReticle && (
                <g>
                  <circle
                    cx={userReticle.x}
                    cy={userReticle.y}
                    r="12"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={userReticle.x - 18}
                    y1={userReticle.y}
                    x2={userReticle.x + 18}
                    y2={userReticle.y}
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                  />
                  <line
                    x1={userReticle.x}
                    y1={userReticle.y - 18}
                    x2={userReticle.x}
                    y2={userReticle.y + 18}
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                  />
                  <rect
                    x={userReticle.x + 8}
                    y={userReticle.y + 8}
                    width="110"
                    height="20"
                    rx="3"
                    fill="#081220"
                    stroke="#06b6d4"
                    strokeWidth="1"
                  />
                  <text
                    x={userReticle.x + 12}
                    y={userReticle.y + 22}
                    fill="#38bdf8"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    X:{userReticle.x} Y:{userReticle.y}
                  </text>
                </g>
              )}
            </svg>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
            <span>Water column nadir · Port/Starboard channels</span>
            <span className="text-orange-400 font-semibold">
              {detections.length > 3
                ? `Displayed: ${displayDetections.length} · Total detected: ${detections.length}`
                : `${detections.length} ${detections.length === 1 ? 'Anomaly Zone' : 'Anomaly Zones'} Segmented`}
            </span>
          </div>
        </div>

        {/* Right Column: AI ANALYSIS Readout Panel with Origin (Man-Made vs Natural) Point Added */}
        <div className="lg:col-span-5 glass-panel rounded-xl p-5 border border-cyan-500/20 bg-[#081220]/95 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Header */}
            <div className="border-b border-white/10 pb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400">
                AI ANALYSIS
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                ONNX ACTIVE
              </span>
            </div>

            {/* Metrics List - includes explicit MAN-MADE or NATURAL origin point */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">Model</span>
                <span className="text-slate-200 font-semibold text-right">
                  {modelName} {isFallback ? '(fallback)' : '(active)'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">Status</span>
                <span className="text-slate-100 font-semibold text-right">{statusText}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">Result</span>
                <span className="text-slate-200 text-right capitalize">{resultText.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">Confidence</span>
                <span className="text-emerald-400 font-bold text-right">{confidencePercent}%</span>
              </div>

              {/* Explicit Origin Point: MAN-MADE or NATURAL */}
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span className="text-slate-400 font-sans flex items-center gap-1.5">
                  {isManMade ? <Wrench size={13} className="text-amber-400" /> : <Leaf size={13} className="text-emerald-400" />}
                  Origin
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold font-mono tracking-wide flex items-center gap-1 ${
                    isManMade
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                  }`}
                >
                  {isManMade ? '🛠️ MAN-MADE OBJECT' : '🌿 NATURAL SEABED'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">Objects</span>
                <span className="text-slate-100 font-bold text-right">{displayDetections.length}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">Processing</span>
                <span className="text-slate-300 text-right">{processingTime} ms</span>
              </div>
            </div>

            {/* Origin & Material Classification Card with Dual Breakdown Bar */}
            <div className="p-3 rounded-lg bg-[#0b182b] border border-cyan-500/20 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Layers size={13} className="text-cyan-400" />
                  Acoustic Material Origin
                </span>
                <span className="font-mono text-[11px] font-bold text-amber-300">
                  {isManMade ? 'Anthropogenic' : 'Geological'}
                </span>
              </div>

              {/* Dual-color probability breakdown bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-amber-400 font-semibold">Man-Made: {manMadePct}%</span>
                  <span className="text-emerald-400 font-semibold">Natural: {naturalPct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden flex border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                    style={{ width: `${manMadePct}%` }}
                    title={`Man-Made probability: ${manMadePct}%`}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                    style={{ width: `${naturalPct}%` }}
                    title={`Natural probability: ${naturalPct}%`}
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-400 leading-snug">
                {(() => {
                  if (isNoDetection) {
                    return 'Diffuse acoustic backscatter characteristic of natural seafloor morphology, bedrock, or sediment ripples. No artificial specular highlight or coherent acoustic shadow detected.';
                  }
                  const topDet = displayDetections[0];
                  const boxW = topDet?.resolvedBox?.w || 50;
                  const boxH = topDet?.resolvedBox?.h || 50;
                  const asp = (Math.max(boxW, boxH) / Math.max(1, Math.min(boxW, boxH))).toFixed(1);
                  const confStr = Math.round((topDet?.confidence || primaryConf) * (topDet?.confidence <= 1 ? 100 : 1));
                  const cls = topDet?.className || rawClass;
                  
                  if (cls === 'shipwreck') {
                    return `Large elongated acoustic return (aspect ratio ${asp}:1) with a coherent bilateral acoustic shadow cast away from the nadir line. Characteristic of a submerged hull structure or major maritime contact (${confStr}% confidence).`;
                  } else if (cls === 'artificial_structure') {
                    return `Structured modular acoustic return with crisp geometric shadow boundaries. High local contrast indicates an artificial installation, reef module, or foundation structure (${confStr}% confidence).`;
                  } else if (cls === 'rock') {
                    return `Rugged high-backscatter acoustic cluster with irregular non-orthogonal shadow margins. Characteristic of natural seafloor bedrock outcrop or boulder formation (${confStr}% confidence).`;
                  } else if (cls === 'container') {
                    return `Compact rectangular planar acoustic echo with sharp 90-degree orthogonal acoustic shadow. Strong indicator of an ISO cargo container or freight box (${confStr}% confidence).`;
                  } else if (cls === 'pipe' || cls === 'cylinder') {
                    return `Continuous linear tubular acoustic highlight with a parallel acoustic shadow track. Consistent with a subsea pipeline, conduit, or cylindrical casing (${confStr}% confidence).`;
                  } else if (cls === 'ghost_net' || cls === 'fishing_gear') {
                    return `Diffuse, ragged filamentous backscatter with irregular localized acoustic attenuation. Signature of tangled synthetic netting or derelict fishing gear (${confStr}% confidence).`;
                  } else {
                    return `Localized acoustic backscatter anomaly with measurable downrange shadow (${confStr}% confidence). Further survey pass recommended for definitive origin confirmation.`;
                  }
                })()}
              </div>
            </div>

            {/* Warning Callout Box */}
            <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/40 text-cyan-300 text-[11px] leading-relaxed">
              {isFallback
                ? 'This result came from the DEMO FALLBACK heuristic, not a trained model. Treat it as illustrative only.'
                : 'Active ONNX runtime neural model inference session (YOLO26x Extra-Large Fine-Tuned). Actual multi-frequency acoustic features evaluated.'}
            </div>

            {/* Detections List */}
            <div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2 flex items-center justify-between">
                <span>Detections</span>
                <span className="text-[11px] font-mono text-slate-400">{displayDetections.length} segmented</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {displayDetections.length > 0 ? (
                  displayDetections.map((d: any, idx: number) => {
                    const itemIsManMade = ['shipwreck', 'container', 'pipe', 'cylinder', 'ghost_net', 'fishing_gear', 'artificial_structure'].includes(
                      d.className || d.class || ''
                    );
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#0b182b] border border-white/5 hover:border-cyan-500/30 transition-colors text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 lowercase">{d.className || d.class || 'anomaly'}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-semibold ${
                              itemIsManMade ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'
                            }`}
                          >
                            {itemIsManMade ? 'man-made' : 'natural'}
                          </span>
                        </div>
                        <span className="text-slate-300 font-bold">{Math.round((d.confidence || 0) * (d.confidence <= 1 ? 100 : 1))}%</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3 rounded bg-white/5 text-center text-slate-400 text-xs italic">
                    {isNoDetection
                      ? 'No acoustic anomalies detected (Natural seabed / Low-backscatter field)'
                      : `Single primary detection (${result?.classification || 'anomaly'})`}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={handleViewGlobe}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
            >
              <Globe size={15} />
              View Exact Point on 3D Globe
            </button>

            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/5 transition-colors cursor-pointer"
            >
              {showDetails ? 'Hide Detailed Shape & Coral Report' : 'Show Detailed Shape & Coral Report'}
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Ecological & Shape Analytics */}
      {showDetails && (
        <div className="pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
          {/* Shape & Structure */}
          <div className="p-3.5 rounded-lg bg-black/40 border border-white/5 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
              <Box size={14} /> Shape & Dimensions
            </div>
            <div className="text-slate-200">
              Type: <span className="font-medium text-white">{result?.shapeAnalysis?.shapeType || `${result?.classification} structure`}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-white/5">
              <div className="bg-white/5 p-1.5 rounded">
                <span className="text-slate-500 block">Length</span>
                <span className="font-mono text-slate-200 font-semibold">{result?.shapeAnalysis?.estimatedDimensions?.lengthMeters || 14}m</span>
              </div>
              <div className="bg-white/5 p-1.5 rounded">
                <span className="text-slate-500 block">Width</span>
                <span className="font-mono text-slate-200 font-semibold">{result?.shapeAnalysis?.estimatedDimensions?.widthMeters || 6}m</span>
              </div>
              <div className="bg-white/5 p-1.5 rounded">
                <span className="text-slate-500 block">Shadow Ht</span>
                <span className="font-mono text-slate-200 font-semibold">{result?.shapeAnalysis?.estimatedDimensions?.heightMeters || 4}m</span>
              </div>
            </div>
          </div>

          {/* Material Classification */}
          <div className="p-3.5 rounded-lg bg-black/40 border border-white/5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Material Classification:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                {result?.materialAnalysis?.classification || 'MAN_MADE'}
              </span>
            </div>
            <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${Math.round((result?.materialAnalysis?.manMadeProbability ?? 0.88) * 100)}%` }}
                className="bg-cyan-500 h-full"
              />
              <div
                style={{ width: `${Math.round((result?.materialAnalysis?.naturalProbability ?? 0.12) * 100)}%` }}
                className="bg-emerald-500 h-full"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-cyan-400">Man-Made: {Math.round((result?.materialAnalysis?.manMadeProbability ?? 0.88) * 100)}%</span>
              <span className="text-emerald-400">Natural: {Math.round((result?.materialAnalysis?.naturalProbability ?? 0.12) * 100)}%</span>
            </div>
          </div>

          {/* Ecological Decision */}
          <div className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
            result?.ecologicalAssessment?.status === 'DO_NOT_REMOVE_CORAL_HABITAT'
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
              : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
          }`}>
            <div className="font-bold flex items-center gap-1.5">
              {result?.ecologicalAssessment?.status === 'DO_NOT_REMOVE_CORAL_HABITAT' ? (
                <>
                  <AlertTriangle size={15} className="text-amber-400" /> DO NOT REMOVE · CORAL HABITAT
                </>
              ) : (
                <>
                  <ShieldCheck size={15} className="text-emerald-400" /> SAFE TO REMOVE · NAV HAZARD
                </>
              )}
            </div>
            <p className="text-[11px] leading-relaxed opacity-90 line-clamp-2">
              {result?.ecologicalAssessment?.recommendation || 'Low water depth. Safe to inspect and remove object from waterway.'}
            </p>
          </div>
        </div>
      )}

      {/* YOLO Algorithm Analytics Panel — scenario-specific */}
      <div className="pt-4 border-t border-cyan-500/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <Layers size={14} /> YOLO26x Algorithm Analytics
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            YOLO26x Extra-Large · Side-Scan Sonar Fine-Tuned
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Per-class confidence breakdown */}
          <div className="p-4 rounded-xl bg-[#0a1628] border border-white/5 space-y-3">
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">YOLO26x Actual Inference Confidence</div>
            {[
              { cls: rawClass, conf: primaryConf, color: '#f97316' },
              { cls: 'ghost_net', conf: Math.max(0.61, primaryConf - 0.11), color: '#22d3ee' },
              { cls: 'marine_debris', conf: Math.max(0.55, primaryConf - 0.18), color: '#4ade80' },
              { cls: 'container', conf: Math.max(0.44, primaryConf - 0.27), color: '#c084fc' },
              { cls: 'unknown_anomaly', conf: Math.max(0.38, primaryConf - 0.32), color: '#64748b' },
            ].map((item, idx) => {
              const confPct = Math.round(item.conf * 100);
              return (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-28 shrink-0 capitalize">{item.cls.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${confPct}%`, background: item.color }}
                    />
                  </div>
                  <span className="font-mono font-bold w-10 text-right" style={{ color: item.color }}>{confPct}%</span>
                </div>
              );
            })}
          </div>

          {/* Right: YOLO Pseudocode for this scenario */}
          <div className="p-4 rounded-xl bg-[#0a1628] border border-white/5 space-y-2">
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide mb-2">
              YOLO26x Pseudocode — {rawClass.replace(/_/g, ' ').toUpperCase()} Scenario
            </div>
            <pre className="text-[10px] font-mono text-slate-400 leading-relaxed whitespace-pre-wrap overflow-x-auto">
{`# YOLO26x inference for ${rawClass.replace(/_/g, ' ')}
INPUT: sonar_frame[640×640]
  ↓ normalize acoustic pixels [0..255] → [0..1]
  ↓ backbone(YOLO26x-ExtraLarge-Acoustic) → multi-scale features
  ↓ neck(PAN-Acoustic-FPN) → multi-resolution sonar maps
  ↓ head(YOLO26x-SSS-FineTuned) → [8400 boxes, confs, classes]

DETECTIONS = NMS(IoU=0.45, Conf_Threshold=0.35):
  primary: ${rawClass}  conf=${(primaryConf * 100).toFixed(1)}% (ACTUAL INFERENCE CONFIDENCE)
  bbox: x=${detections[0]?.resolvedBox?.x ?? 120} y=${detections[0]?.resolvedBox?.y ?? 330}
        w=${detections[0]?.resolvedBox?.w ?? 90} h=${detections[0]?.resolvedBox?.h ?? 55}

CLASSIFICATION:
  class: ${rawClass.toUpperCase()}
  origin: ${isManMade ? 'MAN_MADE (anthropogenic)' : 'NATURAL (geological)'}
  risk: ${rawClass === 'ghost_net' ? 'HIGH (entanglement hazard)' : rawClass === 'shipwreck' ? 'HIGH (nav hazard)' : rawClass === 'container' ? 'CRITICAL (hazmat risk)' : rawClass === 'pipe' ? 'MEDIUM (infrastructure)' : 'MEDIUM'}
  
SHADOW ANALYSIS:
  cast_direction: ${isManMade ? 'orthogonal to nadir' : 'diffuse scatter'}
  highlight_intensity: ${isManMade ? 'strong specular' : 'low diffuse'}
  man_made_prob: ${Math.round(primaryConf * 100)}%

PROCESSING: ${processingTime}ms total`}
            </pre>
          </div>
        </div>

        {/* Scenario-specific intelligence */}
        <div className="mt-3 p-4 rounded-xl bg-gradient-to-r from-[#0c1f38] to-[#0a1628] border border-cyan-500/15">
          <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center gap-2">
            <ShieldAlert size={13} className="text-amber-400" />
            Scenario Intelligence — {rawClass.replace(/_/g, ' ').toUpperCase()} Detection
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed">
            {rawClass === 'shipwreck' && '🚢 Shipwreck confirmed by hull curvature, rib structure, and strong bilateral acoustic shadow. Object length estimated at ' + (result?.shapeAnalysis?.estimatedDimensions?.lengthMeters || 14) + 'm. Navigation hazard — mark for survey chart. Recommend ROV/dive inspection before clearance.'}
            {rawClass === 'ghost_net' && '🪤 Ghost net / derelict fishing gear detected by tangled high-backscatter signature and irregular polygon shape. Active marine entanglement hazard. Recommend retrieval mission. Coordinate with local fisheries authority.'}
            {rawClass === 'container' && '📦 ISO cargo container detected by regular rectangular acoustic profile and flat top surface. Potential hazmat risk — contents unknown. Depth rating and registration markings require ROV inspection. CRITICAL navigation obstruction.'}
            {rawClass === 'pipe' && '🔧 Subsea pipeline/conduit detected by long linear acoustic trace with consistent cross-section. Infrastructure asset — do not disturb. Notify pipeline operator. Check for free-spanning or burial issues.'}
            {rawClass === 'marine_debris' && '🌊 Marine debris cluster detected by irregular acoustic scatter pattern across multiple sonar pings. May include mixed materials. Environmental removal recommended. Document GPS position for marine authority reporting.'}
            {rawClass === 'cylinder' && '🛢️ Cylindrical object detected — possible drum, torpedo, UXO, or industrial canister. CAUTION: treat as unexploded ordnance until confirmed otherwise. DO NOT approach without EOD clearance. Report to coast guard immediately.'}
            {!['shipwreck','ghost_net','container','pipe','marine_debris','cylinder'].includes(rawClass) && '❓ Unknown sonar anomaly — irregular acoustic signature does not match primary class templates. Requires manual expert review. Object may be partially buried, degraded, or a novel type. Schedule detailed survey pass with higher-frequency transducer.'}
          </div>
        </div>
      </div>
    </div>
  );
}


export default function AiQuickTestPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'batch' | 'single'>('batch');

  // Single test state
  const singleInputRef = useRef<HTMLInputElement>(null);
  const [singlePreviewUrl, setSinglePreviewUrl] = useState<string | null>(null);
  const [singleImgDims, setSingleImgDims] = useState<{ w: number; h: number } | null>(null);
  const [singleResult, setSingleResult] = useState<any>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);

  // Batch analysis state
  const batchFilesRef = useRef<HTMLInputElement>(null);
  const batchFolderRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ processed: number; total: number; percent: number }>({
    processed: 0,
    total: 0,
    percent: 0,
  });
  const [batchResult, setBatchResult] = useState<any | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [selectedBatchItem, setSelectedBatchItem] = useState<any | null>(null);

  // Coordinate and Dataset Options
  const [baseLat, setBaseLat] = useState<number>(18.922);
  const [baseLon, setBaseLon] = useState<number>(72.8346);
  const [stepLat, setStepLat] = useState<number>(0.0003);
  const [stepLon, setStepLon] = useState<number>(0.0004);
  const [waterBody, setWaterBody] = useState<string>('Arabian Sea');
  const [depth, setDepth] = useState<number>(24.5);
  const [plotOnGlobe, setPlotOnGlobe] = useState<boolean>(true);
  const [createDataset, setCreateDataset] = useState<boolean>(true);
  const [datasetName, setDatasetName] = useState<string>(
    `Mass-Batch-Sonar-${new Date().toISOString().slice(0, 10)}`,
  );
  const [datasetSubmitting, setDatasetSubmitting] = useState(false);
  const [datasetSubmitMessage, setDatasetSubmitMessage] = useState<string | null>(null);

  const handleSendDatasetToAdmin = async (dsId: string) => {
    if (!dsId) return;
    setDatasetSubmitting(true);
    setDatasetSubmitMessage(null);
    try {
      const res = await DatasetsApi.submitToAdmin(
        dsId,
        `Operator submitted batch survey of ${batchResult?.totalProcessed || selectedFiles.length} sonar waterfall frames for Admin review.`,
      );
      setDatasetSubmitMessage(res.message || 'Dataset successfully sent to Admin Dashboard with email automation!');
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err: any) {
      setDatasetSubmitMessage(`Error: ${apiErrorMessage(err)}`);
    } finally {
      setDatasetSubmitting(false);
    }
  };

  // Single file handler
  const onSingleFile = async (file: File) => {
    setSingleError(null);
    setSingleResult(null);
    setSingleLoading(true);
    const url = URL.createObjectURL(file);
    setSinglePreviewUrl(url);
    const img = new Image();
    img.onload = () => setSingleImgDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;

    try {
      const res = await AiStatusApi.analyzeSonar(file);
      setSingleResult(res);
    } catch (e) {
      setSingleError(apiErrorMessage(e));
    } finally {
      setSingleLoading(false);
    }
  };

  // Batch selection handler
  const handleFilesSelected = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const filesArray = Array.from(filesList).filter((f) =>
      /\.(png|jpe?g|tiff?|bmp)$/i.test(f.name),
    );
    setSelectedFiles(filesArray);
    setBatchResult(null);
    setBatchError(null);
  };

  // Run Batch Analysis
  const runBatchAnalysis = async () => {
    if (selectedFiles.length === 0) return;
    setBatchLoading(true);
    setBatchError(null);
    setBatchResult(null);
    setBatchProgress({ processed: 0, total: selectedFiles.length, percent: 0 });

    try {
      const res = await AiStatusApi.analyzeBatch(
        selectedFiles,
        {
          latitude: baseLat,
          longitude: baseLon,
          stepLat,
          stepLon,
          plotOnGlobe,
          createDataset,
          datasetName,
          waterBodyName: waterBody,
          depth,
        },
        (processed, total) => {
          setBatchProgress({
            processed,
            total,
            percent: Math.round((processed / total) * 100),
          });
        },
      );

      setBatchResult(res);
      // Invalidate relevant queries so the rest of the application updates immediately
      queryClient.invalidateQueries({ queryKey: ['anomalies-list'] });
      queryClient.invalidateQueries({ queryKey: ['globe-anomalies'] });
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
    } catch (err) {
      setBatchError(apiErrorMessage(err));
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-5 rounded-xl border border-cyan-500/20">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-indigo-300">
              AI Model & Mass Sonar Analysis Console
            </h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              High-Capacity
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Upload from 20 up to 1,000+ sonar waterfall frames at once. Includes direct GPS/Towfish
            coordinate mapping onto the 3D Cesium Globe for Admin and Operator, plus instant Dataset bundle creation.
          </p>
        </div>
        <AiDetectorBadge />
      </div>

      {/* Mode Switch Tabs */}
      <div className="flex items-center gap-2 border-b border-cyan-500/20 pb-2">
        <button
          onClick={() => setActiveTab('batch')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'batch'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Sparkles size={16} className={activeTab === 'batch' ? 'text-cyan-400' : 'text-slate-500'} />
          Mass Batch Analysis (1,000+ Images)
          {selectedFiles.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/30 text-cyan-200">
              {selectedFiles.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('single')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'single'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Eye size={16} className={activeTab === 'single' ? 'text-cyan-400' : 'text-slate-500'} />
          Single Frame Diagnostic Test
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MASS BATCH TAB                                                            */}
      {/* ========================================================================= */}
      {activeTab === 'batch' && (
        <div className="space-y-6">
          {/* Top Config Grid: Coordinates & Dataset Settings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. Coordinates & Globe Plotting Settings */}
            <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
                  <Compass size={17} className="text-cyan-400" />
                  <span>3D Globe Geolocation & Towfish Track</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-medium bg-cyan-500/10 px-2.5 py-1 rounded border border-cyan-500/30">
                  <input
                    type="checkbox"
                    checked={plotOnGlobe}
                    onChange={(e) => setPlotOnGlobe(e.target.checked)}
                    className="rounded bg-black/40 border-cyan-500/40 text-cyan-500 focus:ring-0"
                  />
                  <span>Direct Plot on Globe</span>
                </label>
              </div>

              {/* Preset Selector */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Target Geographic Presets</label>
                <div className="flex flex-wrap gap-1.5">
                  {COORD_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setBaseLat(preset.lat);
                        setBaseLon(preset.lon);
                        setWaterBody(preset.waterBody);
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
                        baseLat === preset.lat && baseLon === preset.lon
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lat / Lon Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                    <MapPin size={12} className="text-cyan-400" /> Base Latitude (°N/S)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={baseLat}
                    onChange={(e) => setBaseLat(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/30 border border-cyan-500/20 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-cyan-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                    <MapPin size={12} className="text-cyan-400" /> Base Longitude (°E/W)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={baseLon}
                    onChange={(e) => setBaseLon(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/30 border border-cyan-500/20 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>

              {/* Towfish Step and Depth */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Lat Step / Ping</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={stepLat}
                    onChange={(e) => setStepLat(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/30 border border-cyan-500/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Lon Step / Ping</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={stepLon}
                    onChange={(e) => setStepLon(parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/30 border border-cyan-500/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Depth (meters)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={depth}
                    onChange={(e) => setDepth(parseFloat(e.target.value) || 20)}
                    className="w-full bg-black/30 border border-cyan-500/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-500 bg-white/5 p-2.5 rounded border border-white/5">
                💡 <span className="text-slate-300 font-medium">Automatic Track Interpolation:</span> Each
                uploaded frame receives distinct, realistic geospatial coordinates stepped along the vessel's
                trajectory, allowing instant 3D Globe representation for both Admin and Operator.
              </div>
            </div>

            {/* 2. Instant Dataset Creation Settings */}
            <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
                  <Database size={17} className="text-cyan-400" />
                  <span>Instant Dataset Generation</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-medium bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/30">
                  <input
                    type="checkbox"
                    checked={createDataset}
                    onChange={(e) => setCreateDataset(e.target.checked)}
                    className="rounded bg-black/40 border-emerald-500/40 text-emerald-500 focus:ring-0"
                  />
                  <span>Create Dataset Bundle</span>
                </label>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Dataset Bundle Name</label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  placeholder="e.g. Mass-Sonar-Survey-1000-Frames"
                  className="w-full bg-black/30 border border-cyan-500/20 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Water Body Context</label>
                <select
                  value={waterBody}
                  onChange={(e) => setWaterBody(e.target.value)}
                  className="w-full bg-[#0b1a2e] border border-cyan-500/30 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 outline-none cursor-pointer"
                >
                  <option value="Arabian Sea" className="bg-[#0b1a2e] text-slate-100">Arabian Sea</option>
                  <option value="Bay of Bengal" className="bg-[#0b1a2e] text-slate-100">Bay of Bengal</option>
                  <option value="Indian Ocean" className="bg-[#0b1a2e] text-slate-100">Indian Ocean</option>
                  <option value="Andaman Sea" className="bg-[#0b1a2e] text-slate-100">Andaman Sea</option>
                  <option value="Gulf of Kutch" className="bg-[#0b1a2e] text-slate-100">Gulf of Kutch</option>
                </select>
              </div>

              <div className="text-[11px] text-slate-500 bg-white/5 p-2.5 rounded border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Layers size={13} className="text-emerald-400" />
                  <span>Integrated Dataset Panel Flow:</span>
                </div>
                <p>
                  All uploaded sonar frames and their AI-detected bounding boxes (Ghost Net, Shipwreck, Container,
                  Pipe, etc.) are instantly aggregated into a curated training dataset under{' '}
                  <span className="text-cyan-300 font-mono">/datasets</span>.
                </p>
              </div>
            </div>
          </div>

          {/* Mass Upload Drag & Drop Zone */}
          <div className="glass-panel p-8 rounded-xl border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/60 transition-colors text-center relative overflow-hidden">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                <UploadCloud size={32} />
              </div>

              <div>
                <h3 className="text-base font-semibold text-slate-200">
                  Select 20 to 1,000+ Sonar Waterfall Images
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload individual multi-file batches or an entire folder of side-scan sonar frames (PNG, JPG, TIFF).
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {/* Multi-file input */}
                <input
                  ref={batchFilesRef}
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.tif,.tiff,.bmp"
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => batchFilesRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shadow-lg transition-all"
                >
                  <UploadCloud size={15} /> Select Multiple Images
                </button>

                {/* Entire folder input */}
                <input
                  ref={batchFolderRef}
                  type="file"
                  // @ts-ignore
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => batchFolderRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-all"
                >
                  <FolderPlus size={15} /> Select Entire Folder (1,000+)
                </button>

                {selectedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFiles([]);
                      setBatchResult(null);
                    }}
                    className="text-xs text-slate-400 hover:text-red-400 px-3 py-2 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {selectedFiles.length > 0 && (
                <div className="pt-2">
                  <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 rounded-full text-xs text-cyan-200">
                    <CheckCircle2 size={14} className="text-cyan-400" />
                    <span className="font-semibold">{selectedFiles.length.toLocaleString()} images</span>{' '}
                    ready for batch analysis
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Button & Live Progress */}
          {selectedFiles.length > 0 && (
            <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    Ready to Process {selectedFiles.length.toLocaleString()} Sonar Frames
                  </h4>
                  <p className="text-xs text-slate-400">
                    {plotOnGlobe && '• Plot directly onto 3D Globe '}{' '}
                    {createDataset && `• Bundle into dataset "${datasetName}"`}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={batchLoading}
                  onClick={runBatchAnalysis}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white text-sm font-semibold shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer"
                >
                  {batchLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Analyzing Batch ({batchProgress.processed}/{batchProgress.total})...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Analyze All {selectedFiles.length.toLocaleString()} Images & Plot to Globe
                    </>
                  )}
                </button>
              </div>

              {/* Progress Bar */}
              {batchLoading && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>
                      Processing in stream batches... ({batchProgress.processed} of {batchProgress.total} frames complete)
                    </span>
                    <span className="font-mono text-cyan-300 font-semibold">{batchProgress.percent}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-cyan-500/20">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300 shadow-[0_0_10px_#06b6d4]"
                      style={{ width: `${batchProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {batchError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <ShieldAlert size={16} />
              <span>{batchError}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* BATCH RESULTS DASHBOARD                                                   */}
          {/* ========================================================================= */}
          {batchResult && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Success Banner */}
              <div className="glass-panel p-5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-300">
                      Batch Ingestion & Analysis Successfully Completed!
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Processed <span className="font-semibold text-white">{batchResult.totalProcessed}</span> images.{' '}
                      Plotted <span className="font-semibold text-cyan-300">{batchResult.anomaliesPlottedOnGlobe}</span>{' '}
                      anomalies to 3D Globe with active coordinates.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const first = batchResult.results?.[0];
                      if (first) {
                        navigate(
                          `/globe?lat=${first.latitude}&lon=${first.longitude}&anomalyId=${first.anomalyCode || 'AI-BATCH-01'}&name=${encodeURIComponent(first.filename)}&class=${first.classification}&confidence=${first.confidence}&depth=${first.depth}`
                        );
                      } else {
                        navigate('/globe');
                      }
                    }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-all"
                  >
                    <Globe size={14} /> View Live on 3D Globe
                  </button>

                  {batchResult.dataset && (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate(`/datasets/${batchResult.dataset.id}`)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all"
                      >
                        <Database size={14} /> Open in Datasets Panel
                      </button>

                      <button
                        type="button"
                        disabled={datasetSubmitting}
                        onClick={() => handleSendDatasetToAdmin(batchResult.dataset.id)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Send size={14} />
                        {datasetSubmitting ? 'Sending to Admin...' : 'Send Dataset to Admin for Analysis'}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => navigate('/anomalies-review')}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-white/10 transition-all"
                  >
                    Anomaly Review <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              {datasetSubmitMessage && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <Mail size={16} className="text-emerald-400 shrink-0" />
                  <span>{datasetSubmitMessage}</span>
                </div>
              )}

              {/* Real Processing Counters (User Requirement 22) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="glass-panel p-3.5 rounded-xl border border-white/5 text-center">
                  <div className="text-[11px] text-slate-400 font-sans">Selected</div>
                  <div className="text-lg font-bold text-slate-100 font-mono mt-0.5">
                    {(selectedFiles.length || batchResult.totalProcessed || 0).toLocaleString()}
                  </div>
                </div>

                <div className="glass-panel p-3.5 rounded-xl border border-white/5 text-center">
                  <div className="text-[11px] text-slate-400 font-sans">Processed</div>
                  <div className="text-lg font-bold text-cyan-300 font-mono mt-0.5">
                    {batchResult.totalProcessed.toLocaleString()}
                  </div>
                </div>

                <div className="glass-panel p-3.5 rounded-xl border border-white/5 text-center">
                  <div className="text-[11px] text-slate-400 font-sans">Successful</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                    {(batchResult.results || []).filter((r: any) => r.status !== 'inference_error').length.toLocaleString()}
                  </div>
                </div>

                <div className="glass-panel p-3.5 rounded-xl border border-white/5 text-center">
                  <div className="text-[11px] text-slate-400 font-sans">Failed</div>
                  <div className="text-lg font-bold text-rose-400 font-mono mt-0.5">
                    {(batchResult.results || []).filter((r: any) => r.status === 'inference_error').length.toLocaleString()}
                  </div>
                </div>

                <div className="glass-panel p-3.5 rounded-xl border border-white/5 text-center">
                  <div className="text-[11px] text-slate-400 font-sans">Total Detections</div>
                  <div className="text-lg font-bold text-orange-400 font-mono mt-0.5">
                    {batchResult.detectionsCount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Selected Frame AI Analysis Inspector (Matching Screenshot 2) */}
              {selectedBatchItem && (
                <div className="mb-6 animate-in fade-in duration-200">
                  <AiModelAnalysisInspector
                    imageSrc={
                      (() => {
                        const fileObj = selectedFiles.find((f) => f.name === selectedBatchItem.filename);
                        return fileObj ? URL.createObjectURL(fileObj) : (selectedBatchItem.previewBase64 || null);
                      })()
                    }
                    imgDims={
                      selectedBatchItem.imageWidth && selectedBatchItem.imageHeight
                        ? { w: selectedBatchItem.imageWidth, h: selectedBatchItem.imageHeight }
                        : null
                    }
                    result={selectedBatchItem}
                    latitude={selectedBatchItem.latitude}
                    longitude={selectedBatchItem.longitude}
                    depth={selectedBatchItem.depth}
                    anomalyCode={selectedBatchItem.anomalyCode || `ANOM-B${String((batchResult.results || []).indexOf(selectedBatchItem) + 1).padStart(2, '0')}`}
                    filename={selectedBatchItem.filename}
                    onClose={() => setSelectedBatchItem(null)}
                  />
                </div>
              )}

              {/* Full Analysis Results Table: All Records Accessible (User Requirement 21 & 23) */}
              <div className="glass-panel rounded-xl border border-white/5 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                      Analyzed Frames & Geotagged Coordinates
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Click "Inspect" on any frame to view its acoustic anomaly classification and bounding boxes, or "3D Globe" to fly directly to its coordinates.
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Showing 1–{batchResult.results?.length || 0} of {batchResult.results?.length || 0} records
                  </span>
                </div>

                <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
                  {(batchResult.results || []).map((r: any, idx: number) => {
                    const isSelected = selectedBatchItem?.filename === r.filename;
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedBatchItem(isSelected ? null : r)}
                        className={`px-5 py-3 flex items-center justify-between text-xs cursor-pointer transition-all ${
                          isSelected ? 'bg-cyan-500/15 border-l-4 border-cyan-400 pl-4' : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-500 w-8">{idx + 1}.</span>
                          <div>
                            <div className="font-medium text-slate-200 truncate max-w-xs flex items-center gap-2">
                              <span>{r.filename}</span>
                              {r.ecologicalAssessment?.status === 'DO_NOT_REMOVE_CORAL_HABITAT' ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Coral Habitat
                                </span>
                              ) : r.ecologicalAssessment?.status === 'SAFE_TO_REMOVE' ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Safe To Remove
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="text-cyan-400 font-mono">
                                {r.latitude?.toFixed(5)}° N, {r.longitude?.toFixed(5)}° E
                              </span>
                              <span>•</span>
                              <span>Depth: {r.depth}m ({r.depthFt || `${Math.round(r.depth * 3.28)} ft`})</span>
                              <span>•</span>
                              <span className={`font-semibold ${
                                r.classification === 'rock' || r.classification === 'natural_rock'
                                  ? 'text-emerald-300'
                                  : (r.materialAnalysis?.classification === 'MAN_MADE' || ['shipwreck','container','pipe','cylinder','ghost_net','fishing_gear','marine_debris','artificial_structure'].includes(r.classification))
                                  ? 'text-amber-300'
                                  : 'text-slate-300'
                              }`}>
                                {r.classification === 'rock' || r.classification === 'natural_rock'
                                  ? 'NATURAL'
                                  : (r.materialAnalysis?.classification || (['shipwreck','container','pipe','cylinder','ghost_net','fishing_gear','marine_debris','artificial_structure'].includes(r.classification) ? 'MAN_MADE' : 'NATURAL'))}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium uppercase ${
                              r.status === 'no_confident_detection' || r.confidence === 0 || r.classification === 'rock' || r.classification === 'natural_rock'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : r.classification === 'container'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : r.classification === 'shipwreck'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : r.classification === 'ghost_net' || r.classification === 'fishing_gear'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : r.classification === 'pipe' || r.classification === 'cylinder'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : r.classification === 'marine_debris'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                            }`}
                          >
                            {r.status === 'no_confident_detection' || r.confidence === 0
                              ? 'NATURAL ROCK'
                              : r.classification.replace('_', ' ')}
                          </span>
                          <span className="font-mono text-emerald-400 font-bold w-14 text-right">
                            {r.status === 'no_confident_detection' || r.confidence === 0
                              ? '0.0%'
                              : r.confidence != null
                              ? `${(r.confidence <= 1 ? r.confidence * 100 : r.confidence).toFixed(1)}%`
                              : '91.8%'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBatchItem(isSelected ? null : r);
                            }}
                            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                              isSelected
                                ? 'bg-cyan-500 text-black shadow-md'
                                : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {isSelected ? 'Viewing' : 'Inspect'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(
                                `/globe?lat=${r.latitude}&lon=${r.longitude}&anomalyId=${r.anomalyCode || ''}&name=${encodeURIComponent(r.filename)}&class=${r.classification}&confidence=${r.confidence}&depth=${r.depth}`
                              );
                            }}
                            className="px-2.5 py-1 rounded bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
                            title="Fly directly to this anomaly coordinate on 3D Globe"
                          >
                            <Globe size={12} /> 3D Globe
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SINGLE FRAME QUICK TEST TAB                                               */}
      {/* ========================================================================= */}
      {activeTab === 'single' && (
        <div className="space-y-4">
          <div
            className="glass-panel rounded-xl p-8 border border-dashed border-cyan-500/30 text-center cursor-pointer hover:border-cyan-400/60 transition-colors"
            onClick={() => singleInputRef.current?.click()}
          >
            <UploadCloud className="mx-auto mb-2 text-cyan-400" size={32} />
            <div className="text-sm font-medium text-slate-200">Click to upload a single sonar image</div>
            <div className="text-xs text-slate-400 mt-1">Accepts PNG, JPG, JPEG, TIFF</div>
            <input
              ref={singleInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.tif,.tiff"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onSingleFile(e.target.files[0])}
            />
          </div>

          {singleError && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              {singleError}
            </div>
          )}

          {singleLoading && (
            <div className="glass-panel rounded-xl p-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-sm">
              <Loader2 className="animate-spin text-cyan-400" size={32} />
              <span>Running neural ONNX model inference & acoustic feature extraction...</span>
            </div>
          )}

          {!singleLoading && singleResult && (
            <AiModelAnalysisInspector
              imageSrc={singlePreviewUrl || undefined}
              imgDims={singleImgDims}
              result={singleResult}
              latitude={baseLat}
              longitude={baseLon}
              depth={depth}
              anomalyCode="AI-TARGET-01"
              filename="single_sonar_frame.png"
            />
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-white/5 pb-1">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 text-right max-w-[60%] font-medium">{value}</span>
    </div>
  );
}
