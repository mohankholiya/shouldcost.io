"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CurrencySelect, type Currency } from "@/components/number/currency-select";
import { toMinor, fromMinor } from "@/lib/money";
import { saveQuoteAction } from "@/lib/actions/quotes";
import type { QuoteWithLines } from "@/lib/db/quotes";

export type QuoteFormValues = {
  supplier_name: string;
  incoterm: string;
  payment_terms: string;
  quoted_total_major: number; // major units in the form; converted to minor on submit
};

export function QuoteForm({
  modelId,
  currency: modelCurrency,
  leafLines,
  initial,
  onSaved,
}: {
  modelId: string;
  currency: Currency;
  leafLines: { id: string; name: string }[];
  initial?: QuoteWithLines;
  onSaved: () => void;
}) {
  const [currency, setCurrency] = useState<Currency>(
    (initial?.currency as Currency) ?? modelCurrency,
  );
  const [lineMode, setLineMode] = useState(Boolean(initial?.lines.length));
  const [lineMajor, setLineMajor] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    for (const l of initial?.lines ?? [])
      if (l.cost_node_id) seed[l.cost_node_id] = fromMinor(l.amount, initial!.currency as Currency);
    return seed;
  });
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit } = useForm<QuoteFormValues>({
    defaultValues: {
      supplier_name: initial?.supplier_name ?? "",
      incoterm: initial?.incoterm ?? "",
      payment_terms: initial?.payment_terms ?? "",
      quoted_total_major: initial ? fromMinor(initial.quoted_total, initial.currency as Currency) : 0,
    },
  });

  async function onSubmit(v: QuoteFormValues) {
    setSaving(true);
    try {
      const lines = lineMode
        ? leafLines
            .filter((n) => lineMajor[n.id] != null && lineMajor[n.id] !== 0)
            .map((n) => ({
              cost_node_id: n.id,
              description: n.name,
              amount: toMinor(lineMajor[n.id]!, currency),
            }))
        : [];
      await saveQuoteAction({
        modelId,
        quoteId: initial?.id,
        supplier_name: v.supplier_name,
        currency,
        incoterm: v.incoterm || null,
        payment_terms: v.payment_terms || null,
        quoted_total: toMinor(Number(v.quoted_total_major) || 0, currency),
        lines,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="supplier_name">Supplier</Label>
          <Input id="supplier_name" {...register("supplier_name", { required: true })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quoted_total_major">Total ({currency})</Label>
          <Input
            id="quoted_total_major"
            type="number"
            step="0.01"
            className="num"
            {...register("quoted_total_major", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1">
          <Label>Currency</Label>
          <CurrencySelect value={currency} onChange={setCurrency} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="incoterm">Incoterm</Label>
          <Input id="incoterm" placeholder="e.g. DAP" {...register("incoterm")} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="payment_terms">Payment terms</Label>
          <Input id="payment_terms" placeholder="e.g. Net 30" {...register("payment_terms")} />
        </div>
      </div>

      <div className="rounded-md border border-hairline p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lineMode} onChange={(e) => setLineMode(e.target.checked)} />
          Enter line-by-line amounts (unlocks the per-line matrix &amp; waterfall)
        </label>
        {lineMode && (
          <div className="mt-3 space-y-2">
            {leafLines.map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-3">
                <span className="text-sm">{n.name}</span>
                <Input
                  type="number"
                  step="0.01"
                  className="num w-32"
                  aria-label={`Amount for ${n.name}`}
                  value={lineMajor[n.id] ?? ""}
                  onChange={(e) => setLineMajor((m) => ({ ...m, [n.id]: Number(e.target.value) }))}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save quote"}
      </Button>
    </form>
  );
}
