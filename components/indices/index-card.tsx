import Link from "next/link";
import { IndexSparkline } from "@/components/models/charts/index-sparkline";
import { cn } from "@/lib/utils";
import { surfaceVariants } from "@/components/ui/surface";
import type { IndexWithSeries } from "@/lib/db/indices";

export function IndexCard({ index }: { index: IndexWithSeries }) {
  return (
    <Link
      href={`/indices/${index.code}`}
      className={cn(surfaceVariants({ padding: "md", elevation: "interactive" }), "block")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">{index.name}</div>
        <span className="text-xs text-muted-foreground">{index.currency}</span>
      </div>
      <div className="mt-2">
        <IndexSparkline series={index.series} unit={index.unit} />
      </div>
    </Link>
  );
}
