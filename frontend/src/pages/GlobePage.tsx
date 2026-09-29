import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Viewer, Entity, PolylineGraphics, PolygonGraphics, PointGraphics, CustomDataSource, LabelGraphics } from 'resium';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GlobeApi, AnomaliesApi } from '../api/services';
import { LayerControl, type LayerState } from '../components/LayerControl';
import { AnomalyPanel } from '../components/AnomalyPanel';
import { HistoricalReferencePanel } from '../components/HistoricalReferencePanel';
import { TargetsCatalogPanel, CANONICAL_TARGETS } from '../components/TargetsCatalogPanel';
import type { HistoricalReference } from '../types';
import { useAuthStore } from '../store/auth.store';
import { useRealtimeStore } from '../store/realtime.store';

const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
if (ionToken) {
  Cesium.Ion.defaultAccessToken = ionToken;
}

const TYPE_COLOR: Record<string, Cesium.Color> = {
  ghost_net: Cesium.Color.RED,
  fishing_gear: Cesium.Color.fromCssColorString('#f87171'),
  marine_debris: Cesium.Color.ORANGE,
  pipe: Cesium.Color.YELLOW,
  container: Cesium.Color.BLUE,
  shipwreck: Cesium.Color.PURPLE,
  rock: Cesium.Color.fromCssColorString('#a3e635'),
  cylinder: Cesium.Color.CYAN,
  artificial_structure: Cesium.Color.TEAL,
  unknown_anomaly: Cesium.Color.LIGHTGRAY,
};

const HISTORICAL_TYPE_COLOR: Record<string, Cesium.Color> = {
  SHIPWRECK: Cesium.Color.fromCssColorString('#a78bfa'),
  CONTAINER: Cesium.Color.fromCssColorString('#38bdf8'),
  MARINE_DEBRIS: Cesium.Color.fromCssColorString('#fb923c'),
  FISHING_GEAR: Cesium.Color.fromCssColorString('#f43f5e'),
  OTHER: Cesium.Color.LIGHTGRAY,
};

const RISK_COLOR: Record<string, Cesium.Color> = {
  LOW: Cesium.Color.GREENYELLOW,
  MEDIUM: Cesium.Color.ORANGE,
  HIGH: Cesium.Color.RED,
  CRITICAL: Cesium.Color.RED,
};

function polygonHierarchyFromGeoJson(geometry: any): Cesium.PolygonHierarchy | null {
  try {
    if (!geometry || !geometry.coordinates || !geometry.coordinates.length) return null;
    const rings = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((p: any) => p[0]);
    const ring = rings[0];
    if (!ring || !ring.length) return null;
    const flat = ring.flat();
    return new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(flat));
  } catch {
    return null;
  }
}

export default function GlobePage() {
  const user = useAuthStore((s) => s.user);
  const viewerRef = useRef<any>(null);
  const queryClient = useQueryClient();
  const { on, off } = useRealtimeStore();

  const [layers, setLayers] = useState<LayerState & { simulatedData: boolean }>({
    waterBodies: true,
    liveSurveys: true,
    historicalSurveys: true,
    anomalies: true,
    ghostNets: true,
    containers: true,
    pipes: true,
    shipwrecks: true,
    highRiskOnly: false,
    simulatedData: true,
  });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [historicalType, setHistoricalType] = useState<string>('');
  const [historicalWindow, setHistoricalWindow] = useState<'5Y' | 'ALL'>('5Y');
  const [selectedHistorical, setSelectedHistorical] = useState<HistoricalReference | null>(null);
  const [rightTab, setRightTab] = useState<'TARGETS' | 'HISTORICAL'>('TARGETS');

  const [searchParams] = useSearchParams();
  const queryLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const queryLon = searchParams.get('lon') ? parseFloat(searchParams.get('lon')!) : null;
  const queryAnomalyId = searchParams.get('anomalyId') || searchParams.get('id');

  const surveysQuery = useQuery({ queryKey: ['globe-surveys'], queryFn: GlobeApi.surveys, refetchInterval: 60000 });
  const anomaliesQuery = useQuery({ queryKey: ['anomalies-list'], queryFn: () => AnomaliesApi.list({ limit: 2000 }) });
  const waterBodiesQuery = useQuery({ queryKey: ['globe-water-bodies'], queryFn: () => GlobeApi.waterBodies() });
  const historicalQuery = useQuery({
    queryKey: ['globe-historical-reference', historicalType],
    queryFn: () => GlobeApi.historicalReference(historicalType ? { type: historicalType } : undefined),
    refetchInterval: 60000,
  });

  const historicalRecords: HistoricalReference[] = useMemo(() => {
    const list = historicalQuery.data?.data || [];
    return list.filter((r: any) => {
      if (typeof r.longitude !== 'number' || typeof r.latitude !== 'number' || isNaN(r.longitude) || isNaN(r.latitude)) {
        return false;
      }
      if (historicalWindow === '5Y' && r.eventYear && r.eventYear < 2021 && r.sourceId !== 'NOAA-TITANIC-2004-EXPEDITION') {
        return false;
      }
      return true;
    });
  }, [historicalQuery.data, historicalWindow]);

  const rawAnomalies = useMemo(() => {
    const list = anomaliesQuery.data?.data || [];
    return list.filter(
      (a: any) => typeof a.longitude === 'number' && typeof a.latitude === 'number' && !isNaN(a.longitude) && !isNaN(a.latitude),
    );
  }, [anomaliesQuery.data]);

  const imageryViewModels = useMemo(() => {
    const models: Cesium.ProviderViewModel[] = [];

    // 1. Esri World Satellite (High-Res Ocean & Coastal)
    models.push(new Cesium.ProviderViewModel({
      name: 'Esri World Satellite',
      iconUrl: Cesium.buildModuleUrl('Widgets/Images/ImageryProviders/ArcGisMapServiceWorldImagery.png'),
      tooltip: 'High-resolution global satellite photography and coastal bathymetric coverage (Esri)',
      category: 'Marine Satellite',
      creationFunction: () => new Cesium.UrlTemplateImageryProvider({
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        credit: '© Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      }),
    }));

    // 2. OpenStreetMap Global
    models.push(new Cesium.ProviderViewModel({
      name: 'OpenStreetMap Global',
      iconUrl: Cesium.buildModuleUrl('Widgets/Images/ImageryProviders/openStreetMap.png'),
      tooltip: 'Standard maritime coastlines and global marine navigation reference',
      category: 'Navigation Charts',
      creationFunction: () => new Cesium.UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        credit: '© OpenStreetMap contributors',
      }),
    }));

    // 3. NOAA / GEBCO World Ocean Bathymetry
    models.push(new Cesium.ProviderViewModel({
      name: 'World Ocean Bathymetry',
      iconUrl: Cesium.buildModuleUrl('Widgets/Images/ImageryProviders/naturalEarthII.png'),
      tooltip: 'Global seafloor bathymetry, ocean trenches, and continental shelf relief (NOAA / GEBCO)',
      category: 'Bathymetry',
      creationFunction: () => new Cesium.UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
        credit: '© Esri, GEBCO, NOAA, National Geographic, DeLorme, HERE, Geonames.org',
      }),
    }));

    // 4. Esri World Ocean Reference (Labels + Navigation Overlay)
    models.push(new Cesium.ProviderViewModel({
      name: 'Esri Ocean Reference',
      iconUrl: Cesium.buildModuleUrl('Widgets/Images/ImageryProviders/ArcGisMapServiceWorldOcean.png'),
      tooltip: 'Detailed ocean navigation reference with labels, contours and marine features (Esri)',
      category: 'Navigation Charts',
      creationFunction: () => new Cesium.UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',
        credit: '© Esri, GEBCO, NOAA, National Geographic',
      }),
    }));

    // 5. Esri World Topo Map
    models.push(new Cesium.ProviderViewModel({
      name: 'World Topographic',
      iconUrl: Cesium.buildModuleUrl('Widgets/Images/ImageryProviders/ArcGisMapServiceWorldHillshade.png'),
      tooltip: 'Topographic map with terrain shading and coastal detail (Esri)',
      category: 'Terrain',
      creationFunction: () => new Cesium.UrlTemplateImageryProvider({
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        credit: '© Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS',
      }),
    }));

    return models;
  }, []);

  // ─── Disable Globe Lighting (Crisp, fully illuminated daylight view at all angles) ───
  useEffect(() => {
    const timer = setTimeout(() => {
      const viewer = viewerRef.current?.cesiumElement;
      if (!viewer || viewer.isDestroyed?.()) return;

      const scene = viewer.scene;
      const globe = scene.globe;

      globe.enableLighting = false;
      globe.showGroundAtmosphere = false;
      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.show = false;
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleNewAnomaly = (newAnomaly: any) => {
      queryClient.setQueryData(['anomalies-list'], (old: any) => {
        if (!old) return old;
        const exists = (old.data || []).find((a: any) => a.id === newAnomaly.id);
        if (exists) return old;
        return { ...old, data: [newAnomaly, ...(old.data || [])] };
      });
    };

    const handleUpdatedAnomaly = (updatedAnomaly: any) => {
      queryClient.setQueryData(['anomalies-list'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: (old.data || []).map((a: any) => (a.id === updatedAnomaly.id ? updatedAnomaly : a)),
        };
      });
    };

    const handleGlobeRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['anomalies-list'] });
      queryClient.invalidateQueries({ queryKey: ['globe-surveys'] });
      queryClient.invalidateQueries({ queryKey: ['globe-historical-reference'] });
    };

    const handleCoordinateUpdated = (data: any) => {
      const updatedAnomaly = data.anomaly || data;
      handleUpdatedAnomaly(updatedAnomaly);
      setSelected((prev: any) => (prev && (prev.id === updatedAnomaly.id || prev.anomalyId === updatedAnomaly.anomalyId) ? { ...prev, ...updatedAnomaly } : prev));
    };

    on('anomaly_created', handleNewAnomaly);
    on('anomaly_updated', handleUpdatedAnomaly);
    on('coordinate_updated', handleCoordinateUpdated);
    on('anomaly_verified', handleUpdatedAnomaly);
    on('anomaly_rejected', handleUpdatedAnomaly);
    on('globe_refresh', handleGlobeRefresh);

    return () => {
      off('anomaly_created', handleNewAnomaly);
      off('anomaly_updated', handleUpdatedAnomaly);
      off('coordinate_updated', handleCoordinateUpdated);
      off('anomaly_verified', handleUpdatedAnomaly);
      off('anomaly_rejected', handleUpdatedAnomaly);
      off('globe_refresh', handleGlobeRefresh);
    };
  }, [on, off, queryClient]);

  const visibleAnomalies = useMemo(() => {
    return rawAnomalies.filter((a: any) => {
      if (layers.highRiskOnly && !['HIGH', 'CRITICAL'].includes(a.riskLevel)) return false;
      if (a.type === 'ghost_net' && !layers.ghostNets) return false;
      if (a.type === 'container' && !layers.containers) return false;
      if (a.type === 'pipe' && !layers.pipes) return false;
      if (a.type === 'shipwreck' && !layers.shipwrecks) return false;
      if (a.sourceType === 'historical' && !layers.historicalSurveys) return false;
      if (a.sourceType === 'live' && !layers.liveSurveys) return false;
      if (a.sourceType === 'simulated' && !layers.simulatedData) return false;
      return layers.anomalies;
    });
  }, [rawAnomalies, layers]);

  const flyTo = (lon: number, lat: number, height = 250000, pitch = -90) => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || viewer.isDestroyed?.()) return;
    try {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(pitch),
          roll: 0.0,
        },
        duration: 1.5,
      });
    } catch (e) {
      console.error('Camera flyTo error:', e);
    }
  };

  const handleAnomalyClick = (anomaly: any) => {
    setSelected(anomaly);
    setSelectedHistorical(null);
    flyTo(anomaly.longitude, anomaly.latitude, 22000, -50);
  };

  // Auto-Fly & Inspect Exact Point when opened from AI Quick Test or with lat/lon parameters
  useEffect(() => {
    if (queryLat == null || queryLon == null || isNaN(queryLat) || isNaN(queryLon)) return;

    const timer = setTimeout(() => {
      flyTo(queryLon, queryLat, 18000, -50);

      // Locate in rawAnomalies or build target
      const match = rawAnomalies.find((a: any) => {
        if (queryAnomalyId && (a.anomalyId === queryAnomalyId || a.id === queryAnomalyId)) return true;
        return Math.abs(a.latitude - queryLat) < 0.005 && Math.abs(a.longitude - queryLon) < 0.005;
      });

      if (match) {
        setSelected(match);
        if (match.anomalyId?.startsWith('ANOM-')) {
          setRightTab('TARGETS');
        }
      } else {
        setSelected({
          id: queryAnomalyId || `live-anom-${Date.now()}`,
          anomalyId: queryAnomalyId || 'AI-TARGET',
          targetName: searchParams.get('name') || `${(searchParams.get('class') || 'Sonar Anomaly').replace(/_/g, ' ')}`,
          detailedType: searchParams.get('detailedType') || `${(searchParams.get('class') || 'Sonar Target').replace(/_/g, ' ')} Structure`,
          type: searchParams.get('class') || 'unknown_anomaly',
          latitude: queryLat,
          longitude: queryLon,
          depth: parseFloat(searchParams.get('depth') || '25.0'),
          depthFt: searchParams.get('depthFt') || `${Math.round(parseFloat(searchParams.get('depth') || '25.0') * 3.28)} ft`,
          confidence: parseFloat(searchParams.get('confidence') || '0.92'),
          riskLevel: 'HIGH',
          status: 'needs_verification',
          sourceType: 'live',
          coordinateSource: 'AI_MODEL_TEST_GEOTAG',
          sonarEvidence: 'Side-scan sonar swath anomaly detection',
        });
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [queryLat, queryLon, queryAnomalyId, rawAnomalies]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=1`);
      const results = await res.json();
      if (results?.[0]) flyTo(parseFloat(results[0].lon), parseFloat(results[0].lat), 500000);
    } catch {}
  };

  const refreshEvidence = () => {
    queryClient.invalidateQueries({ queryKey: ['globe-historical-reference'] });
    queryClient.invalidateQueries({ queryKey: ['globe-surveys'] });
    queryClient.invalidateQueries({ queryKey: ['anomalies-list'] });
  };

  // Safe mouse coordinate tracking
  useEffect(() => {
    const timer = setTimeout(() => {
      const viewer = viewerRef.current?.cesiumElement;
      if (!viewer || viewer.isDestroyed?.()) return;
      let handler: Cesium.ScreenSpaceEventHandler | null = null;
      try {
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((movement: any) => {
          if (!viewer || viewer.isDestroyed?.()) return;
          try {
            const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
            if (cartesian) {
              const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
              setCursorCoords({
                lat: Cesium.Math.toDegrees(cartographic.latitude),
                lon: Cesium.Math.toDegrees(cartographic.longitude),
              });
            }
          } catch {}
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      } catch {}

      return () => {
        try {
          if (handler && !handler.isDestroyed()) {
            handler.destroy();
          }
        } catch {}
      };
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const clusterConfig = useMemo(() => {
    const cluster = new Cesium.EntityCluster();
    cluster.enabled = true;
    cluster.pixelRange = 30;
    cluster.minimumClusterSize = 3;
    return cluster;
  }, []);

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-1px)] bg-slate-950 overflow-hidden">
      <Viewer
        ref={viewerRef}
        full
        timeline={false}
        animation={false}
        geocoder={false}
        baseLayerPicker={true}
        imageryProviderViewModels={imageryViewModels}
        selectedImageryProviderViewModel={imageryViewModels[0]}
        sceneModePicker={true}
        navigationHelpButton={false}
        infoBox={false}
        selectionIndicator={false}
      >
        {layers.waterBodies &&
          (waterBodiesQuery.data?.features || []).map((f: any, i: number) => {
            const hierarchy = polygonHierarchyFromGeoJson(f.geometry);
            if (!hierarchy) return null;
            return (
              <Entity key={`wb-${i}`} name={f.properties?.name || `Water Body ${i + 1}`}>
                <PolygonGraphics
                  hierarchy={hierarchy}
                  material={Cesium.Color.fromCssColorString('#0ea5e9').withAlpha(0.08)}
                  outline
                  outlineColor={Cesium.Color.fromCssColorString('#22d3ee').withAlpha(0.4)}
                />
              </Entity>
            );
          })}

        {(surveysQuery.data || []).map((s: any) => {
          const coords: [number, number][] = s.route?.coordinates || [];
          if (coords.length < 2) return null;
          if (s.dataType === 'HISTORICAL' && !layers.historicalSurveys) return null;
          if (s.dataType === 'LIVE' && !layers.liveSurveys) return null;
          return (
            <Entity key={s.id} name={s.name}>
              <PolylineGraphics
                positions={Cesium.Cartesian3.fromDegreesArray(coords.flat())}
                width={2}
                material={
                  s.dataType === 'HISTORICAL'
                    ? Cesium.Color.fromCssColorString('#facc15').withAlpha(0.7)
                    : Cesium.Color.fromCssColorString('#22d3ee').withAlpha(0.9)
                }
              />
            </Entity>
          );
        })}

        <CustomDataSource name="Anomalies" clustering={clusterConfig}>
          {visibleAnomalies.map((a: any) => {
            const isUserTarget = Boolean(a.targetName && a.targetName !== a.anomalyId);
            const labelText = isUserTarget
              ? `${a.anomalyId} · ${a.targetName} [${a.depthFt || (a.depth ? a.depth + 'm' : '')}]`
              : a.sourceType === 'simulated'
              ? `${a.anomalyId || 'ANOM'}: SIMULATED`
              : `${a.anomalyId || 'HIST'} · ${a.name || a.type}`;

            const isHighRisk = a.riskLevel === 'HIGH' || a.riskLevel === 'CRITICAL';
            const isCritical = a.riskLevel === 'CRITICAL';
            const fillColor = isUserTarget
              ? Cesium.Color.fromCssColorString('#06b6d4')
              : TYPE_COLOR[a.type] || TYPE_COLOR.unknown_anomaly;
            const outlineColor = isCritical
              ? Cesium.Color.RED
              : isHighRisk
              ? Cesium.Color.ORANGE
              : Cesium.Color.WHITE;

            return (
              <Entity
                key={a.id || a.anomalyId}
                position={Cesium.Cartesian3.fromDegrees(a.longitude, a.latitude)}
                onClick={() => handleAnomalyClick(a)}
                name={`${a.anomalyId || 'Anomaly'} - ${a.targetName || a.name || a.type}`}
              >
                <PointGraphics
                  pixelSize={isUserTarget ? 15 : isHighRisk ? 13 : 10}
                  color={fillColor}
                  outlineColor={outlineColor}
                  outlineWidth={isUserTarget ? 3 : isHighRisk ? 3 : 1.5}
                />
                <LabelGraphics
                  text={labelText}
                  font="bold 11px Inter, sans-serif"
                  fillColor={isUserTarget ? Cesium.Color.fromCssColorString('#67e8f9') : Cesium.Color.WHITE}
                  style={Cesium.LabelStyle.FILL_AND_OUTLINE}
                  outlineColor={Cesium.Color.BLACK}
                  outlineWidth={3}
                  verticalOrigin={Cesium.VerticalOrigin.BOTTOM}
                  pixelOffset={new Cesium.Cartesian2(0, -18)}
                  distanceDisplayCondition={new Cesium.DistanceDisplayCondition(0.0, 15000000.0)}
                />
              </Entity>
            );
          })}
        </CustomDataSource>

        {historicalRecords.map((r) => {
          const typeStr = (r.type || 'OTHER').replace(/_/g, ' ');
          return (
            <Entity
              key={`hist-${r.sourceId}`}
              position={Cesium.Cartesian3.fromDegrees(r.longitude, r.latitude)}
              onClick={() => {
                setSelectedHistorical(r);
                flyTo(r.longitude, r.latitude, r.type === 'SHIPWRECK' ? 25000 : 50000);
              }}
            >
              <PointGraphics
                pixelSize={r.type === 'SHIPWRECK' ? 14 : r.type === 'FISHING_GEAR' ? 13 : 11}
                color={HISTORICAL_TYPE_COLOR[r.type] || HISTORICAL_TYPE_COLOR.OTHER}
                outlineColor={Cesium.Color.WHITE}
                outlineWidth={2}
              />
              <LabelGraphics
                text={`${typeStr} · ${r.eventYear || ''}`}
                font="10px sans-serif"
                fillColor={HISTORICAL_TYPE_COLOR[r.type] || Cesium.Color.WHITE}
                style={Cesium.LabelStyle.FILL_AND_OUTLINE}
                outlineWidth={2}
                verticalOrigin={Cesium.VerticalOrigin.BOTTOM}
                pixelOffset={new Cesium.Cartesian2(0, -16)}
              />
            </Entity>
          );
        })}

        {/* Focused Target Reticle for exact point navigation */}
        {queryLat != null && queryLon != null && (
          <Entity
            position={Cesium.Cartesian3.fromDegrees(queryLon, queryLat)}
            name="Exact Anomaly Position"
          >
            <PointGraphics
              pixelSize={20}
              color={Cesium.Color.fromCssColorString('#06b6d4')}
              outlineColor={Cesium.Color.YELLOW}
              outlineWidth={3}
            />
            <LabelGraphics
              text={`🎯 TARGET: ${queryAnomalyId || 'SELECTED ANOMALY'} [${queryLat.toFixed(5)}°, ${queryLon.toFixed(5)}°]`}
              font="bold 12px Inter, sans-serif"
              fillColor={Cesium.Color.fromCssColorString('#facc15')}
              style={Cesium.LabelStyle.FILL_AND_OUTLINE}
              outlineColor={Cesium.Color.BLACK}
              outlineWidth={3}
              verticalOrigin={Cesium.VerticalOrigin.BOTTOM}
              pixelOffset={new Cesium.Cartesian2(0, -22)}
            />
          </Entity>
        )}
      </Viewer>

      {/* Top Center Real-Time Anomaly Analytics Dropdown Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-[620px] pointer-events-auto">
        <div className="glass-panel rounded-xl p-2 shadow-2xl backdrop-blur-md border border-cyan-500/30 bg-[#071322]/90 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 text-cyan-400 font-bold text-xs shrink-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>🎯 Anomaly Analytics:</span>
          </div>

          <select
            value={selected?.anomalyId || selected?.id || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                setSelected(null);
                return;
              }
              const found = rawAnomalies.find((a: any) => (a.anomalyId || a.id) === val);
              if (found) {
                handleAnomalyClick(found);
              }
            }}
            className="flex-1 bg-[#0b1a2e] border border-cyan-500/40 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400 cursor-pointer truncate"
          >
            <option value="" className="bg-[#0b1a2e] text-slate-400">
              🌐 All Anomalies on Globe ({rawAnomalies.length} Loaded Targets)
            </option>
            {rawAnomalies.map((a: any) => {
              const rawConf = a.confidence ?? a.finalConfidence ?? 0.85;
              const confPct = (rawConf <= 1 ? rawConf * 100 : rawConf).toFixed(1);
              const depthStr = a.depthFt || (a.depth ? `${a.depth}m` : '');
              return (
                <option key={a.anomalyId || a.id} value={a.anomalyId || a.id} className="bg-[#0b1a2e] text-slate-100">
                  {a.anomalyId} · {a.targetName || a.name || a.type} {depthStr ? `[${depthStr}]` : ''} · YOLO26x: {confPct}%
                </option>
              );
            })}
          </select>

          {selected && (
            <button
              onClick={() => setSelected(null)}
              className="px-2.5 py-1 text-[11px] font-semibold rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-colors shrink-0"
              title="Reset to All Anomalies"
            >
              All Anomalies
            </button>
          )}
        </div>
      </div>

      {/* Floating UI Controls */}
      <div className="absolute top-4 left-4 z-20 space-y-4 pointer-events-auto">
        <LayerControl
          layers={layers as any}
          onChange={(key, value) => setLayers((prev) => ({ ...prev, [key]: value }))}
          searchValue={search}
          onSearchChange={setSearch}
          onSearchSubmit={handleSearch}
        />
        <button
          onClick={refreshEvidence}
          className="w-full bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-bold py-2 px-4 rounded shadow-lg transition-colors border border-cyan-400/40 backdrop-blur-sm"
        >
          Refresh MongoDB Evidence
        </button>
      </div>

      <div className="absolute top-4 right-4 z-20 space-y-2 pointer-events-auto">
        {/* Navigation Tabs between 20 Verified Targets & NOAA Archive */}
        <div className="glass-panel rounded-xl p-1 w-[360px] shadow-xl backdrop-blur-md flex gap-1 border border-cyan-500/20 bg-slate-900/80">
          <button
            onClick={() => {
              setRightTab('TARGETS');
              setSelectedHistorical(null);
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              rightTab === 'TARGETS'
                ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>🎯 Sonar Targets (20)</span>
          </button>
          <button
            onClick={() => {
              setRightTab('HISTORICAL');
              setSelected(null);
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              rightTab === 'HISTORICAL'
                ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <span>📚 NOAA Archive</span>
          </button>
        </div>

        {rightTab === 'TARGETS' && (
          <TargetsCatalogPanel
            anomalies={rawAnomalies}
            onFlyTo={(t) => handleAnomalyClick(t)}
            selectedId={selected?.anomalyId || selected?.id}
            isAdmin={user?.role === 'ADMIN'}
          />
        )}

        {rightTab === 'HISTORICAL' && (
          <>
            <div className="glass-panel rounded-lg p-2 w-[360px] shadow-xl backdrop-blur-md">
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                Historical layer · MongoDB
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={() => setHistoricalWindow('5Y')}
                  className={`text-[10px] px-2 py-1 rounded transition-colors ${
                    historicalWindow === '5Y'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  2021–2025
                </button>
                <button
                  onClick={() => setHistoricalWindow('ALL')}
                  className={`text-[10px] px-2 py-1 rounded transition-colors ${
                    historicalWindow === 'ALL'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  All years
                </button>
              </div>
              <select
                value={historicalType}
                onChange={(e) => setHistoricalType(e.target.value)}
                className="w-full bg-[#0b1a2e] border border-cyan-500/30 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="" className="bg-[#0b1a2e] text-slate-300">All evidence types</option>
                <option value="SHIPWRECK" className="bg-[#0b1a2e] text-slate-100">Shipwrecks / wrecks</option>
                <option value="CONTAINER" className="bg-[#0b1a2e] text-slate-100">Lost containers</option>
                <option value="FISHING_GEAR" className="bg-[#0b1a2e] text-slate-100">Ghost nets / fishing gear</option>
                <option value="MARINE_DEBRIS" className="bg-[#0b1a2e] text-slate-100">Marine debris</option>
              </select>
              <div className="text-[9px] text-slate-400 mt-2">
                Titanic remains visible as a separate heritage reference even in the 5-year view.
              </div>
            </div>
            <HistoricalReferencePanel
              records={historicalRecords}
              onFlyTo={(r) => flyTo(r.longitude, r.latitude, r.type === 'SHIPWRECK' ? 25000 : 50000)}
            />
          </>
        )}
      </div>

      {selected && (
        <div className="absolute top-4 right-4 md:right-[384px] z-30 pointer-events-auto">
          <AnomalyPanel anomaly={selected} onClose={() => setSelected(null)} />
        </div>
      )}

      {selectedHistorical && !selected && (
        <div className="absolute top-4 right-4 z-30 glass-panel rounded-lg p-4 w-[360px] text-xs shadow-2xl backdrop-blur-md pointer-events-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="text-cyan-300 font-semibold">{selectedHistorical.name}</div>
            <button
              onClick={() => setSelectedHistorical(null)}
              className="text-slate-400 hover:text-white text-base leading-none"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-[10px]">
            <div className="bg-white/5 rounded p-2">
              LAT
              <br />
              <span className="text-slate-200">{selectedHistorical.latitude.toFixed(6)}</span>
            </div>
            <div className="bg-white/5 rounded p-2">
              LON
              <br />
              <span className="text-slate-200">{selectedHistorical.longitude.toFixed(6)}</span>
            </div>
            <div className="bg-white/5 rounded p-2">
              YEAR
              <br />
              <span className="text-slate-200">{selectedHistorical.eventYear}</span>
            </div>
            <div className="bg-white/5 rounded p-2">
              TYPE
              <br />
              <span className="text-slate-200">{selectedHistorical.type}</span>
            </div>
          </div>
          {selectedHistorical.quantity != null && (
            <div className="mt-2 text-slate-400">
              Reported quantity: <span className="text-slate-200">{selectedHistorical.quantity}</span>
            </div>
          )}
          <div className="mt-2 text-slate-500">Coordinate accuracy: {selectedHistorical.coordinateAccuracy}</div>
          <div className="mt-2 text-slate-400">{selectedHistorical.description}</div>
          <a
            href={selectedHistorical.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-3 text-cyan-400 hover:underline"
          >
            Open source evidence
          </a>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-20 glass-panel rounded-lg px-3 py-2 text-xs font-mono text-slate-300 pointer-events-auto backdrop-blur-sm">
        {cursorCoords
          ? `LAT: ${cursorCoords.lat.toFixed(6)}  LON: ${cursorCoords.lon.toFixed(6)}`
          : 'Move cursor over the globe to read coordinates'}
      </div>
    </div>
  );
}
