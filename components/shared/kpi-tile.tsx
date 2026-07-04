import { AnimatedCounter } from "@/components/number/animated-counter";
import { DeltaPill } from "@/components/number/delta-pill";
import { cn } from "@/lib/utils";

/**
 * Portfolio-level metric tile. Larger and more prominent than Stat, for the
 * dashboard header row. Renders an optional delta and a supporting hint.
 */
export function KpiTile({
  label,
  valueMinor,
  currency,
  deltaMinor,
  baseMinor,
  hint,
  className,
}: {
  label: string;
  valueMinor: number;
  currency: string;
  deltaMinor?: number;
  baseMinor?: number;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className="num mt-2 flex items-baseline gap-2 text-3xl font-semibold">
        <span className="text-sm text-muted-foreground">{currency}</span>
        <AnimatedCounter valueMinor={valueMinor} />
      </div>
      {deltaMinor !== undefined && (
        <div className="mt-2">
          <DeltaPill deltaMinor={deltaMinor} baseMinor={baseMinor ?? valueMinor} />
        </div>
      )}
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
