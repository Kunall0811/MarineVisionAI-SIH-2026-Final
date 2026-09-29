/**
 * Rule-based risk classification. Factors used (per spec section 36):
 * confidence, object class, size, depth, verification status.
 * Proximity-to-protected-area scoring is intentionally omitted until a real
 * licensed marine-protected-area boundary dataset is wired in - the spec
 * explicitly forbids inventing environmental risk claims.
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskInput {
  finalConfidence: number; // 0..1
  objectClass: string;
  lengthMetres: number | null;
  depth: number | null;
  status: string;
}

const HIGH_RISK_CLASSES = new Set(['ghost_net', 'fishing_gear']);
const STRUCTURAL_CLASSES = new Set(['shipwreck', 'pipe', 'cylinder']);

export function classifyRisk(input: RiskInput): RiskLevel {
  let score = 0;

  score += input.finalConfidence * 40;

  if (HIGH_RISK_CLASSES.has(input.objectClass)) score += 25;
  else if (STRUCTURAL_CLASSES.has(input.objectClass)) score += 15;
  else if (input.objectClass === 'container' || input.objectClass === 'marine_debris') score += 10;

  if (input.lengthMetres !== null) {
    if (input.lengthMetres > 15) score += 15;
    else if (input.lengthMetres > 5) score += 8;
  }

  if (input.depth !== null && input.depth < 30) score += 10; // shallower = higher navigational/ecological risk

  if (input.status === 'VERIFIED') score += 10;
  if (input.status === 'REJECTED') score = 0;

  if (score >= 75) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}
