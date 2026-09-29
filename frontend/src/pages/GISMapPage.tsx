import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import { MapApi, SurveysApi } from '../api/services';
import { DataTag } from '../components/DataTag';

const RISK_COLOR: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

const BASEMAPS: Record<string, { name: string; url: string; attribution: string }> = {
  esri: {
    name: 'Esri Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  },
  ocean: {
    name: 'Ocean Bathymetry',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, GEBCO, NOAA, National Geographic',
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
};

function FitToData({ geojson }: { geojson: any }) {
  const map = useMap();
  useEffect(() => {
    if (!geojson?.features?.length) return;
    try {
      const layer = (window as any).L.geoJSON(geojson);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
    } catch {
      // non-fatal; map stays at default view
    }
  }, [geojson, map]);
  return null;
}

export default function GISMapPage() {
  const [params] = useSearchParams();
  const surveyId = params.get('surveyId');
  const [selectedSurveyId, setSelectedSurveyId] = useState(surveyId || '');
  const [basemapKey, setBasemapKey] = useState<string>('esri');

  const surveysQuery = useQuery({ queryKey: ['surveys-list'], queryFn: () => SurveysApi.list({ limit: 100 }) });

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

  return (
    <div className="h-screen w-full relative">
      {/* Control Panel */}
      <div className="absolute top-4 left-4 z-[1000] glass-panel rounded-lg p-3 w-72 text-sm shadow-xl border border-cyan-500/30">
        <div className="text-xs uppercase tracking-wide text-cyan-400 mb-2 font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          GIS Survey Map
        </div>
        <select
          value={selectedSurveyId}
          onChange={(e) => setSelectedSurveyId(e.target.value)}
          className="w-full bg-[#0b1a2e] border border-cyan-500/30 rounded px-2.5 py-1.5 text-xs text-slate-100 mb-2 focus:border-cyan-400 outline-none cursor-pointer"
        >
          <option value="" className="bg-[#0b1a2e] text-slate-400">All surveys (anomalies only)</option>
          {(surveysQuery.data?.data || []).map((s: any) => (
            <option key={s._id} value={s._id} className="bg-[#0b1a2e] text-slate-100">
              {s.code} - {s.name}
            </option>
          ))}
        </select>

        {/* Risk Legend */}
        <div className="flex gap-2 flex-wrap mt-1 mb-2">
          {Object.entries(RISK_COLOR).map(([level, color]) => (
            <div key={level} className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
              {level}
            </div>
          ))}
        </div>

        {/* Basemap Switcher */}
        <div className="mt-2 pt-2 border-t border-cyan-500/20">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">GIS Basemap</div>
          <div className="grid grid-cols-3 gap-1">
            {Object.entries(BASEMAPS).map(([key, bm]) => (
              <button
                key={key}
                onClick={() => setBasemapKey(key)}
                className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                  basemapKey === key
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-medium'
                    : 'bg-black/30 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {bm.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <MapContainer center={[15.48, 73.82]} zoom={6} className="h-full w-full" style={{ background: '#03101f' }}>
        <TileLayer
          key={basemapKey}
          attribution={BASEMAPS[basemapKey]?.attribution || ''}
          url={BASEMAPS[basemapKey]?.url || BASEMAPS.esri.url}
        />

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
                const marker = (window as any).L.circleMarker(latlng, {
                  radius: 7,
                  fillColor: color,
                  color: '#fff',
                  weight: 1,
                  fillOpacity: 0.9,
                });
                return marker;
              }}
              onEachFeature={(feature, layer) => {
                if (feature.properties?.kind === 'anomaly' || feature.properties?.anomalyCode) {
                  const p = feature.properties;
                  layer.bindPopup(
                    `<div style="font-family:sans-serif;font-size:12px;min-width:200px;color:#0f172a">
                      <div style="font-weight:700;color:#0e7490;font-size:13px;margin-bottom:4px">${p.anomalyCode}</div>
                      <div style="text-transform:capitalize;font-weight:600;margin-bottom:2px">${(p.class || '').replace(/_/g, ' ')}</div>
                      <div>Confidence: <b>${Math.round((p.confidence || 0) * 100)}%</b></div>
                      <div>Risk: <b style="color:${RISK_COLOR[p.riskLevel] || '#0e7490'}">${p.riskLevel}</b></div>
                      <div>Depth: <b>${p.depth ?? 'N/A'} m</b></div>
                      <div>Size: ${p.length ?? '?'}m × ${p.width ?? '?'}m</div>
                      <div>Status: ${(p.status || '').replace(/_/g, ' ')}</div>
                      <div>Location: ${p.locationStatus || 'N/A'}</div>
                    </div>`,
                  );
                }
              }}
            />
          </>
        )}
      </MapContainer>

      <div className="absolute bottom-4 left-4 z-[1000] glass-panel rounded-lg px-3 py-2 text-[11px] text-slate-400 max-w-sm border border-white/5">
        Live GIS Map &middot; Anomaly markers and survey tracks sourced directly from MongoDB via{' '}
        <span className="font-mono">/api/map</span>. No simulated or hardcoded coordinates.
      </div>
    </div>
  );
}
