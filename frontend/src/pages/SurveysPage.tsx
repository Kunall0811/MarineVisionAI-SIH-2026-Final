import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Waves } from 'lucide-react';
import { SurveysApi } from '../api/services';
import { apiErrorMessage } from '../api/client';
import { useAuthStore } from '../store/auth.store';

export default function SurveysPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const SEA_OPTIONS = [
    { name: 'Arabian Sea', region: 'India West Coast / Goa Shelf' },
    { name: 'Bay of Bengal', region: 'India East Coast / Visakhapatnam' },
    { name: 'Indian Ocean', region: 'Equatorial / Lakshadweep Sea' },
    { name: 'Stellwagen Bank National Marine Sanctuary', region: 'North Atlantic Ocean' },
    { name: 'South China Sea', region: 'Indo-Pacific Basin' },
    { name: 'Mediterranean Sea', region: 'Levantine / Aegean Sea' },
    { name: 'Coral Sea', region: 'Great Barrier Reef Shelf' },
    { name: 'Baltic Sea', region: 'Northern European Shelf' },
    { name: 'North Sea', region: 'UK / Dogger Bank' },
    { name: 'Red Sea', region: 'Bab-el-Mandeb / Sinai Shelf' },
    { name: 'Persian Gulf', region: 'Strait of Hormuz' },
    { name: 'Gulf of Mexico', region: 'Mississippi Canyon Shelf' },
    { name: 'Caribbean Sea', region: 'Antillean Trench' },
    { name: 'Andaman Sea', region: 'Andaman & Nicobar Ridge' },
    { name: 'Custom Water Body', region: 'Custom Survey Region' },
  ];

  const PRESETS = [
    {
      title: 'Goa Shelf (Arabian Sea)',
      waterBody: 'Arabian Sea',
      region: 'Goa, India',
      startLat: 15.498,
      startLon: 73.748,
      endLat: 15.525,
      endLon: 73.785,
      depth: 28,
    },
    {
      title: 'Vizag Coast (Bay of Bengal)',
      waterBody: 'Bay of Bengal',
      region: 'Visakhapatnam, India',
      startLat: 17.686,
      startLon: 83.218,
      endLat: 17.72,
      endLon: 83.26,
      depth: 42,
    },
    {
      title: 'Stellwagen Bank (N. Atlantic)',
      waterBody: 'Stellwagen Bank National Marine Sanctuary',
      region: 'North Atlantic',
      startLat: 42.18,
      startLon: -70.32,
      endLat: 42.24,
      endLon: -70.28,
      depth: 35,
    },
    {
      title: 'Coral Sea (Barrier Reef)',
      waterBody: 'Coral Sea',
      region: 'Great Barrier Reef, Australia',
      startLat: -16.85,
      startLon: 146.22,
      endLat: -16.89,
      endLon: 146.28,
      depth: 22,
    },
  ];

  const [form, setForm] = useState({
    code: '',
    name: '',
    waterBodyName: 'Arabian Sea',
    region: 'India West Coast / Goa Shelf',
    dataType: 'LIVE',
    historicalSource: '',
    startLat: 15.498,
    startLon: 73.748,
    endLat: 15.525,
    endLon: 73.785,
    depthMeters: 28,
  });

  const surveysQuery = useQuery({ queryKey: ['surveys-page'], queryFn: () => SurveysApi.list({ limit: 100 }) });

  const createMutation = useMutation({
    mutationFn: () => SurveysApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveys-page'] });
      setShowForm(false);
      setForm({
        code: '',
        name: '',
        waterBodyName: 'Arabian Sea',
        region: 'India West Coast / Goa Shelf',
        dataType: 'LIVE',
        historicalSource: '',
        startLat: 15.498,
        startLon: 73.748,
        endLat: 15.525,
        endLon: 73.785,
        depthMeters: 28,
      });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const applyPreset = (p: (typeof PRESETS)[0]) => {
    setForm((prev) => ({
      ...prev,
      waterBodyName: p.waterBody,
      region: p.region,
      startLat: p.startLat,
      startLon: p.startLon,
      endLat: p.endLat,
      endLon: p.endLon,
      depthMeters: p.depth,
      code: prev.code || `${p.waterBody.slice(0, 3).toUpperCase()}-${new Date().getFullYear()}-01`,
      name: prev.name || `${p.title} Side-Scan Track`,
    }));
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <Waves className="text-cyan-400" size={20} /> Survey Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Register live side-scan sonar hydrographic surveys, bathymetry transects, and coordinate routes.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 transition-colors rounded px-3 py-1.5 text-sm font-medium"
          >
            <Plus size={14} /> New Survey
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            createMutation.mutate();
          }}
          className="glass-panel rounded-xl p-5 border border-cyan-500/20 space-y-4 text-sm"
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="font-semibold text-cyan-300 text-xs uppercase tracking-wider">
              Register Manual Survey with Coordinates & Sea Name
            </span>
            <span className="text-[11px] text-slate-400">Creates GeoJSON Track for 3D Globe & Tactical GIS</span>
          </div>

          {/* Quick preset buttons */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1.5 font-medium">Quick Route Presets:</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="px-2.5 py-1 rounded text-xs bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/40 border border-white/10 text-slate-300 hover:text-cyan-300 transition-all"
                >
                  ⚡ {p.title}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="text-xs text-red-400 bg-red-500/10 rounded p-2.5">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400">Survey Code</label>
              <input
                required
                placeholder="GOA-2026-09"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full mt-1 bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">Survey Name</label>
              <input
                required
                placeholder="Goa Continental Shelf Bathymetric Scan"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full mt-1 bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-slate-100"
              />
            </div>

            {/* Sea Name Dropdown List */}
            <div>
              <label className="text-xs text-slate-400">Sea / Water Body Name (Dropdown)</label>
              <select
                value={form.waterBodyName}
                onChange={(e) => {
                  const val = e.target.value;
                  const found = SEA_OPTIONS.find((s) => s.name === val);
                  setForm({
                    ...form,
                    waterBodyName: val,
                    region: found?.region || form.region,
                  });
                }}
                className="w-full mt-1 bg-[#0b1a2e] border border-cyan-500/30 rounded px-2.5 py-1.5 text-slate-100 focus:border-cyan-400 outline-none cursor-pointer"
              >
                {SEA_OPTIONS.map((sea) => (
                  <option key={sea.name} value={sea.name} className="bg-[#0b1a2e] text-slate-100">
                    {sea.name} ({sea.region})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400">Region / Sector</label>
              <input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="India West Coast / Goa Shelf"
                className="w-full mt-1 bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">Data Type</label>
              <select
                value={form.dataType}
                onChange={(e) => setForm({ ...form, dataType: e.target.value })}
                className="w-full mt-1 bg-[#0b1a2e] border border-cyan-500/30 rounded px-2.5 py-1.5 text-slate-100 focus:border-cyan-400 outline-none cursor-pointer"
              >
                <option value="LIVE" className="bg-[#0b1a2e] text-slate-100">LIVE Hydrographic Scan</option>
                <option value="HISTORICAL" className="bg-[#0b1a2e] text-slate-100">HISTORICAL Survey Archive</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400">Target Survey Depth (Meters)</label>
              <input
                type="number"
                step="0.1"
                value={form.depthMeters}
                onChange={(e) => setForm({ ...form, depthMeters: parseFloat(e.target.value) || 0 })}
                className="w-full mt-1 bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-slate-100"
              />
            </div>

            {form.dataType === 'HISTORICAL' && (
              <div className="md:col-span-2">
                <label className="text-xs text-slate-400">Historical Source (required)</label>
                <input
                  required
                  value={form.historicalSource}
                  onChange={(e) => setForm({ ...form, historicalSource: e.target.value })}
                  placeholder="e.g. NIOT 2024 archive / NOAA Hydrographic Survey H12345"
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-slate-100"
                />
              </div>
            )}
          </div>

          {/* Manual Coordinate Route Section */}
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 space-y-2">
            <span className="text-xs font-semibold text-cyan-400">
              Navigation Coordinates (Start & End Waypoints for GeoJSON Route):
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-400">Start Latitude (°N)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={form.startLat}
                  onChange={(e) => setForm({ ...form, startLat: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400">Start Longitude (°E)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={form.startLon}
                  onChange={(e) => setForm({ ...form, startLon: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400">End Latitude (°N)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={form.endLat}
                  onChange={(e) => setForm({ ...form, endLat: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400">End Longitude (°E)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={form.endLon}
                  onChange={(e) => setForm({ ...form, endLon: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-slate-100 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 transition-colors rounded-lg px-5 py-2 text-sm font-semibold shadow-md"
            >
              {createMutation.isPending ? 'Registering Survey...' : 'Register Survey & Plot Track'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="glass-panel rounded-lg divide-y divide-white/5">
        {(surveysQuery.data?.data || []).map((survey: any) => (
          <Link
            key={survey._id}
            to={`/surveys/${survey._id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-sm"
          >
            <div>
              <div className="text-slate-200 font-medium">
                {survey.code} <span className="text-slate-500 font-normal">- {survey.name}</span>
              </div>
              <div className="text-xs text-slate-500">
                {survey.waterBodyName || 'Unassigned water body'} &middot; {survey.status}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {survey.processedFrames}/{survey.totalFrames} frames processed
              </span>
              <span className={`data-tag ${survey.dataType === 'HISTORICAL' ? 'data-tag-historical' : 'data-tag-live'}`}>
                {survey.dataType}
              </span>
            </div>
          </Link>
        ))}
        {!surveysQuery.data?.data?.length && (
          <div className="p-6 text-sm text-slate-500 italic text-center">
            No surveys found. {isAdmin ? 'Create one to get started.' : 'No surveys have been assigned to you yet.'}
          </div>
        )}
      </div>
    </div>
  );
}
