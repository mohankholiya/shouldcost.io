"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { ChartContainer } from "./chart-container";
import { tornado } from "@/lib/model/sensitivity";
import { buildTree } from "@/lib/model/tree";
import { formatCurrency } from "@/lib/format";
import { PETROL_600 } from "@/lib/chart-palette";
import type { CostNodeRow } from "@/lib/model/types";

export function TornadoChart({ nodes }: { nodes: CostNodeRow[] }) {
  const [pct, setPct] = useState(10);
  const bars = tornado(buildTree(nodes), pct).slice(0, 8);
  const data = bars.map((b) => ({ name: b.name, swing: b.swing / 100 }));

  return (
    <ChartContainer title="Driver sensitivity" data={data}>
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
        %
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
            <Bar dataKey="swing" fill={PETROL_600} radius={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-1 space-y-0.5 text-xs">
        {bars.map((b) => (
          <li key={b.nodeId} className="flex justify-between">
            <span>{b.name}</span>
            <span className="num text-muted-foreground">± {formatCurrency(b.swing, "USD")}</span>
          </li>
        ))}
      </ul>
    </ChartContainer>
  );
}
