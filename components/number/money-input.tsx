"use client";

import { Input } from "@/components/ui/input";
import { formatMinorInput } from "@/lib/money";

/**
 * Text input bound to integer minor units. Accepts a 2-decimal value and emits
 * the corresponding minor-unit integer. The single money chokepoint stays in
 * lib/money.ts; parsing here is intentionally thin.
 */
export function MoneyInput({
  valueMinor,
  currency,
  onChange,
}: {
  valueMinor: number;
  currency: string;
  onChange: (minor: number) => void;
}) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      className="num w-32 text-right"
      value={formatMinorInput(valueMinor)}
      aria-label={`amount in ${currency}`}
      onChange={(e) => {
        const minor = parseMinorInput(e.target.value);
        if (!Number.isNaN(minor)) onChange(minor);
      }}
    />
  );
}

/** "12.34" -> 1234 minor units (2-decimal assumption). */
function parseMinorInput(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
