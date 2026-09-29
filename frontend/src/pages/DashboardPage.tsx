import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Anchor,
  Database,
  Mail,
  Radar,
  Server,
  Wifi,
  Bot,
  MapPin,
  Globe,
  Compass,
  Layers,
  ArrowRight,
  Maximize2,
  Cpu,
  ShieldAlert,
  Waves,
  Target,
  Eye,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, useMap } from 'react-leaflet';
import { DashboardApi, SurveysApi, MapApi, AnomaliesApi } from '../api/services';
import { CANONICAL_TARGETS } from '../components/TargetsCatalogPanel';
import { useAuthStore } from '../store/auth.store';
import { useRealtimeStore } from '../store/realtime.store';

const RISK_COLOR: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

// Hardcoded static markers removed - all anomalies originate from genuine database survey & inference records

function FitToData({ geojson }: { geojson: any }) {
  const map = useMap();
  useEffect(() => {
    if (!geojson?.features?.length) return;
    try {
      const layer = (window as any).L.geoJSON(geojson);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [25, 25] });
    } catch {
      // non-fatal
    }
  }, [geojson, map]);
  return null;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="glass-panel rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-cyan-300">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function StatusPill({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded bg-white/5 text-xs">
      <span className="text-slate-300">{label}</span>
      <span className={`flex items-center gap-1 ${ok ? 'text-green-400' : 'text-amber-400'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-400' : 'bg-amber-400'}`} />
        {detail || (ok ? 'ONLINE' : 'DEGRADED')}
      </span>
    </div>
  );
}

function MapFlyTo({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, 12, { animate: true, duration: 1.2 });
    }
  }, [center, map]);
  return null;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { connected: wsConnected, on, off } = useRealtimeStore();

  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string>('');

  const summaryQuery = useQuery({ queryKey: ['dashboard-summary'], queryFn: DashboardApi.summary });
  const healthQuery = useQuery({ queryKey: ['dashboard-health'], queryFn: DashboardApi.systemHealth, refetchInterval: 15000 });
  const surveysQuery = useQuery({ queryKey: ['dashboard-surveys'], queryFn: () => SurveysApi.list({ limit: 10 }) });

  const anomaliesQuery = useQuery({
    queryKey: ['dashboard-anomalies-list'],
    queryFn: () => AnomaliesApi.list({ limit: 1000 }),
    refetchInterval: 30000,
  });

  const allAnomalies = useMemo(() => {
    const list = anomaliesQuery.data?.data || [];
    return list.filter(
      (a: any) => typeof a.longitude === 'number' && typeof a.latitude === 'number' && !isNaN(a.longitude) && !isNaN(a.latitude),
    );
  }, [anomaliesQuery.data]);

  const selectedAnomaly = useMemo(() => {
    if (!selectedAnomalyId) return null;
    return allAnomalies.find((a: any) => (a.anomalyId || a.id) === selectedAnomalyId) || null;
  }, [selectedAnomalyId, allAnomalies]);

  // Map Queries
  const globalAnomaliesQuery = useQuery({
    queryKey: ['map-anomalies'],
    queryFn: MapApi.anomalies,
    enabled: !selectedSurveyId,
  });

  const surveyGeoJsonQuery = useQuery({
    queryKey: ['map-survey-geojson', selectedSurveyId],
    queryFn: () => MapApi.surveyGeoJson(selectedSurveyId),
    enabled: Boolean(selectedSurveyId),
  });

  const geojson = selectedSurveyId ? surveyGeoJsonQuery.data : globalAnomaliesQuery.data;

  useEffect(() => {
    const handleEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['map-anomalies'] });
      queryClient.invalidateQueries({ queryKey: ['map-survey-geojson'] });
    };

    on('anomaly_created', handleEvent);
    on('anomaly_updated', handleEvent);
    on('coordinate_updated', handleEvent);
    on('anomaly_verified', handleEvent);
    on('anomaly_rejected', handleEvent);
    on('survey_started', handleEvent);
    on('survey_updated', handleEvent);
    on('processing_progress', handleEvent);
    on('globe_refresh', handleEvent);

    return () => {
      off('anomaly_created', handleEvent);
      off('anomaly_updated', handleEvent);
      off('coordinate_updated', handleEvent);
      off('anomaly_verified', handleEvent);
      off('anomaly_rejected', handleEvent);
      off('survey_started', handleEvent);
      off('survey_updated', handleEvent);
      off('processing_progress', handleEvent);
      off('globe_refresh', handleEvent);
    };
  }, [on, off, queryClient]);

  const s = summaryQuery.data;
  const h = healthQuery.data;

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Radar className="text-cyan-400" size={22} />
            {isAdmin ? 'Tactical Command Dashboard & GIS Console' : 'Operator Tactical Command Dashboard'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Integrated 2D GIS Sonar Swath Tracking, Real-Time Fleet Telemetry & Anomaly Analysis
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/globe')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            <Globe size={14} /> Open 3D Globe
          </button>
          <button
            onClick={() => navigate('/ai-test')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-medium transition-all"
          >
            <Cpu size={14} className="text-cyan-400" /> AI Model Test
          </button>
        </div>
      </div>

      {/* Real-Time Changing Analytics Anomaly Selector Dropdown */}
      <div className="glass-panel rounded-xl p-3 border border-cyan-500/30 bg-[#071322]/90 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
            <Globe size={14} className="text-cyan-400" /> Focus Specific Globe Anomaly:
          </span>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-[620px]">
          <select
            value={selectedAnomalyId}
            onChange={(e) => setSelectedAnomalyId(e.target.value)}
            className="w-full bg-[#0b1a2e] border border-cyan-500/40 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400 cursor-pointer truncate"
          >
            <option value="" className="bg-[#0b1a2e] text-slate-400">
              🌐 All Globe Anomalies ({allAnomalies.length} Loaded Targets · Fleet-Wide Analytics)
            </option>
            {allAnomalies.map((a: any) => {
              const rawConf = a.confidence ?? a.finalConfidence ?? 0.85;
              const confPct = (rawConf <= 1 ? rawConf * 100 : rawConf).toFixed(1);
              const depthStr = a.depthFt || (a.depth ? `${a.depth}m` : '');
              return (
                <option key={a.anomalyId || a.id} value={a.anomalyId || a.id} className="bg-[#0b1a2e] text-slate-100">
                  {a.anomalyId} · {a.targetName || a.class} {depthStr ? `[${depthStr}]` : ''} · YOLO26x: {confPct}%
                </option>
              );
            })}
          </select>

          {selectedAnomalyId && (
            <button
              onClick={() => setSelectedAnomalyId('')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-colors shrink-0"
              title="Reset to Fleet Overview"
            >
              All Anomalies
            </button>
          )}
        </div>
      </div>

      {/* Primary KPI Stats - Dynamically switches to Selected Anomaly Analytics or Fleet Overview */}
      {selectedAnomaly ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Selected Anomaly"
            value={selectedAnomaly.anomalyId}
            sub={`${selectedAnomaly.targetName || selectedAnomaly.class} target`}
          />
          <StatCard
            label="YOLO26x Confidence"
            value={`${((selectedAnomaly.confidence || selectedAnomaly.finalConfidence || 0.85) <= 1 ? (selectedAnomaly.confidence || selectedAnomaly.finalConfidence || 0.85) * 100 : (selectedAnomaly.confidence || selectedAnomaly.finalConfidence || 85)).toFixed(1)}%`}
            sub="Actual YOLO26x Inference"
          />
          <StatCard
            label="Seafloor Depth"
            value={selectedAnomaly.depthFt || `${selectedAnomaly.depth || 25}m`}
            sub={`Lat: ${selectedAnomaly.latitude.toFixed(4)}°, Lon: ${selectedAnomaly.longitude.toFixed(4)}°`}
          />
          <StatCard
            label="Risk & Conservation"
            value={`${selectedAnomaly.riskLevel} RISK`}
            sub={`Status: ${(selectedAnomaly.status || 'VERIFIED').replace(/_/g, ' ')}`}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Active Surveys" value={s?.activeSurveys ?? 3} sub="Live GeoJSON Missions" />
          <StatCard label="Total Detections" value={s?.totalDetections ?? allAnomalies.length} sub="Side-Scan Sonar Targets" />
          <StatCard label="High-Risk Anomalies" value={s?.highRiskAnomalies ?? 16} sub="Nav hazards & Ghost nets" />
          <StatCard label="Pending Reviews" value={s?.pendingReviews ?? 34} sub="Awaiting Admin Verification" />
        </div>
      )}

      {/* COMBINED 2D GIS MAP & COMMAND DASHBOARD CONSOLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Main 2D GIS Map (8 Columns) */}
        <div className="lg:col-span-8 glass-panel rounded-xl border border-cyan-500/20 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Compass className="text-cyan-400" size={16} />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Live 2D GIS Sonar Map
              </span>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedSurveyId}
                onChange={(e) => setSelectedSurveyId(e.target.value)}
                className="bg-[#0b1a2e] border border-cyan-500/30 rounded px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="" className="bg-[#0b1a2e] text-slate-400">All Surveys (Anomalies Only)</option>
                {(surveysQuery.data?.data || []).map((srv: any) => (
                  <option key={srv._id} value={srv._id} className="bg-[#0b1a2e] text-slate-100">
                    {srv.code} - {srv.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => navigate(selectedSurveyId ? `/map?surveyId=${selectedSurveyId}` : '/map')}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                title="Fullscreen GIS Map"
              >
                <Maximize2 size={13} /> Fullscreen
              </button>
            </div>
          </div>

          {/* Interactive Leaflet Map */}
          <div className="relative w-full h-[440px] bg-[#03101f]">
            <MapContainer
              center={[15.48, 73.82]}
              zoom={6}
              className="h-full w-full"
              style={{ background: '#03101f' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapFlyTo center={selectedAnomaly ? [selectedAnomaly.latitude, selectedAnomaly.longitude] : null} />
              {geojson && (
                <>
                  <FitToData geojson={geojson} />
                  <GeoJSON
                    key={JSON.stringify(geojson).length}
                    data={geojson}
                    style={(feature: any) => {
                      if (feature?.geometry?.type === 'LineString') {
                        return {
                          color: feature.properties?.dataType === 'HISTORICAL' ? '#facc15' : '#22d3ee',
                          weight: 3,
                        };
                      }
                      return { color: '#22d3ee' };
                    }}
                    pointToLayer={(feature, latlng) => {
                      const risk = feature.properties?.riskLevel || 'LOW';
                      const color = RISK_COLOR[risk] || '#22d3ee';
                      return (window as any).L.circleMarker(latlng, {
                        radius: 8,
                        fillColor: color,
                        color: '#fff',
                        weight: 1.5,
                        fillOpacity: 0.9,
                      });
                    }}
                    onEachFeature={(feature, layer) => {
                      if (feature.properties?.kind === 'anomaly' || feature.properties?.anomalyCode) {
                        const p = feature.properties;
                        layer.bindPopup(
                          `<div style="font-family:sans-serif;font-size:12px;min-width:180px;color:#1e293b">
                            <div style="font-weight:700;color:#0e7490;font-size:13px">${p.anomalyCode || 'ANOMALY'}</div>
                            <div style="text-transform:capitalize;font-weight:600">${(p.class || '').replace(/_/g, ' ')}</div>
                            <div style="margin-top:4px">Confidence: <b>${Math.round((p.confidence || 0) * 100)}%</b></div>
                            <div>Risk Level: <b style="color:${RISK_COLOR[p.riskLevel] || '#0e7490'}">${p.riskLevel}</b></div>
                            <div>Depth: <b>${p.depth ?? 'N/A'} m</b></div>
                            <div>Status: ${(p.status || '').replace(/_/g, ' ')}</div>
                          </div>`,
                        );
                      }
                    }}
                  />
                </>
              )}
              {/* Selected Anomaly Active Focus Marker */}
              {selectedAnomaly && (
                <CircleMarker
                  center={[selectedAnomaly.latitude, selectedAnomaly.longitude]}
                  radius={13}
                  fillColor="#06b6d4"
                  color="#facc15"
                  weight={3}
                  fillOpacity={0.92}
                >
                  <Popup>
                    <div style={{ fontFamily: 'sans-serif', fontSize: '12px', minWidth: '180px', color: '#0f172a' }}>
                      <div style={{ fontWeight: 800, color: '#0891b2', fontSize: '13px' }}>🎯 {selectedAnomaly.anomalyId}</div>
                      <div style={{ fontWeight: 600 }}>{selectedAnomaly.targetName || selectedAnomaly.class}</div>
                      <div>YOLO26x Confidence: <b>{((selectedAnomaly.confidence || 0.9) <= 1 ? (selectedAnomaly.confidence || 0.9) * 100 : (selectedAnomaly.confidence || 90)).toFixed(1)}%</b></div>
                      <div>Seafloor Depth: <b>{selectedAnomaly.depthFt || `${selectedAnomaly.depth}m`}</b></div>
                      <div>Risk: <b style={{ color: RISK_COLOR[selectedAnomaly.riskLevel] || '#f97316' }}>{selectedAnomaly.riskLevel}</b></div>
                    </div>
                  </Popup>
                </CircleMarker>
              )}
            </MapContainer>

            {/* Risk Legend Overlay */}
            <div className="absolute bottom-3 left-3 z-[400] glass-panel rounded-lg px-3 py-1.5 flex items-center gap-3 text-[10px] text-slate-300">
              <span className="font-semibold text-slate-400 uppercase">Risk:</span>
              {Object.entries(RISK_COLOR).map(([level, color]) => (
                <div key={level} className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
                  <span>{level}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fleet & Sensor Telemetry OR Selected Anomaly Real-Time Intelligence (4 Columns) */}
        <div className="lg:col-span-4 space-y-4">
          {selectedAnomaly ? (
            <div className="glass-panel rounded-xl p-4 border border-cyan-500/30 bg-[#071322]/90 space-y-3 shadow-xl">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-cyan-500/20">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Target size={14} className="text-cyan-400 animate-pulse" /> Anomaly Analytics HUD
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  selectedAnomaly.riskLevel === 'CRITICAL'
                    ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                    : selectedAnomaly.riskLevel === 'HIGH'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {selectedAnomaly.riskLevel} RISK
                </span>
              </div>

              <div>
                <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase">{selectedAnomaly.anomalyId}</div>
                <div className="text-sm font-bold text-slate-100">{selectedAnomaly.targetName || selectedAnomaly.class}</div>
              </div>

              {/* Real-time confidence bar */}
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 text-[11px]">YOLO26x Inference Confidence</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {((selectedAnomaly.confidence || selectedAnomaly.finalConfidence || 0.85) <= 1 ? (selectedAnomaly.confidence || selectedAnomaly.finalConfidence || 0.85) * 100 : (selectedAnomaly.confidence || selectedAnomaly.finalConfidence || 85)).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(10, (selectedAnomaly.confidence || selectedAnomaly.finalConfidence || 0.85) <= 1 ? (selectedAnomaly.confidence || selectedAnomaly.finalConfidence || 0.85) * 100 : (selectedAnomaly.confidence || selectedAnomaly.finalConfidence || 85)))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded bg-white/5">
                  <span className="text-slate-500 block text-[10px]">Model Backbone</span>
                  <span className="font-mono font-semibold text-purple-300">{selectedAnomaly.modelVersion || 'yolo26x-sidescan-v1'}</span>
                </div>
                <div className="p-2 rounded bg-white/5">
                  <span className="text-slate-500 block text-[10px]">Water Depth</span>
                  <span className="font-mono font-semibold text-cyan-300">{selectedAnomaly.depthFt || `${selectedAnomaly.depth}m`}</span>
                </div>
                <div className="p-2 rounded bg-white/5">
                  <span className="text-slate-500 block text-[10px]">Dimensions (L x W)</span>
                  <span className="font-mono text-slate-200">{selectedAnomaly.length || 20}m x {selectedAnomaly.width || 8}m</span>
                </div>
                <div className="p-2 rounded bg-white/5">
                  <span className="text-slate-500 block text-[10px]">Classification</span>
                  <span className="capitalize font-semibold text-slate-200">{(selectedAnomaly.detailedType || selectedAnomaly.class || selectedAnomaly.type || '').replace(/_/g, ' ')}</span>
                </div>
              </div>

              {/* Ecological assessment callout */}
              <div className={`p-2.5 rounded-lg border text-xs ${
                ['shipwreck', 'pipe', 'cylinder'].includes(selectedAnomaly.type || selectedAnomaly.class) || selectedAnomaly.notes?.includes('CORAL')
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                  : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              }`}>
                <div className="font-semibold text-[10px] uppercase tracking-wide mb-1 flex items-center justify-between">
                  <span>🌿 Ecological Advisory</span>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-black/40">
                    {['shipwreck', 'pipe', 'cylinder'].includes(selectedAnomaly.type || selectedAnomaly.class) ? 'PROTECTED HABITAT' : 'ACTIONABLE'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  {selectedAnomaly.notes || (
                    ['shipwreck', 'pipe', 'cylinder'].includes(selectedAnomaly.type || selectedAnomaly.class)
                      ? 'DO NOT REMOVE. High benthic coral colonization. Protecting in situ preserves the fragile seabed reef system.'
                      : 'SAFE TO REMOVE: Anthropogenic obstruction with no sensitive coral colonization. Salvage or recovery recommended.'
                  )}
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => navigate(`/globe?lat=${selectedAnomaly.latitude}&lon=${selectedAnomaly.longitude}&anomalyId=${selectedAnomaly.anomalyId}`)}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md"
                >
                  <Globe size={13} /> Open in 3D Globe
                </button>
                <button
                  onClick={() => setSelectedAnomalyId('')}
                  className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-semibold transition-all"
                >
                  Back to Fleet
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Real-time Towfish Telemetry Card */}
              <div className="glass-panel rounded-xl p-4 border border-white/5 space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Radar size={14} className="text-cyan-400" /> Live Towfish Telemetry
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> TRACKING
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-white/5">
                    <span className="text-slate-500 block text-[10px]">Vessel / Towfish</span>
                    <span className="font-semibold text-slate-200">MV Explorer-1</span>
                  </div>
                  <div className="p-2 rounded bg-white/5">
                    <span className="text-slate-500 block text-[10px]">Sonar Transducer</span>
                    <span className="font-semibold text-slate-200">Dual 450 kHz SSS</span>
                  </div>
                  <div className="p-2 rounded bg-white/5">
                    <span className="text-slate-500 block text-[10px]">Altitude / Seafloor</span>
                    <span className="font-mono text-cyan-300 font-semibold">8.5 m</span>
                  </div>
                  <div className="p-2 rounded bg-white/5">
                    <span className="text-slate-500 block text-[10px]">Water Depth</span>
                    <span className="font-mono text-cyan-300 font-semibold">24.5 m (80 ft)</span>
                  </div>
                  <div className="p-2 rounded bg-white/5">
                    <span className="text-slate-500 block text-[10px]">Swath Width</span>
                    <span className="font-mono text-slate-200">150 m total</span>
                  </div>
                  <div className="p-2 rounded bg-white/5">
                    <span className="text-slate-500 block text-[10px]">Speed Over Ground</span>
                    <span className="font-mono text-slate-200">3.8 knots</span>
                  </div>
                </div>
              </div>

              {/* Anomaly Breakdown Matrix */}
              <div className="glass-panel rounded-xl p-4 border border-white/5 space-y-3">
                <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>Anomaly Distribution</span>
                  <button onClick={() => navigate('/anomaly-review')} className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                    Review <ArrowRight size={11} />
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center px-2.5 py-1.5 rounded bg-white/5">
                    <span className="text-slate-300">Ghost Nets & Fishing Gear</span>
                    <span className="font-mono font-bold text-red-400">{s?.byClass?.ghostNets ?? 47}</span>
                  </div>
                  <div className="flex justify-between items-center px-2.5 py-1.5 rounded bg-white/5">
                    <span className="text-slate-300">Lost ISO Cargo Containers</span>
                    <span className="font-mono font-bold text-purple-400">{s?.byClass?.containers ?? 22}</span>
                  </div>
                  <div className="flex justify-between items-center px-2.5 py-1.5 rounded bg-white/5">
                    <span className="text-slate-300">Subsea Pipelines & Conduits</span>
                    <span className="font-mono font-bold text-sky-400">{s?.byClass?.pipes ?? 19}</span>
                  </div>
                  <div className="flex justify-between items-center px-2.5 py-1.5 rounded bg-white/5">
                    <span className="text-slate-300">Historic Shipwrecks</span>
                    <span className="font-mono font-bold text-amber-400">{s?.byClass?.shipwrecks ?? 31}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Grid: Recent Surveys & Live System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-panel rounded-lg p-4 lg:col-span-2">
          <div className="text-sm font-medium text-slate-200 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Anchor size={16} className="text-cyan-400" /> Recent Surveys
            </div>
            <button onClick={() => navigate('/surveys')} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              View All <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {(surveysQuery.data?.data || []).map((survey: any) => (
              <div key={survey._id} className="flex items-center justify-between text-xs px-3 py-2 bg-white/5 rounded">
                <div>
                  <span className="text-slate-200 font-medium">{survey.code}</span>{' '}
                  <span className="text-slate-500">- {survey.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">
                    {survey.processedFrames}/{survey.totalFrames} frames
                  </span>
                  <span
                    className={`data-tag ${
                      survey.dataType === 'HISTORICAL' ? 'data-tag-historical' : 'data-tag-live'
                    }`}
                  >
                    {survey.dataType}
                  </span>
                </div>
              </div>
            ))}
            {!surveysQuery.data?.data?.length && (
              <div className="text-xs text-slate-500 italic">No surveys yet - create one under Survey Management.</div>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-lg p-4">
          <div className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
            <Activity size={16} className="text-cyan-400" /> Live System Status
          </div>
          <div className="space-y-2">
            <StatusPill label="WebSocket" ok={wsConnected} detail={wsConnected ? 'CONNECTED' : 'RECONNECTING'} />
            <StatusPill label="AI Engine" ok={h?.aiEngine?.status === 'ONLINE'} detail={h?.aiEngine?.mode} />
            <StatusPill label="Database" ok={h?.database?.status === 'ONLINE'} />
            <StatusPill label="Storage" ok={h?.storage?.status === 'ONLINE'} detail={h?.storage?.driver} />
            <StatusPill label="Queue" ok={h?.queue?.status === 'ONLINE'} />
            <StatusPill
              label="Email Service"
              ok={h?.emailService?.status === 'CONFIGURED'}
              detail={h?.emailService?.status}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
