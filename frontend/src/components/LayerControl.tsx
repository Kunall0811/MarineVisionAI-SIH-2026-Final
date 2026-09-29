interface LayerState {
  waterBodies: boolean;
  liveSurveys: boolean;
  historicalSurveys: boolean;
  anomalies: boolean;
  ghostNets: boolean;
  containers: boolean;
  pipes: boolean;
  shipwrecks: boolean;
  highRiskOnly: boolean;
}

export function LayerControl({
  layers,
  onChange,
  searchValue,
  onSearchChange,
  onSearchSubmit,
}: {
  layers: LayerState;
  onChange: (key: keyof LayerState, value: boolean) => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
}) {
  const items: { key: keyof LayerState; label: string }[] = [
    { key: 'waterBodies', label: 'Water Bodies' },
    { key: 'liveSurveys', label: 'Live Surveys' },
    { key: 'historicalSurveys', label: 'Historical Surveys' },
    { key: 'anomalies', label: 'All Anomalies' },
    { key: 'ghostNets', label: 'Ghost Nets' },
    { key: 'containers', label: 'Containers' },
    { key: 'pipes', label: 'Pipes' },
    { key: 'shipwrecks', label: 'Shipwrecks' },
    { key: 'highRiskOnly', label: 'High-Risk Only' },
  ];

  return (
    <div className="glass-panel rounded-lg p-3 w-60 text-sm">
      <div className="text-xs uppercase tracking-wide text-cyan-400 mb-2 font-semibold">
        Global Marine Intelligence
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit();
        }}
        className="mb-3"
      >
        <input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search location..."
          className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-cyan-500/50"
        />
      </form>
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Layers</div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={layers[item.key]}
              onChange={(e) => onChange(item.key, e.target.checked)}
              className="accent-cyan-500"
            />
            {item.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export type { LayerState };
