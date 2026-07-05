"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { deleteQuoteAction } from "@/lib/actions/quotes";
import type { QuoteWithLines } from "@/lib/db/quotes";
import type { Currency } from "@/components/number/currency-select";
import { cn } from "@/lib/utils";

export function QuoteList({
  quotes,
  activeId,
  currency,
  onSelect,
  onEdit,
  onDeleted,
}: {
  quotes: QuoteWithLines[];
  activeId: string | null;
  currency: Currency;
  onSelect: (id: string) => void;
  onEdit: (q: QuoteWithLines) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  async function remove(id: string) {
    setBusy(id);
    try {
      await deleteQuoteAction({ quoteId: id });
      onDeleted();
    } finally {
      setBusy(null);
    }
  }
  return (
    <ul className="space-y-2">
      {quotes.map((q) => (
        <li
          key={q.id}
          className={cn(
            "flex items-center justify-between rounded-md border px-3 py-2",
            q.id === activeId ? "border-foreground/30 bg-card" : "border-hairline",
          )}
        >
          <button className="text-left" onClick={() => onSelect(q.id)}>
            <div className="text-sm font-medium">{q.supplier_name}</div>
            <div className="num text-xs text-muted-foreground">
              {formatCurrency(q.quoted_total, (q.currency as Currency) ?? currency)}
              {q.lines.length > 0 && ` · ${q.lines.length} lines`}
            </div>
          </button>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onEdit(q)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" disabled={busy === q.id} onClick={() => remove(q.id)}>
              Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
