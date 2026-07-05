"use client";

import { formatCurrency } from "@/lib/format";
import { DeltaPill } from "@/components/number/delta-pill";
import { Surface } from "@/components/ui/surface";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <Surface padding="none" className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">Line</TableHead>
            <TableHead className="h-auto px-3 py-2 text-right text-xs text-muted-foreground">
              Should-cost
            </TableHead>
            <TableHead className="h-auto px-3 py-2 text-right text-xs text-muted-foreground">
              Quoted
            </TableHead>
            <TableHead className="h-auto px-3 py-2 text-right text-xs text-muted-foreground">
              Gap
            </TableHead>
            <TableHead className="h-auto px-3 py-2 text-right text-xs text-muted-foreground">
              Δ%
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.nodeId}>
              <TableCell className="px-3 py-2">{r.name}</TableCell>
              <TableCell className="num px-3 py-2 text-right">
                {formatCurrency(r.shouldCost, currency)}
              </TableCell>
              <TableCell className="num px-3 py-2 text-right">
                {r.quoted === null ? "—" : formatCurrency(r.quoted, currency)}
              </TableCell>
              <TableCell className="num px-3 py-2 text-right">
                {r.gap === null ? "—" : formatCurrency(r.gap, currency)}
              </TableCell>
              <TableCell className="px-3 py-2 text-right">
                {r.gap === null ? "—" : <DeltaPill deltaMinor={r.gap} baseMinor={r.shouldCost} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell className="px-3 py-2">Total</TableCell>
            <TableCell className="num px-3 py-2 text-right">
              {formatCurrency(shouldCostTotal, currency)}
            </TableCell>
            <TableCell className="num px-3 py-2 text-right">
              {formatCurrency(quoteTotal, currency)}
            </TableCell>
            <TableCell className="num px-3 py-2 text-right">
              {formatCurrency(gapTotal, currency)}
            </TableCell>
            <TableCell className="px-3 py-2 text-right">
              <DeltaPill deltaMinor={gapTotal} baseMinor={shouldCostTotal} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Surface>
  );
}
