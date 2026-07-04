import { notFound } from "next/navigation";
import { loadModel } from "@/lib/db/models";
import { loadNodes } from "@/lib/db/nodes";
import { loadIndicesWithLatest } from "@/lib/db/indices";
import { ModelEditor } from "@/components/models/model-editor";

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await loadModel(id);
  if (!model) notFound();
  const [nodes, indices] = await Promise.all([loadNodes(id), loadIndicesWithLatest()]);
  return <ModelEditor model={model} nodes={nodes} indices={indices} />;
}
