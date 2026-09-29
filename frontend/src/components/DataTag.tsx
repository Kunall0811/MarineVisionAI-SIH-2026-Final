import clsx from 'clsx';

type Variant = 'live' | 'historical' | 'simulated' | 'estimated' | 'unavailable';

const LABELS: Record<Variant, string> = {
  live: 'LIVE',
  historical: 'HISTORICAL',
  simulated: 'SIMULATED DEMO DATA',
  estimated: 'ESTIMATED LOCATION',
  unavailable: 'LOCATION UNAVAILABLE',
};

export function DataTag({ variant, label }: { variant: Variant; label?: string }) {
  return <span className={clsx('data-tag', `data-tag-${variant}`)}>{label || LABELS[variant]}</span>;
}
