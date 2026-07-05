"use client";

import { Button } from "@/components/ui/button";

export type Density = "comfortable" | "compact";

/** Compact is the cost-engineer default; comfortable suits review/presentation. */
export function DensityToggle({
  value,
  onChange,
}: {
  value: Density;
  onChange: (d: Density) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-hairline">
      {(["comfortable", "compact"] as const).map((d) => (
        <Button
          key={d}
          variant={value === d ? "default" : "ghost"}
          size="sm"
          className="rounded-none"
          onClick={() => onChange(d)}
        >
          {d === "compact" ? "Compact" : "Comfortable"}
        </Button>
      ))}
    </div>
  );
}
