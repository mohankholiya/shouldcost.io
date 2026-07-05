"use client";

import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer } from "recharts";
import { ChartContainer } from "@/components/models/charts/chart-container";
import { waterfallData } from "@/lib/model/waterfall";
import { formatCurrency } from "@/lib/format";
import { PETROL_600, WATERFALL_FILL } from "@/lib/chart-palette";
import type { Comparison } from "@/lib/model/comparison";
import type { Currency } from "@/components/number/currency-select";

export function GapWaterfall({
  comparison,
  currency,
}: {
  comparison: Comparison;
  currency: Currency;
}) {
  const bars = waterfallData(comparison);
  // Floating-bar encoding: `offset` (transparent) lifts each bar to its start; `span` is the visible magnitude.
  const data = bars.map((b) => {
    const start = b.kind === "base" || b.kind === "total" ? 0 : b.cumulative - b.delta;
    const end = b.cumulative;
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    return { label: b.label, offset: low, span: high - low, kind: b.kind, value: b.delta / 100 };
  });

  return (
    <ChartContainer title="Gap waterfall" data={data}>
      <div className="h-40 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={48}
            />
            <YAxis hide />
            <Bar dataKey="offset" stackId="w" fill="transparent" />
            <Bar dataKey="span" stackId="w" radius={2}>
              {data.map((d, i) => (
                <Cell key={i} fill={WATERFALL_FILL[d.kind] ?? PETROL_600} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-0.5 text-xs">
        {bars.map((b) => (
          <li key={b.label} className="flex justify-between">
            <span>{b.label}</span>
            <span className="num text-muted-foreground">{formatCurrency(b.delta, currency)}</span>
          </li>
        ))}
      </ul>
    </ChartContainer>
  );
}
