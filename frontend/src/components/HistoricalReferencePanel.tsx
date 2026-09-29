import type { HistoricalReference } from '../types';

const TYPE_LABELS: Record<string, string> = {
  SHIPWRECK: 'Shipwreck',
  CONTAINER: 'Lost Containers',
  MARINE_DEBRIS: 'Marine Debris',
  FISHING_GEAR: 'Fishing Gear',
  OTHER: 'Other',
};

export function HistoricalReferencePanel({
  records,
  onFlyTo,
}: {
  records: HistoricalReference[];
  onFlyTo: (record: HistoricalReference) => void;
}) {
  return (
    <div className="glass-panel rounded-lg p-3 w-[340px] max-h-[62vh] overflow-hidden text-xs">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs uppercase tracking-wide text-cyan-400 font-semibold">Historical Ocean Evidence</div>
        <span className="text-[10px] text-slate-500">{records.length} records</span>
      </div>
      <p className="text-[10px] text-slate-500 mb-2">
        Sourced reference points stored in MongoDB. They are not AI detections or current sonar observations.
      </p>
      <div className="overflow-y-auto max-h-[48vh] space-y-1.5 pr-1">
        {records.map((r) => (
          <button
            key={r.sourceId}
            onClick={() => onFlyTo(r)}
            className="w-full text-left rounded border border-white/10 bg-white/5 hover:bg-cyan-500/10 px-2 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-200 font-medium truncate">{r.name}</span>
              <span className="text-cyan-300 shrink-0">{r.eventYear}</span>
            </div>
            <div className="flex items-center justify-between mt-1 text-[10px]">
              <span className="text-slate-400">{TYPE_LABELS[r.type] || r.type}</span>
              <span className="font-mono text-slate-500">{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</span>
            </div>
            {r.quantity != null && <div className="text-[10px] text-slate-500 mt-1">Reported quantity: {r.quantity}</div>}
            <div className="text-[9px] text-slate-600 mt-1 truncate">{r.sourceOrganization} · {r.coordinateAccuracy}</div>
            <a
              href={r.sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[9px] text-cyan-500 hover:text-cyan-300 mt-0.5 inline-block"
            >
              Open source
            </a>
          </button>
        ))}
        {!records.length && <div className="text-slate-500 italic">No historical records match the current filter.</div>}
      </div>
    </div>
  );
}
