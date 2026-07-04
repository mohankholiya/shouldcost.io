"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ChartContainer } from "./chart-container";
import { buildTree } from "@/lib/model/tree";
import { formatCurrency } from "@/lib/format";
import type { CostNodeRow, Rollup } from "@/lib/model/types";

const COLORS = ["#0b3c5d", "#3c6f95", "#5e90b3", "#8fb6cf", "#bcd3e3", "#f59e0b", "#059669"];

export type Slice = { name: string; value: number };

/** Composition by top-level node (group or line), minor units, positive only. */
export function donutData(nodes: CostNodeRow[], rollup: Rollup): Slice[] {
  const tree = buildTree(nodes);
  return tree.roots
    .map((n) => ({ name: n.name, value: rollup.byNodeId[n.id] ?? 0 }))
    .filter((d) => d.value > 0);
}

export function RollupDonut({ nodes, rollup }: { nodes: CostNodeRow[]; rollup: Rollup }) {
  const data = donutData(nodes, rollup);
  const total = rollup.total || 1;
  return (
    <ChartContainer title="Cost composition" data={data}>
      <div className="flex items-center gap-4">
        <div className="h-40 w-40 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span>{d.name}</span>
              <span className="num text-muted-foreground">
                {formatCurrency(d.value, "USD")} · {Math.round((d.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartContainer>
  );
}
