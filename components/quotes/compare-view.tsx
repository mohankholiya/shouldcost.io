"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QuoteList } from "@/components/quotes/quote-list";
import { QuoteForm } from "@/components/quotes/quote-form";
import { ComparisonMatrix } from "@/components/quotes/comparison-matrix";
import { GapWaterfall } from "@/components/quotes/gap-waterfall";
import { InsightCards } from "@/components/quotes/insight-cards";
import { buildComparison } from "@/lib/model/comparison";
import { rollupLive } from "@/lib/model/rollup-live";
import { buildTree } from "@/lib/model/tree";
import type { CostNodeRow } from "@/lib/model/types";
import type { QuoteWithLines } from "@/lib/db/quotes";
import type { Currency } from "@/components/number/currency-select";

export function CompareView({
  modelId,
  modelName,
  currency,
  nodes,
  quotes,
}: {
  modelId: string;
  modelName: string;
  currency: Currency;
  nodes: CostNodeRow[];
  quotes: QuoteWithLines[];
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(quotes[0]?.id ?? null);
  const [editing, setEditing] = useState<QuoteWithLines | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const rollup = useMemo(() => rollupLive(buildTree(nodes)), [nodes]);
  const leafLines = useMemo(
    () =>
      buildComparison(nodes, rollup, { quoted_total: 0, lines: [] }).rows.map((r) => ({
        id: r.nodeId,
        name: r.name,
      })),
    [nodes, rollup],
  );
  const active = quotes.find((q) => q.id === activeId) ?? null;
  const comparison = active ? buildComparison(nodes, rollup, active) : null;

  function refresh() {
    setOpen(false);
    setEditing(undefined);
    router.refresh();
  }

  const addButton = (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setEditing(undefined);
      }}
    >
      <DialogTrigger asChild>
        <Button onClick={() => setEditing(undefined)}>Add quote</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit quote" : "Add supplier quote"}</DialogTitle>
        </DialogHeader>
        <QuoteForm
          modelId={modelId}
          currency={currency}
          leafLines={leafLines}
          initial={editing}
          onSaved={refresh}
        />
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={modelName} subtitle="Quotes &amp; comparison" actions={addButton} />

      {quotes.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          steps={[
            "Add your first supplier quote (total, or line-by-line)",
            "See it compared against your should-cost, line by line",
            "Use the gap waterfall and insight cards to prepare the negotiation",
          ]}
          cta={addButton}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <QuoteList
            quotes={quotes}
            activeId={activeId}
            currency={currency}
            onSelect={setActiveId}
            onEdit={(q) => {
              setEditing(q);
              setOpen(true);
            }}
            onDeleted={refresh}
          />
          {comparison && (
            <div className="space-y-6">
              <ComparisonMatrix comparison={comparison} currency={currency} />
              <div className="grid gap-4 lg:grid-cols-2">
                <GapWaterfall comparison={comparison} currency={currency} />
                <InsightCards comparison={comparison} currency={currency} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
