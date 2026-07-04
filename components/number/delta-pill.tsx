import { cn } from "@/lib/utils";

/**
 * A positive delta means the quote sits above the should-cost baseline — a
 * buyer-favorable negotiation lever — so it reads green (favor). A negative
 * delta reads amber.
 */
export function DeltaPill({ deltaMinor, baseMinor }: { deltaMinor: number; baseMinor: number }) {
  const sign = deltaMinor >= 0 ? "+" : "-";
  const favorable = deltaMinor >= 0;
  const pct = baseMinor !== 0 ? Math.abs((deltaMinor / baseMinor) * 100) : 0;
  return (
    <span
      className={cn(
        "num inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium",
        favorable ? "text-favor" : "text-amber",
      )}
    >
      {sign}
      {pct.toFixed(1)}%
    </span>
  );
}
