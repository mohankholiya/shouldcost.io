import { AnimatedCounter } from "@/components/number/animated-counter";
import { DeltaPill } from "@/components/number/delta-pill";

export function Stat({
  label,
  valueMinor,
  currency,
  deltaMinor,
}: {
  label: string;
  valueMinor: number;
  currency: string;
  deltaMinor?: number;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="num mt-1 text-2xl font-semibold">
        <AnimatedCounter valueMinor={valueMinor} />
      </div>
      {deltaMinor !== undefined && (
        <div className="mt-1">
          <DeltaPill deltaMinor={deltaMinor} baseMinor={valueMinor} />
        </div>
      )}
      <div className="mt-1 text-[10px] text-muted-foreground">
        all values in {currency} · illustrative
      </div>
    </div>
  );
}
