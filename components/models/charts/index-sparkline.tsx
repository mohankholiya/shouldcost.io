"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";
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

export function IndexSparkline({ series, unit }: { series: SeriesPoint[]; unit: string }) {
  const { last, deltaPct } = sparklineStats(series);
  const up = deltaPct >= 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-24 shrink-0">
        <ResponsiveContainer>
          <LineChart data={series}>
            <Line dataKey="value" stroke="#0b3c5d" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <span className="num text-xs">{formatIndexValue(last, unit)}</span>
      <span className={`num text-[10px] ${up ? "text-favor" : "text-amber"}`}>
        {up ? "+" : ""}
        {deltaPct.toFixed(1)}%
      </span>
    </div>
  );
}
