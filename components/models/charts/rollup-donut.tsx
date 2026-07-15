"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTheme } from "next-themes";
import { ChartContainer } from "./chart-container";
import { useDebouncedEditorSnapshot } from "./use-debounced-editor-snapshot";
import { useChartColors } from "./use-chart-colors";
import { buildTree } from "@/lib/model/tree";
import { formatCurrency } from "@/lib/format";
import { CHART_SURFACE } from "@/lib/chart-palette";
import type { CostNodeRow, Rollup } from "@/lib/model/types";
import type { Currency } from "@/components/number/currency-select";

export type Slice = { name: string; value: number };

/** Composition by top-level node (group or line), minor units, positive only.
 *  Folds roots beyond `max` into a single "Other" slice. */
export function donutData(nodes: CostNodeRow[], rollup: Rollup, max = 6): Slice[] {
  const tree = buildTree(nodes);
  const all = tree.roots
    .map((n) => ({ name: n.name, value: rollup.byNodeId[n.id] ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  if (all.length <= max) return all;
  const head = all.slice(0, max);
  const other = all.slice(max).reduce((s, d) => s + d.value, 0);
  return [...head, { name: "Other", value: other }];
}

export function RollupDonut({ currency = "USD" }: { currency?: Currency }) {
  const { nodes, rollup } = useDebouncedEditorSnapshot();
  const { categorical } = useChartColors();
  const { resolvedTheme } = useTheme();
  const surface = resolvedTheme === "dark" ? CHART_SURFACE.dark : CHART_SURFACE.light;
  const data = useMemo(() => donutData(nodes, rollup), [nodes, rollup]);
  const total = rollup.total || 1;
  const color = (i: number) => categorical[i % categorical.length];

  return (
    <ChartContainer
      title="Cost composition"
      data={data}
      emptyMessage="Add rate-carrying line items (or fill in rates) to see cost composition."
    >
      <div className="flex items-center gap-4">
        <div
          className="h-40 w-40 shrink-0"
          role="img"
          aria-label={`Cost composition donut chart, total ${formatCurrency(rollup.total, currency)}`}
        >
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                stroke={surface}
                strokeWidth={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={color(i)} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [formatCurrency(Number(value), currency), String(name)]}
                contentStyle={{ borderRadius: 6, border: "1px solid #e1e0d9", fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1 text-xs">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm" style={{ background: color(i) }} />
              <span>{d.name}</span>
              <span className="num text-muted-foreground">
                {formatCurrency(d.value, currency)} · {Math.round((d.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartContainer>
  );
}
