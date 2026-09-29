export interface NavigationRecord {
  image?: string;
  timestamp?: string;
  latitude: number;
  longitude: number;
  heading?: number;
  depth?: number;
  range?: number;
  side?: string;
  altitude?: number;
  heave?: number;
  pitch?: number;
  roll?: number;
}

/**
 * Parses an uploaded navigation.csv (spec section 17):
 *   image,timestamp,latitude,longitude,heading,depth[,range,side]
 * Returns a map keyed by image filename for direct matching, and a
 * time-sorted array for nearest-timestamp interpolation fallback.
 */
export function parseNavigationCsv(csvText: string): {
  byFileName: Map<string, NavigationRecord>;
  byTimestamp: NavigationRecord[];
} {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return { byFileName: new Map(), byTimestamp: [] };

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const byFileName = new Map<string, NavigationRecord>();
  const byTimestamp: NavigationRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < header.length) continue;

    const lat = parseFloat(cols[idx('latitude')]);
    const lon = parseFloat(cols[idx('longitude')]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

    const record: NavigationRecord = {
      image: idx('image') >= 0 ? cols[idx('image')].trim() : undefined,
      timestamp: idx('timestamp') >= 0 ? cols[idx('timestamp')].trim() : undefined,
      latitude: lat,
      longitude: lon,
      heading: idx('heading') >= 0 ? parseFloat(cols[idx('heading')]) : undefined,
      depth: idx('depth') >= 0 ? parseFloat(cols[idx('depth')]) : undefined,
      range: idx('range') >= 0 ? parseFloat(cols[idx('range')]) : undefined,
      side: idx('side') >= 0 ? cols[idx('side')].trim().toUpperCase() : undefined,
      altitude: idx('altitude') >= 0 ? parseFloat(cols[idx('altitude')]) : undefined,
      heave: idx('heave') >= 0 ? parseFloat(cols[idx('heave')]) : undefined,
      pitch: idx('pitch') >= 0 ? parseFloat(cols[idx('pitch')]) : undefined,
      roll: idx('roll') >= 0 ? parseFloat(cols[idx('roll')]) : undefined,
    };

    if (record.image) byFileName.set(record.image, record);
    if (record.timestamp) byTimestamp.push(record);
  }

  byTimestamp.sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());

  return { byFileName, byTimestamp };
}

/** Finds the navigation fix with the closest timestamp to the given frame timestamp. */
export function findNearestByTimestamp(
  records: NavigationRecord[],
  targetIso: string,
  maxDeltaMs = 5 * 60 * 1000,
): { record: NavigationRecord; isEstimated: boolean } | null {
  if (!records.length) return null;
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return null;

  let closest: NavigationRecord | null = null;
  let closestDelta = Infinity;
  for (const r of records) {
    const delta = Math.abs(new Date(r.timestamp!).getTime() - target);
    if (delta < closestDelta) {
      closestDelta = delta;
      closest = r;
    }
  }

  if (!closest || closestDelta > maxDeltaMs) return null;
  return { record: closest, isEstimated: closestDelta > 0 };
}
