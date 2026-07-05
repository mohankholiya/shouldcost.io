import type { Comparison } from "@/lib/model/comparison";
import type { Currency } from "@/components/number/currency-select";
import { formatCurrency } from "@/lib/format";

export type InsightCard = {
  id: string;
  severity: "lever" | "info" | "concede";
  title: string;
  detail: string;
};

const LEVER_PCT = 10; // tunable: a line quoted >10% over should-cost is a lever

export function evaluateInsights(c: Comparison, currency: Currency): InsightCard[] {
  const cards: InsightCard[] = [];
  const money = (m: number) => formatCurrency(m, currency);

  // 1. Headline gap — always present.
  const above = c.gapTotal >= 0;
  cards.push({
    id: "headline",
    severity: above ? "lever" : "info",
    title: `Quote is ${Math.abs(c.gapPct).toFixed(1)}% ${above ? "above" : "below"} should-cost`,
    detail: `Total gap of ${money(c.gapTotal)} across ${c.rows.length} line${c.rows.length === 1 ? "" : "s"}.`,
  });

  // 2. Top over-quoted lines (levers), up to 3, largest absolute gap first.
  const levers = c.rows
    .filter((r) => r.gapPct !== null && r.gapPct > LEVER_PCT && r.gap !== null)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))
    .slice(0, 3);
  for (const r of levers) {
    cards.push({
      id: `lever-${r.nodeId}`,
      severity: "lever",
      title: `${r.name} is ${r.gapPct!.toFixed(1)}% over`,
      detail: `Quoted ${money(r.quoted!)} vs should-cost ${money(r.shouldCost)} — primary negotiation lever.`,
    });
  }

  // 3. Favorable lines (quote below should-cost) → concede.
  for (const r of c.rows.filter((r) => r.gap !== null && r.gap < 0)) {
    cards.push({
      id: `concede-${r.nodeId}`,
      severity: "concede",
      title: `${r.name} is competitive`,
      detail: `Quoted ${money(r.quoted!)}, below should-cost ${money(r.shouldCost)} — concede here to trade for levers.`,
    });
  }

  // 4. Implied margin — a leaf line whose name mentions "margin".
  const margin = c.rows.find((r) => /margin/i.test(r.name));
  if (margin && c.shouldCostTotal !== 0) {
    const share = (margin.shouldCost / c.shouldCostTotal) * 100;
    cards.push({
      id: "margin",
      severity: "info",
      title: `Margin is ${share.toFixed(1)}% of should-cost`,
      detail:
        margin.quoted !== null
          ? `Supplier prices margin at ${money(margin.quoted)} vs ${money(margin.shouldCost)}.`
          : `Supplier did not itemise margin; benchmark against ${money(margin.shouldCost)}.`,
    });
  }

  return cards;
}
