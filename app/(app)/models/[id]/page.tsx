import { notFound } from "next/navigation";
import { loadModel } from "@/lib/db/models";
import { loadNodes } from "@/lib/db/nodes";
import { loadIndicesWithLatest } from "@/lib/db/indices";
import { loadVersions } from "@/lib/db/versions";
import { ModelEditor } from "@/components/models/model-editor";

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await loadModel(id);
  if (!model) notFound();
  const [nodes, indices, versions] = await Promise.all([
    loadNodes(id),
    loadIndicesWithLatest(),
    loadVersions(id),
  ]);
  return <ModelEditor model={model} nodes={nodes} indices={indices} versions={versions} />;
}
