import { notFound } from "next/navigation";
import { loadModel } from "@/lib/db/models";
import { loadNodes } from "@/lib/db/nodes";
import { loadQuotes } from "@/lib/db/quotes";
import { CompareView } from "@/components/quotes/compare-view";
import type { Currency } from "@/components/number/currency-select";

export default async function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await loadModel(id);
  if (!model) notFound();
  const [nodes, quotes] = await Promise.all([loadNodes(id), loadQuotes(id)]);
  return (
    <CompareView
      modelId={model.id}
      modelName={model.name}
      currency={model.currency as Currency}
      nodes={nodes}
      quotes={quotes}
    />
  );
}
