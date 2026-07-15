"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ChartContainer } from "./chart-container";
import { useDebouncedEditorSnapshot } from "./use-debounced-editor-snapshot";
import { buildTree } from "@/lib/model/tree";
import { formatCurrency } from "@/lib/format";
import { rampColor } from "@/lib/chart-palette";
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
  const data = useMemo(() => donutData(nodes, rollup), [nodes, rollup]);
  const total = rollup.total || 1;
  return (
    <ChartContainer title="Cost composition" data={data}>
      <div className="flex items-center gap-4">
        <div className="h-40 w-40 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                {data.map((_, i) => (
                  <Cell key={i} fill={rampColor(i)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1 text-xs">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: rampColor(i) }}
              />
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
