import { formatIndexValue } from "@/lib/format";

export type SeriesPoint = { date: string; value: number };

export function sparklineStats(series: SeriesPoint[]): {
  first: number;
  last: number;
  deltaPct: number;
} {
  const first = series[0]?.value ?? 0;
  const last = series.at(-1)?.value ?? 0;
  return { first, last, deltaPct: first ? ((last - first) / first) * 100 : 0 };
}

/**
 * A plain SVG polyline path for the series, inset by the stroke so peaks aren't
 * clipped. Hand-rolled instead of Recharts: the indices page renders one per
 * card, and a 24-point line doesn't need a chart library.
 */
export function sparklinePath(series: SeriesPoint[], w: number, h: number, pad = 1.5): string {
  if (series.length === 0) return "";
  const vals = series.map((p) => p.value);
  const min = Math.min(...vals);
  const span = Math.max(...vals) - min || 1;
  const step = series.length > 1 ? (w - 2 * pad) / (series.length - 1) : 0;
  return vals
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - ((v - min) / span) * (h - 2 * pad);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function IndexSparkline({ series, unit }: { series: SeriesPoint[]; unit: string }) {
  const { last, deltaPct } = sparklineStats(series);
  const up = deltaPct >= 0;
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 96 32" className="h-8 w-24 shrink-0 text-primary" aria-hidden>
        <path
          d={sparklinePath(series, 96, 32)}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <span className="num text-xs">{formatIndexValue(last, unit)}</span>
      <span className={`num text-[10px] ${up ? "text-favor" : "text-amber"}`}>
        {up ? "+" : ""}
        {deltaPct.toFixed(1)}%
      </span>
    </div>
  );
}
