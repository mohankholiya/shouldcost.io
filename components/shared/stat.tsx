import { AnimatedCounter } from "@/components/number/animated-counter";
import { DeltaPill } from "@/components/number/delta-pill";
import { Surface } from "@/components/ui/surface";

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
    <Surface padding="md">
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
    </Surface>
  );
}
