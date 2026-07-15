"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { ChartContainer } from "./chart-container";
import { useDebouncedEditorSnapshot } from "./use-debounced-editor-snapshot";
import { useChartColors } from "./use-chart-colors";
import { tornado } from "@/lib/model/sensitivity";
import { buildTree } from "@/lib/model/tree";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/components/number/currency-select";

export function TornadoChart({ currency = "USD" }: { currency?: Currency }) {
  const [pct, setPct] = useState(10);
  const { nodes, rollup } = useDebouncedEditorSnapshot();
  const { diverging } = useChartColors();
  const baseline = rollup.total;

  const bars = useMemo(() => tornado(buildTree(nodes), pct).slice(0, 8), [nodes, pct]);

  // One row per driver: low (left of baseline) and high (right of baseline), minor units.
  const data = useMemo(
    () =>
      bars.map((b) => ({
        name: b.name,
        low: b.low - baseline, // negative => bar extends left
        high: b.high - baseline, // positive => bar extends right
        baseline,
        swing: b.swing,
      })),
    [bars, baseline],
  );

  return (
    <ChartContainer
      title="Driver sensitivity"
      data={data}
      emptyMessage="Add rate-carrying line items (no formula) to see driver sensitivity."
    >
      <div className="mb-2 flex items-center gap-2 text-xs">
        <label htmlFor="tornado-pct" className="text-muted-foreground">
          Perturbation ±
        </label>
        <input
          id="tornado-pct"
          type="number"
          value={pct}
          onChange={(e) => setPct(Number(e.target.value) || 10)}
          className="w-14 rounded-sm border border-hairline px-1"
        />
        % <span className="text-muted-foreground">· baseline {formatCurrency(baseline, currency)}</span>
      </div>
      <div
        className="h-48 w-full"
        role="img"
        aria-label="Driver sensitivity tornado chart, diverging from the baseline total"
      >
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis
              type="number"
              tickFormatter={(v) => formatCurrency(baseline + Number(v), currency)}
              tick={{ fontSize: 10 }}
              stroke="#898781"
            />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} stroke="#898781" />
            <ReferenceLine x={0} stroke="#898781" strokeWidth={1} />
            <Tooltip
              formatter={(value) => {
                const delta = Number(value);
                const total = baseline + delta;
                const sign = delta >= 0 ? "+" : "−";
                return `${sign}${formatCurrency(Math.abs(delta), currency)} → ${formatCurrency(total, currency)}`;
              }}
              contentStyle={{ borderRadius: 6, border: "1px solid #e1e0d9", fontSize: 12 }}
            />
            <Bar dataKey="low" fill={diverging.down} radius={2} />
            <Bar dataKey="high" fill={diverging.up} radius={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-1 space-y-0.5 text-xs">
        {bars.map((b) => (
          <li key={b.nodeId} className="flex justify-between tabular-nums">
            <span>{b.name}</span>
            <span className="num text-muted-foreground">
              <span style={{ color: diverging.down }}>
                −{formatCurrency(baseline - b.low, currency)}
              </span>
              {" / "}
              <span style={{ color: diverging.up }}>
                +{formatCurrency(b.high - baseline, currency)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </ChartContainer>
  );
}
