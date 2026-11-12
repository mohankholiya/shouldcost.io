import { Skeleton } from "@/components/ui/skeleton";

/** Editor-shaped placeholder: header, CBS grid rows, then the two charts. */
export default function ModelLoading() {
  return (
    <div aria-busy="true" aria-label="Loading model" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-64" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="space-y-1.5 rounded-lg border border-hairline p-3">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" style={{ opacity: 1 - i * 0.07 }} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
    </div>
  );
}
