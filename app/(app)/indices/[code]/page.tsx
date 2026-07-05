import Link from "next/link";
import { notFound } from "next/navigation";
import { loadIndexByCode } from "@/lib/db/indices";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/ui/surface";
import { IndexSparkline } from "@/components/models/charts/index-sparkline";
import { formatIndexValue } from "@/lib/format";

export default async function IndexDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const index = await loadIndexByCode(code);
  if (!index) notFound();

  return (
    <>
      <PageHeader
        title={index.name}
        subtitle={`Latest ${formatIndexValue(index.latest, index.unit)} · ${index.currency}`}
      />
      <div className="space-y-6">
        <Surface padding="md">
          <IndexSparkline series={index.series} unit={index.unit} />
          {index.source_note && (
            <p className="mt-3 text-xs text-muted-foreground">{index.source_note}</p>
          )}
        </Surface>
        <div>
          <h3 className="mb-2 text-sm font-medium">Models using this index</h3>
          {index.usedBy.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No models in your workspace bind this index yet.
            </p>
          ) : (
            <Surface as="ul" padding="none" className="divide-y divide-hairline overflow-hidden">
              {index.usedBy.map((m) => (
                <li key={m.modelId}>
                  <Link
                    href={`/models/${m.modelId}`}
                    className="block px-4 py-2 text-sm hover:bg-accent"
                  >
                    {m.modelName}
                  </Link>
                </li>
              ))}
            </Surface>
          )}
        </div>
      </div>
    </>
  );
}
