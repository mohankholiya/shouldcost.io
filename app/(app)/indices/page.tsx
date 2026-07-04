import { loadIndicesWithSeries } from "@/lib/db/indices";
import { PageHeader } from "@/components/shared/page-header";
import { IndexCard } from "@/components/indices/index-card";

export default async function IndicesPage() {
  const indices = await loadIndicesWithSeries();
  return (
    <>
      <PageHeader title="Commodity indices" subtitle="Benchmark rates that drive your models" />
      {indices.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline p-8 text-sm text-muted-foreground">
          No indices yet. Run <span className="num">pnpm seed</span> to populate benchmark indices.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {indices.map((i) => (
            <IndexCard key={i.code} index={i} />
          ))}
        </div>
      )}
    </>
  );
}
