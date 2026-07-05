"use client";

import { formatCurrency } from "@/lib/format";
import { DeltaPill } from "@/components/number/delta-pill";
import type { Comparison } from "@/lib/model/comparison";
import type { Currency } from "@/components/number/currency-select";

export function ComparisonMatrix({
  comparison,
  currency,
}: {
  comparison: Comparison;
  currency: Currency;
}) {
  const { rows, shouldCostTotal, quoteTotal, gapTotal } = comparison;
  return (
    <div className="overflow-x-auto rounded-md border border-hairline">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Line</th>
            <th className="px-3 py-2 text-right font-medium">Should-cost</th>
            <th className="px-3 py-2 text-right font-medium">Quoted</th>
            <th className="px-3 py-2 text-right font-medium">Gap</th>
            <th className="px-3 py-2 text-right font-medium">Δ%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.nodeId} className="border-b border-hairline last:border-0">
              <td className="px-3 py-2">{r.name}</td>
              <td className="num px-3 py-2 text-right">{formatCurrency(r.shouldCost, currency)}</td>
              <td className="num px-3 py-2 text-right">
                {r.quoted === null ? "—" : formatCurrency(r.quoted, currency)}
              </td>
              <td className="num px-3 py-2 text-right">
                {r.gap === null ? "—" : formatCurrency(r.gap, currency)}
              </td>
              <td className="px-3 py-2 text-right">
                {r.gap === null ? "—" : <DeltaPill deltaMinor={r.gap} baseMinor={r.shouldCost} />}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-hairline font-medium">
            <td className="px-3 py-2">Total</td>
            <td className="num px-3 py-2 text-right">{formatCurrency(shouldCostTotal, currency)}</td>
            <td className="num px-3 py-2 text-right">{formatCurrency(quoteTotal, currency)}</td>
            <td className="num px-3 py-2 text-right">{formatCurrency(gapTotal, currency)}</td>
            <td className="px-3 py-2 text-right">
              <DeltaPill deltaMinor={gapTotal} baseMinor={shouldCostTotal} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
